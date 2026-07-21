# Asistente de instalación

`tools/instalar.py` es un asistente en Python (solo biblioteca estándar, sin
dependencias) que guía la puesta en marcha de Espaciokoop Lagunak y centraliza
la configuración del puente de Foundry VTT. Funciona en Linux, macOS y Windows
(cualquier sistema con Python 3.10 o posterior).

```bash
python3 tools/instalar.py
```

## Qué hace

Al arrancar **autodetecta el entorno**: sistema operativo, distribución, gestor
de paquetes (apt, dnf, pacman, zypper o brew), arquitectura, si Docker y
`docker compose` están disponibles y la ruta habitual de módulos de Foundry VTT
para tu SO. Después ofrece un menú:

1. **Instalar con Docker (servidor + puente)** — la vía recomendada. Comprueba
   los requisitos — **incluido el plugin `docker compose` (v2), que es
   prerrequisito real: sin él la acción se corta antes de tocar nada** —,
   pide confirmación **antes** de crear `docker/.env` (a partir de
   `docker/.env.example`, con un `BRIDGE_TOKEN` aleatorio; si el `.env` ya
   existe, esta ruta no lo toca), y ofrece levantar la pila con
   `docker compose up -d --build`, **informando siempre del código de salida**
   (éxito o fallo). Ver [`docker/README.md`](../docker/README.md).
2. **Compilar de forma nativa** — muestra el comando exacto de dependencias
   para tu gestor de paquetes, verifica que SeriousProton esté como repositorio
   hermano y te da los comandos de configuración y compilación de CMake,
   **ajustados a tu plataforma**: en Arch/CachyOS (pacman) añade
   `-DCMAKE_DISABLE_FIND_PACKAGE_glm=TRUE` (la glm 1.0.x del sistema rompe
   SeriousProton — ver [`docs/BUILDING.md`](BUILDING.md)), y en macOS solo se
   anuncia Homebrew si está instalado.
3. **Instalar el módulo de Foundry VTT** — enlaza (o copia, en Windows) la
   carpeta `foundry-module/` dentro de `Data/modules/espaciokoop-lagunak` de tu
   instalación de Foundry. Ver [`foundry-module/README.md`](../foundry-module/README.md).
4. **Modificar opciones** — un menú para editar la configuración del puente
   (puertos, interfaz de escucha, escenario inicial, nombre y contraseña del
   servidor, token) con validación, escribiendo en `docker/.env` sin perder
   comentarios ni orden. Incluye regenerar el token.
5. **Diagnóstico de requisitos** — enumera lo que falta para cada vía.
6. **Copiar el token del puente** — copia el `BRIDGE_TOKEN` de `docker/.env`
   al portapapeles del sistema (`wl-copy`, `xclip`, `xsel`, `pbcopy` o
   `clip.exe`) para pegarlo en **Configurar token del puente** sin abrir el
   archivo a mano. El asistente nunca lo muestra y vacía el portapapeles cuando
   confirmas que ya lo has pegado; un gestor de historial externo debe limpiarse
   aparte. Si no hay herramienta compatible, falla cerrado. Al pulsar **Guardar**
   en ese mismo diálogo, Foundry ya comprueba la conexión con el puente y
   notifica el resultado real (token válido, puente inaccesible, token
   rechazado…) — no hace falta abrir aparte **Probar conexión con el puente**
   salvo para volver a comprobar el estado sin cambiar el token (ver
   [`foundry-module/README.md`](../foundry-module/README.md)).

## Seguridad

Coherente con [`AGENTS.md`](../AGENTS.md) y [`SECURITY.md`](../SECURITY.md):

- **Nunca instala paquetes del sistema.** Para las dependencias solo *muestra*
  el comando; quien lo ejecuta, con privilegios, es la persona.
- Las acciones que modifican tu equipo (crear `docker/.env`, enlazar el módulo,
  levantar Docker) **se confirman** antes de ejecutarse.
