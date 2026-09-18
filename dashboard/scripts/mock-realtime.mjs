// Mock realtime backend for local testing of the live dashboard.
//
// Replaces the Rust `realtime` service: serves an SSE stream on
// http://localhost:4000/api/realtime matching the shape useSocket.ts expects
// (an `initial` event with full state, then periodic `update` events).
//
// Dependency-free — uses only Node built-ins (http, zlib).
//
// Usage:
//   node scripts/mock-realtime.mjs                 # SessionStatus "Inactive" (use with ?testCountdown=1)
//   node scripts/mock-realtime.mjs --status=started # auto-switches the dashboard to live via SSE (~3s)
//
// To see the countdown → live flow end to end:
//   1. node scripts/mock-realtime.mjs
//   2. open http://localhost:3000/dashboard?testCountdown=1

import http from "node:http";
import zlib from "node:zlib";
import fs from "node:fs";

const PORT = 4000;

// ---- Replay mode -----------------------------------------------------------
// `--replay=<file.json>` streams a real session captured by scripts/extract-fastf1.py
// (FastF1 data) instead of the synthetic feed. `--speed=N` plays N× session-time
// per real second (default 8). `--start=SECONDS` jumps into the race. `--loop`
// restarts at the end instead of going Finished.
const replayArg = process.argv.find((a) => a.startsWith("--replay="));
if (replayArg) {
	runReplayServer(replayArg.split("=")[1]);
} else {
	runSyntheticServer();
}

