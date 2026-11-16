#!/bin/bash
# Compila el parche de Ridder para Traccar (una clase) contra el jar y las librerías de la imagen
# traccar/traccar en uso, y deja parche/ridder-traccar-parche.jar. Ver README.md.
#
# Uso (desde ~/apps/traccar):  sudo bash parche/construir.sh
# Requiere Docker; usa la imagen eclipse-temurin:21-jdk-alpine (Traccar 6.16 está compilado para Java 21).
set -euo pipefail
cd "$(dirname "$0")"
TRABAJO=$(mktemp -d /tmp/parche-traccar.XXXXXX)
trap 'rm -rf "$TRABAJO"' EXIT

echo "== copiando tracker-server.jar y lib/ del contenedor traccar"
docker cp traccar:/opt/traccar/tracker-server.jar "$TRABAJO/"
docker cp traccar:/opt/traccar/lib "$TRABAJO/lib"
VERSION=$(unzip -p "$TRABAJO/tracker-server.jar" META-INF/MANIFEST.MF | tr -d '\r' | awk '/^Implementation-Version:/{print $2}')
echo "   Traccar $VERSION"

echo "== compilando"
mkdir -p "$TRABAJO/out"
docker run --rm -v "$PWD/src:/src:ro" -v "$TRABAJO:/t" -w /t eclipse-temurin:21-jdk-alpine \
  sh -c 'javac --release 21 -nowarn -cp "tracker-server.jar:lib/*" -d out $(find /src -name "*.java") && cd out && jar cf /t/ridder-traccar-parche.jar . && ls -la /t/ridder-traccar-parche.jar && unzip -l /t/ridder-traccar-parche.jar | tail -n +4 | head -n -2'
cp "$TRABAJO/ridder-traccar-parche.jar" ./ridder-traccar-parche.jar
echo "$VERSION" > ./compilado-para-traccar.txt
echo "== listo: parche/ridder-traccar-parche.jar (para Traccar $VERSION). Reiniciar traccar para aplicarlo."
