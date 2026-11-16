#!/bin/bash
# Importa el historial del Traccar viejo (copia restaurada en el contenedor traccar-viejo-pg, disco
# /mnt/archivo) a la base de producción, semana por semana de la más reciente a la más vieja,
# comprimiendo cada semana al terminarla para que el disco rápido no se llene.
#
# - Cruza dispositivos por IMEI (uniqueid). Los IMEIs que no existen en el nuevo se saltean
#   (si Sebastian los crea después, una nueva corrida los trae).
# - De los equipos que ya reportan al nuevo solo trae lo anterior a su primera posición nueva.
# - Conserva los id originales (en el viejo arrancan en 5,7 M, arriba del máximo del nuevo) y
#   adelanta las secuencias, así los eventos siguen apuntando a su posición.
# - Eventos: trae todos menos deviceOnline/deviceOffline/deviceUnknown (61 M de ruido).
#   Geocercas: viejo 1 "Gran Asuncion" -> nuevo 11; viejo 10 "Comercial San Blas" -> nuevo 1;
#   los eventos de otras geocercas del viejo (ya no existen) se saltean.
# - Reanudable e idempotente: anota las semanas hechas en timescale/importar-viejo.estado y
#   usa INSERT ... ON CONFLICT DO NOTHING. Para si quedan menos de 30 GB libres.
#
# Uso (desde ~/apps/traccar):
#   sudo ./timescale/importar-viejo.sh --probar      solo prepara el mapa y muestra qué haría
#   sudo ./timescale/importar-viejo.sh --semanas 1   importa una semana (la más reciente pendiente)
#   sudo ./timescale/importar-viejo.sh               importa todo lo pendiente
#   sudo ./timescale/importar-viejo.sh --equipos-ids ids.txt --hasta 2026-04-16   solo esos equipos (id viejos), semanas desde esa fecha
# Log en timescale/importar-viejo-<fecha>.log
set -euo pipefail
cd "$(dirname "$0")/.."
LOG="timescale/importar-viejo-$(date +%F).log"
ESTADO="timescale/importar-viejo.estado"
exec >> >(tee -a "$LOG") 2>&1
paso() { echo; echo "== $(date -u +'%F %T UTC')  $*"; }

PROBAR=0; MAX_SEMANAS=999; PAUSA=20; MIN_LIBRE_GB=30; MODO_EQUIPOS=0; LISTA_IDS=""; HASTA=""
while [ $# -gt 0 ]; do
  case "$1" in
    --probar) PROBAR=1 ;;
    --semanas) MAX_SEMANAS="$2"; shift ;;
    # solo los equipos cuyos id VIEJOS están en el archivo (separados por coma o línea), en todas las
    # semanas (o desde --hasta AAAA-MM-DD hacia adelante), aunque ya tengan posiciones en el nuevo:
    # sirve para equipos creados después de importar semanas. Descomprime/recomprime como el modo
    # normal y no toca el archivo de estado.
    --equipos-ids) LISTA_IDS=$(tr -s ', \n' ',' < "$2" | sed 's/^,//; s/,$//'); shift ;;
    --hasta) HASTA="$2"; shift ;;
    # solo los equipos que todavía no tienen ninguna posición en el nuevo (p. ej. recién creados con
    # el IMEI del viejo): recorre las 53 semanas leyendo del viejo solo esos equipos, inserta directo
    # en los chunks (aunque estén comprimidos; la política los recomprime) y no toca el archivo de estado
    --equipos-nuevos) MODO_EQUIPOS=1; PAUSA=2 ;;
    *) echo "parámetro desconocido: $1"; exit 1 ;;
  esac
  shift
done

# Ventanas de 7 días alineadas con los chunks de la hypertable (jueves 00:00 UTC).
PRIMER_DIA="2025-10-30"   # inicio del historial viejo (retención de 1 año)
ULTIMO_DIA="2026-11-05"   # fin del chunk que contiene el 31/10/2026
: "${HASTA:=$PRIMER_DIA}"

