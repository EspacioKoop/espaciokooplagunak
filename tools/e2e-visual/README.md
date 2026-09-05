# QA visual: grabar una demo real de Foundry

Herramienta de un solo script (`grabar.mjs`) que abre una sesión REAL de
Foundry con Playwright, hace login, opcionalmente activa una herramienta de la
barra de escena y reproduce una secuencia de teclas, todo grabado a vídeo.

**No sustituye a las suites de test** (`node --test`, `pytest`, CTest): esas
prueban comportamiento. Esto enseña *aspecto* — la clase de cambio que un
`assert.equal` no puede transmitir (un rótulo nuevo, un color, cómo se ve un
paseo por la nave). Nació en #458 al pedir un vídeo de un arreglo de UI, y se
generalizó porque volver a montar el mismo login+navegación a mano cada vez
que hiciera falta una demo sería peor que no tenerlo.

## Por qué está aquí y no en `foundry-module/`

El módulo no declara ninguna dependencia dura (ver `CLAUDE.md`,
"Módulos ajenos"): Playwright y su Chromium (~200 MB) son herramientas de
*quien desarrolla*, nunca del juego. Vive en su propio `package.json`, igual
que `bridge/` tiene el suyo — así que `npm install` aquí nunca afecta a lo que
`module.json` declara ni a lo que se distribuye.

## Requisitos

- Un servidor Foundry ya arrancado y accesible por HTTP (arranque headless:
  ver la memoria de proyecto / `docs/BUILDING.md` — típicamente
  `node resources/app/main.js --dataPath=... --noupnp --port=30000`).
- `Xvfb` en el `PATH` (o cualquier X ya disponible en `$DISPLAY`): la grabación
  corre sobre un display VIRTUAL a propósito, para no tomar el control del
  ratón/teclado de la pantalla real de quien lo ejecuta.
- `ffmpeg`, solo si quieres convertir el `.webm` de salida a `.mp4`.
- `npm install` en esta carpeta (una vez) y `npx playwright install chromium`
  (descarga el Chromium de Playwright, una vez).

## Uso

```bash
Xvfb :99 -screen 0 1280x800x24 &
DISPLAY=:99 node grabar.mjs \
  --url=http://localhost:30000 \
  --world=qa-humo-lagunak --user=Gamemaster \
  --control=lagunak --tool=lagunak-andar-nave \
  --teclas="w:2600,e:900,w:2000,q:700,w:1500" \
  --out=/tmp/demo

ffmpeg -y -i /tmp/demo-video/*.webm -c:v libx264 -pix_fmt yuv420p \
  -movflags +faststart /tmp/demo.mp4
```

- `--control` / `--tool`: el grupo (`data-control`) y la herramienta
  (`data-tool`) de la barra de escena a activar. Se pueden leer del DOM real
  con las herramientas de desarrollador del navegador, o del propio código —
  `control-escena.mjs` / `main.mjs` en `foundry-module/scripts/`. Omitir
  ambos si la demo no necesita abrir ninguna ventana (p. ej. solo enseñar el
  canvas base).
- `--teclas`: `tecla:milisegundos` separados por comas, en el orden en que se
  pulsan — es el paseo que se quiere enseñar. Vacío si no hace falta moverse.
- El usuario (`--user`) tiene que existir en el mundo y su contraseña tiene
  que estar en blanco: el script no pasa ninguna (no hay ningún secreto que
  guardar aquí a propósito).

## Qué NO hace

No arranca Foundry por ti (evita asumir dónde está instalado o qué mundo usar
sin que se le diga explícitamente) y no decide qué demostrar — la secuencia de
teclas y qué herramienta abrir es siempre una decisión de quien lo invoca, no
de este script.
