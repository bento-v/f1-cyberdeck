"use client";

import type { JolpicaDriverStanding } from "@/types/jolpica.type";
import { getTeamColor } from "@/lib/teamColors";

type Props = {
	standings: JolpicaDriverStanding[];
	season: string;
};

export default function DriverSeasonPanel({ standings, season }: Props) {
	const maxPts = Number(standings[0]?.points ?? 1);
	const leaderPts = Number(standings[0]?.points ?? 0);

	return (
		<div className="flex h-full flex-col gap-2 overflow-y-auto p-4">
			<h2 className="text-2xl font-bold text-zinc-300">
				Driver Stats <span className="text-base font-normal text-zinc-500">{season}</span>
			</h2>

			<div className="flex flex-col gap-1.5">
				{standings.map((entry) => {
					const pts = Number(entry.points);
					const wins = Number(entry.wins);
					const gap = leaderPts - pts;
					const barPct = maxPts > 0 ? Math.round((pts / maxPts) * 100) : 0;
					const color = getTeamColor(entry.Constructors[0]?.constructorId ?? "");

					return (
						<div key={entry.Driver.driverId} className="flex flex-col gap-0.5">
							<div className="flex items-center gap-2">
								<span className="w-5 text-right text-xs font-bold text-zinc-500">
									{entry.position}
								</span>

								<div
									className="h-4 w-1 shrink-0 rounded-full"
									style={{ backgroundColor: `#${color}` }}
								/>

								<span className="w-36 truncate text-sm font-semibold">
									{entry.Driver.givenName[0]}. {entry.Driver.familyName}
								</span>

								<span className="flex-1 truncate text-xs text-zinc-500">
									{entry.Constructors[0]?.name}
								</span>

								{wins > 0 && (
									<span className="text-xs font-bold text-yellow-400">{wins}W</span>
								)}

								{gap > 0 && (
									<span className="w-16 text-right text-xs text-zinc-500">
										&minus;{gap}
									</span>
								)}

								<span className="w-12 text-right text-sm font-bold tabular-nums">
									{entry.points}
								</span>
							</div>

							<div className="ml-8 h-0.5 overflow-hidden rounded-full bg-zinc-800">
								<div
									className="h-full rounded-full"
									style={{ width: `${barPct}%`, backgroundColor: `#${color}` }}
								/>
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}
