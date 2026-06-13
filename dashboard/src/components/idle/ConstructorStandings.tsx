"use client";

import type { JolpicaConstructorStanding } from "@/types/jolpica.type";
import { getTeamColor } from "@/lib/teamColors";

type Props = {
	standings: JolpicaConstructorStanding[];
	season: string;
};

export default function ConstructorStandings({ standings, season }: Props) {
	return (
		<div className="flex h-full flex-col gap-4 p-4">
			<h2 className="text-2xl font-bold text-zinc-300">
				Constructors&apos; Championship{" "}
				<span className="text-base font-normal text-zinc-500">{season}</span>
			</h2>

			<div className="flex flex-col gap-2">
				{standings.map((entry) => {
					const teamColor = getTeamColor(entry.Constructor.constructorId);
					const maxPts = Number(standings[0]?.points ?? 1);
					const pts = Number(entry.points);
					const barPct = Math.round((pts / maxPts) * 100);

					return (
						<div key={entry.Constructor.constructorId} className="flex flex-col gap-1 px-2">
							<div className="flex items-center gap-3">
								<span className="w-6 text-right text-sm font-bold text-zinc-500">
									{entry.position}
								</span>

								<div
									className="h-5 w-1.5 shrink-0 rounded-full"
									style={{ backgroundColor: `#${teamColor}` }}
								/>

								<span className="flex-1 text-xl font-semibold">{entry.Constructor.name}</span>

								<span className="text-xl font-bold tabular-nums">{entry.points}</span>
								<span className="text-xs text-zinc-500">pts</span>
							</div>

							<div className="ml-[3.25rem] h-1 overflow-hidden rounded-full bg-zinc-800">
								<div
									className="h-full rounded-full transition-all duration-500"
									style={{
										width: `${barPct}%`,
										backgroundColor: `#${teamColor}`,
									}}
								/>
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}