function runReplayServer(file) {
	const SECTOR_SEGMENTS = [7, 9, 8];
	const TOTAL_SEGMENTS = SECTOR_SEGMENTS.reduce((a, b) => a + b, 0);
	const speedArg = process.argv.find((a) => a.startsWith("--speed="));
	const startArg = process.argv.find((a) => a.startsWith("--start="));
	const SPEED = speedArg ? parseFloat(speedArg.split("=")[1]) : 8;
	const START_S = startArg ? parseFloat(startArg.split("=")[1]) : 0;
	const LOOP = process.argv.includes("--loop");

	const data = JSON.parse(fs.readFileSync(file, "utf8"));
	const nums = Object.keys(data.drivers);
	const F = data.frameTms.length;
	const deflateB64 = (obj) => zlib.deflateRawSync(JSON.stringify(obj)).toString("base64");
	const nowUtc = () => new Date().toISOString();

	const fmtLap = (ms) => {
		if (!ms || ms <= 0) return "";
		const total = ms / 1000;
		const m = Math.floor(total / 60);
		const rem = (total - m * 60).toFixed(3).padStart(6, "0");
		return m ? `${m}:${rem}` : (total).toFixed(3);
	};
	const mkSpeed = (v) => ({ Value: v || "", Status: 0, OverallFastest: false, PersonalFastest: false });

	// Build Sectors[].Segments[] from a 0..1 lap fraction (drives the Map).
	const buildSectors = (frac, s1, s2, s3) => {
		const completed = Math.floor(frac * TOTAL_SEGMENTS);
		let segIdx = 0;
		const vals = [s1, s2, s3];
		return SECTOR_SEGMENTS.map((count, si) => ({
			Stopped: false,
			Value: vals[si] || "",
			Status: 0,
			OverallFastest: false,
			PersonalFastest: false,
			Segments: new Array(count).fill(0).map(() => {
				const status = segIdx < completed ? 2048 : segIdx === completed ? 1 : 0;
				segIdx++;
				return { Status: status };
			}),
		}));
	};

	const driverList = data.drivers;

	const sessionInfo = () => ({
		Meeting: {
			Key: data.meta.meetingKey,
			Name: data.meta.event,
			OfficialName: data.meta.officialName,
			Location: data.meta.location,
			Country: data.meta.country,
			Circuit: { Key: data.meta.circuitKey, ShortName: data.meta.circuitShortName },
		},
		ArchiveStatus: { Status: "Complete" },
		Key: data.meta.sessionKey,
		Type: data.meta.sessionType,
		Name: data.meta.sessionName,
		StartDate: nowUtc(),
		EndDate: nowUtc(),
		GmtOffset: data.meta.gmtOffset,
		Path: data.meta.path,
	});

	const weatherAt = (tMs) => {
		let w = data.weather[0];
		for (const entry of data.weather) {
			if (entry.tMs <= tMs) w = entry;
			else break;
		}
		if (!w) return undefined;
		const { tMs: _t, ...rest } = w;
		return rest;
	};

	const rcUpTo = (tMs) =>
		data.raceControl
			.filter((m) => m.tMs == null || m.tMs <= tMs)
			.map((m) => {
				const msg = { Utc: nowUtc(), Lap: m.Lap, Category: m.Category, Message: m.Message };
				if (m.Flag) msg.Flag = m.Flag;
				if (m.Scope) msg.Scope = m.Scope;
				if (m.Sector != null) msg.Sector = m.Sector;
				if (m.Status) msg.Status = m.Status;
				return msg;
			});

	const buildTimingData = (i) => {
		const Lines = {};
		for (const num of nums) {
			const d = data.driverFrames[num];
			const pos = d.pos[i];
			Lines[num] = {
				GapToLeader: d.gap[i],
				IntervalToPositionAhead: { Value: d.intv[i], Catching: false },
				Line: pos,
				Position: String(pos),
				ShowPosition: true,
				RacingNumber: num,
				Retired: !!d.ret[i],
				InPit: !!d.pit[i],
				PitOut: false,
				Stopped: false,
				Status: 0,
				Sectors: buildSectors(d.frac[i], d.s1[i], d.s2[i], d.s3[i]),
				Speeds: {
					I1: mkSpeed(d.spI1[i]),
					I2: mkSpeed(d.spI2[i]),
					Fl: mkSpeed(d.spFL[i]),
					St: mkSpeed(d.spST[i]),
				},
				BestLapTime: { Value: fmtLap(d.best[i]), Position: pos },
				LastLapTime: { Value: fmtLap(d.last[i]), Status: 0, OverallFastest: false, PersonalFastest: false },
				NumberOfLaps: d.lap[i],
			};
		}
		return { Lines, Withheld: false };
	};

	const buildTimingAppData = (i) => {
		const Lines = {};
		for (const num of nums) {
			const d = data.driverFrames[num];
			Lines[num] = {
				RacingNumber: num,
				GridPos: String(data.gridPos[num] ?? d.pos[i]),
				Line: d.pos[i],
				Stints: [{ Compound: d.comp[i], New: "TRUE", TotalLaps: d.tyre[i] }],
			};
		}
		return { Lines };
	};

	const carDataZ = (i) => {
		const Cars = {};
		for (const num of nums) {
			const d = data.driverFrames[num];
			Cars[num] = {
				Channels: {
					0: d.rpm[i],
					2: d.spd[i],
					3: d.gear[i],
					4: d.thr[i],
					5: d.brk[i] ? 100 : 0,
					45: d.drs[i],
				},
			};
		}
		return deflateB64({ Entries: [{ Utc: nowUtc(), Cars }] });
	};

	const positionZ = (i) => {
		const Entries = {};
		for (const num of nums) {
			const d = data.driverFrames[num];
			Entries[num] = { Status: d.ret[i] ? "OffTrack" : "OnTrack", X: d.x[i], Y: d.y[i], Z: 0 };
		}
		return deflateB64({ Position: [{ Timestamp: nowUtc(), Entries }] });
	};

	// GPS keyframes are ~1s apart in the extract. A real live feed streams positions
	// several times a second, so between keyframes we linearly interpolate each car's
	// X/Y by `frac` (0→1 across the gap) and emit at the tick rate. That turns the
	// sparse keyframes into a dense, continuous stream — the map then glides like a
	// lossless live feed instead of stepping once per second. (Interpolation is
	// skipped across a retirement or a missing sample, where a lerp would be wrong.)
	const positionZInterp = (i, frac) => {
		const j = Math.min(i + 1, F - 1);
		const Entries = {};
		for (const num of nums) {
			const d = data.driverFrames[num];
			const x0 = d.x[i], y0 = d.y[i], x1 = d.x[j], y1 = d.y[j];
			const skip = x0 == null || y0 == null || x1 == null || y1 == null || d.ret[i] || d.ret[j];
			const X = skip ? x0 : Math.round(x0 + (x1 - x0) * frac);
			const Y = skip ? y0 : Math.round(y0 + (y1 - y0) * frac);
			Entries[num] = { Status: d.ret[i] ? "OffTrack" : "OnTrack", X, Y, Z: 0 };
		}
		return deflateB64({ Position: [{ Timestamp: nowUtc(), Entries }] });
	};

	// Derive TrackStatus from the recorded race-control messages (the extract has
	// no separate track-status timeline): the latest SC/VSC/red/clear event at or
	// before frame time wins. Codes match lib/getTrackStatusMessage.
	const trackStatusAt = (tMs) => {
		let status = { Status: "1", Message: "AllClear" };
		for (const m of data.raceControl) {
			if (m.tMs == null || m.tMs > tMs) continue;
			const txt = (m.Message || "").toUpperCase();
			if (txt.includes("VIRTUAL SAFETY CAR") || txt.includes("VSC")) {
				status = txt.includes("ENDING") ? { Status: "7", Message: "VSCEnding" } : { Status: "6", Message: "VSCDeployed" };
			} else if (txt.includes("SAFETY CAR")) {
				status = { Status: "4", Message: "SCDeployed" };
			} else if (m.Flag === "RED") {
				status = { Status: "5", Message: "Red" };
			} else if (txt.includes("TRACK CLEAR") || (m.Flag === "GREEN" && m.Scope === "Track")) {
				status = { Status: "1", Message: "AllClear" };
			}
		}
		return status;
	};

	const buildInitial = (i) => ({
		Heartbeat: { Utc: nowUtc() },
		ExtrapolatedClock: { Utc: nowUtc(), Remaining: "00:00:00", Extrapolating: true },
		SessionStatus: { Status: "Started" },
		SessionInfo: sessionInfo(),
		LapCount: { CurrentLap: data.leaderLap[i], TotalLaps: data.meta.totalLaps },
		TrackStatus: trackStatusAt(data.frameTms[i]),
		WeatherData: weatherAt(data.frameTms[i]),
		DriverList: driverList,
		TimingData: buildTimingData(i),
		TimingAppData: buildTimingAppData(i),
		ChampionshipPrediction: data.championship,
		RaceControlMessages: { Messages: rcUpTo(data.frameTms[i]) },
		// Dotted keys ("CarData.z"/"Position.z") match the real F1 feed and the Rust
		// `realtime` service exactly (see realtime/src/f1.rs TOPICS). The dashboard
		// normalizes these in useSocket — so this replay exercises the true live path.
		"CarData.z": carDataZ(i),
		"Position.z": positionZ(i),
	});

	const buildUpdate = (i) => ({
		Heartbeat: { Utc: nowUtc() },
		LapCount: { CurrentLap: data.leaderLap[i], TotalLaps: data.meta.totalLaps },
		TrackStatus: trackStatusAt(data.frameTms[i]),
		WeatherData: weatherAt(data.frameTms[i]),
		TimingData: buildTimingData(i),
		TimingAppData: buildTimingAppData(i),
		RaceControlMessages: { Messages: rcUpTo(data.frameTms[i]) },
		"CarData.z": carDataZ(i),
		"Position.z": positionZ(i),
	});

	const startTms = data.frameTms[0] + START_S * 1000;
	let startIdx = 0;
	while (startIdx < F - 1 && data.frameTms[startIdx] < startTms) startIdx++;

	const server = http.createServer((req, res) => {
		res.setHeader("Access-Control-Allow-Origin", "*");
		if (req.method === "OPTIONS") return void res.writeHead(204).end();
		if (!req.url.startsWith("/api/realtime")) return void res.writeHead(404).end("not found");

		res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
		const send = (event, payload) => res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);

		let i = startIdx;
		console.log(`[replay] client connected — ${data.meta.event} ${data.meta.year} (${F} frames @ ${SPEED}×, from frame ${i})`);
		send("initial", buildInitial(i));

		// Drive playback from a wall-clock session-time cursor so SPEED is exact
		// (SPEED = session-seconds per real second). Emitting at a fixed cadence and
		// picking the frame at the cursor means slow speeds repeat frames and fast
		// speeds skip them — unlike a fixed frames-per-tick, which floored playback
		// at stepMs/TICK_MS (≈4×) regardless of SPEED.
		// 100ms tick so interpolated positions stream ~10×/s — dense enough that the
		// dashboard's 200ms sampler always has a fresh point and the map glides.
		const TICK_MS = 100;
		const lastTms = data.frameTms[F - 1];
		let cursorMs = data.frameTms[startIdx];
		let finished = false;

		const interval = setInterval(() => {
			cursorMs += TICK_MS * SPEED;
			while (i < F - 1 && data.frameTms[i + 1] <= cursorMs) i++;

			if (cursorMs >= lastTms) {
				if (LOOP) {
					cursorMs = data.frameTms[startIdx];
					i = startIdx;
				} else if (!finished) {
					finished = true;
					send("update", { ...buildUpdate(F - 1), SessionStatus: { Status: "Finished" } });
					console.log("[replay] race finished — sent SessionStatus: Finished");
					return;
				} else {
					return; // keep connection open, race over
				}
			}

			// Fraction of the way from keyframe i to i+1, for smooth position interpolation.
			const span = (data.frameTms[Math.min(i + 1, F - 1)] - data.frameTms[i]) || 1;
			const frac = Math.max(0, Math.min(1, (cursorMs - data.frameTms[i]) / span));
			const update = buildUpdate(i);
			update["Position.z"] = positionZInterp(i, frac);
			send("update", update);
		}, TICK_MS);

		req.on("close", () => {
			clearInterval(interval);
			console.log("[replay] client disconnected");
		});
	});

	server.listen(PORT, () => {
		console.log(`[replay] SSE server on http://localhost:${PORT}/api/realtime`);
		console.log(`[replay] ${data.meta.officialName} — ${F} frames, totalLaps=${data.meta.totalLaps}, speed=${SPEED}×`);
		console.log(`[replay] open http://localhost:3000/dashboard (auto-switches to live)`);
	});
}

