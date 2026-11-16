#!/bin/bash
# Deshace el corte a TimescaleDB y vuelve a postgres:16-alpine con la tabla particionada original.
# Sirve mientras tc_positions_particionada exista (no se borra hasta que Sebastian lo confirme).
# Las posiciones que hayan entrado a la hypertable después del corte se copian de vuelta a la
# tabla particionada antes de deshacer, así no se pierde nada.
#
# Uso: sudo ./timescale/volver-atras.sh     (desde ~/apps/traccar)
set -euo pipefail
cd "$(dirname "$0")/.."
LOG="timescale/volver-atras-$(date +%F-%H%M).log"
exec > >(tee -a "$LOG") 2>&1
paso() { echo; echo "== $(date -u +'%F %T UTC')  $*"; }

[ -f timescale/compose.yml.antes-del-corte ] || { echo "no está compose.yml.antes-del-corte; nada que deshacer"; exit 1; }

paso "parando Traccar"
docker compose stop traccar

paso "deshaciendo la hypertable (PostgreSQL sigue siendo el de TimescaleDB por ahora)"
docker exec -i traccar-postgres psql -U traccar -d traccar -v ON_ERROR_STOP=1 <<'EOF'
\timing on
-- posiciones que entraron después del corte: devolverlas a la tabla particionada
INSERT INTO tc_positions_particionada
  SELECT p.* FROM tc_positions p
  WHERE NOT EXISTS (SELECT 1 FROM tc_positions_particionada q WHERE q.id = p.id AND q.fixtime = p.fixtime);
BEGIN;
ALTER SEQUENCE tc_positions_id_seq OWNED BY tc_positions_particionada.id;  -- si no, el DROP se la lleva
DROP TABLE tc_positions;                       -- la hypertable (los datos ya están en la particionada)
ALTER TABLE tc_positions_particionada RENAME TO tc_positions;
ALTER TABLE tc_positions RENAME CONSTRAINT tc_positions_particionada_pkey TO tc_positions_pkey;
ALTER INDEX position_deviceid_fixtime_particionada RENAME TO position_deviceid_fixtime;
ALTER SEQUENCE tc_positions_id_seq OWNED BY tc_positions.id;
COMMIT;
DROP EXTENSION timescaledb CASCADE;
SELECT count(*) AS posiciones FROM tc_positions;
EOF

paso "volviendo a la imagen postgres:16-alpine"
cp timescale/compose.yml.antes-del-corte compose.yml
docker compose up -d postgres
for i in $(seq 1 30); do docker compose ps postgres | grep -q healthy && break; sleep 2; done
docker exec traccar-postgres psql -U traccar -tAc "select version()" | cut -c1-40

paso "levantando Traccar"
docker compose up -d traccar
for i in $(seq 1 60); do curl -s -o /dev/null -w "%{http_code}" https://track.ridder.com.py/api/server | grep -q 200 && break; sleep 3; done
echo "web responde"

paso "reponiendo el cron de particiones"
sudo -u opc bash -c '(crontab -l 2>/dev/null | grep -v particiones.sh; echo "15 4 1 * * /home/opc/apps/traccar/particiones.sh >> /home/opc/apps/traccar/data/logs/particiones.log 2>&1") | crontab -'
paso "LISTO: todo como antes del corte"
