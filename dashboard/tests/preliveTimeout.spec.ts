import { test, expect } from "@playwright/test";

// The prelive watchdog: if onPreLive fires (T=0 countdown) but the session never
// actually goes live (SessionStatus never "Started" — backend down or delayed
// start), the kiosk must fall back to the idle carousel after PRELIVE_TIMEOUT_MS
// instead of sitting on an empty live layout forever.
test.describe("prelive timeout fallback", () => {
	test.beforeEach(async ({ page }) => {
		// No backend: SSE aborted so isLive never becomes true
		await page.route("http://localhost:4000/api/realtime", (route) => route.abort());
		await page.clock.install();
	});

	test("returns to carousel when live never materializes", async ({ page }) => {
		await page.goto("/dashboard?testCountdown=1");

		// Drive the fake countdown to T=0 → onPreLive fires → live layout
		await page.clock.runFor(36_000);
		await expect(page.getByTestId("idle-carousel")).not.toBeVisible();

		// 10 minutes with no live session → watchdog resets to idle.
		// fastForward (not runFor) so the 200ms data-engine interval doesn't have
		// to replay ~3000 ticks synchronously.
		await page.clock.fastForward(10 * 60_000 + 1_000);
		await expect(page.getByTestId("idle-carousel")).toBeVisible();
	});
});