function runSyntheticServer() {
const statusArg = process.argv.find((a) => a.startsWith("--status="));
// Normalize to the exact casing useSessionMode expects ("Started", "Finished", ...)
const rawStatus = statusArg ? statusArg.split("=")[1] : "Inactive";
const SESSION_STATUS = rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1).toLowerCase();

// --raceend: start "Started", then flip to "Finished" after a few seconds so the
// dashboard exits live mode and shows the post-race summary. Optional --raceend=8000.
const raceEndArg = process.argv.find((a) => a.startsWith("--raceend"));
const RACE_END = !!raceEndArg;
const RACE_END_AFTER = raceEndArg && raceEndArg.includes("=") ? parseInt(raceEndArg.split("=")[1], 10) : 6000;

// deflateRaw + base64 — inverse of dashboard/src/lib/inflate.ts (pako.inflateRaw)
const deflateB64 = (obj) => zlib.deflateRawSync(JSON.stringify(obj)).toString("base64");

// ---- Static grid -----------------------------------------------------------
// racingNumber -> [Tla, FullName, TeamName, TeamColour]
const GRID = [
	["1", "Max VERSTAPPEN", "Red Bull Racing", "3671C6"],
	["11", "Sergio PEREZ", "Red Bull Racing", "3671C6"],
	["16", "Charles LECLERC", "Ferrari", "E8002D"],
	["55", "Carlos SAINZ", "Ferrari", "E8002D"],
	["4", "Lando NORRIS", "McLaren", "FF8000"],
	["81", "Oscar PIASTRI", "McLaren", "FF8000"],
	["44", "Lewis HAMILTON", "Mercedes", "27F4D2"],
	["63", "George RUSSELL", "Mercedes", "27F4D2"],
	["14", "Fernando ALONSO", "Aston Martin", "229971"],
	["18", "Lance STROLL", "Aston Martin", "229971"],
	["10", "Pierre GASLY", "Alpine", "0093CC"],
	["31", "Esteban OCON", "Alpine", "0093CC"],
	["23", "Alexander ALBON", "Williams", "64C4FF"],
	["77", "Valtteri BOTTAS", "Kick Sauber", "52E252"],
	["22", "Yuki TSUNODA", "RB", "6692FF"],
	["3", "Daniel RICCIARDO", "RB", "6692FF"],
	["27", "Nico HULKENBERG", "Haas F1 Team", "B6BABD"],
	["20", "Kevin MAGNUSSEN", "Haas F1 Team", "B6BABD"],
	["24", "Zhou GUANYU", "Kick Sauber", "52E252"],
	["2", "Logan SARGEANT", "Williams", "64C4FF"],
];

