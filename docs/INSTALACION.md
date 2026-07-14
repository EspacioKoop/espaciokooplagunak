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
   los requisitos, crea `docker/.env` a partir de `docker/.env.example` con un
   `BRIDGE_TOKEN` aleatorio si aún no existe, y ofrece levantar la pila con
   `docker compose up -d --build`. Ver [`docker/README.md`](../docker/README.md).
2. **Compilar de forma nativa** — muestra el comando exacto de dependencias
   para tu gestor de paquetes, verifica que SeriousProton esté como repositorio
   hermano y te da los comandos de configuración y compilación de CMake. Ver
   [`docs/BUILDING.md`](BUILDING.md).
3. **Instalar el módulo de Foundry VTT** — enlaza (o copia, en Windows) la
   carpeta `foundry-module/` dentro de `Data/modules/espaciokoop-lagunak` de tu
   instalación de Foundry. Ver [`foundry-module/README.md`](../foundry-module/README.md).
4. **Modificar opciones** — un menú para editar la configuración del puente
   (puertos, interfaz de escucha, escenario inicial, nombre y contraseña del
   servidor, token) con validación, escribiendo en `docker/.env` sin perder
   comentarios ni orden. Incluye regenerar el token.
5. **Diagnóstico de requisitos** — enumera lo que falta para cada vía.

## Seguridad

Coherente con [`AGENTS.md`](../AGENTS.md) y [`SECURITY.md`](../SECURITY.md):

- **Nunca instala paquetes del sistema.** Para las dependencias solo *muestra*
  el comando; quien lo ejecuta, con privilegios, es la persona.
- Las acciones que modifican tu equipo (crear `docker/.env`, enlazar el módulo,
  levantar Docker) **se confirman** antes de ejecutarse.
- El `BRIDGE_TOKEN` **nunca se imprime entero** ni en el menú ni en la salida:
  se enmascara (`7a22…9e05`). La única excepción es `--generar-token`, que
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
| `python3 tools/instalar.py --set CLAVE=VALOR …` | Aplica cambios a `docker/.env` (lo crea si falta). |

Ejemplo:

```bash
python3 tools/instalar.py --set EE_SERVER_PORT=36000 BRIDGE_PORT=8091
```

`--set` solo admite las claves de la lista blanca (las que ofrece el menú de
opciones) y rechaza valores con saltos de línea: no puede añadir claves
arbitrarias ni inyectar líneas sueltas en el `.env`. Las claves con validación
(`EE_SERVER_PORT`, `BRIDGE_PORT`) rechazan además valores fuera de rango antes
de escribir nada.

Al enlazar el módulo de Foundry, si en la ruta ya hay un **directorio real**
(no un enlace nuestro) el asistente no lo borra: pide confirmación y conserva el
anterior renombrándolo a `…espaciokoop-lagunak.bak-<fecha>` antes de reinstalar.

## Pruebas

```bash
python3 -m pytest tools/tests/test_instalar.py
```

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
