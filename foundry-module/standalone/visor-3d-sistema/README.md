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
- La integración con Foundry (`foundry-app.mjs`) es **opt-in**: no está en
  `module.json`, así que hoy es inerte. Ver abajo cómo activarla.

## Estructura

| Archivo | Papel | Dependencias |
|---|---|---|
| `logica.mjs` | matemática pura (órbitas, escala, pick por rayo) | ninguna |
| `datos.mjs` | sistema de ejemplo "Argia" + `aplanarSistema` | ninguna |
| `visor.mjs` | render Three.js + clase `VisorSistema3D` | `three` (CDN) |
| `index.html` | arranque standalone (importmap) | navegador |
| `foundry-app.mjs` | wrapper `Application` para Foundry (opt-in) | Foundry + three |
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

## Integración futura en Foundry (opt-in)

Cuando se quiera la ventana del GM:

1. Añade `"standalone/visor-3d-sistema/foundry-app.mjs"` a `esmodules` en
   `foundry-module/module.json`.
2. Provee Three.js en el entorno de Foundry (CDN o asset del módulo).
3. Llama a `registrarVisorSistema3D()` desde `scripts/main.mjs` tras `ready`
   (o crea el botón en los controles de escena, junto al de estado de la nave).

El wrapper usa `Application` (v11 verificada) y deja comentado el camino
`ApplicationV2` para anfitriones modernos, sin romper v11.302.
