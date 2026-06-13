// Maps Jolpica/Ergast constructor IDs to 2025 F1 team hex colors (no leading #)
const TEAM_COLORS: Record<string, string> = {
	red_bull: "3671C6",
	ferrari: "E8002D",
	mercedes: "27F4D2",
	mclaren: "FF8000",
	aston_martin: "229971",
	alpine: "FF87BC",
	williams: "64C4FF",
	haas: "B6BABD",
	rb: "6692FF",
	kick_sauber: "52E252",
	sauber: "52E252",
};

export function getTeamColor(constructorId: string): string {
	return TEAM_COLORS[constructorId.toLowerCase()] ?? "71717A";
}