V() { docker exec -i traccar-viejo-pg psql -U traccar -d traccar -v ON_ERROR_STOP=1 -qtA -c "$1"; }
N() { docker exec -i traccar-postgres  psql -U traccar -d traccar -v ON_ERROR_STOP=1 -qtA -c "$1"; }
libre_gb() { df --output=avail -BG /home/opc/apps/traccar | tail -1 | tr -dc 0-9; }

paso "chequeos previos"
docker inspect -f '{{.State.Running}}' traccar-viejo-pg | grep -q true || { echo "traccar-viejo-pg no está corriendo (docker start traccar-viejo-pg)"; exit 1; }
docker compose ps postgres | grep -q healthy || { echo "postgres de producción no está healthy"; exit 1; }
N "select 1 from timescaledb_information.hypertables where hypertable_name='tc_positions'" | grep -q 1 || { echo "tc_positions no es hypertable; ¿se hizo el corte?"; exit 1; }
echo "disco libre: $(libre_gb) GB"
touch "$ESTADO"

paso "mapa de dispositivos por IMEI y tablas auxiliares"
N "create table if not exists import_viejo_dev (id int primary key, uniqueid varchar(128));
   create table if not exists import_viejo_map (old_deviceid int primary key, new_deviceid int, desde timestamp);
   create unlogged table if not exists import_viejo_pos (like tc_positions);
   create unlogged table if not exists import_viejo_ev (like tc_events);
   truncate import_viejo_dev, import_viejo_map, import_viejo_pos, import_viejo_ev;"
V "copy (select id, uniqueid from tc_devices) to stdout" | N "copy import_viejo_dev (id, uniqueid) from stdin"
N "insert into import_viejo_map
   select v.id, d.id,
          (select p.servertime from tc_positions p where p.deviceid = d.id and p.fixtime >= '2026-10-01' order by p.fixtime limit 1)
   from import_viejo_dev v join tc_devices d on d.uniqueid = v.uniqueid;"
echo "equipos del viejo: $(N 'select count(*) from import_viejo_dev'); con IMEI en el nuevo: $(N 'select count(*) from import_viejo_map'); de ellos ya reportando al nuevo: $(N 'select count(*) from import_viejo_map where desde is not null')"
FILTRO=""
if [ "$MODO_EQUIPOS" = 1 ]; then
  N "delete from import_viejo_map m where exists (select 1 from tc_positions p where p.deviceid = m.new_deviceid limit 1)"
  OLD_IDS=$(N "select string_agg(old_deviceid::text, ',') from import_viejo_map")
  [ -n "$OLD_IDS" ] || { echo "no hay equipos sin posiciones en el nuevo; nada que hacer"; exit 0; }
  FILTRO=" and deviceid in ($OLD_IDS)"
  echo "modo equipos nuevos: $(N 'select count(*) from import_viejo_map') equipos sin posiciones en el nuevo"
fi
if [ -n "$LISTA_IDS" ]; then
  N "delete from import_viejo_map where old_deviceid not in ($LISTA_IDS)"
  FILTRO=" and deviceid in ($LISTA_IDS)"
  echo "modo lista: $(N 'select count(*) from import_viejo_map') equipos de la lista con IMEI en el nuevo; semanas desde $HASTA"
fi

COLS=$(N "select string_agg(column_name, ', ' order by ordinal_position) from information_schema.columns where table_schema='public' and table_name='tc_positions'")
COLS_SEL=$(echo "$COLS" | sed 's/\bdeviceid\b/m.new_deviceid/')
EV_COLS="id, type, eventtime, deviceid, positionid, geofenceid, attributes, maintenanceid"
TIPOS_EXCLUIDOS="'deviceOnline','deviceOffline','deviceUnknown'"

# lista de semanas, de la más reciente a la más vieja
SEMANAS=()
FIN="$ULTIMO_DIA"
while :; do
  INI=$(date -u -d "$FIN - 7 days" +%F)
  [ "$INI" \< "$PRIMER_DIA" ] && break
  SEMANAS+=("$INI")
  FIN="$INI"
