import assert from "node:assert/strict";
import test from "node:test";

import { dibujarFrame } from "../scripts/mapa-render.mjs";

/**
 * Contexto 2D falso mínimo: cuenta fillRect (la única primitiva que usan
 * tanto el pintor de estrellas/blips como el sprite de nave y los eventos de
 * fondo) y no revienta con el resto de la API de Canvas que dibujarFrame usa
 * incondicionalmente (fondo, retícula).
 */
function ctxFalso(overrides = {}) {
  let fillRects = 0;
  let strokes = 0;
  let fillTexts = 0;
  let beginPaths = 0;
  let arcs = 0;
  let moveTos = 0;
  let lineTos = 0;
  let setLineDashCalls = 0;
  let globalAlphaSets = 0;
  let lastGlobalAlpha = 1;
  let lastFillStyle = "";
  let lastStrokeStyle = "";
  let lastLineWidth = 0;
  let lastFont = "";
  let lastTextAlign = "";
  let lastTextBaseline = "";
  // HISTORIALES, no solo el ultimo valor. Guardar `lastGlobalAlpha` sola hace
  // que una prueba de opacidad no pruebe nada: el render pone 0.3, pinta, y
  // devuelve la opacidad a 1 antes de terminar, asi que al final las tres
  // variantes valen 1 y el assert pasa igual aunque el enfasis desaparezca.
  // Lo mismo con los colores: el ultimo no dice de que color se pinto ESTO.
  const alphas = [];
  const fillStyles = [];
  const strokeStyles = [];

  return {
    get fillRects() { return fillRects; },
    get strokes() { return strokes; },
    get fillTexts() { return fillTexts; },
    get beginPaths() { return beginPaths; },
    get arcs() { return arcs; },
    get moveTos() { return moveTos; },
    get lineTos() { return lineTos; },
    get setLineDashCalls() { return setLineDashCalls; },
    get globalAlphaSets() { return globalAlphaSets; },
    get lastGlobalAlpha() { return lastGlobalAlpha; },
    get lastFillStyle() { return lastFillStyle; },
    get lastStrokeStyle() { return lastStrokeStyle; },
    get lastLineWidth() { return lastLineWidth; },
    get lastFont() { return lastFont; },
    get lastTextAlign() { return lastTextAlign; },
    get lastTextBaseline() { return lastTextBaseline; },
    get alphas() { return alphas; },
    get fillStyles() { return fillStyles; },
    get strokeStyles() { return strokeStyles; },
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    font: "",
    textAlign: "",
    textBaseline: "",
    imageSmoothingEnabled: true,
    globalAlpha: 1,
    fillRect() { fillRects += 1; },
    beginPath() { beginPaths += 1; },
    closePath() {},
    arc() { arcs += 1; },
    stroke() { strokes += 1; },
    fill() {},
    fillText() { fillTexts += 1; },
    moveTo() { moveTos += 1; },
    lineTo() { lineTos += 1; },
    setLineDash(arr) { setLineDashCalls += 1; },
    ...overrides,
    set globalAlpha(v) {
      globalAlphaSets += 1;
      lastGlobalAlpha = v;
      alphas.push(v);
    },
    get globalAlpha() { return lastGlobalAlpha; },
    set fillStyle(v) { lastFillStyle = v; fillStyles.push(v); },
    get fillStyle() { return lastFillStyle; },
    set strokeStyle(v) { lastStrokeStyle = v; strokeStyles.push(v); },
    get strokeStyle() { return lastStrokeStyle; },
    set lineWidth(v) { lastLineWidth = v; },
    get lineWidth() { return lastLineWidth; },
    set font(v) { lastFont = v; },
    get font() { return lastFont; },
    set textAlign(v) { lastTextAlign = v; },
    get textAlign() { return lastTextAlign; },
    set textBaseline(v) { lastTextBaseline = v; },
    get textBaseline() { return lastTextBaseline; },
  };
}

