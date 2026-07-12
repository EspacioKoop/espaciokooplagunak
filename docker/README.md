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
docker compose up -d --build
```

Comprobación:

```bash
# Salud del puente y del juego
curl http://localhost:8090/healthz

# Estado seguro de la nave (requiere el token de .env)
curl -H "Authorization: Bearer $BRIDGE_TOKEN" http://localhost:8090/v1/state
```

Los clientes del puente de mando (EmptyEpsilon/Espaciokoop Lagunak de
escritorio) se conectan al puerto `35666` del host.

## Puertos y superficie de exposición

| Puerto | Servicio | Publicado | Notas |
|---|---|---|---|
| 35666/tcp+udp | juego | Sí | Clientes de la tripulación en LAN |
| 8090/tcp | puente | Sí | API para el módulo de Foundry, con token |
| 8080/tcp | juego (HTTP heredado) | **No** | `/exec.lua` ejecuta Lua arbitrario; solo accesible por el puente dentro de la red de compose |

**Nunca añadas el puerto 8080 a `ports:`.** Es el vector de ataque descrito en
[`SECURITY.md`](../SECURITY.md) y en el inventario
[`docs/API_HTTP.md`](../docs/API_HTTP.md).

## Variables de entorno del servidor

| Variable | Por defecto | Efecto |
|---|---|---|
| `EE_SCENARIO` | `scenario_00_basic.lua` | Escenario que arranca el servidor |
| `EE_SERVER_NAME` | `Espaciokoop Lagunak` | Nombre visible del servidor |
| `EE_SERVER_PASSWORD` | vacío | Contraseña para clientes |
| `EE_SERVER_PORT` | `35666` | Puerto publicado para clientes |
| `BRIDGE_TOKEN` | — (obligatorio) | Token Bearer del puente |
| `BRIDGE_PORT` | `8090` | Puerto publicado del puente |

Argumentos extra al contenedor `game` se pasan tal cual al binario, p. ej.
`docker compose run game startpaused=1`.

## Reproducibilidad

- La imagen compila contra un commit exacto de SeriousProton (`ARG
  SERIOUS_PROTON_REF` en el `Dockerfile`). Al sincronizar con upstream
  (`docs/UPSTREAM.md`), actualiza ese commit en la misma rama.
- Las imágenes se etiquetan con versión (`0.1.0-dev`), nunca `latest` para
  despliegues estables.

## Límites conocidos

- El healthcheck del juego usa la raíz del servidor HTTP heredado; comprueba
  que el proceso vive, no que el escenario funciona.
- Sin persistencia de partidas todavía: parar el contenedor pierde el estado
  del escenario. La persistencia de trayectos es una decisión pendiente en
  `docs/FOUNDRY.md`.
