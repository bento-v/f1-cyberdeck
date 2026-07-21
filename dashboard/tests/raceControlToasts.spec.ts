import { test, expect } from "@playwright/test";

// The live layout shows race-control messages as bottom-right toasts (one at a
// time) instead of a scroll-only panel, and the upstream footer is gone — the
// kiosk view must not require scrolling.

const SSE_HEADERS = {
	"Content-Type": "text/event-stream",
	"Cache-Control": "no-cache",
	"Connection": "keep-alive",
};

const initial = JSON.stringify({
	SessionStatus: { Status: "Started" },
	RaceControlMessages: {
		Messages: [
			{ Utc: "2026-07-26T13:00:00", Lap: 1, Category: "Flag", Flag: "GREEN", Message: "GREEN LIGHT - PIT EXIT OPEN" },
			{ Utc: "2026-07-26T13:20:00", Lap: 12, Category: "SafetyCar", Message: "SAFETY CAR DEPLOYED" },
		],
	},
});

const STREAM = ["event: initial", `data: ${initial}`, "", ""].join("\n");

test("race control toast appears bottom-right and footer is gone", async ({ page }) => {
	await page.route("http://localhost:4000/api/realtime", (route) => {
		route.fulfill({ status: 200, headers: SSE_HEADERS, body: STREAM });
	});

	await page.setViewportSize({ width: 1366, height: 768 });
	await page.goto("/dashboard");

	// Live layout after the 3s debounce
	await expect(page.getByTestId("idle-carousel")).not.toBeVisible({ timeout: 8_000 });

	// Latest race-control message shows as a toast in the bottom-right corner
	const toast = page.getByTestId("race-control-toast");
	await expect(toast).toBeVisible({ timeout: 5_000 });
	await expect(toast).toContainText("SAFETY CAR DEPLOYED");

	const box = await toast.boundingBox();
	const viewport = page.viewportSize()!;
	expect(box!.x + box!.width).toBeGreaterThan(viewport.width * 0.7); // right side
	expect(box!.y + box!.height).toBeGreaterThan(viewport.height * 0.7); // bottom

	// Toast retires after its display window
	await expect(toast).not.toBeVisible({ timeout: 12_000 });

	// Upstream footer removed from the dashboard page
	await expect(page.getByText("Made with", { exact: false })).not.toBeVisible();
});
