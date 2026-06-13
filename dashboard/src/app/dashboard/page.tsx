"use client";

import { useCallback, useEffect, useState } from "react";

import { useSessionMode } from "@/hooks/useSessionMode";

import LeaderBoard from "@/components/dashboard/LeaderBoard";
import RaceControl from "@/components/dashboard/RaceControl";
import TeamRadios from "@/components/dashboard/TeamRadios";
import TrackViolations from "@/components/dashboard/TrackViolations";
import Map from "@/components/dashboard/Map";
import Footer from "@/components/Footer";
import FastestLapBanner from "@/components/FastestLapBanner";
import IdleCarousel from "@/components/idle/IdleCarousel";

export default function Page() {
	const { isLive } = useSessionMode();

	// Allow the carousel to pre-switch to live layout ~2 min before a session
	const [preliveTrigger, setPreliveTrigger] = useState(false);

	const handlePreLive = useCallback(() => setPreliveTrigger(true), []);

	// Reset pre-live trigger when an actual live session ends
	useEffect(() => {
		if (!isLive) setPreliveTrigger(false);
	}, [isLive]);

	const showLive = isLive || preliveTrigger;

	if (!showLive) {
		return (
			<div className="flex h-full w-full flex-col gap-4 p-4">
				<IdleCarousel onPreLive={handlePreLive} />
			</div>
		);
	}

	return (
		<div className="flex w-full flex-col gap-2">
			<FastestLapBanner />

			<div className="flex w-full flex-col gap-2 2xl:flex-row">
				<div className="overflow-x-auto">
					<LeaderBoard />
				</div>

				<div className="flex-1 2xl:max-h-[50rem]">
					<Map />
				</div>
			</div>

			<div className="grid grid-cols-1 gap-2 divide-y divide-zinc-800 *:h-[30rem] *:overflow-y-auto *:rounded-lg *:border *:border-zinc-800 *:p-2 md:divide-y-0 lg:grid-cols-3">
				<div>
					<RaceControl />
				</div>

				<div>
					<TeamRadios />
				</div>

				<div>
					<TrackViolations />
				</div>
			</div>

			<Footer />
		</div>
	);
}
