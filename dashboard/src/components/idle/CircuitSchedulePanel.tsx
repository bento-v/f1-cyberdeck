"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { Round } from "@/types/schedule.type";
import type { JolpicaResult, JolpicaQualifyingResult } from "@/types/jolpica.type";
import { getTeamColor } from "@/lib/teamColors";

const isKiosk = process.env.NEXT_PUBLIC_KIOSK === "1";

// How long each dropdown stays open before closing (ms)
const KIOSK_VIEW_MS = 4_500;
// Gap between close of one and open of next (ms)
const KIOSK_GAP_MS = 400;
// Initial pause before the first dropdown opens (ms)
const KIOSK_INITIAL_MS = 900;

function sessionDotColor(kind: string): string {
	const k = kind.toLowerCase();
	if (k === "race") return "bg-red-600";
	if (k.startsWith("sprint")) return "bg-orange-500";
	if (k.includes("qualifying")) return "bg-yellow-500";
	return "bg-blue-500";
}

function hasResults(kind: string): boolean {
	const k = kind.toLowerCase();
	return k === "race" || k === "qualifying" || k === "sprint";
}

function RaceResultsList({ results }: { results: JolpicaResult[] }) {
	return (
		<div className="flex flex-col divide-y divide-zinc-700/50">
			{results.slice(0, 10).map((r) => {
				const color = `#${getTeamColor(r.Constructor.constructorId)}`;
				const gap = r.Time?.time ?? (r.status !== "Finished" ? r.status : "—");
				return (
					<div key={r.position} className="flex items-center gap-3 px-4 py-1.5">
						<span className="w-5 text-right text-xs font-bold text-zinc-400">{r.position}</span>
						<div
							className="h-4 w-1 shrink-0 rounded-full"
							style={{ backgroundColor: color }}
						/>
						<span className="flex-1 text-sm font-medium">
							{r.Driver.givenName[0]}. {r.Driver.familyName}
						</span>
						<span className="text-xs text-zinc-400">{r.Constructor.name}</span>
						<span className="w-20 text-right font-mono text-xs text-zinc-300">{gap}</span>
					</div>
				);
			})}
		</div>
	);
}

function QualifyingResultsList({ results }: { results: JolpicaQualifyingResult[] }) {
	return (
		<div className="flex flex-col divide-y divide-zinc-700/50">
			{results.slice(0, 10).map((r) => {
				const color = `#${getTeamColor(r.Constructor.constructorId)}`;
				const best = r.Q3 ?? r.Q2 ?? r.Q1 ?? "—";
				return (
					<div key={r.position} className="flex items-center gap-3 px-4 py-1.5">
						<span className="w-5 text-right text-xs font-bold text-zinc-400">{r.position}</span>
						<div
							className="h-4 w-1 shrink-0 rounded-full"
							style={{ backgroundColor: color }}
						/>
						<span className="flex-1 text-sm font-medium">
							{r.Driver.givenName[0]}. {r.Driver.familyName}
						</span>
						<span className="text-xs text-zinc-400">{r.Constructor.name}</span>
						<span className="w-20 text-right font-mono text-xs text-zinc-300">{best}</span>
					</div>
				);
			})}
		</div>
	);
}

type Props = {
	round: Round | null;
	raceResults: JolpicaResult[] | null;
	qualifyingResults: JolpicaQualifyingResult[] | null;
	sprintResults: JolpicaResult[] | null;
};

