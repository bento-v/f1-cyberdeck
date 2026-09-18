import { useMemo } from "react";
import clsx from "clsx";

import { teamTextOnLight } from "@/lib/teamPalette";

type Props = {
	teamColor: string;
	short: string;
	position?: number;
	className?: string;
};

export default function DriverTag({ position, teamColor, short, className }: Props) {
	// The TLA sits team-coloured on the white chip. Use each team's dark brand
	// shade (readable on white) instead of the raw livery colour, which is often
	// a light pastel that washes out.
	const tlaColor = useMemo(() => (teamColor ? teamTextOnLight(teamColor) : "#000000"), [teamColor]);

	// The position number is the page background colour for every team, so it reads
	// as a uniform cut-out of the badge rather than switching black/white per team.
	const posColor = "var(--color-s0)";

	return (
		<div
			id="walkthrough-driver-position"
			className={clsx(
				"flex w-fit items-center justify-between gap-0.5 rounded-lg bg-zinc-500 px-1 py-1 font-black",
				className,
			)}
			style={{ backgroundColor: `#${teamColor}` }}
		>
			{position && (
				<p className="nums px-1 text-xl leading-none" style={{ color: posColor }}>
					{position}
				</p>
			)}

			<div className="flex h-min w-min items-center justify-center rounded-md bg-white px-1">
				<p className="font-sans text-t3" style={{ color: tlaColor }}>
					{short}
				</p>
			</div>
		</div>
	);
}
