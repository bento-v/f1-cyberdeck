"use client";

import { useDataStore } from "@/stores/useDataStore";

// Lap counter for the live header (top-right). The session bar that normally
// carries the lap count is hidden in kiosk mode, so the live layout shows this.
export default function LiveLapCount() {
	const lapCount = useDataStore((state) => state.state?.LapCount);

	if (!lapCount) return null;

	return (
		<div
			data-testid="live-lap-count"
			className="flex shrink-0 items-center rounded-lg border border-hairline bg-s1 px-4 py-2 shadow-lg shadow-black/20"
		>
			<div className="text-right">
				<p className="t-eyebrow text-t2">Lap</p>
				<p className="nums t-display mt-1 font-mono text-2xl leading-tight whitespace-nowrap text-t1">
					{lapCount.CurrentLap} <span className="text-t3">/ {lapCount.TotalLaps}</span>
				</p>
			</div>
		</div>
	);
}
