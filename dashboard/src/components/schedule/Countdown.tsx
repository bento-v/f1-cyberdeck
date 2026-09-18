"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { duration, now, utc } from "moment";

import type { Session } from "@/types/schedule.type";

type Props = {
	next: Session;
	type: "race" | "other";
};

type Parts = [number | null, number | null, number | null, number | null];

const UNITS = ["days", "hours", "minutes", "seconds"] as const;

export default function Countdown({ next, type }: Props) {
	const [parts, setParts] = useState<Parts>([null, null, null, null]);

	// Whole-second display → a 1s setInterval, not requestAnimationFrame. Avoids
	// waking the main thread 60×/s on the unattended Pi (CLAUDE.md Pi guidance).
	// Keyed on the start time so the interval isn't rebuilt on every parent render.
	const startIso = next.start;
	useEffect(() => {
		const target = utc(startIso);
		const tick = () => {
			const diff = duration(target.diff(now()));
			if (diff.asSeconds() > 0) {
				setParts([Math.floor(diff.asDays()), diff.hours(), diff.minutes(), diff.seconds()]);
			} else {
				setParts([0, 0, 0, 0]);
			}
		};
		tick();
		const iv = setInterval(tick, 1000);
		return () => clearInterval(iv);
	}, [startIso]);

	return (
		<div>
			<p className="text-base text-t2">Next {type === "race" ? "race" : "session"} in</p>

			<div className="mt-1 grid auto-cols-max grid-flow-col gap-5">
				{parts.map((value, i) => (
					<div key={UNITS[i]}>
						<AnimatePresence mode="popLayout" initial={false}>
							{value != null ? (
								<motion.p
									className="nums t-display min-w-12 text-4xl text-t1"
									key={value}
									initial={{ y: -10, opacity: 0 }}
									animate={{ y: 0, opacity: 1 }}
									exit={{ y: 10, opacity: 0 }}
									transition={{ type: "spring", bounce: 0, duration: 0.3 }}
								>
									{String(value).padStart(2, "0")}
								</motion.p>
							) : (
								<div className="h-9 w-12 animate-pulse rounded-md bg-s2" />
							)}
						</AnimatePresence>
						<p className="mt-1 text-sm text-t3">{UNITS[i]}</p>
					</div>
				))}
			</div>
		</div>
	);
}
