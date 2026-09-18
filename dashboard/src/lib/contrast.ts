// WCAG 2.1 contrast helpers. Team colours come straight from the live feed and
// several of them (Mercedes, Williams, Haas, Kick Sauber …) are light pastels —
// team-colour text on a white chip, or white text on the team colour, drops well
// below a readable bar. These pull the text colour up to a legible contrast.
//
// Target is 4.2:1 — a deliberate notch under the 4.5:1 AA minimum. The extra
// headroom to 4.5 costs a lot of darkening on the pastel teams, muddying the
// brand hue; 4.2 keeps the colours vivid and recognisable while staying easily
// readable across the kiosk. Bump this back to 4.5 if strict AA is required.
const TARGET_RATIO = 4.2;

const clamp = (n: number) => Math.min(255, Math.max(0, Math.round(n)));

const parseHex = (hex: string): [number, number, number] => {
	const h = hex.replace(/^#/, "");
	return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};

const toHex = (r: number, g: number, b: number) =>
	"#" + [r, g, b].map((c) => clamp(c).toString(16).padStart(2, "0")).join("");

const toLinear = (c: number) => {
	const s = c / 255;
	return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};

const luminance = (r: number, g: number, b: number) =>
	0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);

const ratioFromLum = (l1: number, l2: number) => {
	const hi = Math.max(l1, l2);
	const lo = Math.min(l1, l2);
	return (hi + 0.05) / (lo + 0.05);
};

/** WCAG contrast ratio between two hex colours (1–21). */
export const contrastRatio = (a: string, b: string): number =>
	ratioFromLum(luminance(...parseHex(a)), luminance(...parseHex(b)));

/**
 * Black or white — whichever reads better on the given background. Used for the
 * position number, which sits directly on the team colour.
 */
export const readableTextColor = (bgHex: string): string =>
	contrastRatio(bgHex, "#ffffff") >= contrastRatio(bgHex, "#000000") ? "#ffffff" : "#000000";

/**
 * A version of `hex` darkened just enough to clear `minRatio` against white,
 * keeping the team hue recognisable. Returns the original when it already passes.
 * Used for the TLA, which is team-coloured on a white chip.
 */
export const contrastColorOnWhite = (hex: string, minRatio = TARGET_RATIO): string => {
	const [r, g, b] = parseHex(hex);
	const whiteLum = 1;

	if (ratioFromLum(whiteLum, luminance(r, g, b)) >= minRatio) return toHex(r, g, b);

	// Darkening (scaling RGB toward black) monotonically raises contrast on white,
	// so binary-search the largest scale that still clears the bar — the closest
	// shade to the real team colour that stays readable. Evaluate the *rounded*
	// channels the browser will actually paint, so 8-bit rounding can't nudge the
	// final colour back below the threshold.
	const passesAt = (f: number) =>
		ratioFromLum(whiteLum, luminance(clamp(r * f), clamp(g * f), clamp(b * f))) >= minRatio;

	let lo = 0;
	let hi = 1;
	for (let i = 0; i < 24; i++) {
		const mid = (lo + hi) / 2;
		if (passesAt(mid)) lo = mid;
		else hi = mid;
	}
	return toHex(r * lo, g * lo, b * lo);
};

/**
 * A version of `hex` lightened (blended toward white) just enough to clear
 * `minRatio` against a dark background — the mirror of `contrastColorOnWhite`,
 * for team-coloured text sitting on the near-black page. Returns the original
 * when it already passes.
 */
export const contrastColorOnDark = (hex: string, minRatio = TARGET_RATIO, bgHex = "#09090b"): string => {
	const [r, g, b] = parseHex(hex);
	const bgLum = luminance(...parseHex(bgHex));

	if (ratioFromLum(luminance(r, g, b), bgLum) >= minRatio) return toHex(r, g, b);

	// Blending toward white monotonically raises contrast on a dark background,
	// so binary-search the smallest blend that clears the bar — the shade closest
	// to the real team colour that stays readable. Evaluate the rounded channels.
	const mix = (c: number, t: number) => c + (255 - c) * t;
	const passesAt = (t: number) =>
		ratioFromLum(luminance(clamp(mix(r, t)), clamp(mix(g, t)), clamp(mix(b, t))), bgLum) >= minRatio;

	let lo = 0;
	let hi = 1;
	for (let i = 0; i < 24; i++) {
		const mid = (lo + hi) / 2;
		if (passesAt(mid)) hi = mid;
		else lo = mid;
	}
	return toHex(mix(r, hi), mix(g, hi), mix(b, hi));
};