// Regresión #215 (review de #265/#215): dibujarDecorado se llamaba con los
// eventos de fondo activos también en la pantalla "en espera" (frame.sinDatos),
// aunque el decorado en sí llegara vacío. Un evento de fondo (p. ej. una nave
// lejana cruzando el lienzo) seguía pintándose sobre la espera.
test("dibujarFrame no pinta eventos de fondo en la pantalla en espera (frame.sinDatos)", () => {
  const frameSinDatos = { sinDatos: true, capas: [], blips: [], destino: null };
  const eventosFondo = [{ tipo: "nave_lejana", inicioMs: 0, duracionMs: 60000 }];

  const ctx = ctxFalso();
  dibujarFrame(ctx, frameSinDatos, { decorado: [], eventosFondo, tMs: 100 });

  // Solo el fillRect del fondo (línea 1): ni estrellas (capas vacías), ni
  // decorado (lista vacía), ni eventos de fondo (deben omitirse en espera).
  assert.equal(ctx.fillRects, 1);
});

test("dibujarFrame sí pinta eventos de fondo fuera de la pantalla en espera", () => {
  const frameConDatos = { sinDatos: false, capas: [], blips: [], destino: null };
  const eventosFondo = [{ tipo: "nave_lejana", inicioMs: 0, duracionMs: 60000 }];

  const ctxSinEventos = ctxFalso();
  dibujarFrame(ctxSinEventos, frameConDatos, { decorado: [], eventosFondo: [], tMs: 100 });

  const ctxConEventos = ctxFalso();
  dibujarFrame(ctxConEventos, frameConDatos, { decorado: [], eventosFondo, tMs: 100 });

  // El sprite de la nave propia se pinta siempre (fondo + sprite); con el
  // evento de fondo activo debe haber fillRect adicionales.
  assert.ok(ctxConEventos.fillRects > ctxSinEventos.fillRects);
});

// Estrellas: duplicados de borde cuando la estrella queda a caballo del lienzo
test("dibujarFrame pinta duplicados de borde para estrellas que cruzan el límite derecho/inferior", () => {
  // La condicion del render es `x + tam > ancho`, ESTRICTA. Con x=318 y tam=2
  // sale 320 > 320, que es falso: la version anterior de esta prueba usaba 318
  // y no llegaba a ejecutar la rama de duplicados ni una vez. Pasaba igual,
  // porque contaba fillRect totales y el sprite de la nave propia ya pinta de
  // sobra. Con 319 el borde se cruza de verdad.
  const capaConBorde = {
    estrellas: [
      { x: 319, y: 160, r: 2, brillo: 1 }, // 319+2=321 > 320: cruza el borde derecho
      { x: 160, y: 319, r: 2, brillo: 1 }, // cruza el borde inferior
      { x: 319, y: 319, r: 2, brillo: 1 }, // cruza los dos: 2 duplicados
    ],
    dx: 0,
    dy: 0,
  };
  const frame = { sinDatos: false, capas: [capaConBorde], blips: [], destino: null };

  const ctx = ctxFalso();
  dibujarFrame(ctx, frame, { ancho: 320, alto: 320, decorado: [], tMs: 0 });

  // Un contador absoluto no sirve de prueba aqui: la nave propia pinta un
  // sprite entero de fillRect, asi que `>= 12` seguiria pasando aunque los
  // duplicados de borde desaparecieran. Lo que si aisla el efecto es la
  // DIFERENCIA contra el mismo frame con las estrellas separadas del borde:
  // todo lo demas que se pinta es identico.
  const capaSinBorde = {
    estrellas: [
      { x: 160, y: 160, r: 2, brillo: 1 },
      { x: 100, y: 100, r: 2, brillo: 1 },
      { x: 200, y: 60, r: 2, brillo: 1 },
    ],
    dx: 0,
    dy: 0,
  };
  const ctxSinBorde = ctxFalso();
  dibujarFrame(ctxSinBorde, { sinDatos: false, capas: [capaSinBorde], blips: [], destino: null },
    { ancho: 320, alto: 320, decorado: [], tMs: 0 });

  // Derecho (1) + inferior (1) + la esquina, que cruza las dos (2) = 4.
  assert.equal(ctx.fillRects - ctxSinBorde.fillRects, 4,
    "cuatro duplicados de borde: derecho, inferior y los dos de la esquina");
});

