"use client";

import { useDataStore } from "@/stores/useDataStore";

export function useSessionMode() {
	const status = useDataStore((state) => state.state?.SessionStatus?.Status);
	const isLive = status === "Started";
	return { isLive, status };
}
