"use client";

import type { JolpicaDriverStanding } from "@/types/jolpica.type";
import { getTeamColor } from "@/lib/teamColors";

import Panel from "@/components/idle/Panel";
import PanelHeader from "@/components/idle/PanelHeader";
import StandingRow from "@/components/idle/StandingRow";

type Props = {
	standings: JolpicaDriverStanding[];
	season: string;
};

export default function DriverSeasonPanel({ standings, season }: Props) {
	const maxPts = Number(standings[0]?.points ?? 1);
	const leaderPts = Number(standings[0]?.points ?? 0);

	return (
		<Panel padded={false} className="p-6">
			<PanelHeader
				eyebrow="Season"
				title="Driver Stats"
				aside={<span className="nums text-lg font-semibold text-t3">{season}</span>}
			/>

			<div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
				{standings.map((entry) => {
					const pts = Number(entry.points);
					const wins = Number(entry.wins);
					const gap = leaderPts - pts;
					const barPct = maxPts > 0 ? Math.round((pts / maxPts) * 100) : 0;
					const color = getTeamColor(entry.Constructors[0]?.constructorId ?? "");

					return (
						<div key={entry.Driver.driverId} className="flex flex-col gap-0.5">
							<StandingRow
								position={entry.position}
								teamColor={color}
								primary={`${entry.Driver.givenName[0]}. ${entry.Driver.familyName}`}
								secondary={entry.Constructors[0]?.name}
								extra={
									<div className="flex items-center gap-3">
										{wins > 0 && (
											<span className="text-xs font-bold text-gold">{wins}W</span>
										)}
										{gap > 0 && <span className="nums w-14 text-right text-xs text-t3">&minus;{gap}</span>}
									</div>
								}
								value={<span className="text-t1">{entry.points}</span>}
							/>
							<div className="mx-3 ml-[2.5rem] h-0.5 overflow-hidden rounded-full bg-s2">
								<div
									className="h-full rounded-full"
									style={{ width: `${barPct}%`, backgroundColor: `#${color}` }}
								/>
							</div>
						</div>
					);
				})}
			</div>
		</Panel>
	);
}