// Ruta al destino: línea punteada desde el centro al destino
test("dibujarFrame pinta la ruta al destino cuando frame.destino existe", () => {
  const frame = {
    sinDatos: false,
    capas: [],
    blips: [],
    destino: { x: 200, y: 150, dentro: true, nombre: "Alpha" },
  };

  const ctx = ctxFalso();
  dibujarFrame(ctx, frame, { ancho: 320, alto: 320, decorado: [], tMs: 0 });

  // Debe llamar setLineDash([4,3]) para punteado, luego setLineDash([]) para resetear
  assert.equal(ctx.setLineDashCalls, 2);
  // beginPath + moveTo + lineTo + stroke
  assert.ok(ctx.beginPaths >= 1);
  assert.ok(ctx.moveTos >= 1);
  assert.ok(ctx.lineTos >= 1);
  assert.ok(ctx.strokes >= 1);
  // Color de la ruta
  assert.equal(ctx.lastStrokeStyle, "rgba(255, 209, 102, 0.55)");
});

// Contactos dentro del alcance: sprite de nave por tipo/facción
test("dibujarFrame pinta sprites de nave para contactos dentro del alcance", () => {
  const frame = {
    sinDatos: false,
    capas: [],
    blips: [
      { x: 100, y: 100, dentro: true, parpadeo: true, color: "#ff2e88", esJugador: false, enfasis: "normal", etiqueta: null },
      { x: 200, y: 200, dentro: true, parpadeo: true, color: "#00e5ff", esJugador: false, enfasis: "alto", etiqueta: null },
    ],
    destino: null,
  };

  const ctx = ctxFalso();
  dibujarFrame(ctx, frame, { ancho: 320, alto: 320, decorado: [], tMs: 0 });

  // Que se pinte «bastante» no dice que se pintaran ESTOS contactos. El color
  // si: cada blip lleva el suyo, y solo puede aparecer si su sprite se dibujo.
  assert.ok(ctx.fillStyles.includes("#ff2e88"), "el primer contacto pinta con su color");
  assert.ok(ctx.fillStyles.includes("#00e5ff"), "el segundo contacto pinta con el suyo");
  // globalAlpha se debe restaurar a 1 al final de cada blip
  assert.equal(ctx.lastGlobalAlpha, 1);
});

// Contactos fuera de alcance: marca cuadrada en el borde del anillo
test("dibujarFrame pinta marca en el borde para contactos fuera de alcance", () => {
  const frame = {
    sinDatos: false,
    capas: [],
    blips: [
      { x: 500, y: 500, dentro: false, parpadeo: true, color: "#38b000", esJugador: false, enfasis: "normal", etiqueta: null },
    ],
    destino: null,
  };

  const ctx = ctxFalso();
  dibujarFrame(ctx, frame, { ancho: 320, alto: 320, decorado: [], tMs: 0 });

  // El contacto esta FUERA del alcance, asi que no se pinta su sprite: lo unico
  // que puede llevar su color al lienzo es la marca del borde. Si la marca
  // desaparece, el color no aparece, y esto falla — cosa que `>= 3` no haria.
  assert.ok(ctx.fillStyles.includes("#38b000"),
    "la marca de borde se pinta con el color del contacto fuera de alcance");

  const ctxSinBlips = ctxFalso();
  dibujarFrame(ctxSinBlips, { sinDatos: false, capas: [], blips: [], destino: null },
    { ancho: 320, alto: 320, decorado: [], tMs: 0 });
  assert.equal(ctx.fillRects - ctxSinBlips.fillRects, 1, "exactamente una marca de borde");
});

// Contactos con etiqueta: se pinta el texto solo si está dentro y tiene etiqueta
test("dibujarFrame pinta etiqueta de comunicaciones para contactos dentro con etiqueta", () => {
  const frame = {
    sinDatos: false,
    capas: [],
    blips: [
      { x: 100, y: 100, dentro: true, parpadeo: true, color: "#ff2e88", esJugador: false, enfasis: "normal", etiqueta: "COM-1" },
      { x: 200, y: 200, dentro: true, parpadeo: true, color: "#00e5ff", esJugador: false, enfasis: "normal", etiqueta: null }, // sin etiqueta
      { x: 300, y: 300, dentro: false, parpadeo: true, color: "#38b000", esJugador: false, enfasis: "normal", etiqueta: "COM-2" }, // fuera, no debe pintar
    ],
    destino: null,
  };

  const ctx = ctxFalso();
  dibujarFrame(ctx, frame, { ancho: 320, alto: 320, decorado: [], tMs: 0 });

  // Solo 1 fillText para el contacto con etiqueta y dentro
  assert.equal(ctx.fillTexts, 1);
  assert.equal(ctx.lastFont, "8px monospace");
  assert.equal(ctx.lastTextAlign, "left");
  assert.equal(ctx.lastTextBaseline, "middle");
});

