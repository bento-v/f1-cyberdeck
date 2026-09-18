"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { JolpicaConstructorStanding, JolpicaConstructorStandingsResponse, JolpicaDriverStanding, JolpicaDriverStandingsResponse, JolpicaLastRaceResponse, JolpicaQualifyingResponse, JolpicaQualifyingResult, JolpicaRace, JolpicaResult, JolpicaScheduleRace, JolpicaScheduleResponse, JolpicaSprintResponse } from "@/types/jolpica.type";
import type { Round, Session } from "@/types/schedule.type";

import IdleCountdownBar from "@/components/idle/IdleCountdownBar";
import RaceCountdownScreen from "@/components/idle/RaceCountdownScreen";
import DriverStandings from "@/components/idle/DriverStandings";
import ConstructorStandings from "@/components/idle/ConstructorStandings";
import NextRacePanel from "@/components/idle/NextRacePanel";
import CircuitSchedulePanel from "@/components/idle/CircuitSchedulePanel";
import LastRacePanel from "@/components/idle/LastRacePanel";
import DriverSeasonPanel from "@/components/idle/DriverSeasonPanel";
import TrackMapPanel from "@/components/idle/TrackMapPanel";
import WeatherPanel from "@/components/idle/WeatherPanel";

const CYCLE_MS = 15_000;
const JOLPICA_BASE = "https://api.jolpi.ca/ergast/f1";
const CACHE_TTL = 3_600_000; // 1 hour
const ERROR_COOLDOWN_MS = 5 * 60_000; // retry at most every 5 min during outage
// Re-run the data fetches while the carousel stays mounted, so a kiosk that idles
// for days keeps its schedule/standings current (cachedFetch makes network calls
// at most once per CACHE_TTL, so this mostly serves cache).
const REFRESH_MS = 15 * 60_000;
// Don't fire the pre-live switch if the race started this long ago or more —
// e.g. the kiosk rebooted mid/after-race. SessionStatus drives live mode instead.
const PRELIVE_LATE_WINDOW_S = 300;

// errorUntil: timestamp before which we serve stale data and skip live fetches
type CacheEntry<T> = { data: T; ts: number; errorUntil?: number };

// Module-level cache: survives re-renders and idle↔live transitions without refetching
const fetchCache = new Map<string, CacheEntry<unknown>>();

// Dedupe concurrent requests for the same URL (several effects fetch next.json on mount)
const inflightFetches = new Map<string, Promise<unknown>>();

// Invalidate all cached fetches so the carousel pulls fresh data on its next mount.
// Called after a race ends so the returning carousel reflects post-race standings.
export function clearIdleFetchCache() {
	fetchCache.clear();
}

// Returns cached data (fresh or stale) or null on cold-start outage.
// Never throws — the kiosk must keep showing something.
async function cachedFetch<T>(url: string): Promise<T | null> {
	const hit = fetchCache.get(url) as CacheEntry<T> | undefined;
	const now = Date.now();

	// Fresh cache hit — no network call
	if (hit && now - hit.ts < CACHE_TTL) return hit.data;

	// Within error cooldown — serve stale data to avoid hammering a down API
	if (hit?.errorUntil && now < hit.errorUntil) return hit.data;

	// A request for this URL is already running — share its result
	const pending = inflightFetches.get(url);
	if (pending) return pending as Promise<T | null>;

	const request = (async (): Promise<T | null> => {
		try {
			const res = await fetch(url);
			if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
			const data: T = await res.json();
			fetchCache.set(url, { data, ts: now });
			return data;
		} catch {
			if (hit) {
				// Serve stale data and suppress retries for 5 min
				fetchCache.set(url, { ...hit, errorUntil: now + ERROR_COOLDOWN_MS });
				return hit.data;
			}
			// Cold-start with API down — signal unavailability without throwing
			return null;
		} finally {
			inflightFetches.delete(url);
		}
	})();

	inflightFetches.set(url, request);
	return request;
}

const isKiosk = process.env.NEXT_PUBLIC_KIOSK === "1";

