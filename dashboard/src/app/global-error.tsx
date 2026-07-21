"use client";

import { useEffect } from "react";

import Button from "@/components/ui/Button";

const isKiosk = process.env.NEXT_PUBLIC_KIOSK === "1";

// Self-heal on the unattended kiosk: reload instead of sitting on an error
// screen until someone touches the Pi.
const KIOSK_RELOAD_MS = 10_000;

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
	useEffect(() => {
		console.error("root render error", error);
		if (!isKiosk) return;
		const timeout = setTimeout(() => window.location.reload(), KIOSK_RELOAD_MS);
		return () => clearTimeout(timeout);
	}, [error]);

	return (
		<html>
			<body>
				<div className="flex h-dvh w-full flex-col items-center justify-center gap-2">
					<h2>Something went wrong!</h2>
					<p>{error.message}</p>
					{isKiosk && <p className="text-sm text-zinc-500">Reloading automatically…</p>}
					<Button onClick={() => reset()}>Try again</Button>
				</div>
			</body>
		</html>
	);
}
