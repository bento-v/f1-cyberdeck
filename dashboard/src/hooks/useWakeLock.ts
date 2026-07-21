import { useEffect, useRef } from "react";

export const useWakeLock = () => {
	const wakeLock = useRef<null | WakeLockSentinel>(null);

	useEffect(() => {
		// wakeLock needs a secure context; localhost qualifies, and the kiosk runs
		// on localhost where this is the only thing keeping the screen awake on
		// Wayland (no xset there) — so no localhost opt-out.
		if (!window.isSecureContext) return;
		if (!("wakeLock" in navigator)) return;

		const acquire = () => {
			if (document.visibilityState !== "visible") return;
			navigator.wakeLock
				.request("screen")
				.then((wl) => {
					wakeLock.current = wl;
				})
				.catch(() => {
					// e.g. power-save mode denied it — retry on next visibility change
				});
		};

		acquire();
		// The browser releases the lock when the page is hidden; re-acquire on return
		document.addEventListener("visibilitychange", acquire);

		return () => {
			document.removeEventListener("visibilitychange", acquire);
			if (wakeLock.current) {
				wakeLock.current.release();
			}
		};
	}, []);
};