done
PENDIENTES=()
for s in "${SEMANAS[@]}"; do
  if [ -n "$LISTA_IDS" ]; then [ "$s" \< "$HASTA" ] || PENDIENTES+=("$s")
  else [ "$MODO_EQUIPOS" = 1 ] || grep -qx "$s" "$ESTADO" || PENDIENTES+=("$s"); fi
done
echo "semanas: ${#SEMANAS[@]} en total, ${#PENDIENTES[@]} pendientes"

if [ "$PROBAR" = 1 ]; then
  paso "modo prueba: tamaño de la semana más reciente pendiente (sin escribir nada)"
  INI="${PENDIENTES[0]}"; FIN=$(date -u -d "$INI + 7 days" +%F)
  echo "semana $INI -> $FIN: $(V "select count(*) from tc_positions where fixtime >= '$INI' and fixtime < '$FIN'") posiciones en el viejo"
  echo "pendientes: ${PENDIENTES[*]}"
  exit 0
fi

paso "adelantando las secuencias por encima de los id del viejo"
MAX_POS=$(V "select max(id) from tc_positions"); MAX_EV=$(V "select max(id) from tc_events")
N "select setval('tc_positions_id_seq', greatest((select last_value from tc_positions_id_seq), $MAX_POS + 1));
   select setval('tc_events_id_seq',    greatest((select last_value from tc_events_id_seq),    $MAX_EV + 1));" >/dev/null
echo "tc_positions_id_seq ahora en $(N 'select last_value from tc_positions_id_seq'), tc_events_id_seq en $(N 'select last_value from tc_events_id_seq')"

HECHAS=0
for INI in "${PENDIENTES[@]}"; do
  [ "$HECHAS" -ge "$MAX_SEMANAS" ] && break
  FIN=$(date -u -d "$INI + 7 days" +%F)
  LIBRE=$(libre_gb)
  [ "$LIBRE" -ge "$MIN_LIBRE_GB" ] || { echo "solo $LIBRE GB libres; paro acá (se puede reanudar)"; exit 1; }
  paso "semana $INI -> $FIN  (libre: $LIBRE GB)"
  T0=$(date +%s)

  # chunks comprimidos que toque esta semana se descomprimen antes (más rápido que insertar comprimido)
  [ "$MODO_EQUIPOS" = 1 ] || N "select decompress_chunk(format('%I.%I', chunk_schema, chunk_name)::regclass, true)
     from timescaledb_information.chunks
     where hypertable_name='tc_positions' and is_compressed and range_start < '$FIN' and range_end > '$INI';" >/dev/null

  V "copy (select $COLS from tc_positions where fixtime >= '$INI' and fixtime < '$FIN' $FILTRO) to stdout (format binary)" \
    | N "copy import_viejo_pos ($COLS) from stdin (format binary)"
  N "insert into tc_positions ($COLS)
     select $COLS_SEL from import_viejo_pos p join import_viejo_map m on m.old_deviceid = p.deviceid
     where m.desde is null or p.fixtime < m.desde
     on conflict do nothing;"
  POS_VIEJO=$(N "select count(*) from import_viejo_pos")
  POS_NUEVO=$(N "select count(*) from tc_positions where fixtime >= '$INI' and fixtime < '$FIN'")
  N "truncate import_viejo_pos"

  V "copy (select $EV_COLS from tc_events where eventtime >= '$INI' and eventtime < '$FIN' and type not in ($TIPOS_EXCLUIDOS) $FILTRO) to stdout (format binary)" \
    | N "copy import_viejo_ev ($EV_COLS) from stdin (format binary)"
  N "insert into tc_events ($EV_COLS)
     select e.id, e.type, e.eventtime, m.new_deviceid, e.positionid,
            case e.geofenceid when 1 then 11 when 10 then 1 else 0 end, e.attributes, 0
     from import_viejo_ev e join import_viejo_map m on m.old_deviceid = e.deviceid
     where (m.desde is null or e.eventtime < m.desde)
       and (e.type not like 'geofence%' or e.geofenceid in (1, 10))
     on conflict (id) do nothing;"
  EV_VIEJO=$(N "select count(*) from import_viejo_ev")
  N "truncate import_viejo_ev"

  # comprimir los chunks de esta semana si ya tienen más de 45 días (la política haría lo mismo cada 12 h)
  COMP=0
  if [ "$MODO_EQUIPOS" = 0 ]; then
    COMP=$(N "select count(compress_chunk(c, true)) from (
                select format('%I.%I', chunk_schema, chunk_name)::regclass c from timescaledb_information.chunks
                where hypertable_name='tc_positions' and not is_compressed
                  and range_end <= now() - interval '45 days' and range_start < '$FIN' and range_end > '$INI') s")
    [ -n "$LISTA_IDS" ] || echo "$INI" >> "$ESTADO"
  fi
  HECHAS=$((HECHAS + 1))
  echo "posiciones leídas del viejo: $POS_VIEJO; en el nuevo esa semana ahora: $POS_NUEVO; eventos leídos: $EV_VIEJO; chunks comprimidos: $COMP; $(( $(date +%s) - T0 )) s"
  sleep "$PAUSA"
