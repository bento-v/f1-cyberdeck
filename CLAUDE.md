# CLAUDE.md — f1-cyberdeck

Guidance for AI agents working in this repo. Read this first.

## What this is

**f1-cyberdeck** is a fork of [f1-dash](https://github.com/slowlydev/f1-dash) re-purposed as an
**unattended kiosk**. It runs on a **Raspberry Pi 5 (4 GB)** driving a **1366×768** display in
Chromium kiosk mode. It shows:

- **Live mode** — real-time F1 telemetry during a session (leaderboard, driver telemetry, track
  map with cars, race control, team radios).
- **Idle carousel** — between sessions, an auto-rotating set of info panels.
- **Race-weekend arc** (all automatic): idle carousel → 30s countdown → live timing → ~90s
  post-race summary → back to an updated carousel.

The deployment target is the only thing that matters in production: a Pi 5 on **64-bit Raspberry
Pi OS Bookworm (Wayland/labwc)**, built from source via Docker Compose.

## Tech stack

| Layer | Tech |
|---|---|
| Dashboard framework | **Next.js 16** (App Router, Turbopack, standalone output), **React 19** |
| Language | TypeScript (strict) |
| Styling | **Tailwind CSS v4** (`@tailwindcss/postcss`) |
| Animation | **Motion** (Framer Motion successor) |
| Fonts | Geist Sans / Geist Mono |
| Live data | **SSE** from a local **Rust** service (`realtime`) on `localhost:4000`, endpoint `/api/realtime` |
| Backend (Rust) | `realtime` (F1 SignalR → SSE proxy), `api` (schedule/results), `simulator` (dev replay), `shared`, `signalr` |
| Schedule / results | **Jolpica** API `https://api.jolpi.ca/ergast/f1` (Ergast-compatible) |
| Track maps | **MultiViewer** API `https://api.multiviewer.app/api/v1/circuits/{key}/{year}` |
| Weather | **Open-Meteo** `https://api.open-meteo.com` (no auth) |
| State | **Zustand** stores (live data); module-level `Map` cache (1 hr TTL) for REST fetches |
| Package manager | **yarn 4.14.1** (berry, `nodeLinker: node-modules`) — do NOT use npm here |
| Containerization | Docker Compose, multi-stage Dockerfiles, `docker-bake.hcl` (arm64) |
| Kiosk browser | Chromium (Wayland), launched by `kiosk/launch-kiosk.sh` |

> ⚠️ The fork's `realtime` service serves **SSE** (`realtime::sse_stream`), whereas upstream
> f1-dash serves **WebSockets**. Upstream prebuilt images are therefore incompatible — everything
> must be **built from this repo**.

## Repo layout

```
/                       repo root
├── compose.yaml        builds & runs web + realtime + api (from source)
├── dockerfile          Rust build (targets: api, realtime)
├── docker-bake.hcl     arm64 cross-build targets
├── .gitattributes      forces LF on *.sh/dockerfile/etc (Windows checkout safety)
├── realtime/           Rust SSE service  → /api/realtime, /api/current, /api/drivers …
├── api/                Rust REST service (schedule/results)
├── simulator/          Rust dev tool: replay recorded SignalR data
├── shared/, signalr/   Rust support crates
├── kiosk/
│   ├── install.sh      one-shot Pi setup (Docker, Chromium, build, autostart)
│   └── launch-kiosk.sh Chromium kiosk launcher (Wayland/X11, 1366×768)
└── dashboard/          the Next.js app (the bulk of the work)
    ├── dockerfile      Next standalone build; bakes NEXT_PUBLIC_KIOSK / NEXT_PUBLIC_LIVE_URL
    ├── scripts/mock-realtime.mjs   dependency-free mock SSE backend for dev
    │                               (synthetic feed + `--replay=<file>` FastF1 replay mode)
    ├── scripts/extract-fastf1.py   pulls a real session via FastF1 → compact replay JSON
    ├── scripts/replay-data/        generated replay JSON (git-ignored, ~16 MB) + README
    ├── playwright.config.ts, tests/   e2e tests
    └── src/
        ├── app/dashboard/page.tsx     orchestrates idle ↔ live ↔ summary
        ├── app/dashboard/layout.tsx   live socket wiring + top session bar + kiosk cursor hide
        ├── hooks/  useSessionMode, useSocket, useDataEngine, useBuffer, useStores …
        ├── stores/ useDataStore (live state), useSettingsStore, useSidebarStore
        ├── components/dashboard/  LeaderBoard, Map, RaceControl, TeamRadios …
        ├── components/idle/       carousel + all idle panels (see below)
        └── lib/   inflate (pako), fetchMap, circuitKeys, teamColors, map, sorting …
```

## How the app flows (`app/dashboard/page.tsx`)

`useSessionMode()` derives `isLive` from `useDataStore` `SessionStatus.Status === "Started"`,
**debounced** (3 s to go live, 5 s to drop to idle) to avoid strobing on reconnect.

Render decision:
- `showLive = isLive || preliveTrigger`
- if `showLive` → **live layout** (LeaderBoard + Map + RaceControl/TeamRadios/TrackViolations).
- else if a race just ended → **`<RaceSummary>`** (~90 s, see below).
- else → **`<IdleCarousel>`**.

Idle & summary render inside **`<KioskStage>`**, which draws them at a fixed **1366×768** and
CSS-`transform: scale()`s to fit the screen (so a bigger monitor letterboxes instead of leaving a
bottom gap). The live layout is not wrapped.

### Idle carousel (`components/idle/IdleCarousel.tsx`)
8 panels, `CYCLE_MS = 15_000`, fade transition (`visible` opacity + conditional render so panels
fully unmount/remount each cycle). Order:
`0` Drivers' Championship · `1` Constructors' Championship · `2` Next Race Weekend ·
`3` Circuit & Schedule · `4` Last Race Results · `5` Driver Season Stats · `6` Track Map ·
`7` Track Weather.

Module-level `fetchCache` (1 hr TTL, 5-min error cooldown) survives re-renders and idle↔live
transitions. `clearIdleFetchCache()` is exported and called after a race so the returning carousel
re-fetches post-race standings.

### Race countdown → live
`IdleCarousel` watches the **Race** session start time (`raceSession`). A **1 s `setInterval`**
(not rAF — see Pi notes) only sets state in the final 30 s window: it freezes the carousel
(`frozenRef`), shows `<RaceCountdownScreen>`, and fires `onPreLive()` at T=0 → `preliveTrigger` →
live layout. For non-Race sessions, `IdleCountdownBar` fires `onPreLive` at T-120s instead.

### Post-race summary (`components/idle/RaceSummary.tsx`)
When `isLive` goes true→false **for a Race session**, `page.tsx` snapshots the final classification
from `useDataStore.getState().state` (DriverList, TimingData, ChampionshipPrediction, SessionInfo)
and shows `<RaceSummary>` for `SUMMARY_MS = 90_000`. Snapshotting keeps it stable even if SSE keeps
streaming/drops. Content: winner + podium, P4–P8, DNFs, championship impact (▲/▼ + points).

## Live data pipeline

`useSocket` (EventSource → `localhost:4000/api/realtime`) emits `initial` (full state) and
`update` (partial) events → `useDataEngine` buffers them and writes to Zustand `useDataStore`.

- The realtime service forwards the F1 streams under their **dotted topic names**
  `CarData.z` / `Position.z` (see `realtime/src/f1.rs` TOPICS; the state service does not rename
  them). `useSocket` **normalizes** these to `CarDataZ` / `PositionZ` at the SSE boundary — without
  that, real live races have no car telemetry, DRS, or GPS. The mock/replay also send the dotted
  keys so they exercise the same path.
- `CarDataZ` / `PositionZ` are **base64(zlib-deflateRaw(JSON))** — decoded with
  `pako.inflateRaw` in `lib/inflate.ts`. The map places cars from **real GPS** (`PositionZ` →
  store `positions`, whose X/Y share the MultiViewer circuit coordinate space) when present —
  continuous coords give smooth motion. It **falls back to TimingData segment-progress** placement
  (`getDriverPosition` in `Map.tsx`, ~24 steps/lap → steppy) only when GPS is absent or all-zero
  (e.g. a feed that doesn't carry position data). The synthetic mock omits `PositionZ` on purpose so
  it uses the segment fallback; the FastF1 replay sends real `PositionZ`.
- SSE watchdog (`useSocket`) reloads the page if the backend drops **after** having been reachable
  (ignores errors when it was never up — avoids reload loops while idle between races).

## Data-shape gotchas (verified against real APIs)

- `SessionStatus.Status`: `"Started" | "Finished" | "Finalised" | "Ends"`. Only `"Started"` is live.
- Jolpica race-result `status`: **finishers** are `"Finished"`, `"Lapped"` (Jolpica's word — NOT
  `"+1 Lap"`), or `"+N Lap(s)"`. Everything else (`"Retired"`, `"Accident"`, `"Engine"`, …) is a
  **DNF**. See `LastRacePanel.tsx` `isFinisher()`.
- MultiViewer circuit API has **no DRS-zone data** (keys: corners, marshalLights, marshalSectors,
  x, y, rotation, …). Don't promise DRS overlays from it.
- The Circuit & Schedule panel must use **only the upcoming round's** qualifying
  (`nextQualifyingResults`) — never fall back to last-race qualifying (that was a real bug).
- **FastF1 replay caveats** (`scripts/extract-fastf1.py`): the Map shows cars from `TimingData`
  segment progress, so the extractor synthesizes segments from a *time-based* within-lap fraction
  (cars circulate, but at ~constant per-lap pace — no per-corner slow-down of the dots). The 2026
  Austria FastF1 `DRS` channel is all-zero, so DRS is **derived** from real telemetry (within ~1s of
  the car ahead = eligible; + full throttle/high speed = active) — used only when the raw channel is
  empty. The replay's
  `ChampionshipPrediction` is **real** season standings (FastF1 Ergast/Jolpica driver standings
  after the prior round + this race's points, re-ranked) — so the summary shows true title movement,
  not the race result. Replay `--speed=N` = session-seconds per real second (wall-clock cursor, so
  exact); `--speed=1` ≈ real time (~70 s/lap).

## Local development

```bash
cd dashboard
yarn install            # NOT npm — keep yarn.lock in sync (npm desyncs it & breaks the Docker build)
yarn dev                # http://localhost:3000/dashboard  (non-kiosk: nav dots + sidebar visible)
```

**Mock backend** (`scripts/mock-realtime.mjs`, dependency-free, serves SSE on :4000):
```bash
yarn mock               # SessionStatus "Inactive" — pair with ?testCountdown=1
yarn mock:live          # SessionStatus "Started" — dashboard auto-switches to live
node scripts/mock-realtime.mjs --status=started --raceend=6000   # live then Finished after 6s (tests summary)
```
The mock produces DriverList/TimingData/ChampionshipPrediction, animated car positions (via segment
progress), DNFs, etc. It is **dev-only**, never deployed.

**Real-session replay** (FastF1 — same data source as
[f1-race-replay](https://github.com/IAmTomShaw/f1-race-replay)). For verifying live mode against a
real race instead of the synthetic feed:
```bash
pip install fastf1
python scripts/extract-fastf1.py --year 2026 --gp Austria --session R \
    --out scripts/replay-data/austria-2026.json     # ~16 MB, git-ignored, regenerable
yarn replay        # streams it over SSE on :4000 at real time (--speed=1; auto-goes live)
yarn replay:end    # jumps near the finish so the post-race summary triggers
```
The extractor flattens FastF1 into compact numeric/columnar frames; the Node replay server
(`mock-realtime.mjs --replay=…`) stays dumb — it expands lap-fraction → `Sectors[].Segments[]`
(what the Map uses) and zlib-deflates `CarDataZ`/`PositionZ` at emit time. Flags: `--speed=N`
(session-seconds per real second), `--start=SECONDS`, `--loop`. Real data drives running order,
gaps, lap/sector times, speed traps, tyres/stints, pits, DNFs, car telemetry, GPS, weather, and
race control. See `scripts/replay-data/README.md` for the real-vs-approximated breakdown. Verified
end-to-end against the **2026 Austrian GP** (Russell win) by `tests/replayLive.spec.ts` and
`tests/replaySummary.spec.ts` (both skip unless a replay server is on :4000).

**Dev shortcuts:**
- `http://localhost:3000/dashboard?testCountdown=1` — fake 35→0 countdown (5 s carousel, 30 s
  countdown, then live), no real race needed. Inert without the param (kiosk URL has no query).

**Tests:** `npx playwright test` (Playwright auto-starts `yarn dev`). Tests that need live data
mock the SSE route or rely on the mock server (and skip if it's down). Kiosk-only behavior must be
tested against a `NEXT_PUBLIC_KIOSK=1` build.

**Verify changes** end-to-end with the mock + a short Playwright spec + a screenshot before
declaring done; the project has been built test-first throughout.

## Build & deploy (Raspberry Pi)

Production builds **everything from source** (see the SSE/upstream warning above).

```bash
# On the Pi (64-bit Bookworm), code already present at ~/f1-cyberdeck:
bash ~/f1-cyberdeck/kiosk/install.sh     # Docker + Chromium + swap + build + autostart
sudo reboot
```

`compose.yaml`:
- `web` → builds `./dashboard` with build args `NEXT_PUBLIC_KIOSK=1`,
  `NEXT_PUBLIC_LIVE_URL=http://localhost:4000`. Runtime `API_URL=http://api:80` (compose network;
  the browser reaches `realtime` via the published host port `localhost:4000`).
- `realtime` / `api` → built from root `dockerfile` (targets `realtime` / `api`).
- All three: `restart: unless-stopped`.

`NEXT_PUBLIC_*` are **inlined at build time** — they must be set as build args, not runtime env.

Cross-building for the Pi (faster than building on a 4 GB board): `docker buildx bake arm64`.

## Pi-specific gotchas (these cost real debugging time — heed them)

1. **CRLF line endings break everything on the Pi.** A Windows checkout converts `*.sh`,
   `dockerfile`, `.dockerignore` to CRLF → `bash` errors (`$'\r': command not found`), Docker
   `RUN` lines get `\r`, `.dockerignore` patterns stop matching (so `node_modules` leaks into the
   build). `.gitattributes` forces LF on these; if you edit on Windows, run
   `sed -i 's/\r$//' <file>` before building/shipping.
2. **Chromium binary is `chromium` on Bookworm**, not `chromium-browser`. `launch-kiosk.sh`
   auto-detects (`command -v chromium-browser || command -v chromium`); `install.sh` installs
   `chromium` (falls back to `chromium-browser`).
3. **Raspberry Pi OS Chromium wrapper injects a dead V8 flag.** `/usr/bin/chromium` (a shell
   wrapper) adds `--js-flags=--no-decommit-pooled-pages`, which current Chromium rejects and
   crash-loops on. `install.sh` strips it via `sed`; re-apply after a Chromium apt upgrade if it
   recurs.
4. **Pi 5 Bookworm desktop is Wayland (labwc), not X11/LXDE.** Autostart must go in
   `~/.config/labwc/autostart` (LXDE's `~/.config/lxsession/...` is ignored). `install.sh`
   configures labwc + wayfire + LXDE to be safe.
5. **Keyring prompt** on every Chromium launch → suppress with `--password-store=basic`
   (in `launch-kiosk.sh` COMMON_FLAGS).
6. **Cursor hiding on Wayland:** `unclutter` is X11-only and won't touch a native-Wayland surface.
   Primary approach: CSS `* { cursor: none }` injected in `dashboard/layout.tsx` for kiosk builds.
   Fallback if that doesn't take: run Chromium via XWayland (`--ozone-platform=x11`) + `unclutter`.
7. **Building Rust on a 4 GB Pi is memory-hungry.** `install.sh` raises swap to 2 GB
   (`dphys-swapfile`). A Pi 5 build is ~8–15 min; Pi 4 slower.
8. **arm64 only** — requires 64-bit Raspberry Pi OS.
9. **Docker group timing:** `install.sh` adds the user to `docker`, effective only after re-login;
   if the compose step hits a permission error, reboot and re-run `install.sh` (idempotent).
10. **Copy-deploy without git:** `install.sh` detects a manually-copied tree (no `.git` but
    `compose.yaml` present) and skips the clone. A 1.7 MB tarball (exclude `node_modules`, `.next`,
    `.git`, `target`, `test-results`) is the courier; the Pi build reinstalls deps for arm64.

## Conventions

- TypeScript strict; match surrounding code style (tabs in this repo). Keep comment density and
  naming consistent with neighbors.
- Performance matters: the kiosk runs 24/7 on modest hardware. Prefer `setInterval` over
  per-frame `requestAnimationFrame` for second-resolution updates; avoid re-rendering large trees
  every frame; CSS transforms over JS animation where possible.
- Don't reintroduce npm (`package-lock.json`); keep `yarn.lock` authoritative.
- Don't pull upstream f1-dash images — build from source.
