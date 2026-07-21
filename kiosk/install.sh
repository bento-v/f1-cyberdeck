#!/usr/bin/env bash
# One-shot setup for f1-cyberdeck on Raspberry Pi 5 (64-bit Raspberry Pi OS).
# Run as a normal user (not root); uses sudo where needed.
#
# What this does:
#   1. Installs Docker + docker compose plugin
#   2. Installs Chromium and unclutter (cursor hider)
#   3. Clones or updates this repo
#   4. Writes a .env for the dashboard services
#   5. Starts all three services via Docker Compose
#   6. Configures LXDE autostart to launch the kiosk on boot

set -euo pipefail

REPO_URL="https://github.com/bento-v/f1-cyberdeck"
INSTALL_DIR="${F1_INSTALL_DIR:-$HOME/f1-cyberdeck}"
DASHBOARD_URL="http://localhost:3000/dashboard"
BRANCH="main"

info()  { echo -e "\033[1;34m[INFO]\033[0m  $*"; }
ok()    { echo -e "\033[1;32m[ OK ]\033[0m  $*"; }
warn()  { echo -e "\033[1;33m[WARN]\033[0m  $*"; }
die()   { echo -e "\033[1;31m[ERR ]\033[0m  $*" >&2; exit 1; }

# ── 1. Docker ──────────────────────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
    info "Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker "$USER"
    ok "Docker installed. NOTE: log out and back in for group change to take effect, or run: newgrp docker"
else
    ok "Docker already installed ($(docker --version))"
fi

# ── 2. Chromium + unclutter ────────────────────────────────────────────────────
info "Installing Chromium and unclutter..."
sudo apt-get update -qq
# Bookworm's package is `chromium`; older releases use `chromium-browser`.
sudo apt-get install -y --no-install-recommends chromium unclutter \
    || sudo apt-get install -y --no-install-recommends chromium-browser unclutter
ok "Chromium installed"

# Some Raspberry Pi OS Chromium wrappers inject a dead V8 flag
# (--js-flags=--no-decommit-pooled-pages) that current Chromium rejects, crashing
# it on launch. Strip it if present.
if grep -q 'no-decommit-pooled-pages' /usr/bin/chromium 2>/dev/null; then
    info "Removing obsolete --no-decommit-pooled-pages flag from Chromium wrapper..."
    sudo sed -i 's/ --js-flags=--no-decommit-pooled-pages//' /usr/bin/chromium
    ok "Chromium wrapper patched"
fi

# ── 2b. Screen blanking ────────────────────────────────────────────────────────
# The kiosk display must stay on 24/7. launch-kiosk.sh handles X11 via xset, but
# on Wayland (Bookworm default) blanking is a compositor setting — disable it
# system-wide here. (1 = disable in raspi-config's non-interactive mode.)
if command -v raspi-config &>/dev/null; then
    if sudo raspi-config nonint do_blanking 1; then
        ok "Screen blanking disabled"
    else
        warn "Couldn't disable screen blanking — check 'raspi-config > Display Options' manually"
    fi
else
    warn "raspi-config not found — make sure screen blanking is disabled manually"
fi

# ── 3. Clone / update repo ─────────────────────────────────────────────────────
if [[ -d "$INSTALL_DIR/.git" ]]; then
    info "Updating existing repo at $INSTALL_DIR..."
    git -C "$INSTALL_DIR" pull origin "$BRANCH"
elif [[ -f "$INSTALL_DIR/compose.yaml" ]]; then
    # Code was copied here manually (no git checkout) — use it as-is.
    info "Using existing copy at $INSTALL_DIR (no git repo found)."
else
    info "Cloning $REPO_URL into $INSTALL_DIR..."
    git clone --branch "$BRANCH" "$REPO_URL" "$INSTALL_DIR"
fi
ok "Repo ready at $INSTALL_DIR"

# ── 4. Write .env ──────────────────────────────────────────────────────────────
ENV_FILE="$INSTALL_DIR/dashboard/.env"
if [[ ! -f "$ENV_FILE" ]]; then
    info "Creating $ENV_FILE..."
    cat > "$ENV_FILE" <<'EOF'
NEXT_PUBLIC_LIVE_URL=http://localhost:4000
API_URL=http://localhost:4010
SKIP_ENV_VALIDATION=1
EOF
    ok ".env created"
