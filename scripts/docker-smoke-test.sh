#!/usr/bin/env bash
# Builds the Docker image, runs it, and checks it serves the dashboard.
set -euo pipefail

IMAGE=ariadne-smoke-test
CONTAINER=ariadne-smoke-test
PORT="${PORT:-3010}"
TIMEOUT=60

cleanup() {
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "Building image..."
docker build -t "$IMAGE" .

echo "Starting container..."
docker run -d --name "$CONTAINER" -p "127.0.0.1:${PORT}:3000" "$IMAGE" >/dev/null

echo "Waiting for the app to respond on http://127.0.0.1:${PORT} ..."
elapsed=0
until curl -sf "http://127.0.0.1:${PORT}" >/dev/null; do
  if [ "$elapsed" -ge "$TIMEOUT" ]; then
    echo "Timed out after ${TIMEOUT}s waiting for the app to respond."
    docker logs "$CONTAINER"
    exit 1
  fi
  sleep 2
  elapsed=$((elapsed + 2))
done

echo "OK: container served a response on http://127.0.0.1:${PORT}"
