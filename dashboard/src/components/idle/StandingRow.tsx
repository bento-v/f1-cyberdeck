import clsx from "clsx";
import type { ReactNode } from "react";

// One row for every ranked list in the app: driver/constructor standings, race &
// qualifying results, the post-race P4–P8 list, season stats. Position → team
// colour bar → primary label → secondary label → optional badge → value.
type Props = {
	position: ReactNode;
	/** Team colour as a hex string without the leading '#'. */
	teamColor: string;
	primary: ReactNode;
	secondary?: ReactNode;
	/** Right-aligned value (lap time, gap, points). Rendered in tabular mono. */
	value?: ReactNode;
	valueTone?: "default" | "fastest" | "muted";
	/** Extra content between the secondary label and the value (e.g. a wins badge). */
	extra?: ReactNode;
	dim?: boolean;
	className?: string;
};

const toneClass: Record<NonNullable<Props["valueTone"]>, string> = {
	default: "text-t2",
	fastest: "text-fastest",
	muted: "text-t3",
};

export default function StandingRow({
	position,
	teamColor,
	primary,
	secondary,
	value,
	valueTone = "default",
	extra,
	dim,
	className,
}: Props) {
	return (
		<div
			className={clsx(
				"flex items-center gap-3 rounded-md px-3 py-1.5",
				dim && "opacity-40",
				className,
			)}
		>
			<span className="nums w-7 shrink-0 text-right text-sm font-bold text-t3">{position}</span>

			<div className="h-4 w-1 shrink-0 rounded-full" style={{ backgroundColor: `#${teamColor}` }} />

			<span className="shrink-0 truncate font-semibold text-t1">{primary}</span>

			{secondary ? (
				<span className="flex-1 truncate text-sm text-t2">{secondary}</span>
			) : (
				<span className="flex-1" />
			)}

			{extra}

			{value != null && (
				<span className={clsx("nums shrink-0 font-mono text-sm", toneClass[valueTone])}>{value}</span>
			)}
		</div>
	);
}
