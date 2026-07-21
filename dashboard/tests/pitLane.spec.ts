import { test, expect } from "@playwright/test";
import { deflateRawSync } from "zlib";

// The live map learns the pit lane from real GPS while a car is InPit (MultiViewer
// has no pit-lane geometry) and draws it as a dashed path once the first transit
// completes. This drives one synthetic transit through SSE and asserts the path.
//
// Each SSE response carries one position sample and ends; `retry: 100` makes the
// EventSource reconnect fast, so the transit plays out over a few seconds.

const SSE_HEADERS = {
	"Content-Type": "text/event-stream",
	"Cache-Control": "no-cache",
	"Connection": "keep-alive",
};

const AUSTRIA_KEY = 19;
const STEPS = 24;

const posZ = (x: number, y: number): string =>
	deflateRawSync(
		Buffer.from(
			JSON.stringify({
				Position: [
					{ Timestamp: new Date().toISOString(), Entries: { "1": { Status: "OnTrack", X: x, Y: y, Z: 0 } } },
				],
			}),
		),
	).toString("base64");

test("pit lane is learned from a pit transit and drawn on the live map", async ({ page }) => {
	// Browsers may ignore the `retry` hint and reconnect at their ~3s default;
	// 24 samples then need well over the default 30s budget.
	test.setTimeout(150_000);
	// Build a plausible pit path: follow the first stretch of the real track,
	// offset sideways — consecutive points ~120 units apart, total well past the
	// minimum trace length.
	const res = await fetch(`https://api.multiviewer.app/api/v1/circuits/${AUSTRIA_KEY}/2026`).catch(() => null);
	test.skip(!res || !res.ok, "MultiViewer unavailable");
	const map = (await res!.json()) as { x: number[]; y: number[] };
	const waypoints = Array.from({ length: STEPS }, (_, i) => ({
		x: map.x[(i * 3) % map.x.length] + 400,
		y: map.y[(i * 3) % map.y.length] + 400,
	}));

	// The car loops through pit transits forever (transit, then a few samples
	// out of the pit). Reconnects burn through samples during the idle→live
	// debounce, so a single one-shot transit would finish before the map mounts;
	// looping guarantees the map observes at least one complete transit.
	const CYCLE = STEPS + 4;
	let conn = 0;
	await page.route("http://localhost:4000/api/realtime", (route) => {
		const phase = conn % CYCLE;
		const i = Math.min(phase, STEPS - 1);
		const done = phase >= STEPS; // car has left the pit for the rest of the cycle
		conn++;

		const initial = JSON.stringify({
			SessionStatus: { Status: "Started" },
			SessionInfo: { Meeting: { Name: "Test GP", Country: { Code: "AUT" }, Circuit: { Key: AUSTRIA_KEY, ShortName: "Austria" } } },
			TimingData: { Lines: { "1": { RacingNumber: "1", InPit: !done } } },
			PositionZ: posZ(waypoints[i].x, waypoints[i].y),
		});

		route.fulfill({
			status: 200,
			headers: SSE_HEADERS,
			body: ["retry: 100", "event: initial", `data: ${initial}`, "", ""].join("\n"),
		});
	});

	await page.goto("/dashboard");

	// Live layout after the 3s debounce
	await expect(page.getByTestId("idle-carousel")).not.toBeVisible({ timeout: 10_000 });

	// The dashed pit lane appears once enough of the transit has been observed
	await expect(page.getByTestId("pit-lane")).toBeVisible({ timeout: 120_000 });
	console.log("SSE connections used:", conn);
});
