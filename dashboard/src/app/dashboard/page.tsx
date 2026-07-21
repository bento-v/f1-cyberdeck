"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";

import { useSessionMode } from "@/hooks/useSessionMode";
import { useDataStore } from "@/stores/useDataStore";

import LeaderBoard from "@/components/dashboard/LeaderBoard";
import RaceControlToasts from "@/components/dashboard/RaceControlToasts";
import TrackStatusBorder from "@/components/dashboard/TrackStatusBorder";
import Map from "@/components/dashboard/Map";
import FastestLapBanner from "@/components/FastestLapBanner";
import LiveLapCount from "@/components/LiveLapCount";
import IdleCarousel, { clearIdleFetchCache } from "@/components/idle/IdleCarousel";
import KioskStage from "@/components/idle/KioskStage";
import RaceSummary, { type RaceSummaryData } from "@/components/idle/RaceSummary";

// How long the post-race summary stays up before returning to the carousel
const SUMMARY_MS = 90_000;

// If a pre-live trigger fires but the session never actually goes live (backend
// down, delayed start), drop back to the carousel instead of showing an empty
// live layout forever on the unattended kiosk.
const PRELIVE_TIMEOUT_MS = 10 * 60_000;

export default function Page() {
	const { isLive } = useSessionMode();

	// Allow the carousel to pre-switch to live layout ~2 min before a session
	const [preliveTrigger, dispatchPrelive] = useReducer(
		(_: boolean, action: "set" | "reset") => action === "set",
		false,
	);

	const handlePreLive = useCallback(() => dispatchPrelive("set"), []);

	// Watchdog: a prelive trigger without a real live session within the timeout
	// resets to idle (the carousel re-arms itself once SessionStatus goes Started)
	useEffect(() => {
		if (!preliveTrigger || isLive) return;
		const timeout = setTimeout(() => dispatchPrelive("reset"), PRELIVE_TIMEOUT_MS);
		return () => clearTimeout(timeout);
	}, [preliveTrigger, isLive]);

	// Snapshot of final results shown for ~90s after a race, between live and carousel
	const [summary, setSummary] = useState<RaceSummaryData | null>(null);
	const summaryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const wasLiveRef = useRef(false);

	useEffect(() => {
		const wasLive = wasLiveRef.current;
		wasLiveRef.current = isLive;

		if (isLive) {
			// Going live cancels any pending summary
			setSummary(null);
			if (summaryTimerRef.current) clearTimeout(summaryTimerRef.current);
			return;
		}

		dispatchPrelive("reset");

		// A live session just ended — if it was a race with results, show the summary
		if (wasLive) {
			const state = useDataStore.getState().state;
			const kind = (state?.SessionInfo?.Name ?? state?.SessionInfo?.Type ?? "").toLowerCase();
			const isRace = kind.includes("race");
			const hasResults = !!state?.DriverList && !!state?.TimingData?.Lines;

			if (isRace && hasResults) {
				setSummary({
					drivers: state!.DriverList!,
					timing: state!.TimingData!,
					championship: state!.ChampionshipPrediction,
					sessionInfo: state!.SessionInfo,
				});
				// Refresh carousel data so it reflects post-race standings on return
				clearIdleFetchCache();
				if (summaryTimerRef.current) clearTimeout(summaryTimerRef.current);
				summaryTimerRef.current = setTimeout(() => setSummary(null), SUMMARY_MS);
			}
		}
	}, [isLive]);

	// Clear the summary timer on unmount
	useEffect(() => () => {
		if (summaryTimerRef.current) clearTimeout(summaryTimerRef.current);
	}, []);

	const showLive = isLive || preliveTrigger;

	if (!showLive) {
		return (
			<div className="h-full w-full">
				<KioskStage>
					{summary ? (
						<RaceSummary {...summary} />
					) : (
						<div className="flex h-full w-full flex-col gap-4 p-4">
							<IdleCarousel onPreLive={handlePreLive} />
						</div>
					)}
				</KioskStage>
			</div>
		);
	}

	return (
		<div className="flex w-full flex-col gap-2">
			<div className="flex w-full items-stretch gap-2">
				<div className="min-w-0 flex-1">
					<FastestLapBanner />
				</div>
				<LiveLapCount />
			</div>

			<div className="flex w-full flex-col gap-2 xl:flex-row">
				<div className="overflow-x-auto xl:shrink-0">
					<LeaderBoard />
				</div>

				<div className="min-w-0 flex-1 2xl:max-h-[50rem]">
					<Map />
				</div>
			</div>

			{/* Race-control alerts pop up one at a time in the corner instead of a
			    scroll-only panel below the fold — the kiosk has no one to scroll */}
			<RaceControlToasts />

			{/* Screen-edge glow during SC/VSC (yellow) and red flag (red) */}
			<TrackStatusBorder />
		</div>
	);
}
