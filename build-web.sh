#!/usr/bin/env bash
# Compila la web propia (web-src, rama ridder) y la publica en ./web,
# que está montada en el contenedor como /opt/traccar/web. No requiere reiniciar Traccar.
set -euo pipefail
cd "$(dirname "$0")"

docker run --rm -v "$PWD/web-src":/app -w /app -u "$(id -u):$(id -g)" \
  -e npm_config_cache=/tmp/.npm node:22-alpine \
  sh -c 'npm ci --no-audit --no-fund --loglevel=error && npm run lint && npm run build'

mkdir -p web
find web -mindepth 1 -delete
cp -a web-src/build/. web/
echo "Web publicada en ./web"
