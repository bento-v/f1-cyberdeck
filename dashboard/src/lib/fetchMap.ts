import type { Map as TrackMap } from "@/types/map.type";

// Module-level cache. The idle TrackMapPanel remounts every carousel cycle and
// would otherwise hit the MultiViewer API every ~2 minutes, forever, from the
// 24/7 kiosk (the `next.revalidate` fetch option is server-only and does nothing
// in client components). Track layouts change ~yearly, so cache generously and
// back off during outages while serving whatever we had.
const CACHE_TTL = 2 * 3_600_000; // 2 hours
const ERROR_COOLDOWN_MS = 5 * 60_000;

type CacheEntry = { data: TrackMap | null; ts: number; errorUntil?: number };
const mapCache = new Map<number, CacheEntry>();

export const fetchMap = async (circuitKey: number): Promise<TrackMap | null> => {
	const hit = mapCache.get(circuitKey);
	const now = Date.now();

	if (hit && hit.data && now - hit.ts < CACHE_TTL) return hit.data;
	if (hit?.errorUntil && now < hit.errorUntil) return hit.data;

	const year = new Date().getFullYear();
	// Try current year first, fall back to previous year (multiviewer may lag behind new seasons)
	for (const y of [year, year - 1]) {
		try {
			const res = await fetch(`https://api.multiviewer.app/api/v1/circuits/${circuitKey}/${y}`);
			if (res.ok) {
				const data = (await res.json()) as TrackMap;
				mapCache.set(circuitKey, { data, ts: now });
				return data;
			}
		} catch {
			// network error — try next year
		}
	}

	console.error("fetchMap: no data for circuit", circuitKey);
	// Serve stale data if we have any; either way suppress retries for a while
	mapCache.set(circuitKey, { data: hit?.data ?? null, ts: hit?.ts ?? now, errorUntil: now + ERROR_COOLDOWN_MS });
	return hit?.data ?? null;
};
