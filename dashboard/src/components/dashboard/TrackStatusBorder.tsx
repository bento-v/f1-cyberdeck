"use client";

import { useDataStore } from "@/stores/useDataStore";

// Full-screen border glow for interruption states, readable from across a room:
// Safety Car (4) and VSC (6/7) → soft yellow; Red Flag (5) → soft red.
// Plain local yellows (2/3) stay sector-only on the map to avoid crying wolf.
const BORDER_RGB: Record<string, string> = {
	"4": "234, 179, 8",
	"6": "234, 179, 8",
	"7": "234, 179, 8",
	"5": "239, 68, 68",
};

export default function TrackStatusBorder() {
	const status = useDataStore((state) => state.state?.TrackStatus?.Status);
	const rgb = status ? BORDER_RGB[status] : undefined;

	if (!rgb) return null;

	return (
		<div
			data-testid="track-status-border"
			className="pointer-events-none fixed inset-0 z-40"
			style={{
				boxShadow: `inset 0 0 90px 24px rgba(${rgb}, 0.4)`,
				animation: "f1-status-border 2.4s ease-in-out infinite",
			}}
		>
			<style>{`@keyframes f1-status-border { 0%, 100% { opacity: 1; } 50% { opacity: 0.55; } }`}</style>
		</div>
	);
}
