#!/usr/bin/env python3
"""
Extract a real F1 session via FastF1 into a compact replay file for the dashboard.

This is the same data source the f1-race-replay project uses (https://github.com/IAmTomShaw/f1-race-replay):
the public FastF1 library. We pull a real race and flatten it into numeric, columnar
frames that scripts/mock-realtime.mjs can stream over SSE in this fork's shape
(initial + update events; DriverList / TimingData / CarDataZ / PositionZ / ...).

The Node replay server stays dumb: it expands lap-fraction -> Sectors[].Segments[]
(which is what this fork's Map uses to place cars — not raw GPS) and zlib-deflates
CarDataZ / PositionZ at emit time. All interpolation / running-order / gap logic lives
here in pandas where it's cheap and correct.

Usage:
  python scripts/extract-fastf1.py --year 2026 --gp Austria --session R \
      --out scripts/replay-data/austria-2026.json [--step 1.0]

Requires: pip install fastf1
"""
import argparse, json, math, os, sys

import numpy as np
import pandas as pd
import fastf1


def s(td):
	"""timedelta-ish -> float seconds (NaN-safe)."""
	if td is None:
		return math.nan
	try:
		if pd.isna(td):
			return math.nan
	except (TypeError, ValueError):
		pass
	if isinstance(td, (int, float)):
		return float(td)
	return float(pd.Timedelta(td).total_seconds())


