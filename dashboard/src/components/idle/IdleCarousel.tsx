"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { JolpicaConstructorStanding, JolpicaConstructorStandingsResponse, JolpicaDriverStanding, JolpicaDriverStandingsResponse, JolpicaLastRaceResponse, JolpicaRace, JolpicaScheduleRace, JolpicaScheduleResponse } from "@/types/jolpica.type";
import type { Round, Session } from "@/types/schedule.type";

import IdleCountdownBar from "@/components/idle/IdleCountdownBar";
import DriverStandings from "@/components/idle/DriverStandings";
import ConstructorStandings from "@/components/idle/ConstructorStandings";
import NextRacePanel from "@/components/idle/NextRacePanel";
import CircuitSchedulePanel from "@/components/idle/CircuitSchedulePanel";
import LastRacePanel from "@/components/idle/LastRacePanel";
import DriverSeasonPanel from "@/components/idle/DriverSeasonPanel";

const CYCLE_MS = 15_000;
const JOLPICA_BASE = "https://api.jolpi.ca/ergast/f1";
const CACHE_TTL = 3_600_000; // 1 hour
const ERROR_COOLDOWN_MS = 5 * 60_000; // retry at most every 5 min during outage

// errorUntil: timestamp before which we serve stale data and skip live fetches
type CacheEntry<T> = { data: T; ts: number; errorUntil?: number };

// Module-level cache: survives re-renders and idle↔live transitions without refetching
const fetchCache = new Map<string, CacheEntry<unknown>>();

// Returns cached data (fresh or stale) or null on cold-start outage.
// Never throws — the kiosk must keep showing something.
async function cachedFetch<T>(url: string): Promise<T | null> {
	const hit = fetchCache.get(url) as CacheEntry<T> | undefined;
	const now = Date.now();

	// Fresh cache hit — no network call
	if (hit && now - hit.ts < CACHE_TTL) return hit.data;

	// Within error cooldown — serve stale data to avoid hammering a down API
	if (hit?.errorUntil && now < hit.errorUntil) return hit.data;

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
	}
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

	// Derive next upcoming session for the countdown bar
	const nextSession = nextRound?.sessions.find((s) => new Date(s.start) > new Date()) ?? null;

	// Fetch standings once on mount (cachedFetch never throws — returns null on outage)
	useEffect(() => {
		cachedFetch<JolpicaDriverStandingsResponse>(`${JOLPICA_BASE}/current/driverstandings.json?limit=20`)
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

		cachedFetch<JolpicaConstructorStandingsResponse>(`${JOLPICA_BASE}/current/constructorstandings.json?limit=10`)
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

		// Fetch schedule via local proxy; fall back to Jolpica when the Rust service isn't running
		const tryJolpicaSchedule = () =>
			cachedFetch<JolpicaScheduleResponse>(`${JOLPICA_BASE}/current/next.json`).then((res) => {
				const race = res?.MRData.RaceTable.Races[0];
				if (race) setNextRound(jolpicaRaceToRound(race));
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

		cachedFetch<JolpicaLastRaceResponse>(`${JOLPICA_BASE}/current/last/results.json?limit=20`)
			.then((res) => {
				if (res) {
					const race = res.MRData.RaceTable.Races[0];
					if (race) setLastRace(race);
				}
				setLastRaceLoaded(true);
			});
	}, []);

	// Auto-cycle with fade transition
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const advance = useCallback(() => {
		setVisible(false);
		timerRef.current = setTimeout(() => {
			setActivePanel((p) => (p + 1) % 6);
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
		<div className="flex h-full w-full flex-col gap-4">
			{/* Countdown bar */}
			<IdleCountdownBar
				nextSession={nextSession}
				roundName={nextRound?.name ?? null}
				onPreLive={onPreLive}
			/>

			{/* Panel indicator dots — hidden in kiosk mode (no mouse to click them) */}
			{!isKiosk && (
				<div className="flex items-center justify-center gap-3">
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
									i === activePanel ? "w-8 bg-red-500" : "w-2 bg-zinc-600"
								}`}
							/>
						</button>
					))}
					<span className="ml-2 text-sm text-zinc-500">{PANEL_LABELS[activePanel]}</span>
				</div>
			)}

			{/* Carousel panels */}
			<div
				className="min-h-0 flex-1 rounded-lg border border-zinc-800 bg-zinc-900 transition-opacity duration-500"
				style={{ opacity: visible ? 1 : 0 }}
			>
				{activePanel === 0 && (
					!driverLoaded ? (
						<div className="flex h-full items-center justify-center text-zinc-500">Loading standings…</div>
					) : driverStandings !== null ? (
						<DriverStandings standings={driverStandings} season={driverSeason} />
					) : (
						<div className="flex h-full items-center justify-center text-zinc-500">
							Standings unavailable — will retry when connection is restored
						</div>
					)
				)}
				{activePanel === 1 && (
					!constructorLoaded ? (
						<div className="flex h-full items-center justify-center text-zinc-500">Loading standings…</div>
					) : constructorStandings !== null ? (
						<ConstructorStandings standings={constructorStandings} season={constructorSeason} />
					) : (
						<div className="flex h-full items-center justify-center text-zinc-500">
							Standings unavailable — will retry when connection is restored
						</div>
					)
				)}
				{activePanel === 2 && (
					!scheduleLoaded ? (
						<div className="flex h-full items-center justify-center text-zinc-500">Loading schedule…</div>
					) : (
						<NextRacePanel round={nextRound} />
					)
				)}
				{activePanel === 3 && (
					!scheduleLoaded ? (
						<div className="flex h-full items-center justify-center text-zinc-500">Loading schedule…</div>
					) : (
						<CircuitSchedulePanel round={nextRound} />
					)
				)}
				{activePanel === 4 && (
					!lastRaceLoaded ? (
						<div className="flex h-full items-center justify-center text-zinc-500">Loading last race…</div>
					) : (
						<LastRacePanel race={lastRace} />
					)
				)}
				{activePanel === 5 && (
					!driverLoaded ? (
						<div className="flex h-full items-center justify-center text-zinc-500">Loading standings…</div>
					) : driverStandings !== null ? (
						<DriverSeasonPanel standings={driverStandings} season={driverSeason} />
					) : (
						<div className="flex h-full items-center justify-center text-zinc-500">
							Standings unavailable — will retry when connection is restored
						</div>
					)
				)}
			</div>
		</div>
	);
}
