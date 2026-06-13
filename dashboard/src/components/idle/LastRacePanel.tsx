"use client";

import type { JolpicaRace } from "@/types/jolpica.type";
import { getTeamColor } from "@/lib/teamColors";

type Props = { race: JolpicaRace | null };

export default function LastRacePanel({ race }: Props) {
	if (!race) {
		return (
			<div className="flex h-full items-center justify-center text-zinc-500">
				Last race results unavailable
			</div>
		);
	}

	const top3 = race.Results.slice(0, 3);
	const rest = race.Results.slice(3, 10);
	const fastestLap = race.Results.find((r) => r.FastestLap?.rank === "1");

	return (
		<div className="flex h-full flex-col gap-4 overflow-y-auto p-6">
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
	);
}