export default function CircuitSchedulePanel({ round, raceResults, qualifyingResults, sprintResults }: Props) {
	const [expanded, setExpanded] = useState<string | null>(null);

	// Sessions that currently have results to reveal, in schedule order.
	const expandableKinds = useMemo(() => {
		if (!round) return [];
		return round.sessions
			.filter((s) => {
				if (!hasResults(s.kind)) return false;
				const k = s.kind.toLowerCase();
				if (k === "race") return !!raceResults?.length;
				if (k === "sprint") return !!sprintResults?.length;
				return !!qualifyingResults?.length;
			})
			.map((s) => s.kind);
	}, [round, raceResults, qualifyingResults, sprintResults]);

	// Stable signal: only changes when the *set* of available results changes,
	// not on every prop identity change.
	const kindsKey = expandableKinds.join("|");

	// Kiosk: auto-cycle the result dropdowns. Timers and their cleanup live in the
	// SAME effect so the sequence survives React StrictMode's mount→unmount→remount
	// in dev and the carousel's per-cycle remount in production. It loops through
	// the available results to fill the panel's on-screen window, and restarts
	// cleanly if results arrive after first render (kindsKey changes).
	useEffect(() => {
		if (!isKiosk || expandableKinds.length === 0) return;

		let cancelled = false;
		let timer: ReturnType<typeof setTimeout>;
		let i = 0;

		const open = () => {
			if (cancelled) return;
			setExpanded(expandableKinds[i % expandableKinds.length]);
			timer = setTimeout(close, KIOSK_VIEW_MS);
		};
		const close = () => {
			if (cancelled) return;
			setExpanded(null);
			i += 1;
			timer = setTimeout(open, KIOSK_GAP_MS);
		};

		timer = setTimeout(open, KIOSK_INITIAL_MS);

		return () => {
			cancelled = true;
			clearTimeout(timer);
			setExpanded(null);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [kindsKey]);

	if (!round) {
		return (
			<div className="flex h-full items-center justify-center text-zinc-500">
				No upcoming race weekend
			</div>
		);
	}

	const now = new Date();

	function toggle(key: string) {
		setExpanded((prev) => (prev === key ? null : key));
	}

	return (
		<div className="flex h-full flex-col gap-4 overflow-y-auto p-6">
			<div>
				<p className="text-xs font-semibold uppercase tracking-widest text-red-500">Circuit &amp; Schedule</p>
				<h2 className="text-3xl font-bold text-white">{round.name}</h2>
				<p className="text-base text-zinc-400">{round.countryName}</p>
			</div>

			<div className="flex flex-col gap-1.5">
				{round.sessions.map((session) => {
					const start = new Date(session.start);
					const isPast = start < now;
					const expandable = hasResults(session.kind);
					const k = session.kind.toLowerCase();
					const resultsData =
						k === "race" ? raceResults :
						k === "sprint" ? sprintResults :
						qualifyingResults;
					const isOpen = expanded === session.kind && expandable && !!resultsData;

					return (
						<div key={session.kind + session.start}>
							<button
								className={`flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-left transition-colors ${
									isPast ? "bg-zinc-800/40 opacity-40" : "bg-zinc-800"
								} ${expandable && resultsData ? "cursor-pointer hover:bg-zinc-700" : "cursor-default"}`}
								onClick={() => expandable && resultsData ? toggle(session.kind) : undefined}
								disabled={!expandable || !resultsData}
							>
								<div className={`h-3 w-3 shrink-0 rounded-full ${sessionDotColor(session.kind)}`} />

								<span className="flex-1 text-sm font-medium">{session.kind}</span>

								<span className="text-sm text-zinc-400">
									{start.toLocaleDateString("en-GB", {
										weekday: "short",
										month: "short",
										day: "numeric",
									})}
								</span>

								<span className="w-14 text-right font-mono text-sm font-semibold">
									{start.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
								</span>

								{expandable && resultsData && (
									<motion.span
										animate={{ rotate: isOpen ? 180 : 0 }}
										transition={{ duration: 0.2 }}
										className="ml-1 text-xs text-zinc-500"
									>
										▾
									</motion.span>
								)}
							</button>

							<AnimatePresence initial={false}>
								{isOpen && (
									<motion.div
										key="content"
										initial={{ height: 0, opacity: 0 }}
										animate={{ height: "auto", opacity: 1 }}
										exit={{ height: 0, opacity: 0 }}
										transition={{ duration: 0.25, ease: "easeInOut" }}
										className="overflow-hidden rounded-b-lg border border-t-0 border-zinc-700 bg-zinc-800/60"
									>
										{k === "race" && raceResults && (
											<RaceResultsList results={raceResults} />
										)}
										{k === "sprint" && sprintResults && (
											<RaceResultsList results={sprintResults} />
										)}
										{k === "qualifying" && qualifyingResults && (
											<QualifyingResultsList results={qualifyingResults} />
										)}
									</motion.div>
								)}
							</AnimatePresence>
						</div>
					);
				})}
			</div>
		</div>
	);
}