// Converts a Jolpica next-race response into our Round type so schedule panels
// work even when the local Rust realtime service isn't running.
function jolpicaRaceToRound(race: JolpicaScheduleRace): Round {
	const toISO = (s: { date: string; time: string }) => `${s.date}T${s.time}`;
	const addMins = (iso: string, mins: number) =>
		new Date(new Date(iso).getTime() + mins * 60_000).toISOString();

	const sessions: Session[] = [];
	const push = (kind: string, s: { date: string; time: string } | undefined, durationMins = 60) => {
		if (!s) return;
		const start = toISO(s);
		sessions.push({ kind, start, end: addMins(start, durationMins) });
	};

	push("Practice 1", race.FirstPractice);
	push("Practice 2", race.SecondPractice);
	push("Sprint Qualifying", race.SprintQualifying ?? race.SprintShootout, 45);
	push("Sprint", race.Sprint, 30);
	push("Practice 3", race.ThirdPractice);
	push("Qualifying", race.Qualifying);

	const raceTime = race.time ?? "00:00:00Z";
	const raceStart = `${race.date}T${raceTime}`;
	sessions.push({ kind: "Race", start: raceStart, end: addMins(raceStart, 120) });
	sessions.sort((a, b) => a.start.localeCompare(b.start));

	return {
		name: race.raceName,
		countryName: race.Circuit.Location.country,
		countryKey: null,
		start: sessions[0]?.start ?? raceStart,
		end: addMins(raceStart, 120),
		sessions,
		over: false,
	};
}

type Props = {
	onPreLive?: () => void;
};

const PANEL_LABELS = [
	"Drivers' Championship",
	"Constructors' Championship",
	"Next Race Weekend",
	"Circuit & Schedule",
	"Last Race Results",
	"Driver Season Stats",
	"Track Map",
	"Track Weather",
];

