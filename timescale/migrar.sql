-- Convierte tc_positions (particionada por mes con particiones.sh) en una hypertable de TimescaleDB.
-- Se corre con Traccar parado y PostgreSQL ya levantado con la imagen timescale/timescaledb.
-- Idempotente a medias: si falla a mitad de camino, la tabla original sigue intacta y basta con
-- borrar tc_positions_ts y volver a correrlo.
\set ON_ERROR_STOP on
\timing on

CREATE EXTENSION IF NOT EXISTS timescaledb;

-- 1. Tabla nueva con las mismas columnas y el mismo default de id (la secuencia compartida).
CREATE TABLE tc_positions_ts (LIKE tc_positions INCLUDING DEFAULTS);
ALTER TABLE tc_positions_ts ADD CONSTRAINT tc_positions_ts_pkey PRIMARY KEY (id, fixtime);

-- 2. Hypertable: un chunk por semana (igual que en el Traccar viejo).
SELECT create_hypertable('tc_positions_ts', 'fixtime',
                         chunk_time_interval => interval '7 days',
                         create_default_indexes => false);
CREATE INDEX position_deviceid_fixtime_ts ON tc_positions_ts (deviceid, fixtime DESC);

-- 3. Copiar todas las posiciones actuales (unos minutos).
INSERT INTO tc_positions_ts SELECT * FROM tc_positions;

-- 4. Intercambiar nombres en una sola transacción.
BEGIN;
ALTER TABLE tc_positions RENAME TO tc_positions_particionada;
ALTER TABLE tc_positions_particionada RENAME CONSTRAINT tc_positions_pkey TO tc_positions_particionada_pkey;
ALTER INDEX position_deviceid_fixtime RENAME TO position_deviceid_fixtime_particionada;
ALTER TABLE tc_positions_ts RENAME TO tc_positions;
ALTER TABLE tc_positions RENAME CONSTRAINT tc_positions_ts_pkey TO tc_positions_pkey;
ALTER INDEX position_deviceid_fixtime_ts RENAME TO position_deviceid_fixtime;
ALTER SEQUENCE tc_positions_id_seq OWNED BY tc_positions.id;
COMMIT;

-- 5. Compresión: por moto, ordenada por fecha; se comprime lo que tiene más de 30 días.
ALTER TABLE tc_positions SET (timescaledb.compress,
                              timescaledb.compress_segmentby = 'deviceid',
                              timescaledb.compress_orderby = 'fixtime DESC, id');
SELECT add_compression_policy('tc_positions', interval '30 days');

ANALYZE tc_positions;

-- Verificación
SELECT (SELECT count(*) FROM tc_positions) AS nuevas,
       (SELECT count(*) FROM tc_positions_particionada) AS originales;
SELECT count(*) AS chunks FROM timescaledb_information.chunks WHERE hypertable_name = 'tc_positions';
