#!/usr/bin/env bash
set -Eeuo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
compose_file="$root_dir/deploy/compose.production.yaml"

require_digest() {
  local variable_name="$1"
  local value="${!variable_name:-}"
  if [[ "$value" != *@sha256:* ]]; then
    echo "$variable_name must be set to an immutable image reference containing @sha256:." >&2
    exit 1
  fi
}

require_digest NUTRIMIND_API_IMAGE
require_digest NUTRIMIND_WEB_IMAGE
: "${NUTRIMIND_BACKEND_ENV_FILE:=/etc/nutrimind/backend.env}"
export NUTRIMIND_BACKEND_ENV_FILE

if [[ ! -f "$NUTRIMIND_BACKEND_ENV_FILE" ]]; then
  echo "Backend environment file not found: $NUTRIMIND_BACKEND_ENV_FILE" >&2
  exit 1
fi

docker compose -f "$compose_file" config --quiet
docker compose -f "$compose_file" pull api web
docker compose -f "$compose_file" --profile migration run --rm migrate
docker compose -f "$compose_file" up -d --remove-orphans api web

curl --fail --silent --show-error --retry 12 --retry-delay 5 http://127.0.0.1:5000/ready >/dev/null
curl --fail --silent --show-error --retry 12 --retry-delay 5 http://127.0.0.1:3000/ >/dev/null
docker compose -f "$compose_file" ps
