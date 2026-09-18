"use client";

import type { JolpicaConstructorStanding } from "@/types/jolpica.type";
import { getTeamColor } from "@/lib/teamColors";

import Panel from "@/components/idle/Panel";
import PanelHeader from "@/components/idle/PanelHeader";
import StandingRow from "@/components/idle/StandingRow";

type Props = {
	standings: JolpicaConstructorStanding[];
	season: string;
};

export default function ConstructorStandings({ standings, season }: Props) {
	const maxPts = Number(standings[0]?.points ?? 1);

	return (
		<Panel padded={false} className="p-6">
			<PanelHeader
				eyebrow="Championship"
				title="Constructors"
				aside={<span className="nums text-lg font-semibold text-t3">{season}</span>}
			/>

			<div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto">
				{standings.map((entry) => {
					const teamColor = getTeamColor(entry.Constructor.constructorId);
					const barPct = maxPts > 0 ? Math.round((Number(entry.points) / maxPts) * 100) : 0;

					return (
						<div key={entry.Constructor.constructorId} className="flex flex-col gap-1">
							<StandingRow
								position={entry.position}
								teamColor={teamColor}
								primary={entry.Constructor.name}
								value={
									<>
										{entry.points}
										<span className="ml-1 text-xs font-normal text-t3">pts</span>
									</>
								}
							/>
							<div className="ml-[3.75rem] h-1 overflow-hidden rounded-full bg-s2">
								<div
									className="h-full rounded-full"
									style={{ width: `${barPct}%`, backgroundColor: `#${teamColor}` }}
								/>
							</div>
						</div>
					);
				})}
			</div>
		</Panel>
	);
}
