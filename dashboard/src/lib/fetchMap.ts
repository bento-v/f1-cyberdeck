import type { Map } from "@/types/map.type";

export const fetchMap = async (circuitKey: number): Promise<Map | null> => {
	const year = new Date().getFullYear();
	// Try current year first, fall back to previous year (multiviewer may lag behind new seasons)
	for (const y of [year, year - 1]) {
		try {
			const res = await fetch(`https://api.multiviewer.app/api/v1/circuits/${circuitKey}/${y}`, {
				next: { revalidate: 60 * 60 * 2 },
			});
			if (res.ok) return res.json() as Promise<Map>;
		} catch {
			// network error — try next year
		}
	}
	console.error("fetchMap: no data for circuit", circuitKey);
	return null;
};
