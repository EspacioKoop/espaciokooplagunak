# Compilación y desarrollo

Este documento describe el sistema de compilación heredado de EmptyEpsilon y separa instrucciones conocidas de resultados realmente verificados por Espaciokoop Lagunak.

## Estado de validación

**Compilación limpia verificada en Linux (2026-07-12).** Entorno: Ubuntu 24.04 (x86-64), g++ 13.3.0,
CMake 3.28.3, Ninja 1.11.1, libsdl2-dev 2.30.0, lua5.3; SeriousProton en `master` (`e6f10ae`) como
repositorio hermano; commit del fork `d433a2b2`. Resultado:

- Configuración con `-DSERIOUS_PROTON_DIR=../SeriousProton -DWARNING_IS_ERROR=1`: correcta.
- Compilación: 539/539 objetivos sin warnings; binario `build/EmptyEpsilon` (ELF x86-64, ~20 MB).
- Validación Lua (`luac -p` sobre todo `scripts/`): sin errores.
- Prueba de humo headless: `./build/EmptyEpsilon headless=scenario_10_empty.lua` arranca, carga los
  packs y el escenario, y escucha en TCP y UDP 35666 (puerto multijugador por defecto). En este modo
  la entrada estándar actúa como consola Lua y la configuración se guarda en `~/.emptyepsilon`.

Esto valida **una** plataforma y **un** entorno concretos; otras distribuciones o versiones de
dependencias pueden requerir ajustes. Queda pendiente la prueba manual con interfaz gráfica y la
conexión de dos estaciones (fase 1 del roadmap).

En el bootstrap inicial se inspeccionaron `CMakeLists.txt`, `.github/workflows/cicd.yml` y la estructura de upstream. El host de bootstrap disponía de `g++`, pero no de `cmake`, `ninja`, `lua/luac`, cabeceras SDL2 ni una copia hermana de SeriousProton. Por ello, en ese momento **no se pudo configurar, compilar ni validar los scripts Lua localmente**.

La CI heredada contiene trabajos Linux, macOS, compilación cruzada para Windows y validación sintáctica de Lua. Que existan esos trabajos no equivale a una ejecución correcta en este fork; el estado deberá confirmarse en GitHub Actions.

## Dependencias principales

- Git.
- Compilador compatible con C++17.
- CMake 3.12 o posterior.
- SDL2 y sus cabeceras de desarrollo.
- [SeriousProton](https://github.com/daid/SeriousProton), normalmente como repositorio hermano.
- Ninja es recomendable, aunque CMake admite otros generadores.
- Python 3 se detecta para tareas auxiliares.
- Lua 5.3 / `luac` para validar escenarios como hace la CI original.

CMake descarga `meshoptimizer` durante la configuración cuando no está disponible localmente. La integración de Discord está desactivada por defecto salvo en Windows.

Cuando sí está activa, el SDK de Discord se descarga en una **versión fijada con SHA-256 esperado** (`DISCORD_SDK_VERSION` / `DISCORD_SDK_SHA256` en [`cmake/DiscordGameSdk.cmake`](../cmake/DiscordGameSdk.cmake)). Si la descarga falla o el archivo no cuadra, la configuración **aborta al instante** diciendo por qué, en vez de morir seis minutos después por una cabecera ausente; la salida siempre disponible es `-DWITH_DISCORD=OFF` (#400).

## Preparación recomendada

Desde el directorio padre de ambos repositorios:

```bash
git clone https://github.com/daid/SeriousProton.git
git clone https://github.com/EspacioKoop/espaciokooplagunak.git
```

Estructura esperada:

```text
proyectos/
├── SeriousProton/
└── espaciokooplagunak/
```

También puedes ubicar SeriousProton en otro lugar y pasar `-DSERIOUS_PROTON_DIR=/ruta/absoluta`.

## Linux

Los nombres exactos de paquetes dependen de la distribución. En Debian/Ubuntu, la base habitual es:

```bash
sudo apt update
sudo apt install build-essential cmake ninja-build libsdl2-dev lua5.3
```

Configura sin modificar el árbol fuente:

```bash
cd espaciokooplagunak
cmake -S . -B build -G Ninja \
  -DSERIOUS_PROTON_DIR=../SeriousProton \
  -DWARNING_IS_ERROR=1 \
  -DBUILD_CONTENT_RESOURCE_TESTS=ON
cmake --build build --parallel
ctest --test-dir build --output-on-failure
```

No ejecutes instalaciones del sistema desde un agente sin autorización humana. La lista anterior procede de la configuración original y debe ajustarse si CMake informa de una dependencia adicional.

### Arch / CachyOS

Compilación verificada el 2026-07-12 (GCC 16.1; evidencia y detalle en el issue #14). Dependencias base con pacman:

```bash
sudo pacman -S --needed cmake ninja
```

(`sdl2-compat` y `freetype2` suelen estar ya presentes como dependencias de otros paquetes; instálalos si faltan.)

**Incompatibilidad conocida**: con la glm del sistema (1.0.3), SeriousProton falla con `glm::vec2 does not name a type` en `vectorUtils.h` — glm 1.0.x ya no expone los tipos de forma transitiva. Solución verificada: desactivar la detección de la glm del sistema para que SeriousProton use su copia vendorizada:

```bash
cmake -S . -B build -G Ninja \
  -DSERIOUS_PROTON_DIR=../SeriousProton \
  -DWARNING_IS_ERROR=1 \
  -DCMAKE_DISABLE_FIND_PACKAGE_glm=TRUE
cmake --build build --parallel
```

La configuración debe informar `GLM version used: BUNDLED`. En Docker y en la CI no ocurre porque esas imágenes no tienen glm de sistema.

## Validación Lua

Equivalente portable al objetivo de CI heredado:

```bash
find scripts -type f -iname '*.lua' -print0 \
  | xargs -0 -n 1 luac -p
```

La ausencia de salida y código de retorno cero indica que los archivos analizados tienen sintaxis válida.

## Ejecución y prueba manual

La ruta y nombre final del ejecutable dependen del generador y la plataforma. Tras compilar:

1. Localiza el binario generado bajo `build/`.
2. Inicia el juego y registra versión, sistema operativo y commit.
3. Crea una partida local.
4. Conecta al menos dos estaciones si el cambio afecta a multijugador.
5. Documenta escenario, pasos y resultado en el pull request.

No añadas al repositorio `options.ini`, `keybindings.json`, logs ni directorios de build.

## Otras plataformas

El proyecto original mantiene instrucciones y CI para Windows, macOS y Android. Consulta:

- [Wiki oficial de compilación](https://github.com/daid/EmptyEpsilon/wiki/Build)
- `android/Readme.md`
- `.github/workflows/cicd.yml`
- `cmake/mingw.toolchain`

Cuando Espaciokoop Lagunak valide una plataforma, añadirá aquí comandos, versión de dependencias y resultado reproducible.

## Diagnóstico

Si CMake falla, incluye en el issue o PR:

- sistema operativo y arquitectura;
- versión de CMake y compilador;
- comando exacto;
- primeras causas útiles del error, sin volcar logs enormes;
- commit de Espaciokoop Lagunak y commit de SeriousProton.

Nunca publiques rutas privadas, nombres de usuario, tokens o variables con secretos.
