"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// The kiosk's native resolution. The idle carousel is laid out for this exact
// size, so we render it at a fixed stage of these dimensions and scale the whole
// thing to fit the available space (preserving aspect, centered). This makes the
// carousel look identical to the Pi on any screen — leftover space on a larger or
// differently-shaped display becomes symmetric letterbox margins instead of a
// bottom gap.
const KIOSK_W = 1366;
const KIOSK_H = 768;

export default function KioskStage({ children }: { children: ReactNode }) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [scale, setScale] = useState(1);

	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;

		const update = () => {
			const { width, height } = el.getBoundingClientRect();
			if (width === 0 || height === 0) return;
			// contain: largest scale that fits both dimensions
			setScale(Math.min(width / KIOSK_W, height / KIOSK_H));
		};

		update();
		const ro = new ResizeObserver(update);
		ro.observe(el);
		return () => ro.disconnect();
	}, []);

	return (
		<div ref={containerRef} className="flex h-full w-full items-center justify-center overflow-hidden">
			<div
				style={{
					width: KIOSK_W,
					height: KIOSK_H,
					flex: "none",
					transform: `scale(${scale})`,
					transformOrigin: "center",
				}}
			>
				{children}
			</div>
		</div>
	);
}
