"use client";

import type { JolpicaRace, JolpicaResult } from "@/types/jolpica.type";
import { getTeamColor } from "@/lib/teamColors";

import PanelHeader from "@/components/idle/PanelHeader";
import PodiumCard from "@/components/idle/PodiumCard";
import StandingRow from "@/components/idle/StandingRow";

type Props = { race: JolpicaRace | null };

// A finisher took the chequered flag: "Finished" or "Lapped" (Jolpica's word for
// one-or-more laps down; also tolerate the "+N Lap(s)" form). Anything else
// (Retired, Accident, Engine, Collision, Disqualified, …) is a DNF.
const isFinisher = (status: string) =>
	status === "Finished" || status === "Lapped" || /^\+\d+ Laps?$/.test(status);

export default function LastRacePanel({ race }: Props) {
	if (!race) {
		return <div className="flex h-full items-center justify-center text-t3">Last race results unavailable</div>;
	}

	// Finishers fill the podium + list; retirements go to the marquee (no overlap).
	const finishers = race.Results.filter((r) => isFinisher(r.status));
	const dnfs = race.Results.filter((r) => !isFinisher(r.status));
	const top3 = finishers.slice(0, 3);
	const rest = finishers.slice(3, 10);
	const fastestLap = race.Results.find((r) => r.FastestLap?.rank === "1");

	return (
		<div className="flex h-full flex-col">
			<div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-6">
				<PanelHeader
					eyebrow="Last Race"
					title={race.raceName}
					subtitle={`${race.Circuit.circuitName} · ${race.Circuit.Location.locality}, ${race.Circuit.Location.country}`}
				/>

				<div className="grid grid-cols-3 gap-3">
					{top3.map((r, i) => (
						<PodiumCard
							key={r.Driver.driverId}
							index={i}
							teamColor={getTeamColor(r.Constructor.constructorId)}
							tla={r.Driver.code}
							team={r.Constructor.name}
							value={r.Time?.time ?? r.status}
						/>
					))}
				</div>

				<div className="flex flex-col gap-0.5">
					{rest.map((r) => {
						const isFastest = r.FastestLap?.rank === "1";
						return (
							<StandingRow
								key={r.Driver.driverId}
								position={r.positionText}
								teamColor={getTeamColor(r.Constructor.constructorId)}
								primary={r.Driver.code}
								secondary={r.Constructor.name}
								extra={
									isFastest && (
										<span className="text-xs font-semibold text-fastest">{r.FastestLap?.Time.time}</span>
									)
								}
								value={r.Time?.time ?? r.status}
							/>
						);
					})}
				</div>

				{fastestLap && (
					<p className="text-xs text-t3">
						<span className="font-semibold text-fastest">Fastest lap:</span> {fastestLap.Driver.code} ·{" "}
						{fastestLap.FastestLap?.Time.time}
					</p>
				)}
			</div>

			{dnfs.length > 0 && <DnfMarquee dnfs={dnfs} />}
		</div>
	);
}

function DnfMarquee({ dnfs }: { dnfs: JolpicaResult[] }) {
	// Repeat the content twice and translate -50% for a seamless loop.
	// Duration scales with the number of retirements for a consistent scroll speed.
	const duration = Math.max(20, dnfs.length * 6);

	// Rendered twice (the -50% translate loops seamlessly). Kept as an element,
	// not a nested component, so it isn't recreated on every render.
	const content = (
		<span className="px-6 text-sm">
			<span className="t-eyebrow text-negative">Did not finish</span>
			<span className="text-t4"> — </span>
			{dnfs.map((r, i) => (
				<span key={r.Driver.driverId}>
					{i > 0 && <span className="text-t4"> &nbsp;•&nbsp; </span>}
					<span className="font-bold text-t2">{r.Driver.code}</span>
					<span className="text-t3"> {r.status}</span>
				</span>
			))}
		</span>
	);

	return (
		<div className="relative shrink-0 overflow-hidden border-t border-hairline bg-s1/80 py-2">
			<div
				className="flex w-max flex-nowrap whitespace-nowrap will-change-transform"
				style={{ animation: `f1-dnf-marquee ${duration}s linear infinite` }}
			>
				{content}
				{content}
			</div>
			<style>{`@keyframes f1-dnf-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }`}</style>
		</div>
	);
}
