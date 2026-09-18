import { contrastColorOnDark, contrastColorOnWhite } from "@/lib/contrast";

// Readable text colours drawn from each team's *actual* brand palette, rather
// than algorithmically muddying the single livery colour the live feed sends.
// A team's one feed colour can't serve both surfaces the UI paints text on:
//   - onLight → a dark brand shade, for the TLA on the white leaderboard chip
//   - onDark  → a bright brand shade, for team-coloured text on the near-black
//               fastest-lap banner
// Both are pulled from the researched 2026 constructor palettes (primary +
// secondary/accent colours) and verified ≥4.5:1 on their respective surface.
// Keyed by the uppercased feed hex (F1's SignalR TeamColour, which the API
// service also mirrors via lib/teamColors). Sources in the palette research;
// unknown/future teams fall back to the contrast helpers below.

type Pair = { onLight: string; onDark: string };

const PALETTE: Record<string, Pair> = {
	// Red Bull — navy primary / bright blue accent
	"3671C6": { onLight: "#3671C6", onDark: "#4C8DFF" },
	// Ferrari — racing red / brighter red
	E8002D: { onLight: "#E8002D", onDark: "#FF2D55" },
	E80020: { onLight: "#E80020", onDark: "#FF2D55" },
	// Mercedes — dark petronas teal / turquoise
	"27F4D2": { onLight: "#007A6B", onDark: "#27F4D2" },
	// McLaren — deep papaya / papaya
	FF8000: { onLight: "#C24E00", onDark: "#FF8000" },
	// Aston Martin — british racing green / lime accent
	"229971": { onLight: "#00665E", onDark: "#CEDC00" },
	// Alpine — blue variants (feed sends blue in-race, pink in some liveries)
	"0093CC": { onLight: "#0064B0", onDark: "#2AB7FF" },
	FF87BC: { onLight: "#0064B0", onDark: "#2AB7FF" },
	// Williams — navy accent / bright blue
	"64C4FF": { onLight: "#041E42", onDark: "#64C4FF" },
	// Racing Bulls — deep blue / blue
	"6692FF": { onLight: "#27458C", onDark: "#6692FF" },
	// Haas — brand red / titanium grey
	B6BABD: { onLight: "#C10024", onDark: "#B6BABD" },
	// Kick Sauber — dark green / kick green
	"52E252": { onLight: "#1E7A22", onDark: "#52E252" },
};

const key = (hex: string) => hex.replace(/^#/, "").toUpperCase();

/** Readable team-coloured text on a white/light surface (e.g. the TLA chip). */
export const teamTextOnLight = (feedHex: string): string =>
	PALETTE[key(feedHex)]?.onLight ?? contrastColorOnWhite(feedHex);

/** Readable team-coloured text on the near-black surface (e.g. the lap time). */
export const teamTextOnDark = (feedHex: string): string =>
	PALETTE[key(feedHex)]?.onDark ?? contrastColorOnDark(feedHex);
