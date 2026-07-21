import { test, expect } from "@playwright/test";

// MultiViewer marks some long corners with several points sharing one number
// (Hungaroring T1/T12 — 16 markers for 14 corners), which used to render
// duplicate corner labels. TrackMapPanel de-dupes per corner number; this
// guards that invariant for whichever circuit is next on the calendar.
test("track map panel renders each corner number exactly once", async ({ page }) => {
	await page.route("http://localhost:4000/api/realtime", (route) => route.abort());

	await page.goto("/dashboard");
	await page.getByRole("button", { name: "Show Track Map" }).click();

	// Corner labels are the only <text> elements in the panel's SVG.
	// Skip if the map didn't load (MultiViewer outage) — nothing to assert.
	const svgText = page.locator("svg text");
	try {
		await expect(svgText.first()).toBeVisible({ timeout: 15_000 });
	} catch {
		const unavailable = await page.getByText("Track map unavailable").isVisible();
		test.skip(unavailable, "MultiViewer data unavailable");
		throw new Error("track map rendered neither corners nor the unavailable notice");
	}

	const labels = await svgText.allTextContents();
	expect(labels.length).toBeGreaterThan(5);
	expect(new Set(labels).size).toBe(labels.length); // no duplicate corner numbers
});