def fmt_lap(ms):
	if ms is None or (isinstance(ms, float) and math.isnan(ms)) or ms <= 0:
		return ""
	total = ms / 1000.0
	m = int(total // 60)
	rem = total - m * 60
	return f"{m}:{rem:06.3f}" if m else f"{rem:.3f}"


def sum_points_through(year, last_round):
	"""Fallback championship: sum race-result points across rounds 1..last_round.
	(Race points only — no sprint points; the Ergast path is preferred.)"""
	totals = {}
	for rnd in range(1, max(last_round, 0) + 1):
		try:
			ssn = fastf1.get_session(year, rnd, "R")
			ssn.load(telemetry=False, weather=False, messages=False)
			for _, rr in ssn.results.iterrows():
				num = str(rr["DriverNumber"])
				totals[num] = totals.get(num, 0.0) + (float(rr["Points"]) if not pd.isna(rr["Points"]) else 0.0)
		except Exception:
			pass
	return totals


def main():
	ap = argparse.ArgumentParser()
	ap.add_argument("--year", type=int, required=True)
	ap.add_argument("--gp", required=True, help="event name or location, e.g. Austria")
	ap.add_argument("--session", default="R")
	ap.add_argument("--out", required=True)
	ap.add_argument("--step", type=float, default=1.0, help="frame step in session-seconds")
	ap.add_argument("--max-frames", type=int, default=6000)
	ap.add_argument("--cache", default=None)
	args = ap.parse_args()

	cache = args.cache or os.path.join(os.path.dirname(os.path.abspath(args.out)), ".ff1cache")
	os.makedirs(cache, exist_ok=True)
	fastf1.Cache.enable_cache(cache)

	ses = fastf1.get_session(args.year, args.gp, args.session)
	ses.load(telemetry=True, weather=True, messages=True)

	info = ses.session_info
	meeting = info["Meeting"]
	total_laps = int(ses.total_laps)
	gmt_seconds = int(pd.Timedelta(info["GmtOffset"]).total_seconds())
	gmt_h = gmt_seconds // 3600
	gmt_str = f"{gmt_h:+03d}:{abs(gmt_seconds)//60 % 60:02d}:00"

	results = ses.results
	laps = ses.laps

	# ---- Driver list (DriverList shape) ------------------------------------
	drivers = {}
	grid_pos = {}
	for _, r in results.iterrows():
		num = str(r["DriverNumber"])
		full = str(r["FullName"])
		first, last = str(r["FirstName"]), str(r["LastName"])
		drivers[num] = {
			"RacingNumber": num,
			"BroadcastName": str(r["BroadcastName"]),
			"FullName": full,
			"Tla": str(r["Abbreviation"]),
			"Line": int(r["Position"]) if not pd.isna(r["Position"]) else 99,
			"TeamName": str(r["TeamName"]),
			"TeamColour": str(r["TeamColor"]),
			"FirstName": first,
			"LastName": last,
			"Reference": f"{last.upper()}01",
			"HeadshotUrl": "" if pd.isna(r["HeadshotUrl"]) else str(r["HeadshotUrl"]),
			"CountryCode": "" if pd.isna(r["CountryCode"]) else str(r["CountryCode"]),
		}
		grid_pos[num] = int(r["GridPosition"]) if not pd.isna(r["GridPosition"]) else 99

	nums = list(drivers.keys())

	# ---- Per-driver lap tables --------------------------------------------
	# For each driver build arrays describing each completed lap so we can
	# derive lap/fraction/position/gap/last-lap/sectors at any session time.
	dl = {}
	race_start = math.inf
	race_end = 0.0
	for num in nums:
		d = laps.pick_drivers(num).sort_values("LapNumber")
		rows = []
		for _, lp in d.iterrows():
			ls = s(lp["LapStartTime"])
			te = s(lp["Time"])
			rows.append({
				"lap": int(lp["LapNumber"]) if not pd.isna(lp["LapNumber"]) else 0,
				"ls": ls,
				"te": te,
				"laptime": s(lp["LapTime"]) * 1000 if not math.isnan(s(lp["LapTime"])) else math.nan,
				"position": int(lp["Position"]) if not pd.isna(lp["Position"]) else None,
				"s1": s(lp["Sector1Time"]),
				"s2": s(lp["Sector2Time"]),
				"s3": s(lp["Sector3Time"]),
				"spI1": lp["SpeedI1"],
				"spI2": lp["SpeedI2"],
				"spFL": lp["SpeedFL"],
				"spST": lp["SpeedST"],
				"compound": None if pd.isna(lp["Compound"]) else str(lp["Compound"]),
				"stint": int(lp["Stint"]) if not pd.isna(lp["Stint"]) else 1,
				"tyrelife": int(lp["TyreLife"]) if not pd.isna(lp["TyreLife"]) else 0,
				"pitin": s(lp["PitInTime"]),
				"pitout": s(lp["PitOutTime"]),
			})
		dl[num] = rows
		for r in rows:
			if not math.isnan(r["te"]):
				race_end = max(race_end, r["te"])
			if r["lap"] == 1 and not math.isnan(r["ls"]):
				race_start = min(race_start, r["ls"])
	if not math.isfinite(race_start):
		race_start = 0.0

	# Frame grid (session seconds)
	step = args.step
	span = race_end - race_start
	if span / step > args.max_frames:
		step = span / args.max_frames
	frame_t = np.arange(race_start, race_end + step, step)
	if len(frame_t) > args.max_frames:
		frame_t = frame_t[: args.max_frames]
	F = len(frame_t)

	# ---- Interpolate continuous telemetry onto the frame grid --------------
	def interp(num, df, col, default=0.0):
		if num not in df:
			return np.full(F, default)
		t = df[num]["SessionTime"].dt.total_seconds().to_numpy()
		v = pd.to_numeric(df[num][col], errors="coerce").to_numpy(dtype=float)
		ok = ~np.isnan(t) & ~np.isnan(v)
		if ok.sum() < 2:
			return np.full(F, default)
		return np.interp(frame_t, t[ok], v[ok])

	car = ses.car_data
	pos = ses.pos_data

	# precompute per-driver continuous channels
	chan = {}
	for num in nums:
		chan[num] = {
			"x": interp(num, pos, "X"),
			"y": interp(num, pos, "Y"),
			"spd": interp(num, car, "Speed"),
			"rpm": interp(num, car, "RPM"),
			"gear": interp(num, car, "nGear"),
			"thr": interp(num, car, "Throttle"),
			"brk": interp(num, car, "Brake"),
			"drs": interp(num, car, "DRS"),
		}

	# ---- Per-frame derived fields -----------------------------------------
	# helper: for a driver at time t, find current lap index, fraction, completed laps
	def lap_state(rows, t):
		# returns (lapnum, fraction, completed_laps, last_completed_row)
		completed = 0
		last = None
		for r in rows:
			te = r["te"]
			ls = r["ls"]
			# fill missing lap1 start with race_start
			if r["lap"] == 1 and math.isnan(ls):
				ls = race_start
			if not math.isnan(te) and t >= te:
				completed = r["lap"]
				last = r
				continue
			# in progress?
			if not math.isnan(ls) and ls <= t and (math.isnan(te) or t < te):
				frac = 0.0
				if not math.isnan(te) and te > ls:
					frac = (t - ls) / (te - ls)
				return r["lap"], min(max(frac, 0.0), 1.0), completed, last
		# after last lap -> frozen at end
		if last is not None:
			return last["lap"], 1.0, completed, last
		return 1, 0.0, 0, None

	# cumulative session time at each lap line, per driver, for gaps
	cumT = {num: {r["lap"]: r["te"] for r in dl[num] if not math.isnan(r["te"])} for num in nums}

	out_drivers = {num: {k: [] for k in (
		"pos", "gap", "intv", "last", "best", "lap", "frac",
		"x", "y", "spd", "rpm", "gear", "thr", "brk", "drs",
		"pit", "ret", "s1", "s2", "s3", "spI1", "spI2", "spFL", "spST",
		"comp", "stint", "tyre")} for num in nums}

	best_so_far = {num: math.inf for num in nums}
	final_status = {str(r["DriverNumber"]): str(r["Status"]) for _, r in results.iterrows()}

	for fi, t in enumerate(frame_t):
		prog = {}  # progress for ordering
		state = {}
		for num in nums:
			rows = dl[num]
			lapnum, frac, completed, last = lap_state(rows, t)
			# retired? after last recorded lap and status not a finisher
			last_te = max([r["te"] for r in rows if not math.isnan(r["te"])], default=math.nan)
			st = final_status.get(num, "")
			finisher = st in ("Finished",) or st.startswith("+") or st == "Lapped"
			retired = (not finisher) and (not math.isnan(last_te)) and t > last_te + 1.0
			state[num] = (lapnum, frac, completed, last, retired)
			prog[num] = -1 if retired else (completed + frac)

		# running order: by progress desc; retired sink to back by their completed laps
		order = sorted(nums, key=lambda n: (prog[n] if prog[n] >= 0 else -1000 + state[n][2]), reverse=True)
		leader = order[0]
		leader_completed = state[leader][2]

		for idx, num in enumerate(order):
			lapnum, frac, completed, last, retired = state[num]
			ch = chan[num]
			# gap to leader (at line) + interval to car ahead
			if idx == 0:
				gap = ""
				intv = ""
			else:
				lead_laps = leader_completed
				my_laps = completed
				if my_laps >= lead_laps and lead_laps in cumT[num] and lead_laps in cumT[leader]:
					gsec = cumT[num][lead_laps] - cumT[leader][lead_laps]
					gap = f"+{gsec:.3f}" if gsec > 0 else ""
				else:
					dl_laps = lead_laps - my_laps
					gap = f"+{dl_laps} L" if dl_laps > 0 else ""
				ahead = order[idx - 1]
				a_laps = state[ahead][2]
				if my_laps == a_laps and my_laps in cumT[num] and my_laps in cumT[ahead]:
					isec = cumT[num][my_laps] - cumT[ahead][my_laps]
					intv = f"+{isec:.3f}" if isec > 0 else ""
				else:
					di = a_laps - my_laps
					intv = f"+{di} L" if di > 0 else ""

			# last lap / best
			lastlap = last["laptime"] if last else math.nan
			if last and not math.isnan(last["laptime"]) and last["laptime"] < best_so_far[num]:
				best_so_far[num] = last["laptime"]
			best = best_so_far[num] if math.isfinite(best_so_far[num]) else math.nan

			# pit detection
			inpit = 0
			cur = last
			# find row for current lap
			cur_row = next((r for r in dl[num] if r["lap"] == lapnum), last)
			if cur_row:
				pi, po = cur_row["pitin"], cur_row["pitout"]
				if (not math.isnan(pi) and t >= pi and (math.isnan(po) or t <= po + 25)) or (
					not math.isnan(po) and abs(t - po) < 8):
					inpit = 1

			src = last if last else (dl[num][0] if dl[num] else None)
			def gv(key, mult=1.0, asint=False):
				if not src or src.get(key) is None:
					return ""
				v = src[key]
				try:
					if pd.isna(v):
						return ""
				except (TypeError, ValueError):
					pass
				return str(int(round(float(v) * mult))) if asint else f"{float(v)*mult:.3f}"

			od = out_drivers[num]
			od["pos"].append(idx + 1)
			od["gap"].append(gap)
			od["intv"].append(intv)
			od["last"].append(round(lastlap) if not math.isnan(lastlap) else 0)
			od["best"].append(round(best) if not math.isnan(best) else 0)
			od["lap"].append(int(lapnum))
			od["frac"].append(round(float(frac), 4))
			od["x"].append(int(round(ch["x"][fi])))
			od["y"].append(int(round(ch["y"][fi])))
			od["spd"].append(int(round(ch["spd"][fi])))
			od["rpm"].append(int(round(ch["rpm"][fi])))
			od["gear"].append(int(round(ch["gear"][fi])))
			od["thr"].append(int(round(ch["thr"][fi])))
			od["brk"].append(1 if ch["brk"][fi] > 0.5 else 0)
			# DRS (channel 45): dashboard reads drs>9 = active, drs===8 = eligible.
			# Use the real FastF1 DRS channel when present; otherwise (it's all-zero
			# for some sessions) DERIVE a believable indicator from real telemetry:
			# eligible = within ~1s of the car ahead at racing speed (lap>=3, not in
			# pit); active = eligible AND on a straight (full throttle, high speed,
			# off the brakes).
			raw_drs = ch["drs"][fi]
			if raw_drs >= 6:
				drs_code = 12 if raw_drs >= 9 else 8
			else:
				gap_ahead = None
				if intv.startswith("+") and "L" not in intv:
					try:
						gap_ahead = float(intv[1:])
					except ValueError:
						gap_ahead = None
				eligible = (
					gap_ahead is not None and 0 < gap_ahead <= 1.0
					and lapnum >= 3 and not inpit and not retired
				)
				active = eligible and ch["thr"][fi] >= 95 and ch["spd"][fi] >= 250 and ch["brk"][fi] < 0.5
				drs_code = 12 if active else (8 if eligible else 0)
			od["drs"].append(drs_code)
			od["pit"].append(inpit)
			od["ret"].append(1 if retired else 0)
			od["s1"].append(gv("s1"))
			od["s2"].append(gv("s2"))
			od["s3"].append(gv("s3"))
			od["spI1"].append(gv("spI1", asint=True))
			od["spI2"].append(gv("spI2", asint=True))
			od["spFL"].append(gv("spFL", asint=True))
			od["spST"].append(gv("spST", asint=True))
			od["comp"].append((src["compound"] if src and src["compound"] else "MEDIUM"))
			od["stint"].append(src["stint"] if src else 1)
			od["tyre"].append(src["tyrelife"] if src else 0)

	# leader lap per frame (for LapCount)
	leader_lap = []
	for fi in range(F):
		leader_lap.append(max((out_drivers[n]["lap"][fi] for n in nums), default=1))

	# ---- Weather (keyed by session-time ms) -------------------------------
	weather = []
	for _, w in ses.weather_data.iterrows():
		weather.append({
			"tMs": int(s(w["Time"]) * 1000),
			"AirTemp": str(w["AirTemp"]), "Humidity": str(w["Humidity"]),
			"Pressure": str(w["Pressure"]), "Rainfall": "1" if w["Rainfall"] else "0",
			"TrackTemp": str(w["TrackTemp"]), "WindDirection": str(int(w["WindDirection"])),
			"WindSpeed": str(w["WindSpeed"]),
		})

	# ---- Race control messages (keyed by session-time ms) -----------------
	# RC Time is wall-clock; convert to session ms via offset from first lap.
	rc = []
	# Build a wall->session mapping using lap LapStartDate vs LapStartTime where available
	ref = None
	for num in nums:
		d = laps.pick_drivers(num)
		for _, lp in d.iterrows():
			if not pd.isna(lp["LapStartDate"]) and not pd.isna(lp["LapStartTime"]):
				ref = (pd.Timestamp(lp["LapStartDate"]), s(lp["LapStartTime"]))
				break
		if ref:
			break
	for _, m in ses.race_control_messages.iterrows():
		tms = None
		if ref is not None and not pd.isna(m["Time"]):
			tms = int((pd.Timestamp(m["Time"]) - ref[0]).total_seconds() * 1000 + ref[1] * 1000)
		rc.append({
			"tMs": tms,
			"Lap": int(m["Lap"]) if not pd.isna(m["Lap"]) else 0,
			"Category": str(m["Category"]) if not pd.isna(m["Category"]) else "Other",
			"Message": str(m["Message"]),
			"Flag": None if pd.isna(m["Flag"]) else str(m["Flag"]),
			"Scope": None if pd.isna(m["Scope"]) else str(m["Scope"]),
			"Sector": int(m["Sector"]) if not pd.isna(m["Sector"]) else None,
			"Status": None if pd.isna(m["Status"]) else str(m["Status"]),
		})

	# ---- Championship standings (for the post-race summary) ---------------
	# REAL season standings: current = after the prior round; predicted = current
	# points + this race's points, re-ranked. The summary shows the ▲/▼ change and
	# the post-race points — i.e. the championship impact of this race, NOT the race
	# result (which is the classification on the left of the summary).
	round_no = int(ses.event["RoundNumber"])
	race_points = {
		str(r["DriverNumber"]): (float(r["Points"]) if not pd.isna(r["Points"]) else 0.0)
		for _, r in results.iterrows()
	}
	current_points, current_pos = {}, {}
	try:
		from fastf1.ergast import Ergast
		standings = Ergast().get_driver_standings(season=args.year, round=max(round_no - 1, 1)).content[0]
		for _, srow in standings.iterrows():
			if pd.isna(srow["driverNumber"]):
				continue
			num = str(int(srow["driverNumber"]))
			current_points[num] = float(srow["points"])
			current_pos[num] = int(srow["position"])
		champ_source = f"ergast standings after round {round_no - 1}"
	except Exception as ex:
		print(f"  ergast standings unavailable ({ex!r}); summing per-round results")
		current_points = sum_points_through(args.year, round_no - 1)
		ranked = sorted(current_points.items(), key=lambda kv: kv[1], reverse=True)
		current_pos = {num: i + 1 for i, (num, _) in enumerate(ranked)}
		champ_source = f"summed results rounds 1..{round_no - 1}"

	# Drivers in this race missing from prior standings (rookies / no points yet).
	max_pos = max(current_pos.values(), default=0)
	for num in nums:
		if num not in current_points:
			max_pos += 1
			current_points[num] = 0.0
			current_pos[num] = max_pos

	# Predicted = current + this race's points, re-ranked over all known drivers
	# (so positions stay correct even for any driver who skipped this race).
	predicted_points = {num: current_points.get(num, 0.0) + race_points.get(num, 0.0) for num in current_points}
	pred_ranked = sorted(predicted_points.items(), key=lambda kv: kv[1], reverse=True)
	predicted_pos = {num: i + 1 for i, (num, _) in enumerate(pred_ranked)}

	champ_drivers = {}
	for num in nums:
		champ_drivers[num] = {
			"RacingNumber": num,
			"CurrentPosition": current_pos.get(num, 99),
			"PredictedPosition": predicted_pos.get(num, 99),
			"CurrentPoints": int(round(current_points.get(num, 0.0))),
			"PredictedPoints": int(round(predicted_points.get(num, 0.0))),
		}
	print(f"  championship: {champ_source}")

	out = {
		"meta": {
			"year": args.year,
			"event": meeting["Name"],
			"officialName": meeting.get("OfficialName", meeting["Name"]),
			"location": meeting.get("Location", ""),
			"country": {"Key": meeting["Country"].get("Key", 0), "Code": meeting["Country"]["Code"], "Name": meeting["Country"]["Name"]},
			"circuitKey": meeting["Circuit"]["Key"],
			"circuitShortName": meeting["Circuit"]["ShortName"],
			"meetingKey": meeting["Key"],
			"sessionKey": info["Key"],
			"sessionType": info["Type"],
			"sessionName": info["Name"],
			"path": info["Path"],
			"gmtOffset": gmt_str,
			"totalLaps": total_laps,
			"stepMs": int(step * 1000),
			"frames": F,
		},
		"drivers": drivers,
		"gridPos": grid_pos,
		"frameTms": [int(t * 1000) for t in frame_t],
		"leaderLap": leader_lap,
		"driverFrames": out_drivers,
		"weather": weather,
		"raceControl": rc,
		"championship": {"Drivers": champ_drivers, "Teams": {}},
	}

	os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
	with open(args.out, "w", encoding="utf-8") as f:
		json.dump(out, f, separators=(",", ":"))
	size = os.path.getsize(args.out)
	print(f"wrote {args.out}  ({size/1e6:.1f} MB)  frames={F} step={step:.2f}s drivers={len(nums)} totalLaps={total_laps}")
	winner_num = str(results.sort_values("Position").iloc[0]["DriverNumber"])
	print(f"winner: {drivers[winner_num]['FullName']}")


if __name__ == "__main__":
	main()