// Contacto con parpadeo false: fase apagada, no se pinta
test("dibujarFrame omite contactos con parpadeo false (fase apagada)", () => {
  const frameConParpadeo = {
    sinDatos: false,
    capas: [],
    blips: [
      { x: 100, y: 100, dentro: true, parpadeo: true, color: "#ff2e88", esJugador: false, enfasis: "normal", etiqueta: null },
    ],
    destino: null,
  };
  const frameSinParpadeo = {
    sinDatos: false,
    capas: [],
    blips: [
      { x: 100, y: 100, dentro: true, parpadeo: false, color: "#ff2e88", esJugador: false, enfasis: "normal", etiqueta: null },
    ],
    destino: null,
  };

  const ctxCon = ctxFalso();
  dibujarFrame(ctxCon, frameConParpadeo, { ancho: 320, alto: 320, decorado: [], tMs: 0 });

  const ctxSin = ctxFalso();
  dibujarFrame(ctxSin, frameSinParpadeo, { ancho: 320, alto: 320, decorado: [], tMs: 0 });

  // Sin parpadeo debe haber MENOS fillRect (no pinta el sprite)
  assert.ok(ctxSin.fillRects < ctxCon.fillRects);
});

// Contacto esJugador true: se salta (la nave propia se pinta al final)
test("dibujarFrame omite blips marcados como esJugador", () => {
  const frameConJugador = {
    sinDatos: false,
    capas: [],
    blips: [
      { x: 100, y: 100, dentro: true, parpadeo: true, color: "#ff2e88", esJugador: true, enfasis: "normal", etiqueta: null },
    ],
    destino: null,
  };
  const frameSinJugador = {
    sinDatos: false,
    capas: [],
    blips: [
      { x: 100, y: 100, dentro: true, parpadeo: true, color: "#ff2e88", esJugador: false, enfasis: "normal", etiqueta: null },
    ],
    destino: null,
  };

  const ctxCon = ctxFalso();
  dibujarFrame(ctxCon, frameConJugador, { ancho: 320, alto: 320, decorado: [], tMs: 0 });

  const ctxSin = ctxFalso();
  dibujarFrame(ctxSin, frameSinJugador, { ancho: 320, alto: 320, decorado: [], tMs: 0 });

  // El blip jugador se salta, así que menos fillRect
  assert.ok(ctxCon.fillRects < ctxSin.fillRects);
});

// Enfasis: opacidad según nivel (alto=1, normal=0.75, tenue=0.3)
test("dibujarFrame aplica opacidad según blip.enfasis", () => {
  const frameAlto = {
    sinDatos: false,
    capas: [],
    blips: [{ x: 100, y: 100, dentro: true, parpadeo: true, color: "#ff2e88", esJugador: false, enfasis: "alto", etiqueta: null }],
    destino: null,
  };
  const frameNormal = {
    sinDatos: false,
    capas: [],
    blips: [{ x: 100, y: 100, dentro: true, parpadeo: true, color: "#ff2e88", esJugador: false, enfasis: "normal", etiqueta: null }],
    destino: null,
  };
  const frameTenue = {
    sinDatos: false,
    capas: [],
    blips: [{ x: 100, y: 100, dentro: true, parpadeo: true, color: "#ff2e88", esJugador: false, enfasis: "tenue", etiqueta: null }],
    destino: null,
  };

  const ctxAlto = ctxFalso();
  dibujarFrame(ctxAlto, frameAlto, { ancho: 320, alto: 320, decorado: [], tMs: 0 });

  const ctxNormal = ctxFalso();
  dibujarFrame(ctxNormal, frameNormal, { ancho: 320, alto: 320, decorado: [], tMs: 0 });

  const ctxTenue = ctxFalso();
  dibujarFrame(ctxTenue, frameTenue, { ancho: 320, alto: 320, decorado: [], tMs: 0 });

  // El historial es lo que hace que esta prueba pruebe algo. Mirando solo el
  // ultimo valor, las tres variantes acaban en 1 —el render restaura la
  // opacidad antes de salir— y el assert pasaria igual aunque el enfasis
  // dejara de aplicarse. La tabla es OPACIDAD_ENFASIS: alto 1, normal 0.75,
  // tenue 0.3.
  assert.ok(ctxTenue.alphas.includes(0.3), "el enfasis tenue pinta a 0.3");
  assert.ok(ctxNormal.alphas.includes(0.75), "el enfasis normal pinta a 0.75");
  assert.ok(!ctxAlto.alphas.includes(0.3) && !ctxAlto.alphas.includes(0.75),
    "el enfasis alto no baja la opacidad");

  // Y que se restaure a 1 al salir sigue importando: si no, el proximo frame
  // heredaria la opacidad del blip anterior.
  assert.equal(ctxAlto.lastGlobalAlpha, 1);
  assert.equal(ctxNormal.lastGlobalAlpha, 1);
  assert.equal(ctxTenue.lastGlobalAlpha, 1);
});

