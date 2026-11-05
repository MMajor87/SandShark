#!/bin/sh
# installs SandShark Server as a systemd service, see docs/linux-server-install.md. the release
# workflow publishes this as sandshark-install-linux.sh with its own version filled in, so the
# script from a release installs that release
#
#   curl -fsSL <release url>/sandshark-install-linux.sh | sudo sh
#   sudo sh sandshark-install-linux.sh --uninstall [--purge]
#   sudo sh sandshark-install-linux.sh --binary ./sandshark-linux-x64

set -eu

VERSION="@SANDSHARK_VERSION@"
REPO="MMajor87/SandShark"
SERVICE="sandshark"
SERVICE_USER="sandshark"
# the service user owns the binary's folder, so the server can replace its own binary when it
# updates (helpers/systemd-update.ts)
INSTALL_DIR="/opt/sandshark"
DATA_DIR="/var/lib/sandshark"
UNIT_PATH="/etc/systemd/system/$SERVICE.service"

ACTION="install"
PURGE=0
LOCAL_BINARY=""

say() {
  printf '%s\n' "$*"
}

fail() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}

usage() {
  say "usage: $0 [--binary <path>] | --uninstall [--purge]"
  say ""
  say "  --binary <path>  install this server binary instead of downloading release $VERSION"
  say "  --uninstall      remove the service and the server, keeping its data"
  say "  --purge          with --uninstall, also delete the data and the $SERVICE_USER user"
}

while [ $# -gt 0 ]; do
  case "$1" in
    --binary)
      [ $# -ge 2 ] || fail "--binary needs a path"
      LOCAL_BINARY="$2"
      shift 2
      ;;
    --uninstall)
      ACTION="uninstall"
      shift
      ;;
    --purge)
      PURGE=1
      shift
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      usage >&2
      exit 2
      ;;
  esac
done

[ "$(id -u)" -eq 0 ] || fail "run this as root, for example with sudo"

if ! command -v systemctl >/dev/null 2>&1 || [ ! -d /run/systemd/system ]; then
  fail "this machine does not run systemd. Use the Docker image or run the binary yourself instead."
fi

uninstall() {
  if [ -f "$UNIT_PATH" ]; then
    systemctl disable --now "$SERVICE" || true
    rm -f "$UNIT_PATH"
    systemctl daemon-reload
  fi

  rm -rf "$INSTALL_DIR"

  if [ "$PURGE" -eq 1 ]; then
    rm -rf "$DATA_DIR"

    if id "$SERVICE_USER" >/dev/null 2>&1; then
      userdel "$SERVICE_USER"
    fi

    say "Removed SandShark Server, its data and the $SERVICE_USER user."
  else
    say "Removed SandShark Server. Its data is still in $DATA_DIR; run again with --purge to delete it."
  fi
}

get_target() {
  case "$(uname -m)" in
    x86_64 | amd64) printf 'linux-x64' ;;
    aarch64 | arm64) printf 'linux-arm64' ;;
    *) fail "there is no SandShark Server build for $(uname -m)" ;;
  esac
}

download() {
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL -o "$2" "$1"
  elif command -v wget >/dev/null 2>&1; then
    wget -q -O "$2" "$1"
  else
    fail "curl or wget is needed to download the server"
  fi
}

# the release's binary for this machine, checked against the release's SHA256SUMS.txt
fetch_release_binary() {
  case "$VERSION" in
    @*) fail "this copy of the script has no version; use the one attached to a server release, or --binary" ;;
  esac

  binary_name="sandshark-$(get_target)"
  base_url="https://github.com/$REPO/releases/download/sandshark-server-v$VERSION"

  say "Downloading SandShark Server $VERSION ($binary_name)..."
  download "$base_url/$binary_name" "$WORK_DIR/$binary_name"
  download "$base_url/SHA256SUMS.txt" "$WORK_DIR/SHA256SUMS.txt"

  expected="$(awk -v name="$binary_name" '{ file = $2; sub(/^\*/, "", file) } file == name { print $1 }' "$WORK_DIR/SHA256SUMS.txt")"
  [ -n "$expected" ] || fail "SHA256SUMS.txt has no entry for $binary_name"

  actual="$(sha256sum "$WORK_DIR/$binary_name" | awk '{ print $1 }')"
  [ "$expected" = "$actual" ] || fail "$binary_name does not match its checksum"

  BINARY="$WORK_DIR/$binary_name"
}

write_unit() {
  cat >"$UNIT_PATH" <<EOF
[Unit]
Description=SandShark Server
Documentation=https://github.com/$REPO/blob/main/docs/linux-server-install.md
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$SERVICE_USER
Group=$SERVICE_USER
WorkingDirectory=$DATA_DIR
ExecStart=$INSTALL_DIR/sandshark
Environment=HOME=$DATA_DIR
Environment=SANDSHARK_DATA_PATH=$DATA_DIR
Environment=SANDSHARK_SERVICE=systemd
# also brings the server back after it installs an update and exits
Restart=always
RestartSec=5
TimeoutStopSec=30
LimitNOFILE=65536
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$INSTALL_DIR $DATA_DIR

[Install]
WantedBy=multi-user.target
EOF
}

install_server() {
  WORK_DIR="$(mktemp -d)"
  trap 'rm -rf "$WORK_DIR"' EXIT

  if [ -n "$LOCAL_BINARY" ]; then
    [ -f "$LOCAL_BINARY" ] || fail "$LOCAL_BINARY does not exist"
    BINARY="$LOCAL_BINARY"
  else
    fetch_release_binary
  fi

  if ! id "$SERVICE_USER" >/dev/null 2>&1; then
    useradd --system --home-dir "$DATA_DIR" --no-create-home --shell /usr/sbin/nologin "$SERVICE_USER"
  fi

  install -d -o "$SERVICE_USER" -g "$SERVICE_USER" -m 0755 "$INSTALL_DIR"
  # the data holds the database, so only the service user can read it
  install -d -o "$SERVICE_USER" -g "$SERVICE_USER" -m 0750 "$DATA_DIR"

  if systemctl is-active --quiet "$SERVICE"; then
    systemctl stop "$SERVICE"
  fi

  install -o "$SERVICE_USER" -g "$SERVICE_USER" -m 0755 "$BINARY" "$INSTALL_DIR/sandshark"

  write_unit
  systemctl daemon-reload
  systemctl enable --now "$SERVICE"

  say ""
  say "SandShark Server is installed and running as the $SERVICE service."
  say ""
  say "  status:   systemctl status $SERVICE"
  say "  log:      journalctl -u $SERVICE -f"
  say "  monitor:  http://localhost:4991/monitor on this machine,"
  say "            or ssh -L 4991:localhost:4991 <this machine> and open it locally"
  say "  data:     $DATA_DIR"
  say ""
  say "Open TCP 4991 for the app and UDP 40000 for voice in the firewall, for example:"
  say "  ufw allow 4991/tcp && ufw allow 40000/udp"
}

if [ "$ACTION" = "uninstall" ]; then
  uninstall
else
  install_server
fi
