# Setup

Service and environment reference for **f1-cyberdeck**. For the one-shot Raspberry Pi install and
the copy-deploy tarball, see [`README.md`](README.md); for architecture and Pi-specific gotchas, see
[`CLAUDE.md`](CLAUDE.md).

> This fork's `realtime` service serves **SSE**, not WebSockets like upstream f1-dash. Upstream
> prebuilt images are therefore incompatible — **everything is built from this repo.** Do not pull
> `slowlydev/f1-dash` images.

## Components

Three services, all built from source and wired together by [`compose.yaml`](compose.yaml).

### dashboard (`web`)

The Next.js 16 app (App Router, standalone output). Renders the kiosk and reads live data over SSE.

`NEXT_PUBLIC_*` values are **inlined at build time**, so they are passed as Docker **build args**,
not runtime env:

```
NEXT_PUBLIC_KIOSK=1                        # kiosk mode: hide nav/cursor, enable burn-in shift
NEXT_PUBLIC_LIVE_URL=http://localhost:4000 # where the browser reaches the realtime SSE endpoint
```

Runtime env:

```
API_URL=http://api:80                      # schedule/results service (compose network name)
```

### realtime

Rust (Axum + SignalR). Connects to F1's live SignalR feed and re-serves it as **SSE** on
`/api/realtime` (plus `/api/current`, `/api/drivers`, …).

```
RUST_LOG=realtime=info
ADDRESS=0.0.0.0:80                          # container listens on :80; compose publishes 4000:80
ORIGIN=http://localhost:3000                # CORS origin (the dashboard)
F1_DEV_URL=ws://localhost:8000/ws           # (optional) point at the simulator for replay
```

### api

Rust (Axum). Serves non-realtime data (past/future sessions, schedule, results), backed by the
Jolpica (Ergast-compatible) API.

```
RUST_LOG=api=info
ADDRESS=0.0.0.0:80                          # container listens on :80; compose publishes 4010:80
ORIGIN=http://localhost:3000                # CORS origin (the dashboard)
```

## Running with Docker Compose

`compose.yaml` builds all three services from source and runs them with `restart: unless-stopped`:

- `web` builds `./dashboard` with build args `NEXT_PUBLIC_KIOSK=1` and
  `NEXT_PUBLIC_LIVE_URL=http://localhost:4000`; the browser reaches `realtime` via the published
  host port `localhost:4000`.
- `realtime` and `api` build from the root [`dockerfile`](dockerfile) (targets `realtime` / `api`).

```bash
docker compose up --build -d      # build + run all three
docker compose logs -f web        # follow a service
docker compose down               # stop
```

On the Pi, `kiosk/install.sh` does this for you (plus Chromium, swap, autostart). To cross-build the
arm64 images from a faster machine: `docker buildx bake arm64` (see [`docker-bake.hcl`](docker-bake.hcl)).

## Local development (no Docker)

```bash
cd dashboard
yarn install         # yarn 4 (berry) — NOT npm; keep yarn.lock authoritative
yarn dev             # http://localhost:3000/dashboard
```

Drive live mode without a real session using the dependency-free mock or the FastF1 replay:

```bash
yarn mock:live       # synthetic "Started" feed, auto-switches to live
yarn replay          # replays a real recorded race (2026 Austrian GP) over SSE
yarn replay:end      # jumps near the finish to trigger the post-race summary
```

See `dashboard/scripts/replay-data/README.md` for the replay data pipeline, and `README.md` for the
`?testCountdown=1` / `?burnin=1` dev shortcuts.

## Notes

- CORS: the services default to a permissive local setup. If you expose them beyond `localhost`
  (other devices on your LAN, a reverse proxy), set each service's origin accordingly and secure it
  yourself — the kiosk deployment assumes a single local machine.
- Secrets: `.env`, `compose.env` and any `*.tar.gz` courier are git-ignored.
