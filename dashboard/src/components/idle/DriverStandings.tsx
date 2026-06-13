"use client";

import type { JolpicaDriverStanding } from "@/types/jolpica.type";
import { getTeamColor } from "@/lib/teamColors";

type Props = {
	standings: JolpicaDriverStanding[];
	season: string;
};

export default function DriverStandings({ standings, season }: Props) {
	return (
		<div className="flex h-full flex-col gap-4 p-4">
			<h2 className="text-2xl font-bold text-zinc-300">
				Drivers&apos; Championship{" "}
				<span className="text-base font-normal text-zinc-500">{season}</span>
			</h2>

			<div className="grid grid-cols-2 gap-x-8 gap-y-1">
				{standings.slice(0, 20).map((entry) => {
					const teamColor = getTeamColor(entry.Constructors[0]?.constructorId ?? "");
					return (
						<div
							key={entry.Driver.driverId}
							className="flex items-center gap-3 rounded px-2 py-1.5"
						>
							<span className="w-6 text-right text-sm font-bold text-zinc-500">{entry.position}</span>

							<div
								className="h-5 w-1.5 shrink-0 rounded-full"
								style={{ backgroundColor: `#${teamColor}` }}
							/>

							<span className="flex-1 text-lg font-semibold">
								{entry.Driver.givenName[0]}. {entry.Driver.familyName}
							</span>

							<span className="text-lg font-bold tabular-nums">{entry.points}</span>
							<span className="text-xs text-zinc-500">pts</span>
						</div>
					);
				})}
			</div>
		</div>
	);
}
