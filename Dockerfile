FROM oven/bun:1.3.14

ARG TARGETARCH
ENV RUNNING_IN_DOCKER=true

USER root

COPY apps/server/build/out/sandshark-linux-x64 /tmp/sandshark-linux-x64
COPY apps/server/build/out/sandshark-linux-arm64 /tmp/sandshark-linux-arm64
COPY apps/server/package.json /tmp/server-package.json

# the entrypoint compares this with a server update installed into the data volume
RUN set -eux; \
    sed -n 's/^  "version": "\([^"]*\)".*/\1/p' /tmp/server-package.json > /sandshark-version; \
    test -s /sandshark-version; \
    rm /tmp/server-package.json

RUN set -eux; \
    case "$TARGETARCH" in \
      amd64)  cp /tmp/sandshark-linux-x64 /sandshark ;; \
      arm64)  cp /tmp/sandshark-linux-arm64 /sandshark ;; \
      *) echo "Unsupported arch: $TARGETARCH" >&2; exit 1 ;; \
    esac; \
    chmod +x /sandshark; \
    chown bun:bun /sandshark; \
    rm -rf /tmp/sandshark-linux-*

RUN mkdir -p /home/bun/.config/sandshark && \
    chown -R bun:bun /home/bun/.config

COPY docker-entrypoint.sh /entrypoint.sh
RUN sed -i 's/\r$//' /entrypoint.sh && chmod +x /entrypoint.sh

WORKDIR /home/bun

ENTRYPOINT ["/entrypoint.sh"]
