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

type CacheEntry<T> = { data: T; ts: number };

// Module-level cache to survive re-renders without localStorage complexity
const fetchCache = new Map<string, CacheEntry<unknown>>();

async function cachedFetch<T>(url: string): Promise<T> {
	const hit = fetchCache.get(url) as CacheEntry<T> | undefined;
	if (hit && Date.now() - hit.ts < CACHE_TTL) return hit.data;

	const res = await fetch(url);
	if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
	const data: T = await res.json();
	fetchCache.set(url, { data, ts: Date.now() });
	return data;
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

	// Fetch standings once on mount
	useEffect(() => {
		cachedFetch<JolpicaDriverStandingsResponse>(`${JOLPICA_BASE}/current/driverstandings.json?limit=20`)
			.then((res) => {
				const list = res.MRData.StandingsTable.StandingsLists[0];
				if (list) {
					setDriverStandings(list.DriverStandings);
					setDriverSeason(list.season);
				}
			})
			.catch(console.error);

		cachedFetch<JolpicaConstructorStandingsResponse>(`${JOLPICA_BASE}/current/constructorstandings.json?limit=10`)
			.then((res) => {
				const list = res.MRData.StandingsTable.StandingsLists[0];
				if (list) {
					setConstructorStandings(list.ConstructorStandings);
					setConstructorSeason(list.season);
				}
			})
			.catch(console.error);

		// Fetch schedule via local proxy (avoids exposing server-side API_URL)
		fetch("/api/schedule")
			.then((r) => r.json())
			.then((data: Round | null) => setNextRound(data))
			.catch(console.error);
	}, []);

	// Auto-cycle with fade transition
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
							setVisible(false);
							setTimeout(() => {
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
					<DriverStandings
						standings={driverStandings ?? []}
						season={driverSeason}
					/>
				)}
				{activePanel === 1 && (
					<ConstructorStandings
						standings={constructorStandings ?? []}
						season={constructorSeason}
					/>
				)}
				{activePanel === 2 && <NextRacePanel round={nextRound} />}
			</div>
		</div>
	);
}
