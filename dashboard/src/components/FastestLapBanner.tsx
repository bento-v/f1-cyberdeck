"use client";

import { useEffect, useRef, useState } from "react";

import { useDataStore } from "@/stores/useDataStore";

export default function FastestLapBanner() {
	const timingData = useDataStore((state) => state.state?.TimingData);
	const driverList = useDataStore((state) => state.state?.DriverList);
	const topThree = useDataStore((state) => state.state?.TopThree);

	const [isFlashing, setIsFlashing] = useState(false);
	const prevHolderRef = useRef<string | null>(null);

	// Determine current fastest lap holder (position 1 in BestLapTime)
	const fastestEntry = timingData
		? Object.entries(timingData.Lines).find(([, d]) => d.BestLapTime?.Position === 1)
		: null;

	const fastestNr = fastestEntry?.[0] ?? null;
	const fastestDriver = fastestNr && driverList ? driverList[fastestNr] : null;
	const fastestTime = fastestEntry?.[1]?.BestLapTime?.Value ?? null;

	// Also check TopThree for OverallFastest flag as a fallback
	const overallFastestFromTopThree = topThree?.Lines.find((d) => d.OverallFastest);
	const displayDriver = fastestDriver ?? (overallFastestFromTopThree && driverList
		? driverList[overallFastestFromTopThree.RacingNumber]
		: null);
	const displayTime = fastestTime ?? overallFastestFromTopThree?.LapTime ?? null;
	const displayNr = fastestNr ?? overallFastestFromTopThree?.RacingNumber ?? null;

	useEffect(() => {
		if (!displayNr) return;
		if (prevHolderRef.current !== null && prevHolderRef.current !== displayNr) {
			setIsFlashing(true);
			const t = setTimeout(() => setIsFlashing(false), 2500);
			return () => clearTimeout(t);
		}
		prevHolderRef.current = displayNr;
	}, [displayNr]);

	if (!displayDriver || !displayTime) return null;

	const teamColor = displayDriver.TeamColour ?? "9B26B6";

	return (
		<div
			className={`relative flex w-full items-center gap-4 overflow-hidden rounded-lg px-4 py-2 ${
				isFlashing ? "animate-fastest-lap-flash" : ""
			}`}
			style={{ backgroundColor: `#${teamColor}22`, borderLeft: `4px solid #${teamColor}` }}
		>
			{/* Purple sector flash overlay */}
			{isFlashing && (
				<div
					className="pointer-events-none absolute inset-0 animate-fastest-lap-flash rounded-lg"
					style={{ backgroundColor: `#${teamColor}` }}
				/>
			)}

			<div className="relative flex items-center gap-3">
				<div
					className="flex h-8 w-8 items-center justify-center rounded-md font-black text-black"
					style={{ backgroundColor: `#${teamColor}` }}
				>
					<span className="text-sm">{displayDriver.Tla}</span>
				</div>

				<div>
					<p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
						Fastest Lap
					</p>
					<p className="text-lg font-bold leading-tight">
						{displayDriver.FirstName} {displayDriver.LastName}
					</p>
				</div>
			</div>

			<div className="relative ml-auto text-right">
				<p className="text-xs text-zinc-400">Time</p>
				<p
					className="font-mono text-2xl font-bold"
					style={{ color: `#${teamColor}` }}
				>
					{displayTime}
				</p>
			</div>

			<div className="relative text-right">
				<p className="text-xs text-zinc-400">Team</p>
				<p className="text-sm font-medium">{displayDriver.TeamName}</p>
			</div>
		</div>
	);
}
