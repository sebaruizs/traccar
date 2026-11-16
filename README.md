# Ridder GPS: despliegue de Traccar

Stack Docker Compose que corre https://track.ridder.com.py: Traccar 6.16.0 con PostgreSQL 16 +
TimescaleDB, detrás de un Caddy compartido (red Docker externa `proxy`).

## Qué hay acá

- `compose.yml`: los dos servicios (`traccar` y `postgres`), puertos GPS publicados en el host
  (5013 H02/Sinotrack, 5023 GT06, 5055 OsmAnd, 5222 Startek) y la web solo por la red `proxy`.
- `traccar.xml.ejemplo`: configuración de Traccar sin secretos. Copiar a `traccar.xml` y completar.
- `web-src/`: la web de Traccar personalizada para Ridder (submódulo, rama `web-ridder` de este
  mismo repositorio, basada en traccar-web v6.16.0). `build-web.sh` la compila con Docker y la
  publica en `web/`, que el contenedor sirve montada; no hace falta reiniciar.
- `parche/`: parche al servidor para que la última posición de un equipo se resuelva en milisegundos
  sobre la hypertable (ver `parche/README.md`, con el procedimiento al actualizar Traccar).
- `timescale/`: scripts con los que se migró `tc_positions` a TimescaleDB, se comprimió el
  historial y se movieron los chunks viejos al disco lento (`archivo.sql`, `migrar.sql`,
  `corte.sh`, `importar-viejo.sh`, `volver-atras.sh`).
- `particiones.sh`: mantenimiento de particiones.

## Lo que no está en el repositorio

Se crean a mano en el servidor y están en `.gitignore`:

- `.env` con `POSTGRES_PASSWORD=...` (permisos 600).
- `traccar.xml` (permisos 600): a partir de `traccar.xml.ejemplo`, con el JSON de la cuenta de
  servicio de Firebase para las notificaciones push de la app Ridder GPS.
- `secrets/`: tokens de las integraciones y el JSON de Firebase.
- `data/`: datos de PostgreSQL. `backups/`: copias previas a cada cambio.

## Puesta en marcha

```bash
git clone --recurse-submodules https://github.com/sebaruizs/traccar.git
cd traccar
cp traccar.xml.ejemplo traccar.xml && chmod 600 traccar.xml   # completar Firebase
echo "POSTGRES_PASSWORD=..." > .env && chmod 600 .env
sudo ./build-web.sh                                            # compila y publica la web
sudo docker compose up -d
```

El sitio Caddy correspondiente vive en `../caddy/sites/traccar.caddy`.
