"use client";

import { useDataStore } from "@/stores/useDataStore";

// Lap counter for the live header (top-right). The session bar that normally
// carries the lap count is hidden in kiosk mode, so the live layout shows this.
export default function LiveLapCount() {
	const lapCount = useDataStore((state) => state.state?.LapCount);

	if (!lapCount) return null;

	return (
		<div data-testid="live-lap-count" className="flex shrink-0 items-center rounded-lg border border-zinc-800 px-4 py-2">
			<div className="text-right">
				<p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Lap</p>
				<p className="font-mono text-2xl font-bold leading-tight whitespace-nowrap">
					{lapCount.CurrentLap} <span className="text-zinc-500">/ {lapCount.TotalLaps}</span>
				</p>
			</div>
		</div>
	);
}
