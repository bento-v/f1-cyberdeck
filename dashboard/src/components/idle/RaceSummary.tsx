"use client";

import type { ChampionshipPrediction, DriverList, SessionInfo, TimingData, TimingDataDriver } from "@/types/state.type";

export type RaceSummaryData = {
	drivers: DriverList;
	timing: TimingData;
	championship?: ChampionshipPrediction;
	sessionInfo?: SessionInfo;
};

const PODIUM_LABEL = ["P1", "P2", "P3"];
const PODIUM_ACCENT = ["#facc15", "#cbd5e1", "#d8843a"]; // gold / silver / bronze

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
	const teamColor = (num: string) => `#${drivers[num]?.TeamColour ?? "52525b"}`;

	return (
		<div className="flex h-full w-full flex-col gap-4 p-6">
			<div>
				<p className="text-xs font-semibold uppercase tracking-widest text-red-500">Race Result</p>
				<h1 className="text-3xl font-bold text-white">{raceName}</h1>
			</div>

			<div className="grid min-h-0 flex-1 grid-cols-[1.4fr_1fr] gap-4">
				{/* Left: podium + next finishers + DNFs */}
				<div className="flex min-h-0 flex-col gap-3">
					{/* Podium */}
					<div className="grid grid-cols-3 gap-3">
						{podium.map((l, i) => {
							const winner = i === 0;
							return (
								<div
									key={l.RacingNumber}
									className={`flex flex-col gap-1 rounded-lg bg-zinc-900 p-3 ${winner ? "ring-2 ring-yellow-400/60" : ""}`}
									style={{ borderTop: `4px solid ${teamColor(l.RacingNumber)}` }}
								>
									<div className="flex items-center justify-between">
										<span className="text-sm font-bold" style={{ color: PODIUM_ACCENT[i] }}>
											{PODIUM_LABEL[i]}
										</span>
										{winner && <span className="text-xs font-semibold uppercase text-yellow-400">Winner</span>}
									</div>
									<span className={`font-bold text-white ${winner ? "text-3xl" : "text-2xl"}`}>
										{drivers[l.RacingNumber]?.Tla ?? l.RacingNumber}
									</span>
									<span className="truncate text-xs text-zinc-400">{drivers[l.RacingNumber]?.TeamName ?? ""}</span>
									<span className="font-mono text-xs text-zinc-300">{l.GapToLeader || "—"}</span>
								</div>
							);
						})}
					</div>

					{/* P4–P8 */}
					<div className="flex flex-col gap-1">
						{rest.map((l) => (
							<div key={l.RacingNumber} className="flex items-center gap-3 rounded bg-zinc-800/50 px-3 py-1.5">
								<span className="w-5 text-right font-mono text-sm text-zinc-500">{l.Position}</span>
								<div className="h-4 w-1 shrink-0 rounded-full" style={{ backgroundColor: teamColor(l.RacingNumber) }} />
								<span className="w-9 text-sm font-bold">{drivers[l.RacingNumber]?.Tla ?? l.RacingNumber}</span>
								<span className="flex-1 truncate text-xs text-zinc-400">{drivers[l.RacingNumber]?.TeamName ?? ""}</span>
								<span className="font-mono text-xs text-zinc-300">{l.GapToLeader || "—"}</span>
							</div>
						))}
					</div>

					{/* DNFs */}
					{dnfs.length > 0 && (
						<div className="flex flex-col gap-1">
							<p className="text-xs font-semibold uppercase tracking-wider text-red-500/80">Did not finish</p>
							<div className="flex flex-wrap gap-x-4 gap-y-1">
								{dnfs.map((l) => (
									<div key={l.RacingNumber} className="flex items-center gap-2">
										<div
											className="h-3 w-1 shrink-0 rounded-full opacity-70"
											style={{ backgroundColor: teamColor(l.RacingNumber) }}
										/>
										<span className="text-sm font-medium text-zinc-400">
											{drivers[l.RacingNumber]?.Tla ?? l.RacingNumber}
										</span>
										<span className="text-xs text-zinc-600">{l.Status === 0 ? "DNF" : "OUT"}</span>
									</div>
								))}
							</div>
						</div>
					)}
				</div>

				{/* Right: championship impact */}
				<div className="flex min-h-0 flex-col gap-2 rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
					<p className="text-xs font-semibold uppercase tracking-widest text-red-500">Championship</p>
					{champ.length === 0 ? (
						<div className="flex flex-1 items-center justify-center text-sm text-zinc-500">
							Championship data unavailable
						</div>
					) : (
						<div className="flex flex-col gap-1">
							{champ.map((c) => {
								const move = c.CurrentPosition - c.PredictedPosition; // + = gained places
								return (
									<div key={c.RacingNumber} className="flex items-center gap-3 px-1 py-1">
										<span className="w-5 text-right font-mono text-sm font-bold text-zinc-300">{c.PredictedPosition}</span>
										<div
											className="h-4 w-1 shrink-0 rounded-full"
											style={{ backgroundColor: teamColor(c.RacingNumber) }}
										/>
										<span className="flex-1 truncate text-sm font-medium">{driverName(c.RacingNumber)}</span>
										<span className="w-7 text-center text-xs font-semibold">
											{move > 0 ? (
												<span className="text-emerald-500">▲{move}</span>
											) : move < 0 ? (
												<span className="text-red-500">▼{-move}</span>
											) : (
												<span className="text-zinc-600">—</span>
											)}
										</span>
										<span className="w-12 text-right font-mono text-sm text-white">{c.PredictedPoints}</span>
									</div>
								);
							})}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
