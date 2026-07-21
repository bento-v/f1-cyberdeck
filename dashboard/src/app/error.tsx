"use client";

import { useEffect } from "react";

import Button from "@/components/ui/Button";

const isKiosk = process.env.NEXT_PUBLIC_KIOSK === "1";

// Auto-reload delay after a render crash on the unattended kiosk. Nothing else
// recovers from a React render error (the SSE watchdog only handles connection
// loss), so without this a single bad frame would white-screen the Pi until
// someone touches it.
const KIOSK_RELOAD_MS = 10_000;

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
	useEffect(() => {
		console.error("dashboard render error", error);
		if (!isKiosk) return;
		const timeout = setTimeout(() => window.location.reload(), KIOSK_RELOAD_MS);
		return () => clearTimeout(timeout);
	}, [error]);

	return (
		<div className="flex h-dvh w-full flex-col items-center justify-center gap-2">
			<h2>Something went wrong!</h2>
			<p>{error.message}</p>
			{isKiosk && <p className="text-sm text-zinc-500">Reloading automatically…</p>}
			<Button onClick={() => reset()}>Try again</Button>
		</div>
	);
}
