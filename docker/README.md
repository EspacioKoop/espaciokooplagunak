# Docker — servidor headless + puente Foundry

Despliegue reproducible del servidor de Espaciokoop Lagunak y del puente de
integración con Foundry VTT. Diseño y contrato: [`docs/FOUNDRY.md`](../docs/FOUNDRY.md).

## Contenido

| Archivo | Propósito |
|---|---|
| `Dockerfile` | Imagen del servidor headless (multi-stage, SeriousProton fijado por commit) |
| `entrypoint.sh` | Traduce variables `EE_*` a preferencias `clave=valor` del juego |
| `compose.yaml` | Orquesta `game` + `bridge` en una red compartida |
| `.env.example` | Plantilla de configuración; copiar a `.env` |
| `build.sh` | Script de compilación usado por la CI heredada (no es parte del despliegue) |

El código del puente vive en [`bridge/`](../bridge/).

## Arranque rápido

```bash
cd docker
cp .env.example .env
# Edita .env y define BRIDGE_TOKEN (openssl rand -hex 32)
# Ajusta BRIDGE_ALLOWED_ORIGINS al origen exacto de Foundry
docker compose up -d --build
```

Comprobación:

```bash
# Salud del puente y del juego
curl http://localhost:8090/healthz

# Estado seguro de la nave (requiere el token de .env; la entrada no se muestra)
read -rsp "BRIDGE_TOKEN: " BRIDGE_TOKEN && printf '\n'
curl -H "Authorization: Bearer ***" http://127.0.0.1:8090/v1/state
unset BRIDGE_TOKEN
```

Antes de custodiar, compartir o sustituir el token, sigue el procedimiento de
[`docs/seguridad/BRIDGE_AUTHENTICATION.md`](../docs/seguridad/BRIDGE_AUTHENTICATION.md). Cambiar
`.env` no rota por sí solo la credencial: hay que recrear el servicio `bridge`.

Los clientes del puente de mando (EmptyEpsilon/Espaciokoop Lagunak de
escritorio) se conectan al puerto `35666` del host.

## Imágenes publicadas (GHCR)

El workflow [`docker-publish.yml`](../.github/workflows/docker-publish.yml)
publica ambas imágenes en GitHub Container Registry al crear un tag `v*` (o
por lanzamiento manual), etiquetadas con la versión y el SHA corto — nunca
`latest` (ver «Reproducibilidad»):

```bash
docker pull ghcr.io/varotv7/espaciokooplagunak-server:<versión>
docker pull ghcr.io/varotv7/espaciokooplagunak-bridge:<versión>
```

