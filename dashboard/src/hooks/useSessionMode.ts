"use client";

import { useEffect, useRef, useState } from "react";

import { useDataStore } from "@/stores/useDataStore";

// Prevent visual strobing if SessionStatus flickers on reconnect.
// Require "Started" to be stable for 3s before going live;
// require a non-Started status to be stable for 5s before dropping back to idle.
const LIVE_DEBOUNCE_MS = 3_000;
const IDLE_DEBOUNCE_MS = 5_000;

export function useSessionMode() {
	const status = useDataStore((state) => state.state?.SessionStatus?.Status);
	const rawIsLive = status === "Started";

	const [isLive, setIsLive] = useState(false);
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		if (rawIsLive === isLive) {
			// No transition pending — cancel any queued debounce for the opposite direction
			if (timerRef.current) {
				clearTimeout(timerRef.current);
				timerRef.current = null;
			}
			return;
		}
		if (timerRef.current) clearTimeout(timerRef.current);
		timerRef.current = setTimeout(
			() => setIsLive(rawIsLive),
			rawIsLive ? LIVE_DEBOUNCE_MS : IDLE_DEBOUNCE_MS,
		);
		return () => {
			if (timerRef.current) clearTimeout(timerRef.current);
		};
	}, [rawIsLive, isLive]);

	return { isLive, status };
}