- El `BRIDGE_TOKEN` **nunca se imprime entero** ni en el menú ni en la salida:
  se representa sin prefijo ni sufijo (`****`). La única excepción es `--generar-token`, que
  imprime un token nuevo **completo** por stdout —es su función explícita, para
  poder capturarlo—, así que redirige su salida a donde toque y no la dejes en
  un log compartido. `docker/.env` está ignorado por git y se escribe con
  permisos `0600` (solo tu usuario), de forma atómica.

## Uso no interactivo

Útil para automatización, scripts y CI. Ninguna de estas órdenes abre el menú:

| Orden | Efecto |
|---|---|
| `python3 tools/instalar.py --detectar` | Imprime la detección del entorno en JSON. |
| `python3 tools/instalar.py --diagnostico` | Requisitos de cada vía. |
| `python3 tools/instalar.py --generar-token` | Imprime un token Bearer nuevo **completo** por stdout (única salida que no enmascara el token). |
| `python3 tools/instalar.py --imprimir-config` | `docker/.env` con el token oculto. |
| `python3 tools/instalar.py --copiar-token` | Copia el `BRIDGE_TOKEN`, espera el pegado y vacía el portapapeles; nunca lo imprime y falla cerrado si no puede copiar o limpiar. |
| `python3 tools/instalar.py --set CLAVE=VALOR …` | Aplica cambios a `docker/.env` (lo crea si falta). |

Ejemplo:

```bash
python3 tools/instalar.py --set EE_SERVER_PORT=36000 BRIDGE_PORT=8091
```

`--set` solo admite las claves **no secretas** de la lista blanca (las que
ofrece el menú de opciones) y rechaza valores con saltos de línea: no puede
añadir claves arbitrarias ni inyectar líneas sueltas en el `.env`. `BRIDGE_TOKEN`
y `EE_SERVER_PASSWORD` se rechazan expresamente para que nunca viajen en `argv`;
edítalos desde el menú, que usa entrada oculta. Las claves con validación
(`EE_SERVER_PORT`, `BRIDGE_PORT`) rechazan además valores fuera de rango antes
de escribir nada.

Al enlazar el módulo de Foundry, si en la ruta ya hay un **directorio real**
(no un enlace nuestro) el asistente no lo borra: pide confirmación y conserva el
anterior renombrándolo a `…espaciokoop-lagunak.bak-<fecha>` antes de reinstalar.

## Pruebas

```bash
python3 -m pytest tools/tests/test_instalar.py
```

En CI corren con el resto de tests de `tools/` en el workflow
[`tools.yml`](../.github/workflows/tools.yml) (job Python ligero sobre Linux;
la ruta nativa de Windows del instalador queda declarada como límite: no se
ejercita en CI).

## Mantenimiento

El asistente se apoya en partes que cambian; si se quedan desincronizadas, engaña
en silencio a quien instala por primera vez (justo lo que pretende evitar).
**Actualiza `tools/instalar.py` y este documento en el mismo cambio** cuando toques:

| Si cambia… | Actualiza en `tools/instalar.py` |
|---|---|
| Dependencias de compilación o nombres de paquetes | `_PAQUETES_NATIVOS`, `REQUISITOS_NATIVO` |
| Comandos de compilación (CMake, flags) | `_accion_nativa` (y [`docs/BUILDING.md`](BUILDING.md)) |
| Claves o puertos de `docker/.env.example` | `OPCIONES_EDITABLES` y sus validadores |
| Estructura de arranque de Docker | `_accion_docker` |
| Ruta de módulos de Foundry o forma de instalarlo | `ruta_modulos_foundry`, `enlazar_modulo` |
| Gestores de paquetes / distribuciones soportadas | `_DISTRO_A_GESTOR` |

Mantén además sincronizada la tabla de banderas no interactivas de arriba con las
opciones reales del `argparse`, y añade una prueba en `tools/tests/test_instalar.py`
para cualquier lógica nueva.
