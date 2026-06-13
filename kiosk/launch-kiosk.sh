#!/usr/bin/env bash
# Launches Chromium in kiosk mode pointing at the f1-cyberdeck dashboard.
# Designed for Raspberry Pi 5 running Raspberry Pi OS (64-bit) with LXDE desktop.
# Auto-restarts Chromium if it crashes.

set -euo pipefail

DASHBOARD_URL="${F1_DASHBOARD_URL:-http://localhost:3000/dashboard}"

# Disable screen blanking and power management
xset s off
xset s noblank
xset -dpms

# Hide the cursor after a short idle period (requires unclutter)
if command -v unclutter &>/dev/null; then
    unclutter -idle 3 -root &
fi

echo "Launching F1 Cyberdeck kiosk → $DASHBOARD_URL"

# Restart loop — Chromium can crash on WebGL/GPU events
while true; do
    # Remove any stale Chromium lock files that prevent restart
    rm -f "$HOME/.config/chromium/SingletonLock" \
          "$HOME/.config/chromium/SingletonCookie" \
          "$HOME/.config/chromium/SingletonSocket"

    chromium-browser \
        --kiosk \
        --window-size=1366,768 \
        --window-position=0,0 \
        --noerrdialogs \
        --disable-infobars \
        --disable-session-crashed-bubble \
        --disable-restore-session-state \
        --disable-translate \
        --disable-features=TranslateUI \
        --check-for-update-interval=31536000 \
        --autoplay-policy=no-user-gesture-required \
        --start-fullscreen \
        "$DASHBOARD_URL" || true

    echo "Chromium exited — restarting in 3 seconds..."
    sleep 3
done