else
    ok ".env already exists — skipping"
fi

# ── 4b. Swap ───────────────────────────────────────────────────────────────────
# The Rust build is memory-hungry on a 4 GB board; ensure at least 2 GB swap so it
# doesn't OOM. Safe to run repeatedly.
if [[ -f /etc/dphys-swapfile ]]; then
    info "Ensuring 2 GB swap for the build..."
    sudo dphys-swapfile swapoff || true
    if sudo sed -i 's/^CONF_SWAPSIZE=.*/CONF_SWAPSIZE=2048/' /etc/dphys-swapfile \
        && sudo dphys-swapfile setup \
        && sudo dphys-swapfile swapon; then
        ok "Swap set to 2 GB"
    else
        warn "Couldn't adjust swap — continuing anyway (a Pi 5 may not need it)"
    fi
else
    warn "dphys-swapfile not found — skipping swap setup"
fi

# ── 5. Start services ──────────────────────────────────────────────────────────
info "Starting f1-cyberdeck services via Docker Compose..."
cd "$INSTALL_DIR"

# Build the fork from source. The upstream images can't be used: this fork's
# dashboard needs NEXT_PUBLIC_KIOSK baked in, and its realtime service serves SSE
# (upstream serves WebSockets). Building the Rust services on a 4 GB Pi can be
# memory-hungry — if it OOMs, add swap, or cross-build elsewhere with
# `docker buildx bake arm64` and load the images before running compose.
docker compose up -d --build
ok "Services started (built from source). Dashboard will be at $DASHBOARD_URL once the build finishes."

# ── 6. Autostart ───────────────────────────────────────────────────────────────
# Raspberry Pi OS Bookworm uses Wayland (labwc on Pi 5, wayfire on Pi 4); older
# images use LXDE/X11. Configure all of them so the kiosk launches regardless of
# which desktop session the Pi happens to boot.
KIOSK_CMD="bash $INSTALL_DIR/kiosk/launch-kiosk.sh"
chmod +x "$INSTALL_DIR/kiosk/launch-kiosk.sh"

# labwc — Raspberry Pi 5 Bookworm default
mkdir -p "$HOME/.config/labwc"
LABWC_AUTOSTART="$HOME/.config/labwc/autostart"
if ! grep -qF "launch-kiosk.sh" "$LABWC_AUTOSTART" 2>/dev/null; then
    echo "$KIOSK_CMD &" >> "$LABWC_AUTOSTART"
fi

# wayfire — Raspberry Pi 4 Bookworm
WAYFIRE_INI="$HOME/.config/wayfire.ini"
if [[ -f "$WAYFIRE_INI" ]] && ! grep -qF "launch-kiosk.sh" "$WAYFIRE_INI"; then
    grep -q '^\[autostart\]' "$WAYFIRE_INI" || printf '\n[autostart]\n' >> "$WAYFIRE_INI"
    sed -i "/^\[autostart\]/a f1kiosk = $KIOSK_CMD" "$WAYFIRE_INI"
fi

# LXDE — older X11 sessions
LXDE_AUTOSTART="$HOME/.config/lxsession/LXDE-pi/autostart"
mkdir -p "$(dirname "$LXDE_AUTOSTART")"
if [[ ! -f "$LXDE_AUTOSTART" ]]; then
    [[ -f /etc/xdg/lxsession/LXDE-pi/autostart ]] && cp /etc/xdg/lxsession/LXDE-pi/autostart "$LXDE_AUTOSTART" || touch "$LXDE_AUTOSTART"
fi
if ! grep -qF "launch-kiosk.sh" "$LXDE_AUTOSTART"; then
    echo "@$KIOSK_CMD" >> "$LXDE_AUTOSTART"
fi

ok "Kiosk autostart configured (labwc / wayfire / LXDE)"

# ── Done ───────────────────────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
ok "F1 Cyberdeck installation complete!"
echo ""
echo "  Dashboard URL : $DASHBOARD_URL"
echo "  Services      : docker compose ps  (from $INSTALL_DIR)"
echo "  Logs          : docker compose logs -f"
echo "  Kiosk launch  : $INSTALL_DIR/kiosk/launch-kiosk.sh"
echo ""
echo "  Reboot to start the kiosk automatically, or run:"
echo "    bash $INSTALL_DIR/kiosk/launch-kiosk.sh"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
