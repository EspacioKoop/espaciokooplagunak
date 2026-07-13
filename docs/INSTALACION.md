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
  se enmascara (`7a22…9e05`). `docker/.env` está ignorado por git.

## Uso no interactivo

Útil para automatización, scripts y CI. Ninguna de estas órdenes abre el menú:

| Orden | Efecto |
|---|---|
| `python3 tools/instalar.py --detectar` | Imprime la detección del entorno en JSON. |
| `python3 tools/instalar.py --diagnostico` | Requisitos de cada vía. |
| `python3 tools/instalar.py --generar-token` | Un token Bearer nuevo. |
| `python3 tools/instalar.py --imprimir-config` | `docker/.env` con el token oculto. |
| `python3 tools/instalar.py --set CLAVE=VALOR …` | Aplica cambios a `docker/.env` (lo crea si falta). |

Ejemplo:

```bash
python3 tools/instalar.py --set EE_SERVER_PORT=36000 BRIDGE_PORT=8091
```

Las claves con validación (`EE_SERVER_PORT`, `BRIDGE_PORT`) rechazan valores
fuera de rango antes de escribir nada.

## Pruebas

```bash
python3 -m pytest tools/tests/test_instalar.py
```
