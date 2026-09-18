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

	// A 1s interval is enough — the display is whole seconds. Using setInterval
	// instead of requestAnimationFrame avoids waking the main thread 60×/sec, which
	// matters on the unattended Raspberry Pi kiosk.
	// Keyed on the start TIME — the session object is a fresh identity on every
	// parent render, which would rebuild the interval each render.
	const startIso = nextSession?.start ?? null;
	useEffect(() => {
		if (!startIso) return;

		// New session target — allow the pre-live trigger to fire again for it
		preLiveFiredRef.current = false;

		const target = utc(startIso);

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
		};

		tick();
		const iv = setInterval(tick, 1000);
		return () => clearInterval(iv);
	}, [startIso, onPreLive]);

	const sessionLabel = nextSession?.kind ?? "session";
	const hasData = days !== null;

	return (
		<div data-testid="idle-countdown-bar" className="flex w-full items-center justify-between rounded-lg border border-hairline bg-s1 px-6 py-4 shadow-lg shadow-black/20">
			<div>
				{roundName && <p className="text-sm text-t3">{roundName}</p>}
				<p className="t-title text-2xl text-t2">
					Next: <span className="text-t1">{sessionLabel}</span>
				</p>
			</div>

			<div className="nums flex items-baseline gap-4 text-right font-mono">
				{!hasData ? (
					<p className="text-3xl text-t3">--:--:--</p>
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
			<p className={`nums text-4xl font-bold leading-none ${highlight ? "text-warning" : "text-t1"}`}>{text}</p>
			<p className="text-xs text-t3">{label}</p>
		</div>
	);
}