Para usarlas con `compose` sin compilar en local no basta con sobrescribir
`image:` en un override: Compose fusiona los ficheros y **conserva** el bloque
`build:` del fichero base, así que `docker compose up` seguiría pudiendo
compilar. Hay que anular `build:` explícitamente con el tag YAML
[`!reset`](https://docs.docker.com/reference/compose-file/merge/#reset-value)
de la sintaxis de fusión (Docker Compose v2 moderno; probado con v5.3.1 —
la documentación oficial no publica una versión mínima explícita):

```yaml
# docker/compose.override.yaml
services:
  game:
    image: ghcr.io/varotv7/espaciokooplagunak-server:<versión>
    build: !reset null
  bridge:
    image: ghcr.io/varotv7/espaciokooplagunak-bridge:<versión>
    build: !reset null
```

Comprueba el modelo resultante antes de levantar nada — no debe quedar ningún
bloque `build:` y ambas `image:` deben apuntar a GHCR:

```bash
docker compose config | grep -E "build:|image:"
```

El resto de la configuración (`.env`, puertos, healthchecks) no cambia.

## Puertos y superficie de exposición

| Puerto | Servicio | Publicado | Notas |
|---|---|---|---|
| 35666/tcp+udp | juego | Sí | Clientes de la tripulación en LAN |
| 8090/tcp | puente | Solo loopback por defecto | API HTTP con token para el módulo de Foundry |
| 8080/tcp | juego (HTTP heredado) | **No** | `/exec.lua` ejecuta Lua arbitrario; solo accesible por el puente dentro de la red de compose |

**Nunca añadas el puerto 8080 a `ports:`.** Es el vector de ataque descrito en
[`SECURITY.md`](../SECURITY.md) y en el inventario
[`docs/seguridad/API_HTTP.md`](../docs/seguridad/API_HTTP.md).

El puente también usa HTTP sin TLS. El valor seguro por defecto
`BRIDGE_BIND=127.0.0.1` exige que el navegador del GM y compose compartan host.
Para usarlo desde otro equipo, no cambies el bind a `0.0.0.0` sin proteger el
trayecto: utiliza un túnel SSH, una VPN confiable o un proxy HTTPS con
certificado válido. No publiques `8090` directamente en Internet. Un Foundry
servido por HTTPS puede bloquear una URL `http://` por contenido mixto; en ese
caso usa HTTPS también para el puente.

## Variables de entorno del servidor

| Variable | Por defecto | Efecto |
|---|---|---|
| `EE_SCENARIO` | `scenario_00_basic.lua` | Escenario que arranca el servidor |
| `EE_SERVER_NAME` | `Espaciokoop Lagunak` | Nombre visible del servidor |
| `EE_SERVER_PASSWORD` | vacío | Contraseña para clientes |
| `EE_SERVER_PORT` | `35666` | Puerto publicado para clientes |
| `BRIDGE_TOKEN` | — (obligatorio) | Token Bearer del puente |
| `BRIDGE_ALLOWED_ORIGINS` | `http://localhost:30000` en `.env.example` | Orígenes Foundry autorizados para CORS, separados por comas; vacío lo desactiva |
| `BRIDGE_BIND` | `127.0.0.1` | Dirección del host donde se publica el puente |
| `BRIDGE_PORT` | `8090` | Puerto publicado del puente |

No compartas la salida completa de `docker compose config` ni de
`docker inspect`: pueden mostrar `BRIDGE_TOKEN` ya resuelto. La comprobación
filtrada de imágenes de la sección anterior no imprime esa variable.

Argumentos extra al contenedor `game` se pasan tal cual al binario, p. ej.
`docker compose run game startpaused=1`.

## Reproducibilidad

- La imagen compila contra un commit exacto de SeriousProton (`ARG
  SERIOUS_PROTON_REF` en el `Dockerfile`). Al sincronizar con upstream
  (`docs/UPSTREAM.md`), actualiza ese commit en la misma rama.
- Las imágenes se etiquetan con versión (`0.1.0-dev`), nunca `latest` para
  despliegues estables.

## Superficie vulnerable de las imágenes

Trivy analiza ambas imágenes ([`trivy.yml`](../.github/workflows/trivy.yml)) y
publica los HIGH/CRITICAL en Code Scanning. Decisiones de base tomadas para
reducir esa superficie:

- **Servidor**: se compila en `debian:bookworm-slim` (toolchain conocida) pero
  se ejecuta en `debian:trixie-slim`. La glibc de trixie es más nueva que la de
  bookworm, así que el binario funciona, y desaparecen los CVE sin parche de
  bookworm (expat, zlib/minizip, libssh2, libldap).
- **Servidor**: sin `curl`. Solo servía para el `HEALTHCHECK` y arrastraba
  `libcurl4`/`libssh2-1`/`libldap`; la sonda usa el `/dev/tcp` de bash.
- **Puente**: base `python:3.14-alpine`, no Debian slim. Todas las
  dependencias traen rueda `musllinux`, y así la imagen no incluye
  `perl-base`, `util-linux` ni `ncurses`.
- **Puente**: `pip` y `setuptools` se quedan en la etapa de construcción (las
  dependencias se instalan en un venv que se copia). La imagen final no
  instala nada, así que el gestor de paquetes solo aportaría CVE.

Lo que queda abierto en el servidor son paquetes de Debian **sin versión
corregida disponible** (`perl-base`, `util-linux`, `ncurses`, `gzip`,
`libacl1`) más `libxml2`/`libsndfile1`, que entran como dependencias duras de
`libsdl2-2.0-0`. No hay parche que aplicar: quitarlos exigiría una imagen
distroless con SDL compilado a medida.

## Límites conocidos

- El healthcheck del juego usa la raíz del servidor HTTP heredado; comprueba
  que el proceso vive, no que el escenario funciona.
- Sin persistencia de partidas todavía: parar el contenedor pierde el estado
  del escenario. La persistencia de trayectos es una decisión pendiente en
  `docs/FOUNDRY.md`.
