#!/bin/bash
# Corte a TimescaleDB: cambia la imagen de PostgreSQL de producción por timescale/timescaledb y
# convierte tc_positions en hypertable (ver migrar.sql). Ensayado el 31/10/2026 sobre una copia.
#
# Uso: sudo ./timescale/corte.sh          (desde ~/apps/traccar)
# Deja un log en timescale/corte-<fecha>.log. Si algo falla antes de levantar Traccar, correr
# ./timescale/volver-atras.sh para dejar todo como estaba.
set -euo pipefail
cd "$(dirname "$0")/.."
LOG="timescale/corte-$(date +%F-%H%M).log"
exec > >(tee -a "$LOG") 2>&1
paso() { echo; echo "== $(date -u +'%F %T UTC')  $*"; }
IMAGEN_NUEVA="timescale/timescaledb:2.31.0-pg16"
WEB="https://track.ridder.com.py/api/server"

paso "chequeos previos"
docker compose ps postgres | grep -q "healthy" || { echo "postgres no está healthy; no sigo"; exit 1; }
docker image inspect "$IMAGEN_NUEVA" >/dev/null 2>&1 || { echo "falta la imagen $IMAGEN_NUEVA (docker pull)"; exit 1; }
LIBRE=$(df --output=avail -BG . | tail -1 | tr -dc 0-9)
[ "$LIBRE" -ge 20 ] || { echo "solo ${LIBRE} GB libres; no sigo"; exit 1; }
grep -q "image: postgres:16-alpine" compose.yml || { echo "compose.yml no tiene la imagen esperada; ¿ya se hizo el corte?"; exit 1; }
ANTES=$(docker exec traccar-postgres psql -U traccar -tAc "select count(*) from tc_positions")
echo "posiciones antes: $ANTES"

paso "respaldo completo de la base (pg_dump)"
mkdir -p backups
RESPALDO="backups/pre-timescale-$(date +%F-%H%M).dump"
docker exec traccar-postgres pg_dump -U traccar -Fc traccar > "$RESPALDO"
ls -lh "$RESPALDO"

paso "parando Traccar (desde acá no entran posiciones)"
docker compose stop traccar
INICIO_CORTE=$(date +%s)

paso "cambiando la imagen de PostgreSQL en compose.yml"
cp compose.yml timescale/compose.yml.antes-del-corte
python3 - <<'EOF'
import re
s = open('compose.yml').read()
s = s.replace('image: postgres:16-alpine', 'image: timescale/timescaledb:2.31.0-pg16  # PostgreSQL 16 + TimescaleDB', 1)
s = s.replace('    container_name: traccar-postgres\n',
              '    container_name: traccar-postgres\n'
              '    command: ["postgres", "-c", "shared_preload_libraries=timescaledb"]\n', 1)
open('compose.yml', 'w').write(s)
EOF
docker compose up -d postgres
for i in $(seq 1 30); do docker compose ps postgres | grep -q healthy && break; sleep 2; done
docker exec traccar-postgres psql -U traccar -tAc "select version()" | cut -c1-40
docker exec traccar-postgres psql -U traccar -tAc "show shared_preload_libraries" | grep -q timescaledb || { echo "timescaledb no está precargada"; exit 1; }

paso "convirtiendo tc_positions en hypertable"
docker exec -i traccar-postgres psql -U traccar -d traccar -v ON_ERROR_STOP=1 -f - < timescale/migrar.sql
DESPUES=$(docker exec traccar-postgres psql -U traccar -tAc "select count(*) from tc_positions")
[ "$DESPUES" -eq "$ANTES" ] || { echo "las cuentas no coinciden ($ANTES vs $DESPUES); NO levanto Traccar"; exit 1; }

paso "levantando Traccar"
docker compose up -d traccar
for i in $(seq 1 60); do curl -s -o /dev/null -w "%{http_code}" "$WEB" | grep -q 200 && break; sleep 3; done
echo "web responde; corte de $(( $(date +%s) - INICIO_CORTE )) segundos"

paso "verificando que entren posiciones (60 s)"
sleep 60
docker exec traccar-postgres psql -U traccar -tAc "select count(*) || ' posiciones nuevas en el último minuto' from tc_positions where servertime > now() - interval '1 minute'"
grep -ciE "exception|error" data/logs/tracker-server.log | sed 's/$/ líneas con error en el log de hoy (ver si son nuevas)/'

paso "apagando el cron de particiones (ya no hace falta)"
sudo -u opc bash -c 'crontab -l 2>/dev/null | grep -v particiones.sh | crontab -' || true

paso "LISTO. Pendiente: importar el historial del viejo (timescale/importar-viejo.sh)"
