"use client";

import type { ChampionshipPrediction, DriverList, SessionInfo, TimingData, TimingDataDriver } from "@/types/state.type";

import Reveal from "@/components/ui/Reveal";
import PanelHeader from "@/components/idle/PanelHeader";
import PodiumCard from "@/components/idle/PodiumCard";
import StandingRow from "@/components/idle/StandingRow";

export type RaceSummaryData = {
	drivers: DriverList;
	timing: TimingData;
	championship?: ChampionshipPrediction;
	sessionInfo?: SessionInfo;
};

function posNum(d: TimingDataDriver): number {
	const p = parseInt(d.Position, 10);
	return Number.isFinite(p) ? p : 999;
}

export default function RaceSummary({ drivers, timing, championship, sessionInfo }: RaceSummaryData) {
	const lines = Object.values(timing.Lines ?? {});
	const finishers = lines.filter((l) => !l.Retired && !l.Stopped).sort((a, b) => posNum(a) - posNum(b));
	const dnfs = lines.filter((l) => l.Retired || l.Stopped).sort((a, b) => posNum(a) - posNum(b));

	const podium = finishers.slice(0, 3);
	const rest = finishers.slice(3, 8); // P4–P8 under the podium

	const raceName = sessionInfo?.Meeting?.Name ?? "Race";

	const champ = championship?.Drivers
		? Object.values(championship.Drivers)
				.sort((a, b) => a.PredictedPosition - b.PredictedPosition)
				.slice(0, 8)
		: [];

	const driverName = (num: string) => {
		const d = drivers[num];
		if (!d) return num;
		return `${d.FirstName?.[0] ?? ""}. ${d.LastName ?? d.Tla}`;
	};
	const teamColor = (num: string) => drivers[num]?.TeamColour ?? "52525b";
	const tla = (num: string) => drivers[num]?.Tla ?? num;
	const team = (num: string) => drivers[num]?.TeamName ?? "";

	return (
		<Reveal className="h-full w-full">
			<div className="flex h-full w-full flex-col gap-5 p-6">
				<PanelHeader eyebrow="Race Result" title={raceName} />

				<div className="grid min-h-0 flex-1 grid-cols-[1.4fr_1fr] gap-5">
					{/* Left: podium + next finishers + DNFs */}
					<div className="flex min-h-0 flex-col gap-4">
						<div className="grid grid-cols-3 gap-3">
							{podium.map((l, i) => (
								<PodiumCard
									key={l.RacingNumber}
									index={i}
									teamColor={teamColor(l.RacingNumber)}
									tla={tla(l.RacingNumber)}
									team={team(l.RacingNumber)}
									value={l.GapToLeader || "—"}
									winnerLabel="Winner"
								/>
							))}
						</div>

						<div className="flex flex-col gap-0.5">
							{rest.map((l) => (
								<StandingRow
									key={l.RacingNumber}
									position={l.Position}
									teamColor={teamColor(l.RacingNumber)}
									primary={tla(l.RacingNumber)}
									secondary={team(l.RacingNumber)}
									value={l.GapToLeader || "—"}
								/>
							))}
						</div>

						{dnfs.length > 0 && (
							<div className="flex flex-col gap-2">
								<p className="t-eyebrow text-negative">Did not finish</p>
								<div className="flex flex-wrap gap-x-4 gap-y-1">
									{dnfs.map((l) => (
										<div key={l.RacingNumber} className="flex items-center gap-2">
											<div
												className="h-3 w-1 shrink-0 rounded-full opacity-70"
												style={{ backgroundColor: `#${teamColor(l.RacingNumber)}` }}
											/>
											<span className="text-sm font-medium text-t2">{tla(l.RacingNumber)}</span>
											<span className="text-xs text-t4">{l.Status === 0 ? "DNF" : "OUT"}</span>
										</div>
									))}
								</div>
							</div>
						)}
					</div>

					{/* Right: championship impact */}
					<div className="flex min-h-0 flex-col gap-3 rounded-lg border border-hairline bg-s1/60 p-4">
						<p className="t-eyebrow">Championship</p>
						{champ.length === 0 ? (
							<div className="flex flex-1 items-center justify-center text-sm text-t3">
								Championship data unavailable
							</div>
						) : (
							<div className="flex flex-col gap-0.5">
								{champ.map((c) => {
									const move = c.CurrentPosition - c.PredictedPosition; // + = gained places
									return (
										<StandingRow
											key={c.RacingNumber}
											position={c.PredictedPosition}
											teamColor={teamColor(c.RacingNumber)}
											primary={<span className="font-medium">{driverName(c.RacingNumber)}</span>}
											extra={
												<span className="nums w-7 text-center text-xs font-semibold">
													{move > 0 ? (
														<span className="text-positive">▲{move}</span>
													) : move < 0 ? (
														<span className="text-negative">▼{-move}</span>
													) : (
														<span className="text-t4">—</span>
													)}
												</span>
											}
											value={<span className="text-t1">{c.PredictedPoints}</span>}
										/>
									);
								})}
							</div>
						)}
					</div>
				</div>
			</div>
		</Reveal>
	);
}
