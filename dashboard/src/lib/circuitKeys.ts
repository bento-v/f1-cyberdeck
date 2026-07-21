// Maps Jolpica/Ergast circuitId strings → multiviewer/F1 numeric circuit keys.
// Keys verified against https://api.multiviewer.app/api/v1/circuits/{key}/{year}
const CIRCUIT_KEYS: Record<string, number> = {
	albert_park: 10,   // Australia (Melbourne)
	bahrain: 63,       // Bahrain
	jeddah: 149,       // Saudi Arabia
	shanghai: 49,      // China
	suzuka: 46,        // Japan
	miami: 151,        // USA (Miami)
	imola: 6,          // Italy (Emilia Romagna)
	monaco: 22,        // Monaco
	villeneuve: 23,    // Canada (Montreal)
	red_bull_ring: 19, // Austria
	silverstone: 2,    // Great Britain
	hungaroring: 4,    // Hungary
	spa: 7,            // Belgium
	zandvoort: 55,     // Netherlands
	monza: 39,         // Italy
	baku: 144,         // Azerbaijan
	marina_bay: 61,    // Singapore
	americas: 9,       // USA (Austin/COTA)
	rodriguez: 65,     // Mexico
	interlagos: 14,    // Brazil (São Paulo)
	las_vegas: 152,    // USA (Las Vegas)
	losail: 150,       // Qatar
	yas_marina: 70,    // UAE (Abu Dhabi)
	catalunya: 15,     // Spain (Barcelona, historical)
};

export function getCircuitKey(circuitId: string): number | null {
	return CIRCUIT_KEYS[circuitId.toLowerCase()] ?? null;
}
