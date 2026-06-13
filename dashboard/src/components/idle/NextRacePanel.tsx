"use client";

import { utc } from "moment";

import type { Round } from "@/types/schedule.type";

import RoundCard from "@/components/schedule/Round";
import Countdown from "@/components/schedule/Countdown";

type Props = {
	round: Round | null;
};

export default function NextRacePanel({ round }: Props) {
	if (!round) {
		return (
			<div className="flex h-full flex-col items-center justify-center gap-2 p-4">
				<p className="text-xl text-zinc-400">No upcoming race weekend found</p>
			</div>
		);
	}

	const nextSession = round.sessions.filter(
		(s) => utc(s.start) > utc() && s.kind.toLowerCase() !== "race",
	)[0];
	const nextRace = round.sessions.find((s) => s.kind.toLowerCase() === "race");

	return (
		<div className="flex h-full flex-col gap-6 p-4">
			<h2 className="text-2xl font-bold text-zinc-300">Next Race Weekend</h2>

			<div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
				<div className="flex flex-col gap-4">
					{nextSession && <Countdown next={nextSession} type="other" />}
					{nextRace && <Countdown next={nextRace} type="race" />}
				</div>

				<div className="overflow-hidden">
					<RoundCard round={round} />
				</div>
			</div>
		</div>
	);
}
