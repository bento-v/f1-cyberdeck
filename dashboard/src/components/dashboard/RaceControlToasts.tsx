"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import { utc } from "moment";

import type { Message } from "@/types/state.type";

import { useDataStore } from "@/stores/useDataStore";
import { useSettingsStore } from "@/stores/useSettingsStore";

// Race-control messages as one-at-a-time toasts in the bottom-right corner, so
// the kiosk live view never needs scrolling to see alerts. New messages queue up
// and each shows for DISPLAY_MS; on (re)mount the latest existing message is
// shown once for context (useful after the watchdog reloads mid-session).
const DISPLAY_MS = 8_000;
const MAX_QUEUE = 5;

const msgKey = (msg: Message) => `${msg.Utc}|${msg.Message}`;

export default function RaceControlToasts() {
	const messages = useDataStore((state) => state.state?.RaceControlMessages?.Messages);

	const raceControlChime = useSettingsStore((state) => state.raceControlChime);
	const raceControlChimeVolume = useSettingsStore((state) => state.raceControlChimeVolume);
	const chimeRef = useRef<HTMLAudioElement | null>(null);

	const seenRef = useRef<Set<string> | null>(null);
	const queueRef = useRef<Message[]>([]);
	const showingRef = useRef(false);
	const [current, setCurrent] = useState<Message | null>(null);

	useEffect(() => {
		const chime = new Audio("/sounds/chime.mp3");
		chime.volume = raceControlChimeVolume / 100;
		chimeRef.current = chime;
		return () => {
			chimeRef.current = null;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// Each shown toast owns its retirement timer here — the effect re-arms on
	// re-mount (StrictMode-safe) and advances to the next queued message.
	useEffect(() => {
		if (!current) return;
		const timer = setTimeout(() => {
			const next = queueRef.current.shift() ?? null;
			showingRef.current = next !== null;
			setCurrent(next);
		}, DISPLAY_MS);
		return () => clearTimeout(timer);
	}, [current]);

	useEffect(() => {
		if (!messages || messages.length === 0) return;

		// Oldest → newest so the queue plays back in order
		const sorted = [...messages].sort((a, b) => a.Utc.localeCompare(b.Utc));

		const enqueue = (fresh: Message[]) => {
			if (fresh.length === 0) return;
			queueRef.current = [...queueRef.current, ...fresh].slice(-MAX_QUEUE);
			if (!showingRef.current) {
				const next = queueRef.current.shift() ?? null;
				showingRef.current = next !== null;
				setCurrent(next);
			}
		};

		if (!seenRef.current) {
			// First data after mount: don't replay history, just show the latest
			seenRef.current = new Set(sorted.map(msgKey));
			enqueue(sorted.slice(-1));
			return;
		}

		const fresh = sorted.filter((msg) => !seenRef.current!.has(msgKey(msg)));
		fresh.forEach((msg) => seenRef.current!.add(msgKey(msg)));

		const visible = fresh.filter((msg) => (msg.Flag ? msg.Flag.toLowerCase() !== "blue" : true));
		if (visible.length > 0 && raceControlChime) {
			chimeRef.current?.play();
		}
		enqueue(visible);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [messages]);

	return (
		<div className="pointer-events-none fixed right-4 bottom-4 z-50 max-w-2xl">
			<AnimatePresence>
				{current && (
					<motion.div
						key={msgKey(current)}
						initial={{ opacity: 0, y: 24 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: 12 }}
						transition={{ duration: 0.3 }}
						data-testid="race-control-toast"
						className="flex items-center gap-4 rounded-xl border border-hairline bg-s1/95 p-[18px] shadow-lg shadow-black/40"
					>
						{current.Flag && current.Flag !== "CLEAR" && (
							<Image
								src={`/flags/${current.Flag.toLowerCase().replaceAll(" ", "-")}-flag.svg`}
								alt={current.Flag}
								width={42}
								height={42}
							/>
						)}

						<div>
							<div className="flex items-center gap-1.5 text-lg leading-none text-t3">
								<p className="font-semibold uppercase tracking-wider text-accent/90">Race Control</p>
								{!!current.Lap && (
									<>
										{"·"}
										<p>Lap {current.Lap}</p>
									</>
								)}
								{"·"}
								<time dateTime={current.Utc}>{utc(current.Utc).local().format("HH:mm:ss")}</time>
							</div>

							<p className="mt-1.5 text-[21px] leading-snug">{current.Message}</p>
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}