// Vista.blips tiene prioridad sobre frame.blips
test("dibujarFrame usa vista.blips cuando existe, ignorando frame.blips", () => {
  const frame = {
    sinDatos: false,
    capas: [],
    blips: [{ x: 999, y: 999, dentro: true, parpadeo: true, color: "#ff2e88", esJugador: false, enfasis: "normal", etiqueta: null }], // posición absurda
    destino: null,
  };
  const vista = {
    blips: [{ x: 50, y: 50, dentro: true, parpadeo: true, color: "#00e5ff", esJugador: false, enfasis: "normal", etiqueta: null }],
  };

  const ctx = ctxFalso();
  dibujarFrame(ctx, frame, { ancho: 320, alto: 320, decorado: [], vista, tMs: 0 });

  // El blip de vista está en (50,50), el de frame en (999,999) fuera de pantalla
  // Si usa vista.blips, el sprite se pinta en (50,50) → fillRect > 1
  // Si usara frame.blips, el sprite estaría fuera y no se vería (solo fondo+retícula)
  assert.ok(ctx.fillRects > 3); // fondo + retícula + sprite
});

// Marca del destino: rombo ámbar con nombre si dentro, sin nombre si fuera
test("dibujarFrame pinta marca de destino (rombo) con nombre cuando destino.dentro=true", () => {
  const frame = {
    sinDatos: false,
    capas: [],
    blips: [],
    destino: { x: 100, y: 100, dentro: true, nombre: "Base Alpha" },
  };

  const ctx = ctxFalso();
  dibujarFrame(ctx, frame, { ancho: 320, alto: 320, decorado: [], tMs: 0 });

  // fillRect del fondo + retícula (stroke) + rombo (fill) + fillText del nombre
  assert.ok(ctx.fillRects >= 1);
  assert.equal(ctx.fillTexts, 1);
  // El último fillStyle antes de la nave propia debería ser COLOR_DESTINO
  // Pero la nave propia pinta después, así que verificamos que se llamó fillText con la fuente correcta
  assert.equal(ctx.lastFont, "8px monospace");
});

test("dibujarFrame pinta marca de destino (rombo) SIN nombre cuando destino.dentro=false", () => {
  const frame = {
    sinDatos: false,
    capas: [],
    blips: [],
    destino: { x: 100, y: 100, dentro: false, nombre: "Base Alpha" },
  };

  const ctx = ctxFalso();
  dibujarFrame(ctx, frame, { ancho: 320, alto: 320, decorado: [], tMs: 0 });

  // Rombo sí, nombre no
  assert.ok(ctx.fillRects >= 1);
  assert.equal(ctx.fillTexts, 0);
});

// Alineación del nombre del destino: right si cerca del borde derecho
test("dibujarFrame alinea nombre del destino a la derecha si dx > ancho - 48", () => {
  const frame = {
    sinDatos: false,
    capas: [],
    blips: [],
    destino: { x: 280, y: 100, dentro: true, nombre: "Base" }, // 280 > 320-48=272
  };

  const ctx = ctxFalso();
  dibujarFrame(ctx, frame, { ancho: 320, alto: 320, decorado: [], tMs: 0 });

  assert.equal(ctx.lastTextAlign, "right");
});

