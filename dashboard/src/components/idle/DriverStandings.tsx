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

export default function DriverStandings({ standings, season }: Props) {
	return (
		<Panel padded={false} className="p-6">
			<PanelHeader
				eyebrow="Championship"
				title="Drivers"
				aside={<span className="nums text-lg font-semibold text-t3">{season}</span>}
			/>

			<div className="grid min-h-0 flex-1 grid-cols-2 gap-x-6 gap-y-0.5 overflow-y-auto">
				{standings.map((entry) => (
					<StandingRow
						key={entry.Driver.driverId}
						position={entry.position}
						teamColor={getTeamColor(entry.Constructors[0]?.constructorId ?? "")}
						primary={`${entry.Driver.givenName[0]}. ${entry.Driver.familyName}`}
						value={
							<>
								{entry.points}
								<span className="ml-1 text-xs font-normal text-t3">pts</span>
							</>
						}
					/>
				))}
			</div>
		</Panel>
	);
}
