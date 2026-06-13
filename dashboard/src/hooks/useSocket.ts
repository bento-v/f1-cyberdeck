import { useEffect, useRef, useState } from "react";

import type { MessageInitial, MessageUpdate } from "@/types/message.type";

import { env } from "@/env";

type Props = {
	handleInitial: (data: MessageInitial) => void;
	handleUpdate: (data: MessageUpdate) => void;
};

// Kiosk watchdog: reload the page if the SSE connection fails repeatedly.
// Protects against permanent connection loss on an unattended Pi.
const WATCHDOG_MAX_ERRORS = 10;
const WATCHDOG_WINDOW_MS = 5 * 60_000; // 5 minutes

export const useSocket = ({ handleInitial, handleUpdate }: Props) => {
	const [connected, setConnected] = useState<boolean>(false);
	const errorCountRef = useRef(0);
	const errorWindowStartRef = useRef<number | null>(null);

	useEffect(() => {
		const sse = new EventSource(`${env.NEXT_PUBLIC_LIVE_URL}/api/realtime`);

		sse.onerror = () => {
			setConnected(false);
			const now = Date.now();
			if (!errorWindowStartRef.current || now - errorWindowStartRef.current > WATCHDOG_WINDOW_MS) {
				errorWindowStartRef.current = now;
				errorCountRef.current = 0;
			}
			errorCountRef.current++;
			if (errorCountRef.current >= WATCHDOG_MAX_ERRORS) {
				window.location.reload();
			}
		};

		sse.onopen = () => {
			setConnected(true);
			// Reset watchdog on successful reconnect
			errorCountRef.current = 0;
			errorWindowStartRef.current = null;
		};

		sse.addEventListener("initial", (message) => {
			handleInitial(JSON.parse(message.data));
		});

		sse.addEventListener("update", (message) => {
			handleUpdate(JSON.parse(message.data));
		});

		return () => sse.close();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	return { connected };
};