const COMPOUNDS = ["SOFT", "MEDIUM", "HARD"];

// Drivers that retired (DNF) — surfaced in the post-race summary
const DNF_NUMS = new Set(["77", "2"]);

// Build a championship prediction: predicted = standings after this race,
// current = before, so the summary can show position movement.
function buildChampionship() {
	const Drivers = {};
	GRID.forEach(([num], i) => {
		const predicted = i + 1;
		// nudge a few drivers so movement arrows show
		const current = Math.max(1, predicted + (i % 3 === 0 ? 1 : i % 3 === 1 ? -1 : 0));
		const pts = Math.max(0, 400 - i * 22 - Math.floor(Math.random() * 8));
		Drivers[num] = {
			RacingNumber: num,
			CurrentPosition: current,
			PredictedPosition: predicted,
			CurrentPoints: pts - 7,
			PredictedPoints: pts,
		};
	});
	return { Drivers, Teams: {} };
}

const tla = (full) => full.split(" ").pop().slice(0, 3).toUpperCase();
const firstName = (full) => full.split(" ").slice(0, -1).join(" ");
const lastName = (full) => full.split(" ").pop();

function buildDriverList() {
	const list = {};
	GRID.forEach(([num, full, team, colour], i) => {
		list[num] = {
			RacingNumber: num,
			BroadcastName: full,
			FullName: full,
			Tla: tla(full),
			Line: i + 1,
			TeamName: team,
			TeamColour: colour,
			FirstName: firstName(full),
			LastName: lastName(full),
			Reference: `${lastName(full).toUpperCase()}01`,
			HeadshotUrl: "",
			CountryCode: "",
		};
	});
	return list;
}

