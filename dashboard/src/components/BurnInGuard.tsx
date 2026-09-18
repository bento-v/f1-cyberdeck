"use client";

import { useEffect, useRef, type ReactNode } from "react";

// Burn-in / image-persistence protection for the kiosk. The live layout keeps a
// lot of bright, static chrome (session bar, leaderboard frame) fixed for a whole
// race — on an older panel that risks ghosting. This slowly drifts the ENTIRE app
// by a few pixels on a long interval so no bright pixel stays put; the shift is
// small enough that the clipped/revealed edges (near-black page background) are
// invisible.
//
// Driven by setInterval mutating an inline transform via ref (not a CSS keyframe
// animation, so the global prefers-reduced-motion override can't switch it off,
// and children never re-render — one transform write per minute). A CSS
// transition turns each step into a slow glide rather than a jump.

const isKiosk = process.env.NEXT_PUBLIC_KIOSK === "1";

// Center + a ring at ±8px: spreads wear across a ~16px band on both axes.
const OFFSETS: ReadonlyArray<readonly [number, number]> = [
	[0, 0],
	[8, 0],
	[8, 8],
	[0, 8],
	[-8, 8],
	[-8, 0],
	[-8, -8],
	[0, -8],
	[8, -8],
];

const DEFAULT_STEP_MS = 60_000; // advance once a minute → full cycle ~9 min

export default function BurnInGuard({ children }: { children: ReactNode }) {
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		// Enabled on the kiosk build, or via ?burnin=1 for local testing. A numeric
		// value (?burnin=3) overrides the step in seconds so the drift is observable
		// without waiting a full minute.
		const param = new URLSearchParams(window.location.search).get("burnin");
		const enabled = isKiosk || param !== null;
		if (!enabled) return;

		const el = ref.current;
		if (!el) return;

		const paramNum = param ? Number(param) : NaN;
		const stepMs = Number.isFinite(paramNum) && paramNum >= 1 ? paramNum * 1000 : DEFAULT_STEP_MS;

		el.style.transition = "transform 3s ease-in-out";
		el.style.willChange = "transform";

		let i = 0;
		const id = window.setInterval(() => {
			i = (i + 1) % OFFSETS.length;
			const [x, y] = OFFSETS[i];
			el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
		}, stepMs);

		return () => window.clearInterval(id);
	}, []);

	return (
		<div ref={ref} style={{ width: "100%" }}>
			{children}
		</div>
	);
}
