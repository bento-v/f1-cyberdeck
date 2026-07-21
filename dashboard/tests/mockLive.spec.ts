import { test, expect } from "@playwright/test";

// Verifies the mock realtime feed populates the live dashboard.
// REQUIRES the mock server running: `npm run mock:live` (SessionStatus "Started").
// The mock auto-switches the dashboard to live via SSE after the ~3s debounce.

test("mock feed populates the live leaderboard", async ({ page }) => {
	// Skip when the mock server isn't running so the default suite stays green.
	// Probe with OPTIONS (returns 204 instantly) — a GET would hang on the SSE stream.
	const reachable = await page
		.request.fetch("http://localhost:4000/api/realtime", { method: "OPTIONS", timeout: 1500 })
		.then((r) => r.status() === 204)
		.catch(() => false);
	test.skip(!reachable, "mock server not running — start it with `npm run mock:live`");

	const errors: string[] = [];
	page.on("console", (msg) => {
		if (msg.type() === "error") errors.push(msg.text());
	});

	await page.goto("/dashboard");

	// SSE "Started" → useSessionMode flips to live after ~3s debounce
	// Leaderboard rows render from DriverList + TimingData (look for a driver TLA)
	await expect(page.getByText("VER", { exact: true }).first()).toBeVisible({ timeout: 12_000 });
	await expect(page.getByText("HAM", { exact: true }).first()).toBeVisible();

	// No inflate errors from CarDataZ / PositionZ decoding (the risky part)
	const inflateErrors = errors.filter((e) => /inflate|incorrect header|invalid|pako/i.test(e));
	expect(inflateErrors, `console errors:\n${inflateErrors.join("\n")}`).toHaveLength(0);
});