const fmtGap = (s) => (s <= 0 ? "" : `+${s.toFixed(3)}`);
const fmtLap = (ms) => {
	const m = Math.floor(ms / 60000);
	const s = ((ms % 60000) / 1000).toFixed(3).padStart(6, "0");
	return `${m}:${s}`;
};

// mutable race state, animated over time
const order = GRID.map(([num]) => num); // index 0 = leader
const gaps = order.map((_, i) => i * (0.6 + Math.random() * 1.4)); // cumulative gap to leader
const lapBase = 78_000; // ~1:18.0

// Per-driver lap progress (0..1). This fork's Map derives car position from
// TimingData segment progress (not raw GPS), so we must advance segments over
// time for cars to circulate. Each driver gets a slightly different speed/offset.
const SECTOR_SEGMENTS = [7, 9, 8]; // segments per sector
const TOTAL_SEGMENTS = SECTOR_SEGMENTS.reduce((a, b) => a + b, 0);
const lapProgress = {};
const lapSpeed = {};
GRID.forEach(([num], i) => {
	lapProgress[num] = i / GRID.length; // spread cars around the lap
	lapSpeed[num] = 0.010 + Math.random() * 0.006; // ~full lap every ~16–25s
});

// Advance every driver's lap progress one tick (called once per update frame)
function advanceProgress() {
	for (const num of Object.keys(lapProgress)) {
		lapProgress[num] = (lapProgress[num] + lapSpeed[num]) % 1;
	}
}

// Build a driver's Sectors[].Segments[] from their lap progress so getDriverPosition
// (Map.tsx) walks the car around the track: completed segments = 2048, current = 1, rest = 0.
function buildSegments(num) {
	const completed = Math.floor(lapProgress[num] * TOTAL_SEGMENTS);
	let segIdx = 0;
	return SECTOR_SEGMENTS.map((count) => ({
		Stopped: false,
		Value: (lapBase / 3000 + Math.random() * 2).toFixed(3),
		Status: 0,
		OverallFastest: false,
		PersonalFastest: Math.random() > 0.85,
		Segments: new Array(count).fill(0).map(() => {
			const status = segIdx < completed ? 2048 : segIdx === completed ? 1 : 0;
			segIdx++;
			return { Status: status };
		}),
	}));
}

