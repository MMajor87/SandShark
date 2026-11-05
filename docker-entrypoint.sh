#!/bin/sh
set -e

# must resolve the same directory the server does (helpers/paths.ts)
DATA_DIR="${SANDSHARK_DATA_PATH:-/home/bun/.config/sandshark}"

# an owner can update the server from its settings, which puts the new binary in the data
# volume (helpers/docker-update.ts), since the image itself cannot change. run that binary
# while it is newer than the image, and drop it once a pulled image catches up, so a recreated
# container never goes back to an older server than the one that last migrated the database
UPDATE_DIR="$DATA_DIR/server-update"
BINARY=/sandshark

if [ -x "$UPDATE_DIR/sandshark" ] && [ -f "$UPDATE_DIR/version" ]; then
  IMAGE_VERSION="$(cat /sandshark-version)"
  UPDATE_VERSION="$(cat "$UPDATE_DIR/version")"
  NEWEST="$(printf '%s\n%s\n' "$IMAGE_VERSION" "$UPDATE_VERSION" | sort -V | tail -n 1)"

  if [ "$UPDATE_VERSION" != "$IMAGE_VERSION" ] && [ "$NEWEST" = "$UPDATE_VERSION" ]; then
    echo "Running server $UPDATE_VERSION, installed from the server settings, over image $IMAGE_VERSION"
    BINARY="$UPDATE_DIR/sandshark"
  else
    rm -rf "$UPDATE_DIR"
  fi
fi

# if we're already running as non-root (e.g. K8s securityContext, Podman rootless),
# just ensure the data directory exists and run the binary directly.
if [ "$(id -u)" -ne 0 ]; then
  mkdir -p "$DATA_DIR"
  exec "$BINARY"
fi

# running as root: optionally remap the bun user's UID/GID via PUID/PGID env vars
if [ -n "$PUID" ] && [ -n "$PGID" ]; then
  echo "Setting bun user to UID=$PUID GID=$PGID"

  if [ "$(getent group bun | cut -d: -f3)" != "$PGID" ]; then
    groupmod -o -g "$PGID" bun
  fi

  if [ "$(id -u bun)" != "$PUID" ]; then
    usermod -o -u "$PUID" bun
  fi
fi

# ensure the data directory exists and is owned by the bun user
mkdir -p "$DATA_DIR"
chown -R bun:bun /home/bun/.config "$DATA_DIR"

# drop privileges and exec the binary
exec su -s /bin/sh bun -c "exec \"$BINARY\""
