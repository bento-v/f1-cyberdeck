"use client";

import { useEffect, useRef, useState } from "react";
import { duration, now, utc } from "moment";

import type { Session } from "@/types/schedule.type";

type Parts = [number | null, number | null, number | null, number | null];

type Props = {
	nextSession: Session | null;
	roundName: string | null;
	onPreLive?: () => void;
};

export default function IdleCountdownBar({ nextSession, roundName, onPreLive }: Props) {
	const [[days, hours, minutes, seconds], setParts] = useState<Parts>([null, null, null, null]);
	const preLiveFiredRef = useRef(false);
	const rafRef = useRef<number | null>(null);

	useEffect(() => {
		if (!nextSession) return;

		const target = utc(nextSession.start);

		const tick = () => {
			const diff = duration(target.diff(now()));
			const totalSeconds = diff.asSeconds();

			if (totalSeconds > 0) {
				const d = Math.floor(diff.asDays());
				setParts([d, diff.hours(), diff.minutes(), diff.seconds()]);

				if (totalSeconds <= 120 && !preLiveFiredRef.current) {
					preLiveFiredRef.current = true;
					onPreLive?.();
				}
			} else {
				setParts([0, 0, 0, 0]);
				if (!preLiveFiredRef.current) {
					preLiveFiredRef.current = true;
					onPreLive?.();
				}
			}

			rafRef.current = requestAnimationFrame(tick);
		};

		rafRef.current = requestAnimationFrame(tick);
		return () => {
			if (rafRef.current) cancelAnimationFrame(rafRef.current);
		};
	}, [nextSession, onPreLive]);

	const sessionLabel = nextSession?.kind ?? "session";
	const hasData = days !== null;

	return (
		<div className="flex w-full items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 px-6 py-4">
			<div>
				{roundName && <p className="text-sm text-zinc-500">{roundName}</p>}
				<p className="text-2xl font-bold">
					Next: <span className="text-white">{sessionLabel}</span>
				</p>
			</div>

			<div className="flex items-baseline gap-4 text-right font-mono">
				{!hasData ? (
					<p className="text-3xl text-zinc-500">--:--:--</p>
				) : days != null && days > 0 ? (
					<>
						<Segment value={days} label="days" />
						<Segment value={hours} label="hrs" />
						<Segment value={minutes} label="min" />
					</>
				) : (
					<>
						<Segment value={hours} label="hrs" />
						<Segment value={minutes} label="min" />
						<Segment value={seconds} label="sec" highlight={!!(hours === 0 && minutes !== null && minutes < 5)} />
					</>
				)}
			</div>
		</div>
	);
}

function Segment({ value, label, highlight }: { value: number | null; label: string; highlight?: boolean }) {
	const text = value == null ? "--" : String(value).padStart(2, "0");
	return (
		<div className="flex flex-col items-center">
			<p className={`text-4xl font-bold leading-none ${highlight ? "text-red-400" : "text-white"}`}>{text}</p>
			<p className="text-xs text-zinc-500">{label}</p>
		</div>
	);
}
