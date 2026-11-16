#!/bin/bash
# Mantiene las particiones mensuales de tc_positions (una tabla por mes, partida el 30/10/2026):
# crea las que falten hasta 12 meses adelante. Pensado para correr el día 1 de cada mes desde cron.
# Las posiciones con fecha absurda caen en tc_positions_otros (partición por defecto).
# Para mover un mes viejo a otro disco: ALTER TABLE tc_positions_YYYY_MM SET TABLESPACE archivo;
set -euo pipefail
cd "$(dirname "$0")"
sudo docker exec traccar-postgres psql -U traccar -d traccar -v ON_ERROR_STOP=1 -q <<'SQL'
DO $$
DECLARE m date := date_trunc('month', now())::date;
DECLARE nombre text;
BEGIN
  FOR i IN 0..12 LOOP
    nombre := 'tc_positions_' || to_char(m, 'YYYY_MM');
    IF to_regclass(nombre) IS NULL THEN
      EXECUTE format('CREATE TABLE %I PARTITION OF tc_positions FOR VALUES FROM (%L) TO (%L)',
        nombre, m, m + interval '1 month');
      RAISE NOTICE 'creada %', nombre;
    END IF;
    m := m + interval '1 month';
  END LOOP;
END $$;
SQL
echo "$(date -u '+%F %T') particiones al día: $(sudo docker exec traccar-postgres psql -U traccar -d traccar -At -c "select count(*) from pg_inherits where inhparent='tc_positions'::regclass")"
