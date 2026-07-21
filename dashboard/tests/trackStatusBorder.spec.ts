import { test, expect } from "@playwright/test";

// Live view shows a screen-edge glow during interruptions: yellow for Safety
// Car / VSC, red for a red flag, nothing when the track is clear.

const SSE_HEADERS = {
	"Content-Type": "text/event-stream",
	"Cache-Control": "no-cache",
	"Connection": "keep-alive",
};

const streamFor = (trackStatus: string) =>
	[
		"event: initial",
		`data: ${JSON.stringify({ SessionStatus: { Status: "Started" }, TrackStatus: { Status: trackStatus, Message: "" } })}`,
		"",
		"",
	].join("\n");

const cases = [
	{ name: "safety car", status: "4", rgb: "234, 179, 8" },
	{ name: "VSC", status: "6", rgb: "234, 179, 8" },
	{ name: "red flag", status: "5", rgb: "239, 68, 68" },
] as const;

for (const { name, status, rgb } of cases) {
	test(`border glow shows for ${name}`, async ({ page }) => {
		await page.route("http://localhost:4000/api/realtime", (route) => {
			route.fulfill({ status: 200, headers: SSE_HEADERS, body: streamFor(status) });
		});

		await page.goto("/dashboard");
		await expect(page.getByTestId("idle-carousel")).not.toBeVisible({ timeout: 8_000 });

		const border = page.getByTestId("track-status-border");
		await expect(border).toBeVisible();
		const shadow = await border.evaluate((el) => getComputedStyle(el).boxShadow);
		expect(shadow).toContain(rgb);
	});
}

test("no border glow when the track is clear", async ({ page }) => {
	await page.route("http://localhost:4000/api/realtime", (route) => {
		route.fulfill({ status: 200, headers: SSE_HEADERS, body: streamFor("1") });
	});

	await page.goto("/dashboard");
	await expect(page.getByTestId("idle-carousel")).not.toBeVisible({ timeout: 8_000 });
	await expect(page.getByTestId("track-status-border")).not.toBeVisible();
});