export default function IdleCarousel({ onPreLive }: Props) {
	const [activePanel, setActivePanel] = useState(0);
	const [visible, setVisible] = useState(true);

	const [driverStandings, setDriverStandings] = useState<JolpicaDriverStanding[] | null>(null);
	const [driverSeason, setDriverSeason] = useState("");
	const [driverLoaded, setDriverLoaded] = useState(false);
	const [constructorStandings, setConstructorStandings] = useState<JolpicaConstructorStanding[] | null>(null);
	const [constructorSeason, setConstructorSeason] = useState("");
	const [constructorLoaded, setConstructorLoaded] = useState(false);
	const [nextRound, setNextRound] = useState<Round | null>(null);
	const [scheduleLoaded, setScheduleLoaded] = useState(false);
	const [lastRace, setLastRace] = useState<JolpicaRace | null>(null);
	const [lastRaceLoaded, setLastRaceLoaded] = useState(false);
	const [nextQualifyingResults, setNextQualifyingResults] = useState<JolpicaQualifyingResult[] | null>(null);
	const [nextSprintResults, setNextSprintResults] = useState<JolpicaResult[] | null>(null);
	const [nextRoundNumber, setNextRoundNumber] = useState<string | null>(null);
	const [nextCircuitId, setNextCircuitId] = useState<string | null>(null);
	const [nextCircuitName, setNextCircuitName] = useState<string | null>(null);
	const [nextLat, setNextLat] = useState<string | null>(null);
	const [nextLon, setNextLon] = useState<string | null>(null);
	const [nextLocality, setNextLocality] = useState<string | null>(null);

	// Derive next upcoming session for the countdown bar
	const nextSession = nextRound?.sessions.find((s) => new Date(s.start) > new Date()) ?? null;

	// Race session — used for the 30s pre-race countdown overlay
	const raceSession = nextRound?.sessions.find((s) => s.kind.toLowerCase() === "race") ?? null;

	// Fetch standings on mount, then periodically so long idle stretches (no
	// idle↔live remount) don't pin stale data (cachedFetch never throws — returns
	// null on outage — and serves its cache until CACHE_TTL expires)
	useEffect(() => {
		const load = () => {
		cachedFetch<JolpicaDriverStandingsResponse>(`${JOLPICA_BASE}/current/driverstandings.json?limit=30`)
			.then((res) => {
				if (res) {
					const list = res.MRData.StandingsTable.StandingsLists[0];
					if (list) {
						setDriverStandings(list.DriverStandings);
						setDriverSeason(list.season);
					}
				}
				setDriverLoaded(true);
			});

		cachedFetch<JolpicaConstructorStandingsResponse>(`${JOLPICA_BASE}/current/constructorstandings.json?limit=15`)
			.then((res) => {
				if (res) {
					const list = res.MRData.StandingsTable.StandingsLists[0];
					if (list) {
						setConstructorStandings(list.ConstructorStandings);
						setConstructorSeason(list.season);
					}
				}
				setConstructorLoaded(true);
			});

		// Fetch schedule via local proxy; fall back to Jolpica when the Rust service isn't running.
		// Always also fetch from Jolpica to get the circuitId (not available via local proxy).
		const tryJolpicaSchedule = () =>
			cachedFetch<JolpicaScheduleResponse>(`${JOLPICA_BASE}/current/next.json`).then((res) => {
				const race = res?.MRData.RaceTable.Races[0];
				if (race) {
					setNextRound(jolpicaRaceToRound(race));
					setNextCircuitId(race.Circuit.circuitId);
					setNextCircuitName(race.Circuit.circuitName);
					setNextLat(race.Circuit.Location.lat ?? null);
					setNextLon(race.Circuit.Location.long ?? null);
					setNextLocality(race.Circuit.Location.locality);
				}
				setScheduleLoaded(true);
			});

		fetch("/api/schedule")
			.then((r) => r.json())
			.then((data: Round | null) => {
				if (data) {
					setNextRound(data);
					setScheduleLoaded(true);
				} else {
					return tryJolpicaSchedule();
				}
			})
			.catch(() => tryJolpicaSchedule());

		// Always fetch Jolpica schedule separately to get circuitId, name, coords, and round number.
		// Setting nextRoundNumber triggers a dedicated effect that clears stale qualifying/sprint
		// data and refetches for the new round.
		cachedFetch<JolpicaScheduleResponse>(`${JOLPICA_BASE}/current/next.json`).then((res) => {
			const race = res?.MRData.RaceTable.Races[0];
			if (race) {
				setNextCircuitId(race.Circuit.circuitId);
				setNextCircuitName(race.Circuit.circuitName);
				setNextLat(race.Circuit.Location.lat ?? null);
				setNextLon(race.Circuit.Location.long ?? null);
				setNextLocality(race.Circuit.Location.locality);
				setNextRoundNumber(race.round);
			}
		});

		cachedFetch<JolpicaLastRaceResponse>(`${JOLPICA_BASE}/current/last/results.json?limit=20`)
			.then((res) => {
				if (res) {
					const race = res.MRData.RaceTable.Races[0];
					if (race) setLastRace(race);
				}
				setLastRaceLoaded(true);
			});
		};

		load();
		const refresh = setInterval(load, REFRESH_MS);
		return () => clearInterval(refresh);
	}, []);

	// When the upcoming race round changes, clear stale qualifying/sprint data and
	// fetch fresh results for the new round. Runs on first set and on any round change.
	useEffect(() => {
		setNextQualifyingResults(null);
		setNextSprintResults(null);
		if (!nextRoundNumber) return;

		cachedFetch<JolpicaQualifyingResponse>(
			`${JOLPICA_BASE}/current/${nextRoundNumber}/qualifying.json?limit=20`,
		).then((qRes) => {
			const results = qRes?.MRData.RaceTable.Races[0]?.QualifyingResults;
			if (results?.length) setNextQualifyingResults(results);
		});

		cachedFetch<JolpicaSprintResponse>(
			`${JOLPICA_BASE}/current/${nextRoundNumber}/sprint.json?limit=20`,
		).then((sRes) => {
			const results = sRes?.MRData.RaceTable.Races[0]?.SprintResults;
			if (results?.length) setNextSprintResults(results);
		});
	}, [nextRoundNumber]);

	// Race countdown state — drives the 30s pre-race overlay
	const [secsToRace, setSecsToRace] = useState<number | null>(null);
	const frozenRef = useRef(false);
	const preLiveRaceFiredRef = useRef(false);

	// Dev-only: ?testCountdown=1 drives a fake countdown from 35 without a real race session.
	// The kiosk URL never has query params so this is inert in production.
	const testCountdown =
		typeof window !== "undefined" && new URLSearchParams(window.location.search).get("testCountdown") === "1";
	const testSecsRef = useRef(35);

	// Test mode — fake 1s interval countdown starting at 35 (5s carousel + 30s countdown)
	useEffect(() => {
		if (!testCountdown) return;
		const iv = setInterval(() => {
			const secs = testSecsRef.current--;
			setSecsToRace(secs);
			if (secs <= 30) frozenRef.current = true;
			if (secs <= 0 && !preLiveRaceFiredRef.current) {
				preLiveRaceFiredRef.current = true;
				onPreLive?.();
				clearInterval(iv);
			}
		}, 1000);
		return () => clearInterval(iv);
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// Tracks seconds to the next race session. A 1s interval (not requestAnimationFrame)
	// keeps the Raspberry Pi idle: far from the race it just checks the clock once a
	// second and does NOT re-render; it only updates state during the final 30s
	// countdown window, and fires onPreLive at T=0.
	// Keyed on the start TIME, not the session object — `raceSession` is a fresh
	// object every render, which would tear down and rebuild the interval (and
	// reset the fired/frozen refs) on each carousel re-render.
	const raceStartIso = raceSession?.start ?? null;
	useEffect(() => {
		if (!raceStartIso || testCountdown) {
			if (!testCountdown) setSecsToRace(null);
			return;
		}
		const target = new Date(raceStartIso).getTime();
		const tick = () => {
			const secs = Math.ceil((target - Date.now()) / 1000);
			if (secs <= 30 && secs >= 0) {
				frozenRef.current = true;
				setSecsToRace(secs); // only re-render during the visible countdown
			}
			// Fire at T=0, but not if the start is already long past (kiosk rebooted
			// mid/after-race) — then SessionStatus alone decides when to go live.
			if (secs <= 0 && secs >= -PRELIVE_LATE_WINDOW_S && !preLiveRaceFiredRef.current) {
				preLiveRaceFiredRef.current = true;
				onPreLive?.();
			}
		};
		tick();
		const iv = setInterval(tick, 1000);
		return () => {
			clearInterval(iv);
			frozenRef.current = false;
			preLiveRaceFiredRef.current = false;
		};
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [raceStartIso]);

	const showRaceCountdown = secsToRace !== null && secsToRace <= 30 && secsToRace >= 0;

	// Auto-cycle with fade transition
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const advance = useCallback(() => {
		if (frozenRef.current) return;
		setVisible(false);
		timerRef.current = setTimeout(() => {
			setActivePanel((p) => (p + 1) % 8);
			setVisible(true);
		}, 500);
	}, []);

	useEffect(() => {
		const interval = setInterval(advance, CYCLE_MS);
		return () => {
			clearInterval(interval);
			if (timerRef.current) clearTimeout(timerRef.current);
			if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
		};
	}, [advance]);

	return (
		<div data-testid="idle-carousel" className="flex h-full w-full flex-col gap-4">
			{/* Countdown bar — hidden while race countdown overlay is active */}
			{!showRaceCountdown && (
				<IdleCountdownBar
					nextSession={nextSession}
					roundName={nextRound?.name ?? null}
					onPreLive={nextSession?.kind.toLowerCase() === "race" ? undefined : onPreLive}
				/>
			)}

			{/* Panel indicator dots — hidden in kiosk mode and during race countdown */}
			{!isKiosk && !showRaceCountdown && (
				<div data-testid="carousel-dots" className="flex items-center justify-center gap-3">
					{PANEL_LABELS.map((label, i) => (
						<button
							key={label}
							onClick={() => {
								if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
								setVisible(false);
								clickTimerRef.current = setTimeout(() => {
									setActivePanel(i);
									setVisible(true);
								}, 300);
							}}
							className="flex items-center gap-2"
							aria-label={`Show ${label}`}
						>
							<div
								className={`h-2 rounded-full transition-all duration-300 ${
									i === activePanel ? "w-8 bg-accent" : "w-2 bg-t4"
								}`}
							/>
						</button>
					))}
					<span className="ml-2 text-sm text-t3">{PANEL_LABELS[activePanel]}</span>
				</div>
			)}

			{/* Carousel panels / Race countdown */}
			<div
				className="min-h-0 flex-1 rounded-lg border border-hairline bg-s1 shadow-lg shadow-black/20 transition-opacity duration-500"
				style={{ opacity: showRaceCountdown ? 1 : visible ? 1 : 0 }}
			>
				{showRaceCountdown ? (
					<RaceCountdownScreen
						roundName={nextRound?.name ?? "Race"}
						countryName={nextRound?.countryName ?? ""}
						secsToRace={secsToRace!}
					/>
				) : null}
				{!showRaceCountdown && activePanel === 0 && (
					!driverLoaded ? (
						<div className="flex h-full items-center justify-center text-t3">Loading standings…</div>
					) : driverStandings !== null ? (
						<DriverStandings standings={driverStandings} season={driverSeason} />
					) : (
						<div className="flex h-full items-center justify-center text-t3">
							Standings unavailable — will retry when connection is restored
						</div>
					)
				)}
				{!showRaceCountdown && activePanel === 1 && (
					!constructorLoaded ? (
						<div className="flex h-full items-center justify-center text-t3">Loading standings…</div>
					) : constructorStandings !== null ? (
						<ConstructorStandings standings={constructorStandings} season={constructorSeason} />
					) : (
						<div className="flex h-full items-center justify-center text-t3">
							Standings unavailable — will retry when connection is restored
						</div>
					)
				)}
				{!showRaceCountdown && activePanel === 2 && (
					!scheduleLoaded ? (
						<div className="flex h-full items-center justify-center text-t3">Loading schedule…</div>
					) : (
						<NextRacePanel round={nextRound} />
					)
				)}
				{!showRaceCountdown && activePanel === 3 && (
					!scheduleLoaded ? (
						<div className="flex h-full items-center justify-center text-t3">Loading schedule…</div>
					) : (
						<CircuitSchedulePanel
							round={nextRound}
							raceResults={null}
							qualifyingResults={nextQualifyingResults}
							sprintResults={nextSprintResults}
						/>
					)
				)}
				{!showRaceCountdown && activePanel === 4 && (
					!lastRaceLoaded ? (
						<div className="flex h-full items-center justify-center text-t3">Loading last race…</div>
					) : (
						<LastRacePanel race={lastRace} />
					)
				)}
				{!showRaceCountdown && activePanel === 5 && (
					!driverLoaded ? (
						<div className="flex h-full items-center justify-center text-t3">Loading standings…</div>
					) : driverStandings !== null ? (
						<DriverSeasonPanel standings={driverStandings} season={driverSeason} />
					) : (
						<div className="flex h-full items-center justify-center text-t3">
							Standings unavailable — will retry when connection is restored
						</div>
					)
				)}
				{!showRaceCountdown && activePanel === 6 && (
					<TrackMapPanel
						circuitId={nextCircuitId}
						circuitName={nextCircuitName}
						countryName={nextRound?.countryName ?? null}
					/>
				)}
				{!showRaceCountdown && activePanel === 7 && (
					<WeatherPanel
						lat={nextLat}
						lon={nextLon}
						circuitName={nextCircuitName}
						locality={nextLocality}
					/>
				)}
			</div>
		</div>
	);
}
