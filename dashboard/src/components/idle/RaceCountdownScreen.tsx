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
			className="relative flex h-full w-full flex-col items-center justify-center gap-6 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950"
			style={{ borderLeftWidth: "4px", borderLeftColor: "rgb(220 38 38)" }}
		>
			<p className="text-xs font-semibold uppercase tracking-widest text-red-500">
				Race Starting In
			</p>

			<p
				data-testid="countdown-seconds"
				className="font-mono font-black leading-none text-white tabular-nums"
				style={{ fontSize: "10rem" }}
			>
				{display}
			</p>

			<div className="flex flex-col items-center gap-1">
				<p className="text-3xl font-bold text-zinc-200">{roundName}</p>
				{countryName && <p className="text-base text-zinc-500">{countryName}</p>}
			</div>

			{/* Progress bar — grows from 0% to 100% as countdown elapses */}
			<div className="h-1 w-2/3 overflow-hidden rounded-full bg-zinc-800">
				<div
					className="h-full rounded-full bg-red-600"
					style={{ width: `${progress}%`, transition: "none" }}
				/>
			</div>
		</div>
	);
}
