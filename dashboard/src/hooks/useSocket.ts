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

// The F1 live-timing feed (and the Rust `realtime` service that proxies it) names
// the compressed streams "CarData.z" / "Position.z" (dotted), but the dashboard
// consumes them as CarDataZ / PositionZ. Normalize the wire shape to the internal
// contract here, at the single SSE entry point, so live data, the mock, and the
// FastF1 replay all flow through the same path. (Without this, real live races
// would have no car telemetry, DRS, or GPS map.)
const normalizeKeys = <T extends Record<string, unknown>>(data: T): T => {
	const d = data as Record<string, unknown>;
	if (d["CarData.z"] !== undefined && d.CarDataZ === undefined) {
		d.CarDataZ = d["CarData.z"];
		delete d["CarData.z"];
	}
	if (d["Position.z"] !== undefined && d.PositionZ === undefined) {
		d.PositionZ = d["Position.z"];
		delete d["Position.z"];
	}
	return data;
};

export const useSocket = ({ handleInitial, handleUpdate }: Props) => {
	const [connected, setConnected] = useState<boolean>(false);
	const errorCountRef = useRef(0);
	const errorWindowStartRef = useRef<number | null>(null);
	// Only trigger watchdog reload if the backend was reachable at some point.
	// When the Rust service is simply not running (between race weekends), errors
	// accumulate immediately and the old code reloaded every ~30 s. Now we let
	// SSE retry silently until a real connection is established, then watch for
	// drops afterward.
	const hasEverConnectedRef = useRef(false);

	useEffect(() => {
		const sse = new EventSource(`${env.NEXT_PUBLIC_LIVE_URL}/api/realtime`);

		sse.onerror = () => {
			setConnected(false);
			if (!hasEverConnectedRef.current) return;
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
			hasEverConnectedRef.current = true;
			// Reset watchdog on successful reconnect
			errorCountRef.current = 0;
			errorWindowStartRef.current = null;
		};

		sse.addEventListener("initial", (message) => {
			handleInitial(normalizeKeys(JSON.parse(message.data)));
		});

		sse.addEventListener("update", (message) => {
			handleUpdate(normalizeKeys(JSON.parse(message.data)));
		});

		return () => sse.close();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	return { connected };
};
