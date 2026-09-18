import clsx from "clsx";

// Shared podium card for the last-race panel and the post-race summary: a
// team-colour top edge, the finishing position in its podium accent, the driver
// TLA (winner largest), team, and gap/time. Winner gets a gold ring for primacy.
const PODIUM_LABEL = ["P1", "P2", "P3"];
const PODIUM_ACCENT = ["var(--color-gold)", "var(--color-silver)", "var(--color-bronze)"];

type Props = {
	index: number; // 0,1,2
	teamColor: string; // hex without '#'
	tla: string;
	team: string;
	value: string; // gap or time
	winnerLabel?: string; // e.g. "Winner"
};

export default function PodiumCard({ index, teamColor, tla, team, value, winnerLabel }: Props) {
	const winner = index === 0;
	return (
		<div
			className={clsx("flex flex-col gap-1 rounded-lg bg-s2 p-3", winner && "ring-2 ring-gold/50")}
			style={{ borderTop: `4px solid #${teamColor}` }}
		>
			<div className="flex items-center justify-between">
				<span className="text-sm font-bold" style={{ color: PODIUM_ACCENT[index] }}>
					{PODIUM_LABEL[index]}
				</span>
				{winner && winnerLabel && (
					<span className="t-eyebrow text-gold">{winnerLabel}</span>
				)}
			</div>

			<span className={clsx("t-display text-t1", winner ? "text-4xl" : "text-2xl")}>{tla}</span>
			<span className="truncate text-xs text-t2">{team}</span>
			<span className="nums font-mono text-xs text-t2">{value || "—"}</span>
		</div>
	);
}