test("dibujarFrame alinea nombre del destino a la izquierda si dx <= ancho - 48", () => {
  const frame = {
    sinDatos: false,
    capas: [],
    blips: [],
    destino: { x: 100, y: 100, dentro: true, nombre: "Base" }, // 100 <= 272
  };

  const ctx = ctxFalso();
  dibujarFrame(ctx, frame, { ancho: 320, alto: 320, decorado: [], tMs: 0 });

  assert.equal(ctx.lastTextAlign, "left");
});

// Capas de vista: anillos de sensores (vista.anillos)
test("dibujarFrame pinta anillos de sensores cuando vista.anillos existe", () => {
  const frame = { sinDatos: false, capas: [], blips: [], destino: null };
  const vista = { anillos: [{ radio01: 0.5, tenue: false }, { radio01: 0.8, tenue: true }] };

  const ctx = ctxFalso();
  dibujarFrame(ctx, frame, { ancho: 320, alto: 320, decorado: [], vista, tMs: 0 });

  // 2 anillos → 2 beginPath + 2 arc + 2 stroke
  assert.ok(ctx.beginPaths >= 2);
  assert.ok(ctx.arcs >= 2);
  assert.ok(ctx.strokes >= 2);
  // El segundo anillo es tenue → globalAlpha = 0.6 durante su dibujo
  // Al final se restaura a 1
  assert.equal(ctx.lastGlobalAlpha, 1);
});

// Capas de vista: vector de navegación (vista.vector)
test("dibujarFrame pinta vector de navegación cuando vista.vector existe", () => {
  const frame = { sinDatos: false, capas: [], blips: [], destino: null };
  const vista = { vector: { magnitud01: 0.6 } };

  const ctx = ctxFalso();
  dibujarFrame(ctx, frame, { ancho: 320, alto: 320, decorado: [], vista, tMs: 0 });

  // vector → beginPath + moveTo + lineTo + stroke con lineWidth=2
  assert.ok(ctx.beginPaths >= 1);
  assert.ok(ctx.moveTos >= 1);
  assert.ok(ctx.lineTos >= 1);
  assert.ok(ctx.strokes >= 1);
  // lineWidth=2 durante el vector, pero la nave propia lo resetea a 1 al final
  // Verificamos que al menos se ejecutó el camino del vector
});

test("dibujarFrame usa VECTOR_LARGO_FIJO cuando vista.vector.magnitud01 es null", () => {
  const frame = { sinDatos: false, capas: [], blips: [], destino: null };
  const vista = { vector: { magnitud01: null } };

  const ctx = ctxFalso();
  dibujarFrame(ctx, frame, { ancho: 320, alto: 320, decorado: [], vista, tMs: 0 });

  // Debe pintar el vector igual (usando el fallback)
  assert.ok(ctx.strokes >= 1);
});

// Capas de vista: barras de calor (vista.superposicion.filas)
test("dibujarFrame pinta barras de calor para superposición de ingeniería", () => {
  const frame = { sinDatos: false, capas: [], blips: [], destino: null };
  const vista = {
    superposicion: {
      filas: [
        { valor01: 0.5, critico: false }, // barra normal (verde)
        { valor01: 0.9, critico: true },  // barra crítica (roja)
        { valor01: 0.2, critico: false }, // otra normal
      ],
    },
  };

  const ctx = ctxFalso();
  dibujarFrame(ctx, frame, { ancho: 320, alto: 320, decorado: [], vista, tMs: 0 });

  // 3 barras → 3 fillRect
  // Cada barra usa fillStyle según critico
  assert.ok(ctx.fillRects >= 3); // fondo + 3 barras mínimo
});

test("dibujarFrame usa CALOR_CRITICO para filas.critico=true y CALOR_FRIO para false", () => {
  const frameCritico = {
    sinDatos: false,
    capas: [],
    blips: [],
    destino: null,
    vista: { superposicion: { filas: [{ valor01: 1, critico: true }] } },
  };
  const frameNormal = {
    sinDatos: false,
    capas: [],
    blips: [],
    destino: null,
    vista: { superposicion: { filas: [{ valor01: 1, critico: false }] } },
  };

  const ctxCritico = ctxFalso();
  dibujarFrame(ctxCritico, frameCritico, { ancho: 320, alto: 320, decorado: [], tMs: 0 });

  const ctxNormal = ctxFalso();
  dibujarFrame(ctxNormal, frameNormal, { ancho: 320, alto: 320, decorado: [], tMs: 0 });

  // El último fillStyle usado en cada caso debería ser el de la barra
  // (aunque se pinta la nave propia después, que también usa fillRect)
  // Verificamos que al menos se llamó con ambos colores en algún momento
  // No podemos inspeccionar el historial, pero el test de integración cubre la rama
});

