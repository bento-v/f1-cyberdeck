#!/usr/bin/env bash
# Build a courier tarball of f1-cyberdeck for copy-deploy to the Raspberry Pi.
#
# The Pi builds everything from source (the fork serves SSE, not WebSockets, so
# upstream f1-dash images are incompatible). This tarball is just the source: no
# node_modules, no build output, no git history, no dev-only replay data. On the
# Pi, kiosk/install.sh detects a manually-copied tree (compose.yaml present, no
# .git) and skips the git clone — see CLAUDE.md "Copy-deploy without git".
#
# Usage:
#   bash kiosk/pack.sh                 # writes ./f1-cyberdeck.tar.gz
#   bash kiosk/pack.sh /path/out.tgz   # custom output path
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:-$ROOT/f1-cyberdeck.tar.gz}"

cd "$ROOT"

# Exclude everything the Pi rebuilds or doesn't need. Keeps the courier ~1-2 MB.
tar --exclude-vcs \
	--exclude="./f1-cyberdeck.tar.gz" \
	--exclude="*.tar.gz" \
	--exclude="node_modules" \
	--exclude=".next" \
	--exclude="target" \
	--exclude="test-results" \
	--exclude="playwright-report" \
	--exclude="dashboard/scripts/replay-data" \
	--exclude="graphify-out" \
	--exclude=".claude" \
	--exclude=".env" \
	--exclude=".env.*.local" \
	--exclude="*.log" \
	-czf "$OUT" .

echo "Wrote $OUT ($(du -h "$OUT" | cut -f1))"
echo
echo "Deploy to the Pi:"
echo "  scp \"$OUT\" pi@<pi-host>:~/f1-cyberdeck.tar.gz"
echo "  ssh pi@<pi-host>"
echo "  mkdir -p ~/f1-cyberdeck && tar -xzf ~/f1-cyberdeck.tar.gz -C ~/f1-cyberdeck"
echo "  bash ~/f1-cyberdeck/kiosk/install.sh && sudo reboot"