function buildTimingData() {
	const Lines = {};
	order.forEach((num, idx) => {
		const driverIdx = GRID.findIndex(([n]) => n === num);
		const gapLeader = gaps[idx];
		const interval = idx === 0 ? 0 : gaps[idx] - gaps[idx - 1];
		const lap = lapBase + (Math.random() * 1500 - 400);
		Lines[num] = {
			GapToLeader: idx === 0 ? "" : fmtGap(gapLeader),
			IntervalToPositionAhead: { Value: idx === 0 ? "" : fmtGap(interval), Catching: Math.random() > 0.7 },
			Line: idx + 1,
			Position: String(idx + 1),
			ShowPosition: true,
			RacingNumber: num,
			Retired: DNF_NUMS.has(num),
			// Staggered pit cycle so PIT indicators are exercised in mock mode:
			// each non-leading driver spends ~18s in the pit (then ~12s pit-out)
			// once every 150s, offset per driver.
			InPit: idx > 0 && ((Date.now() / 1000 + idx * 41) % 150) < 18,
			PitOut: idx > 0 && (((Date.now() / 1000 + idx * 41) % 150) >= 18 && ((Date.now() / 1000 + idx * 41) % 150) < 30),
			Stopped: false,
			Status: 0,
			Sectors: buildSegments(num),
			Speeds: {
				I1: mkSpeed(280 + Math.random() * 40),
				I2: mkSpeed(250 + Math.random() * 40),
				Fl: mkSpeed(300 + Math.random() * 30),
				St: mkSpeed(320 + Math.random() * 20),
			},
			BestLapTime: { Value: fmtLap(lapBase - driverIdx * 30), Position: idx + 1 },
			LastLapTime: { Value: fmtLap(lap), Status: 0, OverallFastest: false, PersonalFastest: Math.random() > 0.8 },
			NumberOfLaps: 24,
		};
	});
	return { Lines, Withheld: false };
}

const mkSpeed = (v) => ({ Value: String(Math.round(v)), Status: 0, OverallFastest: false, PersonalFastest: false });

function buildTimingAppData() {
	const Lines = {};
	order.forEach((num, idx) => {
		Lines[num] = {
			RacingNumber: num,
			GridPos: String(idx + 1),
			Line: idx + 1,
			Stints: [
				{ Compound: COMPOUNDS[idx % COMPOUNDS.length], New: "TRUE", TotalLaps: 24 },
			],
		};
	});
	return { Lines };
}

// ---- CarData (compressed) --------------------------------------------------
// The synthetic feed intentionally sends NO PositionZ (GPS): the Map then uses
// TimingData segment-progress placement, which keeps dots on the real track
// outline. (The FastF1 replay server sends real PositionZ instead.)
function buildCars() {
	const cars = {};
	order.forEach((num) => {
		cars[num] = {
			Channels: {
				0: 9000 + Math.round(Math.random() * 3000), // RPM
				2: 200 + Math.round(Math.random() * 120), // Speed
				3: 5 + Math.round(Math.random() * 3), // Gear
				4: Math.round(Math.random() * 100), // Throttle
				5: Math.random() > 0.8 ? 100 : 0, // Brake
				// DRS uses the F1 channel encoding: 0/1 off, 8 eligible, >9 open.
				// (An earlier version sent 1 for "on", which the dashboard correctly
				// treats as off — no DRS state was ever visible in mock mode.)
				45: Math.random() > 0.85 ? 12 : Math.random() > 0.6 ? 8 : 0,
			},
		};
	});
	return cars;
}

const nowUtc = () => new Date().toISOString();

const carDataZ = () => deflateB64({ Entries: [{ Utc: nowUtc(), Cars: buildCars() }] });

const raceControlMessages = [
	{ Utc: nowUtc(), Lap: 1, Category: "Flag", Flag: "GREEN", Scope: "Track", Message: "GREEN LIGHT - PIT EXIT OPEN" },
	{ Utc: nowUtc(), Lap: 12, Category: "Drs", Message: "DRS ENABLED", Status: "ENABLED" },
];

