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

REPO_URL="https://github.com/secretaccount99/f1-cyberdeck"
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
sudo apt-get install -y --no-install-recommends chromium-browser unclutter
ok "Chromium installed"

# ── 3. Clone / update repo ─────────────────────────────────────────────────────
if [[ -d "$INSTALL_DIR/.git" ]]; then
    info "Updating existing repo at $INSTALL_DIR..."
    git -C "$INSTALL_DIR" pull origin "$BRANCH"
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
API_URL=http://localhost:4001
SKIP_ENV_VALIDATION=1
EOF
    ok ".env created"
else
    ok ".env already exists — skipping"
fi

# ── 5. Start services ──────────────────────────────────────────────────────────
info "Starting f1-cyberdeck services via Docker Compose..."
cd "$INSTALL_DIR"

# Use pre-built upstream images (no local build needed — saves 30+ min on Pi)
docker compose pull
docker compose up -d
ok "Services started. Dashboard will be at $DASHBOARD_URL in ~30 seconds."

# ── 6. LXDE autostart ─────────────────────────────────────────────────────────
AUTOSTART_DIR="$HOME/.config/lxsession/LXDE-pi"
AUTOSTART_FILE="$AUTOSTART_DIR/autostart"
KIOSK_LINE="@bash $INSTALL_DIR/kiosk/launch-kiosk.sh"

mkdir -p "$AUTOSTART_DIR"

# Copy default autostart if it doesn't exist yet
if [[ ! -f "$AUTOSTART_FILE" ]]; then
    if [[ -f /etc/xdg/lxsession/LXDE-pi/autostart ]]; then
        cp /etc/xdg/lxsession/LXDE-pi/autostart "$AUTOSTART_FILE"
    else
        touch "$AUTOSTART_FILE"
    fi
fi

if grep -qF "$KIOSK_LINE" "$AUTOSTART_FILE"; then
    ok "Kiosk autostart already configured"
else
    info "Adding kiosk to LXDE autostart..."
    echo "$KIOSK_LINE" >> "$AUTOSTART_FILE"
    ok "Kiosk will launch automatically on next desktop login"
fi

chmod +x "$INSTALL_DIR/kiosk/launch-kiosk.sh"

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
