import clsx from "clsx";

type Props = {
	on: boolean;
	possible: boolean;
	inPit: boolean;
	pitOut: boolean;
};

export default function DriverDRS({ on, possible, inPit, pitOut }: Props) {
	const pit = inPit || pitOut;

	return (
		<span
			className={clsx(
				"text-md inline-flex h-8 w-full items-center justify-center rounded-md border-2 font-mono font-black",
				{
					"border-zinc-700 text-zinc-700": !pit && !on && !possible,
					// eligible (in detection range) — amber so it reads at kiosk distance
					// (the old zinc-400 was near-indistinguishable from the off state)
					"border-amber-400 text-amber-400": !pit && !on && possible,
					"border-emerald-500 text-emerald-500": !pit && on,
					"border-cyan-500 text-cyan-500": pit,
				},
			)}
		>
			{pit ? "PIT" : "DRS"}
		</span>
	);
}