function buildInitialState() {
	return {
		Heartbeat: { Utc: nowUtc() },
		ExtrapolatedClock: { Utc: nowUtc(), Remaining: "01:12:45", Extrapolating: true },
		SessionStatus: { Status: SESSION_STATUS },
		SessionInfo: {
			Meeting: {
				Key: 1234,
				Name: "Mock Grand Prix",
				OfficialName: "FORMULA 1 MOCK GRAND PRIX 2026",
				Location: "Testville",
				Country: { Key: 1, Code: "TST", Name: "Testland" },
				Circuit: { Key: 10, ShortName: "Test Circuit" },
			},
			ArchiveStatus: { Status: "Complete" },
			Key: 9999,
			Type: "Race",
			Name: "Race",
			StartDate: nowUtc(),
			EndDate: nowUtc(),
			GmtOffset: "00:00:00",
			Path: "mock",
		},
		LapCount: { CurrentLap: 24, TotalLaps: 58 },
		TrackStatus: { Status: "1", Message: "AllClear" },
		WeatherData: {
			AirTemp: "26.4",
			Humidity: "41.0",
			Pressure: "1012.3",
			Rainfall: "0",
			TrackTemp: "38.7",
			WindDirection: "210",
			WindSpeed: "2.4",
		},
		DriverList: buildDriverList(),
		TimingData: buildTimingData(),
		TimingAppData: buildTimingAppData(),
		ChampionshipPrediction: buildChampionship(),
		RaceControlMessages: { Messages: [...raceControlMessages] },
		CarDataZ: carDataZ(),
		// No PositionZ: the synthetic feed's positions are a fake ellipse, not real
		// track coords. The Map now prefers GPS when present, so omitting it keeps the
		// synthetic feed on the accurate segment-progress placement. (The FastF1
		// replay feed *does* send real PositionZ — see runReplayServer.)
	};
}

// Shuffle the order slightly to animate position changes
function maybeSwapOrder() {
	if (Math.random() > 0.85) {
		const i = 1 + Math.floor(Math.random() * (order.length - 1));
		[order[i - 1], order[i]] = [order[i], order[i - 1]];
	}
	// drift gaps
	for (let i = 1; i < gaps.length; i++) {
		gaps[i] += (Math.random() - 0.5) * 0.3;
		if (gaps[i] < gaps[i - 1] + 0.1) gaps[i] = gaps[i - 1] + 0.1;
	}
}

// ---- HTTP / SSE ------------------------------------------------------------
const server = http.createServer((req, res) => {
	// CORS for EventSource cross-origin (dashboard :3000 → mock :4000)
	res.setHeader("Access-Control-Allow-Origin", "*");

	if (req.method === "OPTIONS") {
		res.writeHead(204).end();
		return;
	}

	if (!req.url.startsWith("/api/realtime")) {
		res.writeHead(404).end("not found");
		return;
	}

	res.writeHead(200, {
		"Content-Type": "text/event-stream",
		"Cache-Control": "no-cache",
		Connection: "keep-alive",
	});

	const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

	console.log(`[mock] client connected — SessionStatus="${SESSION_STATUS}"`);
	send("initial", buildInitialState());

	let t = 0;
	let endedSent = false;
	const interval = setInterval(() => {
		t += 250;
		advanceProgress();
		maybeSwapOrder();

		const update = {
			Heartbeat: { Utc: nowUtc() },
			TimingData: buildTimingData(),
			ChampionshipPrediction: buildChampionship(),
			CarDataZ: carDataZ(),
			// No PositionZ — see buildInitialState (segment-progress placement).
		};

		// --raceend: after RACE_END_AFTER, flag the race finished so the dashboard
		// drops out of live mode and shows the post-race summary.
		if (RACE_END && !endedSent && t >= RACE_END_AFTER) {
			update.SessionStatus = { Status: "Finished" };
			endedSent = true;
			console.log("[mock] race finished — sending SessionStatus: Finished");
		}

		// Occasionally append a race control message
		if (Math.random() > 0.95) {
			raceControlMessages.push({
				Utc: nowUtc(),
				Lap: 24,
				Category: "Other",
				Message: `Car ${order[Math.floor(Math.random() * order.length)]} sets a personal best`,
			});
			update.RaceControlMessages = { Messages: [...raceControlMessages] };
		}

		res.write(`event: update\ndata: ${JSON.stringify(update)}\n\n`);
	}, 250);

	req.on("close", () => {
		clearInterval(interval);
		console.log("[mock] client disconnected");
	});
});

server.listen(PORT, () => {
	console.log(`[mock] realtime SSE server on http://localhost:${PORT}/api/realtime`);
	console.log(`[mock] SessionStatus = "${SESSION_STATUS}"`);
	if (SESSION_STATUS !== "Started") {
		console.log(`[mock] tip: open http://localhost:3000/dashboard?testCountdown=1 to test the countdown → live flow`);
	} else {
		console.log(`[mock] dashboard will auto-switch to live (~3s) at http://localhost:3000/dashboard`);
	}
});
}
