# Replay data (FastF1)

Real F1 session telemetry, flattened for the SSE replay path
(`../mock-realtime.mjs --replay=<file>`). Same data source the
[f1-race-replay](https://github.com/IAmTomShaw/f1-race-replay) project uses: the
public [FastF1](https://github.com/theOehrly/Fast-F1) library.

The `*.json` files here are **large (~16 MB) and git-ignored** — they are
generated, not source. Regenerate them with the extractor:

```bash
pip install fastf1
python scripts/extract-fastf1.py --year 2026 --gp Austria --session R \
    --out scripts/replay-data/austria-2026.json
```

Then stream it into the dashboard's live mode:

```bash
yarn replay         # plays from lights-out at 8× session speed
yarn replay:end     # jumps near the finish so the post-race summary triggers
# or directly, with options:
node scripts/mock-realtime.mjs --replay=scripts/replay-data/austria-2026.json \
    --speed=8 [--start=SECONDS] [--loop]
```

Open http://localhost:3000/dashboard — it auto-switches to live (~3 s debounce).

## What's real vs. approximated

Real, straight from FastF1: running order, positions, gaps/intervals (at the
line), lap & sector times, speed-trap values, tyre compound/stint, pit windows,
DNFs, car telemetry (RPM / speed / gear / throttle / brake), GPS (`PositionZ`),
weather, race-control messages, the final classification used by the post-race
summary, and **real championship standings** (driver standings after the prior
round via FastF1's Ergast/Jolpica wrapper, plus this race's points → the
summary's ▲/▼ and post-race totals show genuine title-fight movement, distinct
from the race result).

Approximated / source-limited:
- **Lap fraction → map position.** The Map places cars from `TimingData` segment
  progress, so the extractor synthesizes `Sectors[].Segments[]` from a
  time-based within-lap fraction. Cars circulate correctly but at roughly
  constant per-lap speed (no per-corner deceleration on the map dots).
- **DRS.** Uses the real FastF1 `DRS` channel when present. This 2026 session's
  channel is all-zero, so the extractor **derives** a believable indicator from
  real telemetry: eligible (within ~1 s of the car ahead, lap ≥ 3, not in pit)
  and active (eligible + full throttle + high speed off the brakes = on a
  straight). It's an approximation, not a fixed detection-zone model.

## Playback speed

`--speed=N` is **session-seconds per real second** (playback is driven by a
wall-clock session-time cursor, so the value is exact). `--speed=1` is real time
(~70 s/lap at Red Bull Ring) — the default for `yarn replay`. Bump it
(`--speed=8`) to review the race faster.