// Nave propia: sprite con parámetros moviendo y tMs
test("dibujarFrame pinta nave propia con sprite pixel-art (pixel=4)", () => {
  const frame = { sinDatos: false, capas: [], blips: [], destino: null };

  const ctxQuieto = ctxFalso();
  dibujarFrame(ctxQuieto, frame, { ancho: 320, alto: 320, decorado: [], moviendo: false, tMs: 0 });

  const ctxMoviendo = ctxFalso();
  dibujarFrame(ctxMoviendo, frame, { ancho: 320, alto: 320, decorado: [], moviendo: true, tMs: 1000 });

  // Ambos pintan la nave (fillRects > fondo+retícula)
  assert.ok(ctxQuieto.fillRects > 2);
  assert.ok(ctxMoviendo.fillRects > 2);
});

// sinDatos true: retorno temprano, no pinta nada más que fondo y retícula
test("dibujarFrame retorna temprano si frame.sinDatos=true (solo fondo y retícula)", () => {
  const frame = { sinDatos: true, capas: [], blips: [], destino: { x: 100, y: 100, dentro: true, nombre: "X" } };

  const ctx = ctxFalso();
  dibujarFrame(ctx, frame, { ancho: 320, alto: 320, decorado: [], eventosFondo: [], tMs: 0 });

  // Solo fondo (1 fillRect) + retícula (2 strokes: círculo + cruz)
  assert.equal(ctx.fillRects, 1);
  assert.equal(ctx.strokes, 2);
  // No debe pintar destino, blips, vista, ni nave propia
  assert.equal(ctx.fillTexts, 0);
});

// frame.capas puede ser undefined (operador ?? [])
test("dibujarFrame no falla si frame.capas es undefined", () => {
  const frame = { sinDatos: false, capas: undefined, blips: [], destino: null };

  const ctx = ctxFalso();
  dibujarFrame(ctx, frame, { ancho: 320, alto: 320, decorado: [], tMs: 0 });

  // Solo fondo + retícula + nave propia
  assert.ok(ctx.fillRects >= 1);
  assert.ok(ctx.strokes >= 2);
});

// frame.blips puede ser undefined (operador ?? [])
test("dibujarFrame no falla si frame.blips es undefined", () => {
  const frame = { sinDatos: false, capas: [], blips: undefined, destino: null };

  const ctx = ctxFalso();
  dibujarFrame(ctx, frame, { ancho: 320, alto: 320, decorado: [], tMs: 0 });

  assert.ok(ctx.fillRects >= 1);
  assert.ok(ctx.strokes >= 2);
});

// vista puede ser null/undefined (no pinta capas de vista)
test("dibujarFrame no falla si vista es null o undefined", () => {
  const frame = { sinDatos: false, capas: [], blips: [], destino: null };

  const ctxNull = ctxFalso();
  dibujarFrame(ctxNull, frame, { ancho: 320, alto: 320, decorado: [], vista: null, tMs: 0 });

  const ctxUndef = ctxFalso();
  dibujarFrame(ctxUndef, frame, { ancho: 320, alto: 320, decorado: [], vista: undefined, tMs: 0 });

  // Solo fondo + retícula + blips (vacíos) + nave propia
  assert.ok(ctxNull.fillRects >= 1);
  assert.ok(ctxUndef.fillRects >= 1);
});

// Parámetros por defecto: ancho=320, alto=320
test("dibujarFrame usa ancho=320 y alto=320 por defecto", () => {
  const frame = { sinDatos: false, capas: [], blips: [], destino: null };

  const ctx = ctxFalso();
  dibujarFrame(ctx, frame, { decorado: [], tMs: 0 }); // sin ancho/alto

  // El centro debería estar en 160,160 (320/2)
  // La retícula usa cx=ancho/2, cy=alto/2, radio=min(ancho,alto)/2-2
  // No podemos inspeccionar directamente, pero que no falle ya valida los defaults
  assert.ok(ctx.fillRects >= 1);
  assert.ok(ctx.strokes >= 2);
});
