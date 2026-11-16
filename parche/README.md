# Parche de Ridder para Traccar: última posición de un equipo

## Qué arregla

Traccar busca la última posición de **un** equipo (ficha del equipo, tipos de comando disponibles,
caché al arrancar) con esta consulta, sin acotar por fecha:

    SELECT * FROM tc_positions WHERE deviceId = ? AND id IN (SELECT positionId FROM tc_devices WHERE id = ?)

Con `tc_positions` como hypertable de TimescaleDB y un año de historial comprimido, PostgreSQL trata el
`IN` como un join y recorre **todas** las semanas del equipo (10 a 20 s en frío). La ficha se dibuja sin
el botón "Bloquear motor" porque la respuesta llega tarde.

El parche cambia una línea en `org.traccar.storage.DatabaseStorage` (`formatCondition`, caso
`Condition.LatestPositions` con deviceId): usa `id = (SELECT ...)` en vez de `id IN (SELECT ...)`.
Es equivalente (la subconsulta devuelve un solo valor) y PostgreSQL la planifica como InitPlan, con
lo que TimescaleDB excluye chunks por id y responde en milisegundos. Diff en `DatabaseStorage.diff`.

Medido el 2/11/2026: 258ABUG 10-19 s en frío → 0,02 s.

## Cómo se aplica

- `construir.sh` compila la clase contra el jar de la imagen en uso y genera `ridder-traccar-parche.jar`.
- `compose.yml` monta ese jar en `/opt/traccar/ridder-traccar-parche.jar` y arranca Java con
  `-cp ridder-traccar-parche.jar:tracker-server.jar org.traccar.Main conf/traccar.xml`, así la clase
  parcheada se carga antes que la original (el `Class-Path` del manifiesto sigue cargando `lib/`).

## Al actualizar Traccar

1. Cambiar la imagen en `compose.yml` y bajarla (`docker compose pull traccar`).
2. Bajar el código fuente de la nueva versión (https://github.com/traccar/traccar/releases) y comparar
   `src/main/java/org/traccar/storage/DatabaseStorage.java` con `src/org/traccar/storage/DatabaseStorage.java`
   de acá: si cambió, rehacer el parche sobre la versión nueva (es el bloque marcado "Parche Ridder").
   Si Traccar ya incorporó el arreglo, quitar el parche del `compose.yml`.
3. `sudo bash parche/construir.sh` (la imagen nueva tiene que estar corriendo o al menos creada como
   contenedor `traccar` para copiar el jar; alternativa: `docker create`).
4. `sudo docker compose up -d traccar`.

`compilado-para-traccar.txt` dice para qué versión se compiló el jar actual. Si no coincide con la
imagen, Traccar puede fallar al arrancar (clase incompatible): quitar el parche del compose y reiniciar.

## Para volver atrás

Quitar del `compose.yml` el `command:` y el volumen del parche en el servicio `traccar`, y
`sudo docker compose up -d traccar`.
