# Visor de sistema planetario 3D

Elemento 3D **standalone-first** y autocontenido para Espaciokoop Lagunak: una
estrella con sus planetas y lunas en órbita, con arrastrar-para-orbitar, zoom y
click-para-enfocar. No depende de Foundry ni de build: Three.js entra por CDN
vía `importmap`.

## Filosofía (mínima colisión con otros workers)

- Vive en su propia carpeta `foundry-module/standalone/visor-3d-sistema/`. No
  toca `module.json`, `main.mjs` ni ningún script compartido.
- La **lógica pura** (`logica.mjs`, solo matemática con vectores `{x,y,z}`)
  está separada del render y se testea desde Node sin navegador, igual que el
  resto del módulo (`decorado-fondo.mjs`, etc.).
- El render (`visor.mjs`) es la única pieza que usa Three.js y el navegador.
- La integración con Foundry (la glu `scripts/visor-3d-sistema-app.mjs`) ya está **activa**: el archivo
  está en `module.json` (esmodules) y se auto-registra como botón solo-GM.

## Estructura

| Archivo | Papel | Dependencias |
|---|---|---|
| `logica.mjs` | matemática pura (órbitas, escala, pick por rayo) | ninguna |
| `datos.mjs` | sistema de ejemplo "Argia" + `aplanarSistema` | ninguna |
| `visor.mjs` | render Three.js + clase `VisorSistema3D` | `three` (CDN) |
| `index.html` | arranque standalone (Three por CDN) | navegador |
| _(glu en `scripts/visor-3d-sistema-app.mjs`)_ | ventana Foundry que embebe `index.html` en iframe | Foundry |
| `../tests/visor-3d-sistema.test.mjs` | tests Node de la lógica pura | `node:test` |

## Uso standalone

Los módulos ES no se cargan desde `file://` en Chrome, así que sírvelo por HTTP
desde la raíz del repo:

```bash
python3 -m http.server 8080
# abre http://localhost:8080/foundry-module/standalone/visor-3d-sistema/
```

Controles: arrastrar para orbitar, rueda para zoom, click en un cuerpo para
enfocarlo. Botones para pausar y togglear las órbitas.

## Tests

```bash
node --test foundry-module/tests/visor-3d-sistema.test.mjs
```

Cubre la lógica pura: orden de pintado, periodicidad de la órbita, escala visual
monótona, anillos y selección por rayo (incluido ignorar cuerpos detrás de la
cámara y el desempate determinista). El pintado real sobre WebGL queda en
verificación humana en un navegador (igual que `mapa-render.mjs`).

## Integración en Foundry (ACTIVADA)

El archivo `scripts/visor-3d-sistema-app.mjs` ya está listado en `esmodules` de `module.json`, así
que Foundry lo carga al arrancar y se auto-registra en la barra de controles de
escena, dentro del grupo propio `lagunak` (issue #125), como botón solo-GM
"Visor 3D del sistema" (`fa-solid fa-satellite`). Al pulsarlo se abre una
ventana `Application` (v11) con el visor montado; en anfitriones modernos que
conserven `Application` v1 (v13 por retrocompatibilidad) también funciona, sin
tocar `main.mjs` ni `control-escena.mjs` salvo para reusar el helper puro
`anadirHerramienta`.

- Three.js se importa por CDN (forma `+esm` de jsDelivr) dentro de `visor.mjs`,
  de modo que no hace falta importmap ni build. El import es dinámico y solo
  ocurre al abrir la ventana, para no romper el arranque si la CDN falla.
- La clave de título `"LAGUNAK.Controles.AbrirVisor3DSistema"` está en
  `lang/es.json` y `lang/en.json`.
- Si la clase base `Application` no existiera en el anfitrión, el botón se
  registra pero al abrir avisa y no rompe nada (pendiente de la variante
  `ApplicationV2` real, con su smoke en el issue de versiones modernas).
