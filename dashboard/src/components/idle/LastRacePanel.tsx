"use client";

import type { JolpicaRace, JolpicaResult } from "@/types/jolpica.type";
import { getTeamColor } from "@/lib/teamColors";

type Props = { race: JolpicaRace | null };

// A finisher took the chequered flag: "Finished" or "Lapped" (Jolpica's word for
// one-or-more laps down; also tolerate the "+N Lap(s)" form). Anything else
// (Retired, Accident, Engine, Collision, Disqualified, …) is a DNF.
const isFinisher = (status: string) =>
	status === "Finished" || status === "Lapped" || /^\+\d+ Laps?$/.test(status);

export default function LastRacePanel({ race }: Props) {
	if (!race) {
		return (
			<div className="flex h-full items-center justify-center text-zinc-500">
				Last race results unavailable
			</div>
		);
	}

	// Finishers fill the podium + list; retirements go to the marquee (no overlap).
	const finishers = race.Results.filter((r) => isFinisher(r.status));
	const dnfs = race.Results.filter((r) => !isFinisher(r.status));
	const top3 = finishers.slice(0, 3);
	const rest = finishers.slice(3, 10);
	const fastestLap = race.Results.find((r) => r.FastestLap?.rank === "1");

	return (
		<div className="flex h-full flex-col">
			<div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-6">
				<div>
					<p className="text-xs font-semibold uppercase tracking-widest text-red-500">Last Race</p>
					<h2 className="text-2xl font-bold text-white">{race.raceName}</h2>
					<p className="text-sm text-zinc-400">
						{race.Circuit.circuitName} &middot; {race.Circuit.Location.locality},{" "}
						{race.Circuit.Location.country}
					</p>
				</div>

				{/* Podium */}
				<div className="grid grid-cols-3 gap-3">
					{top3.map((r, i) => {
						const color = getTeamColor(r.Constructor.constructorId);
						return (
							<div
								key={r.Driver.driverId}
								className="flex flex-col items-center gap-1 rounded-lg bg-zinc-800 p-3 text-center"
								style={{ borderTop: `3px solid #${color}` }}
							>
								<p className="text-xs font-bold text-zinc-500">{["P1", "P2", "P3"][i]}</p>
								<p className="text-2xl font-bold text-white">{r.Driver.code}</p>
								<p className="text-xs text-zinc-400">{r.Constructor.name}</p>
								<p className="font-mono text-xs text-zinc-300">{r.Time?.time ?? r.status}</p>
							</div>
						);
					})}
				</div>

				{/* P4 – P10 */}
				<div className="flex flex-col gap-1">
					{rest.map((r) => {
						const color = getTeamColor(r.Constructor.constructorId);
						const isFastest = r.FastestLap?.rank === "1";
						return (
							<div key={r.Driver.driverId} className="flex items-center gap-2 rounded px-3 py-1.5 bg-zinc-800/50">
								<span className="w-5 text-right font-mono text-sm text-zinc-500">{r.positionText}</span>
								<div className="h-4 w-1 shrink-0 rounded-full" style={{ backgroundColor: `#${color}` }} />
								<span className="w-9 text-sm font-bold">{r.Driver.code}</span>
								<span className="flex-1 text-xs text-zinc-400">{r.Constructor.name}</span>
								{isFastest && (
									<span className="text-xs font-semibold text-purple-400">
										{r.FastestLap?.Time.time}
									</span>
								)}
								<span className="font-mono text-xs text-zinc-300">{r.Time?.time ?? r.status}</span>
							</div>
						);
					})}
				</div>

				{fastestLap && (
					<p className="text-xs text-zinc-500">
						<span className="font-semibold text-purple-400">Fastest lap:</span>{" "}
						{fastestLap.Driver.code} &middot; {fastestLap.FastestLap?.Time.time}
					</p>
				)}
			</div>

			{dnfs.length > 0 && <DnfMarquee dnfs={dnfs} />}
		</div>
	);
}

function DnfMarquee({ dnfs }: { dnfs: JolpicaResult[] }) {
	// Repeat the content twice and translate -50% for a seamless loop.
	// Duration scales with the number of retirements for a consistent scroll speed.
	const duration = Math.max(20, dnfs.length * 6);

	const Content = () => (
		<span className="px-6 text-sm">
			<span className="font-semibold uppercase tracking-wider text-red-500">Did not finish</span>
			<span className="text-zinc-600"> — </span>
			{dnfs.map((r, i) => (
				<span key={r.Driver.driverId}>
					{i > 0 && <span className="text-zinc-700"> &nbsp;•&nbsp; </span>}
					<span className="font-bold text-zinc-200">{r.Driver.code}</span>
					<span className="text-zinc-500"> {r.status}</span>
				</span>
			))}
		</span>
	);

	return (
		<div className="relative shrink-0 overflow-hidden border-t border-zinc-800 bg-zinc-900/80 py-2">
			<div
				className="flex w-max flex-nowrap whitespace-nowrap will-change-transform"
				style={{ animation: `f1-dnf-marquee ${duration}s linear infinite` }}
			>
				<Content />
				<Content />
			</div>
			<style>{`@keyframes f1-dnf-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }`}</style>
		</div>
	);
}