done

if [ -n "$LISTA_IDS" ]; then
  paso "última posición y fecha de último reporte de los equipos de la lista; estadísticas"
  N "update tc_devices d set positionid = p.id, lastupdate = p.fixtime
     from import_viejo_map m, lateral (select id, fixtime from tc_positions p where p.deviceid = m.new_deviceid and p.fixtime >= '$PRIMER_DIA' order by fixtime desc limit 1) p
     where d.id = m.new_deviceid and (d.lastupdate is null or d.lastupdate < p.fixtime);
     analyze tc_positions; analyze tc_events;"
  echo "(se ven en el mapa después del próximo reinicio de Traccar)"
  paso "LISTO (lista de equipos)"
  exit 0
fi

if [ "$MODO_EQUIPOS" = 1 ]; then
  paso "última posición conocida para los equipos recién importados y estadísticas"
  N "update tc_devices d set positionid = (select id from tc_positions p where p.deviceid = d.id order by fixtime desc limit 1)
     where d.positionid is null and exists (select 1 from tc_positions p where p.deviceid = d.id);
     analyze tc_positions; analyze tc_events;"
  N "select count(*) || ' equipos con posiciones de los ' || (select count(*) from import_viejo_map) || ' del modo equipos nuevos' from import_viejo_map m where exists (select 1 from tc_positions p where p.deviceid = m.new_deviceid limit 1)"
  echo "(se ven en el mapa después del próximo reinicio de Traccar)"
  paso "LISTO (equipos nuevos)"
  exit 0
fi

if [ "$(grep -c . "$ESTADO")" -ge "${#SEMANAS[@]}" ]; then
  paso "todas las semanas importadas: última posición conocida para los equipos que nunca reportaron al nuevo"
  N "update tc_devices d set positionid = (select id from tc_positions p where p.deviceid = d.id order by fixtime desc limit 1)
     where d.positionid is null and exists (select 1 from tc_positions p where p.deviceid = d.id);"
  echo "(se ven en el mapa después del próximo reinicio de Traccar)"
  paso "estadísticas y limpieza"
  N "analyze tc_positions; analyze tc_events; drop table import_viejo_pos; drop table import_viejo_ev;"
  N "select pg_size_pretty(hypertable_size('tc_positions')) as tamanio_posiciones, (select count(*) from timescaledb_information.chunks where hypertable_name='tc_positions' and is_compressed) as chunks_comprimidos"
  paso "LISTO"
else
  paso "pausa: quedan $(( ${#SEMANAS[@]} - $(grep -c . "$ESTADO") )) semanas; volver a correr para seguir"
fi
