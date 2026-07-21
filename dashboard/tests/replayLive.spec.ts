import { test, expect } from "@playwright/test";

// Verifies the FastF1 replay feed (scripts/extract-fastf1.py -> scripts/mock-realtime.mjs
// --replay=...) drives every part of live mode with REAL data (2026 Austrian GP).
//
// REQUIRES the replay server running, e.g.:
//   node scripts/mock-realtime.mjs --replay=scripts/replay-data/austria-2026.json --speed=5 --start=1800
// The dashboard auto-switches to live (~3s debounce) once it sees SessionStatus "Started".

test("FastF1 replay populates live mode end to end", async ({ page }) => {
	// Skip when the replay server isn't running so the default suite stays green.
	const reachable = await page
		.request.fetch("http://localhost:4000/api/realtime", { method: "OPTIONS", timeout: 1500 })
		.then((r) => r.status() === 204)
		.catch(() => false);
	test.skip(!reachable, "replay server not running — see header of this spec");

	const errors: string[] = [];
	page.on("console", (msg) => {
		if (msg.type() === "error") errors.push(msg.text());
	});

	await page.goto("/dashboard");

	// Live leaderboard: real Austria 2026 grid (Russell, Verstappen, Hamilton).
	await expect(page.getByText("RUS", { exact: true }).first()).toBeVisible({ timeout: 15_000 });
	await expect(page.getByText("VER", { exact: true }).first()).toBeVisible();
	await expect(page.getByText("HAM", { exact: true }).first()).toBeVisible();

	// Race-control messages ride the live pipeline: the latest recorded message
	// shows as the bottom-right toast when live mode mounts.
	await expect(page.getByTestId("race-control-toast")).toBeVisible({ timeout: 8_000 });

	// Track map renders real car positions: many CarDots (circles) on the SVG.
	const circles = page.locator("svg circle");
	await expect.poll(async () => circles.count(), { timeout: 10_000 }).toBeGreaterThan(14);

	// A real lap time (m:ss.mmm) should appear somewhere in the leaderboard.
	await expect(page.getByText(/^\d:\d{2}\.\d{3}$/).first()).toBeVisible({ timeout: 10_000 });

	await page.screenshot({ path: "test-results/replay-live.png", fullPage: true });

	// Lap counter from the real session, visible top-right of the live layout (… / 71).
	const lapBadge = page.getByTestId("live-lap-count");
	await expect(lapBadge).toBeVisible({ timeout: 10_000 });
	await expect(lapBadge).toContainText("/ 71");

	// No CarDataZ / PositionZ decode errors (the risky compressed path).
	const inflateErrors = errors.filter((e) => /inflate|incorrect header|invalid|pako/i.test(e));
	expect(inflateErrors, `console errors:\n${inflateErrors.join("\n")}`).toHaveLength(0);
});
