"use client";

import { utc } from "moment";

import type { Round } from "@/types/schedule.type";

import RoundCard from "@/components/schedule/Round";
import Countdown from "@/components/schedule/Countdown";
import Panel from "@/components/idle/Panel";
import PanelHeader from "@/components/idle/PanelHeader";

type Props = {
	round: Round | null;
};

export default function NextRacePanel({ round }: Props) {
	if (!round) {
		return (
			<div className="flex h-full flex-col items-center justify-center gap-2 p-6">
				<p className="text-xl text-t2">No upcoming race weekend found</p>
			</div>
		);
	}

	const nextSession = round.sessions.filter(
		(s) => utc(s.start) > utc() && s.kind.toLowerCase() !== "race",
	)[0];
	const nextRace = round.sessions.find((s) => s.kind.toLowerCase() === "race");

	return (
		<Panel>
			<PanelHeader eyebrow="Up Next" title="Next Race Weekend" subtitle={round.name} />

			<div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
				<div className="flex flex-col gap-5">
					{nextSession && <Countdown next={nextSession} type="other" />}
					{nextRace && <Countdown next={nextRace} type="race" />}
				</div>

				<div className="overflow-hidden">
					<RoundCard round={round} />
				</div>
			</div>
		</Panel>
	);
}
