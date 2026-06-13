"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { JolpicaConstructorStanding, JolpicaConstructorStandingsResponse, JolpicaDriverStanding, JolpicaDriverStandingsResponse } from "@/types/jolpica.type";
import type { Round } from "@/types/schedule.type";

import IdleCountdownBar from "@/components/idle/IdleCountdownBar";
import DriverStandings from "@/components/idle/DriverStandings";
import ConstructorStandings from "@/components/idle/ConstructorStandings";
import NextRacePanel from "@/components/idle/NextRacePanel";

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

type Props = {
	onPreLive?: () => void;
};

const PANEL_LABELS = ["Drivers' Championship", "Constructors' Championship", "Next Race Weekend"];

export default function IdleCarousel({ onPreLive }: Props) {
	const [activePanel, setActivePanel] = useState(0);
	const [visible, setVisible] = useState(true);

	const [driverStandings, setDriverStandings] = useState<JolpicaDriverStanding[] | null>(null);
	const [driverSeason, setDriverSeason] = useState("");
	const [constructorStandings, setConstructorStandings] = useState<JolpicaConstructorStanding[] | null>(null);
	const [constructorSeason, setConstructorSeason] = useState("");
	const [nextRound, setNextRound] = useState<Round | null>(null);

	// Derive next upcoming session for the countdown bar
	const nextSession = nextRound?.sessions.find((s) => new Date(s.start) > new Date()) ?? null;

	// Fetch standings once on mount (cachedFetch never throws — returns null on outage)
	useEffect(() => {
		cachedFetch<JolpicaDriverStandingsResponse>(`${JOLPICA_BASE}/current/driverstandings.json?limit=20`)
			.then((res) => {
				if (!res) return; // cold-start outage — keep null to show placeholder
				const list = res.MRData.StandingsTable.StandingsLists[0];
				if (list) {
					setDriverStandings(list.DriverStandings);
					setDriverSeason(list.season);
				}
			});

		cachedFetch<JolpicaConstructorStandingsResponse>(`${JOLPICA_BASE}/current/constructorstandings.json?limit=10`)
			.then((res) => {
				if (!res) return;
				const list = res.MRData.StandingsTable.StandingsLists[0];
				if (list) {
					setConstructorStandings(list.ConstructorStandings);
					setConstructorSeason(list.season);
				}
			});

		// Fetch schedule via local proxy (avoids exposing server-side API_URL)
		fetch("/api/schedule")
			.then((r) => r.json())
			.then((data: Round | null) => setNextRound(data))
			.catch(console.error);
	}, []);

	// Auto-cycle with fade transition
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const advance = useCallback(() => {
		setVisible(false);
		timerRef.current = setTimeout(() => {
			setActivePanel((p) => (p + 1) % 3);
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

			{/* Panel indicator dots */}
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

			{/* Carousel panels */}
			<div
				className="min-h-0 flex-1 rounded-lg border border-zinc-800 bg-zinc-900 transition-opacity duration-500"
				style={{ opacity: visible ? 1 : 0 }}
			>
				{activePanel === 0 && (
					driverStandings !== null ? (
						<DriverStandings standings={driverStandings} season={driverSeason} />
					) : (
						<div className="flex h-full items-center justify-center text-zinc-500">
							Standings unavailable — will retry when connection is restored
						</div>
					)
				)}
				{activePanel === 1 && (
					constructorStandings !== null ? (
						<ConstructorStandings standings={constructorStandings} season={constructorSeason} />
					) : (
						<div className="flex h-full items-center justify-center text-zinc-500">
							Standings unavailable — will retry when connection is restored
						</div>
					)
				)}
				{activePanel === 2 && <NextRacePanel round={nextRound} />}
			</div>
		</div>
	);
}
