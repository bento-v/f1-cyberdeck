import { test, expect } from "@playwright/test";

// Minimal SSE payloads — useSessionMode only reads SessionStatus.Status
const SSE_STARTED = JSON.stringify({ SessionStatus: { Status: "Started" } });

// Serve "Started" as the initial event on every EventSource connection.
// EventSource retries after each fulfilled response closes; serving "Started" on every
// retry keeps rawIsLive=true consistently, so the 3s debounce can complete.
const SSE_STARTED_STREAM = ["event: initial", `data: ${SSE_STARTED}`, "", ""].join("\n");

const SSE_HEADERS = {
	"Content-Type": "text/event-stream",
	"Cache-Control": "no-cache",
	"Connection": "keep-alive",
};

test.describe("race countdown UI (testCountdown mode)", () => {
	test.beforeEach(async ({ page }) => {
		// Isolate from any real/mock backend: abort SSE so SessionStatus never flips isLive.
		// (hasEverConnected stays false in useSocket, so no watchdog reload.)
		await page.route("http://localhost:4000/api/realtime", (route) => route.abort());

		// Install fake clock BEFORE navigation so all browser timers/intervals are controlled
		await page.clock.install();
	});

	test("carousel is visible before T-30", async ({ page }) => {
		await page.goto("/dashboard?testCountdown=1");
		await expect(page.getByTestId("idle-carousel")).toBeVisible();
		await expect(page.getByTestId("race-countdown")).not.toBeVisible();
	});

	test("countdown screen appears and bar/dots are hidden at T-30", async ({ page }) => {
		await page.goto("/dashboard?testCountdown=1");

		// testSecsRef starts at 35; runFor fires setInterval(1000) once per simulated second.
		// After 6 ticks: secsToRace = 35→34→33→32→31→30 → showRaceCountdown becomes true
		await page.clock.runFor(6_000);

		await expect(page.getByTestId("race-countdown")).toBeVisible();
		await expect(page.getByTestId("idle-countdown-bar")).not.toBeVisible();
		await expect(page.getByTestId("carousel-dots")).not.toBeVisible();
	});

	test("countdown number decrements correctly", async ({ page }) => {
		await page.goto("/dashboard?testCountdown=1");

		// 6 ticks → secsToRace=30 → display "30"
		await page.clock.runFor(6_000);
		await expect(page.getByTestId("countdown-seconds")).toContainText("30");

		// 10 more ticks → secsToRace=20 → display "20"
		await page.clock.runFor(10_000);
		await expect(page.getByTestId("countdown-seconds")).toContainText("20");
	});

	test("live layout replaces countdown at T=0", async ({ page }) => {
		await page.goto("/dashboard?testCountdown=1");

		// 36 ticks: at tick 36, secsToRace=35-36=-1 ≤ 0 → onPreLive fires → preliveTrigger → live layout
		await page.clock.runFor(36_000);

		await expect(page.getByTestId("race-countdown")).not.toBeVisible();
		await expect(page.getByTestId("idle-carousel")).not.toBeVisible();
	});

	test("normal carousel runs without testCountdown param", async ({ page }) => {
		await page.goto("/dashboard");
		await expect(page.getByTestId("idle-carousel")).toBeVisible();
		await expect(page.getByTestId("race-countdown")).not.toBeVisible();
	});
});

test.describe("live race simulation (SSE mock)", () => {
	// These tests don't use fake clocks so EventSource can deliver events normally.
	// The useSessionMode 3s debounce runs in real time (≤4s total wait).

	test("SessionStatus Started drives transition to live layout", async ({ page }) => {
		// Every EventSource connection (initial + retries after close) gets "Started".
		// This keeps rawIsLive=true consistently so the 3s debounce can complete.
		await page.route("http://localhost:4000/api/realtime", (route) => {
			route.fulfill({ status: 200, headers: SSE_HEADERS, body: SSE_STARTED_STREAM });
		});

		await page.goto("/dashboard");

		// Carousel visible initially (React state update hasn't propagated yet)
		await expect(page.getByTestId("idle-carousel")).toBeVisible();

		// After 3s LIVE_DEBOUNCE fires, isLive=true → live layout renders (carousel unmounts)
		await expect(page.getByTestId("idle-carousel")).not.toBeVisible({ timeout: 8_000 });
	});

	test("SSE 'Started' wins over countdown — live layout appears before countdown ends", async ({ page }) => {
		// When SSE delivers "Started" immediately, the 3s debounce completes before the
		// 35s testCountdown reaches T=0. The app leaves idle mode via SSE, not the timer.
		await page.route("http://localhost:4000/api/realtime", (route) => {
			route.fulfill({ status: 200, headers: SSE_HEADERS, body: SSE_STARTED_STREAM });
		});

		await page.goto("/dashboard?testCountdown=1");

		// Carousel shows on mount — testCountdown hasn't reached T-30 yet
		await expect(page.getByTestId("idle-carousel")).toBeVisible();

		// SSE debounce (3s) resolves in real time; live layout replaces idle before countdown shows
		await expect(page.getByTestId("idle-carousel")).not.toBeVisible({ timeout: 8_000 });
	});
});
