import { test, expect } from "@playwright/test";

// Verifies the post-race summary triggers at the end of the FastF1 replay.
// The dashboard must enter live mode first (3s debounce), then see SessionStatus
// "Finished" (5s debounce) -> snapshot -> <RaceSummary>.
//
// REQUIRES a near-end replay running, e.g.:
//   node scripts/mock-realtime.mjs --replay=scripts/replay-data/austria-2026.json --speed=6 --start=5150

test("FastF1 replay ends in the post-race summary", async ({ page }) => {
	const reachable = await page
		.request.fetch("http://localhost:4000/api/realtime", { method: "OPTIONS", timeout: 1500 })
		.then((r) => r.status() === 204)
		.catch(() => false);
	test.skip(!reachable, "replay server not running — see header of this spec");

	await page.goto("/dashboard");

	// Race Result screen appears once the replay finishes and debounces out of live.
	await expect(page.getByText("Race Result").first()).toBeVisible({ timeout: 40_000 });
	await expect(page.getByText("Winner").first()).toBeVisible();

	await page.screenshot({ path: "test-results/replay-summary.png", fullPage: true });

	// Winner is Russell (real classification snapshot).
	await expect(page.getByText("RUS", { exact: true }).first()).toBeVisible();
});
