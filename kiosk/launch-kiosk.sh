#!/usr/bin/env bash
# Launches Chromium in kiosk mode pointing at the f1-cyberdeck dashboard.
# Targets Raspberry Pi 5 running Raspberry Pi OS Bookworm (64-bit).
# Pi OS Bookworm defaults to Wayland (labwc) — script auto-detects and sets
# the correct display, acceleration, and cursor-hide flags for each session type.
# Auto-restarts Chromium on crash for unattended race-weekend operation.
#
# GPU check after launch: navigate to chrome://gpu and confirm:
#   "Graphics Feature Status" → "Canvas" and "Rasterization" = Hardware accelerated
#   "Video Decode" = Hardware accelerated (requires libva-drm2 installed)

set -euo pipefail

DASHBOARD_URL="${F1_DASHBOARD_URL:-http://localhost:3000/dashboard}"

# ---------------------------------------------------------------------------
# Display management — Wayland vs X11
# ---------------------------------------------------------------------------
if [ -n "${WAYLAND_DISPLAY:-}" ] || [ "${XDG_SESSION_TYPE:-}" = "wayland" ]; then
    IS_WAYLAND=1
else
    IS_WAYLAND=0
fi

if [ "$IS_WAYLAND" -eq 0 ]; then
    # X11: disable screen blanking and DPMS
    xset s off
    xset s noblank
    xset -dpms
fi

# Hide cursor after idle period
# Wayland: wlr-randr or labwc/compositor config is the proper way.
# Fallback: set cursor to blank via environment (harmless on X11 too).
export XCURSOR_SIZE=0

# unclutter works under XWayland (when Chromium runs via XWayland) but not pure Wayland.
# Install hide-cursor (apt install hide-cursor) for native Wayland cursor hiding.
if [ "$IS_WAYLAND" -eq 0 ] && command -v unclutter &>/dev/null; then
    unclutter -idle 3 -root &
elif command -v hide-cursor &>/dev/null; then
    hide-cursor &
fi

# ---------------------------------------------------------------------------
# Chromium flags
# ---------------------------------------------------------------------------

# Common flags for all session types
COMMON_FLAGS=(
    --kiosk
    --window-size=1366,768
    --window-position=0,0
    --noerrdialogs
    --no-first-run
    --disable-infobars
    --disable-session-crashed-bubble
    --disable-restore-session-state
    --disable-translate
    --disable-features=TranslateUI
    --check-for-update-interval=31536000
    --autoplay-policy=no-user-gesture-required
    --start-fullscreen
    # Don't use the system keyring (avoids the "unlock keyring" prompt on an
    # unattended kiosk)
    --password-store=basic
    # Hardware acceleration — critical for smooth 200ms updates on Pi 5
    --ignore-gpu-blocklist
    --enable-gpu-rasterization
    --enable-zero-copy
)

# Wayland-specific flags — required on Pi OS Bookworm (labwc default).
# Combine ALL --enable-features into one flag: Chrome only honors the last
# occurrence, so separate flags silently drop earlier ones.
WAYLAND_FLAGS=(
    --ozone-platform=wayland
    --enable-features=UseOzonePlatform,VaapiVideoDecodeLinuxGL
)

# X11-specific flags
X11_FLAGS=(
    --display=:0
    --enable-features=VaapiVideoDecodeLinuxGL
)

if [ "$IS_WAYLAND" -eq 1 ]; then
    PLATFORM_FLAGS=("${WAYLAND_FLAGS[@]}")
else
    PLATFORM_FLAGS=("${X11_FLAGS[@]}")
fi

# Find the Chromium binary — Bookworm calls it `chromium`, older releases
# `chromium-browser`.
CHROMIUM="$(command -v chromium-browser || command -v chromium || true)"
if [ -z "$CHROMIUM" ]; then
    echo "ERROR: Chromium not found (looked for 'chromium' and 'chromium-browser')." >&2
    echo "Install it with: sudo apt install -y chromium" >&2
    exit 1
fi

echo "Launching F1 Cyberdeck kiosk → $DASHBOARD_URL"
echo "Session type: $([ "$IS_WAYLAND" -eq 1 ] && echo 'Wayland' || echo 'X11')  Browser: $CHROMIUM"

# ---------------------------------------------------------------------------
# Restart loop — Chromium can crash on GPU/WebGL events; kiosk must self-heal
# ---------------------------------------------------------------------------
while true; do
    # Remove stale singleton locks that block restart after a crash
    rm -f "$HOME/.config/chromium/SingletonLock" \
          "$HOME/.config/chromium/SingletonCookie" \
          "$HOME/.config/chromium/SingletonSocket"

    "$CHROMIUM" \
        "${COMMON_FLAGS[@]}" \
        "${PLATFORM_FLAGS[@]}" \
        "$DASHBOARD_URL" || true

    echo "Chromium exited — restarting in 3 seconds..."
    sleep 3
done
