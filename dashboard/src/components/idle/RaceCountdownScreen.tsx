"use client";

type Props = {
	roundName: string;
	countryName: string;
	secsToRace: number;
};

export default function RaceCountdownScreen({ roundName, countryName, secsToRace }: Props) {
	const clamped = Math.max(0, secsToRace);
	const display = String(clamped).padStart(2, "0");
	const progress = Math.min(100, ((30 - clamped) / 30) * 100);

	return (
		<div
			data-testid="race-countdown"
			className="relative flex h-full w-full flex-col items-center justify-center gap-6 overflow-hidden rounded-lg border border-hairline bg-s0"
			style={{ borderLeftWidth: "4px", borderLeftColor: "var(--color-accent-strong)" }}
		>
			<p className="t-eyebrow">Race Starting In</p>

			<p
				data-testid="countdown-seconds"
				className="t-display nums font-mono leading-none text-t1"
				style={{ fontSize: "11rem", letterSpacing: "-0.04em" }}
			>
				{display}
			</p>

			<div className="flex flex-col items-center gap-1">
				<p className="t-title text-4xl text-t1">{roundName}</p>
				{countryName && <p className="text-base text-t3">{countryName}</p>}
			</div>

			{/* Progress bar — grows from 0% to 100% as countdown elapses */}
			<div className="h-1 w-2/3 overflow-hidden rounded-full bg-s2">
				<div
					className="h-full rounded-full bg-accent-strong"
					style={{ width: `${progress}%`, transition: "none" }}
				/>
			</div>
		</div>
	);
}
