// Maps Jolpica/Ergast circuitId strings → multiviewer/F1 numeric circuit keys
const CIRCUIT_KEYS: Record<string, number> = {
	bahrain: 3,
	jeddah: 149,
	albert_park: 1,
	suzuka: 7,
	shanghai: 5,
	miami: 151,
	imola: 21,
	monaco: 6,
	villeneuve: 2,
	catalunya: 4,
	red_bull_ring: 13,
	silverstone: 9,
	hungaroring: 11,
	spa: 14,
	zandvoort: 10,
	monza: 16,
	baku: 143,
	marina_bay: 15,
	americas: 148,
	rodriguez: 147,
	interlagos: 18,
	las_vegas: 154,
	yas_marina: 24,
	// 2026 new/renamed venues
	madrid: 155,
};

export function getCircuitKey(circuitId: string): number | null {
	return CIRCUIT_KEYS[circuitId.toLowerCase()] ?? null;
}
