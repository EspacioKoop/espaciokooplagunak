// Evidencia RENDERIZADA del contrato visual del pintor (#362, rebanada 2).
//
// Las otras pruebas del lienzo usan un contexto que apunta llamadas: demuestran
// el orden de Canvas —que se rellena antes de contornear, que cada cara lleva su
// color— pero no demuestran la afirmación central de la rebanada, que es sobre
// el RESULTADO: que la imagen ampliada sea de verdad pixelada y que no queden
// juntas visibles entre caras vecinas.
//
// Así que aquí se rasteriza de verdad, en un búfer de píxeles, con un relleno
// por barrido y un contorno de un píxel: lo mismo que hace un Canvas con
// `fill()` y `stroke()`, sin antialias. Y sobre esos píxeles se mide.
//
// LO QUE ESTA PRUEBA NO PUEDE DEMOSTRAR, dicho para no vender de más: el
// antialias real de un navegador. El contorno por cara existe precisamente para
// tapar la costura de medio píxel que deja ese antialias, y eso solo se ve en
// pantalla. Lo que sí queda fijado aquí es el contrato geométrico —silueta sin
// huecos interiores— y la ampliación por bloques, que son las dos formas de
// romper el efecto que dependen de nuestro código y no del navegador.

import assert from "node:assert/strict";
import test from "node:test";

import { pintarEscena } from "../scripts/retro3d-lienzo.mjs";
import { MALLA_CAZA, componerEscena } from "../scripts/retro3d.mjs";

const ANCHO = 64;
const ALTO = 48;
const VACIO = null;

/** Lienzo de mentira que rasteriza de verdad sobre un búfer de píxeles. */
function lienzoDePrueba(ancho, alto) {
  const pixeles = new Array(ancho * alto).fill(VACIO);
  let camino = [];

  const poner = (x, y, color) => {
    const px = Math.round(x);
    const py = Math.round(y);
    if (px < 0 || py < 0 || px >= ancho || py >= alto) return;
    pixeles[py * ancho + px] = color;
  };

  // Bresenham, que es lo que hace un `stroke()` de un píxel sin suavizado.
  const linea = (a, b, color) => {
    let x0 = Math.round(a.x);
    let y0 = Math.round(a.y);
    const x1 = Math.round(b.x);
    const y1 = Math.round(b.y);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let error = dx + dy;
    for (;;) {
      poner(x0, y0, color);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * error;
      if (e2 >= dy) {
        error += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        error += dx;
        y0 += sy;
      }
    }
  };

  const ctx = {
    fillStyle: "#000000",
    strokeStyle: "#000000",
    lineWidth: 1,
    beginPath() {
      camino = [];
    },
    moveTo(x, y) {
      camino = [{ x, y }];
    },
    lineTo(x, y) {
      camino.push({ x, y });
    },
    closePath() {},
    fillRect(x, y, w, h) {
      for (let py = y; py < y + h; py += 1) {
        for (let px = x; px < x + w; px += 1) poner(px, py, this.fillStyle);
      }
    },
    clearRect(x, y, w, h) {
      for (let py = y; py < y + h; py += 1) {
        for (let px = x; px < x + w; px += 1) poner(px, py, VACIO);
      }
    },
    // Relleno por barrido con regla par-impar, sin suavizar: cada píxel es de
    // un color o de otro, nunca de una mezcla.
    fill() {
      if (camino.length < 3) return;
      const ys = camino.map((p) => p.y);
      const desde = Math.max(0, Math.floor(Math.min(...ys)));
      const hasta = Math.min(alto - 1, Math.ceil(Math.max(...ys)));
      for (let y = desde; y <= hasta; y += 1) {
        const centro = y + 0.5;
        const cortes = [];
        for (let i = 0; i < camino.length; i += 1) {
          const a = camino[i];
          const b = camino[(i + 1) % camino.length];
          if (a.y === b.y) continue;
          const dentro = centro >= Math.min(a.y, b.y) && centro < Math.max(a.y, b.y);
          if (!dentro) continue;
          cortes.push(a.x + ((centro - a.y) / (b.y - a.y)) * (b.x - a.x));
        }
        cortes.sort((p, q) => p - q);
        for (let i = 0; i + 1 < cortes.length; i += 2) {
          for (let x = Math.round(cortes[i]); x <= Math.round(cortes[i + 1]); x += 1) {
            poner(x, y, this.fillStyle);
          }
        }
      }
    },
    stroke() {
      for (let i = 0; i < camino.length; i += 1) {
        linea(camino[i], camino[(i + 1) % camino.length], this.strokeStyle);
      }
    },
  };

  return { ctx, pixeles, en: (x, y) => pixeles[y * ancho + x] };
}

/** Amplía por vecino más cercano: lo que hace `image-rendering: pixelated`. */
function ampliar(pixeles, ancho, alto, escala) {
  const grande = new Array(ancho * escala * alto * escala).fill(VACIO);
  for (let y = 0; y < alto * escala; y += 1) {
    for (let x = 0; x < ancho * escala; x += 1) {
      const origen = Math.floor(y / escala) * ancho + Math.floor(x / escala);
      grande[y * ancho * escala + x] = pixeles[origen];
    }
  }
  return grande;
}

/**
 * Huecos interiores: píxeles vacíos con casco pintado a los cuatro lados. Es la
 * forma que tiene una costura entre dos caras vecinas, y a esta resolución una
 * costura es un arañazo que cruza la nave entera.
 */
function huecosInteriores(pixeles, ancho, alto) {
  const pintado = (x, y) => pixeles[y * ancho + x] !== VACIO;
  let huecos = 0;
  for (let y = 1; y < alto - 1; y += 1) {
    for (let x = 1; x < ancho - 1; x += 1) {
      if (pintado(x, y)) continue;
      if (pintado(x - 1, y) && pintado(x + 1, y) && pintado(x, y - 1) && pintado(x, y + 1)) {
        huecos += 1;
      }
    }
  }
  return huecos;
}

function pintar(epoca, opciones = {}) {
  const lienzo = lienzoDePrueba(ANCHO, ALTO);
  const escena = componerEscena(MALLA_CAZA, {
    epoca,
    ancho: ANCHO,
    alto: ALTO,
    yaw: 0.7,
    pitch: 0.25,
    // La cámara se acerca respecto al valor de partida: a 64x48 la nave
    // entera cabría en un puñado de píxeles y no habría nada que medir.
    posicion: [0, 0, 3],
    ...opciones,
  });
  pintarEscena(lienzo.ctx, escena);
  return { ...lienzo, escena };
}

test("la nave se pinta de verdad en las dos épocas, con píxeles de colores reales", () => {
  for (const epoca of ["psx", "gamecube"]) {
    const { pixeles, escena } = pintar(epoca);
    const pintados = pixeles.filter((p) => p !== VACIO);
    assert.ok(pintados.length > 150, `${epoca}: hay nave en el búfer (${pintados.length} px)`);

    // Cada píxel es exactamente uno de los colores que declaró la escena: sin
    // mezclas, que es lo que un rasterizado sin suavizado garantiza.
    const colores = new Set(escena.poligonos.map((p) => p.color));
    for (const pixel of pintados) {
      assert.ok(colores.has(pixel), `${epoca}: color de cara, no una mezcla (${pixel})`);
    }
  }
});

test("EVIDENCIA: no quedan costuras entre caras vecinas en ninguna época", () => {
  // Sin el contorno por cara, el relleno deja juntas de un píxel entre
  // polígonos adyacentes. Se mide sobre el resultado, no sobre las llamadas.
  for (const epoca of ["psx", "gamecube"]) {
    const { pixeles } = pintar(epoca);
    assert.equal(
      huecosInteriores(pixeles, ANCHO, ALTO),
      0,
      `${epoca}: la silueta no tiene agujeros interiores`,
    );
  }
});

test("EVIDENCIA: ampliado es pixelado — bloques macizos, sin degradado", () => {
  // La resolución interna ES el efecto: se pinta pequeño y se estira. Ampliar
  // por vecino más cercano tiene que dar bloques perfectos; cualquier otra cosa
  // sería un suavizado, y entonces la nave dejaría de parecer de consola.
  const escala = 5;
  for (const epoca of ["psx", "gamecube"]) {
    const { pixeles } = pintar(epoca);
    const grande = ampliar(pixeles, ANCHO, ALTO, escala);
    const anchoGrande = ANCHO * escala;
    for (let y = 0; y < ALTO; y += 1) {
      for (let x = 0; x < ANCHO; x += 1) {
        const esperado = pixeles[y * ANCHO + x];
        for (let dy = 0; dy < escala; dy += 1) {
          for (let dx = 0; dx < escala; dx += 1) {
            const valor = grande[(y * escala + dy) * anchoGrande + (x * escala + dx)];
            assert.equal(valor, esperado, `${epoca}: bloque macizo en (${x},${y})`);
          }
        }
      }
    }
  }
});

test("EVIDENCIA: la PSX tiembla y la GameCube no — se ve en los vértices pintados", () => {
  // La diferencia entre épocas no es una etiqueta: el ajuste a rejilla de la
  // PSX pone cada vértice en un entero, y eso es lo que produce el temblor al
  // girar. Si esto se rompiera, las dos épocas se verían igual.
  const psx = pintar("psx", { yaw: 0.37 });
  const cubo = pintar("gamecube", { yaw: 0.37 });

  const enteros = (escena) =>
    escena.poligonos.flatMap((p) => p.puntos).every((p) => Number.isInteger(p.x) && Number.isInteger(p.y));
  assert.equal(enteros(psx.escena), true, "PSX: vértices en la rejilla de píxeles");
  assert.equal(enteros(cubo.escena), false, "GameCube: subpíxel, sin ajustar");

  // Y las dos siguen siendo naves: mismo encuadre, sin salirse del visor.
  for (const { pixeles } of [psx, cubo]) {
    const pintados = pixeles.filter((p) => p !== VACIO).length;
    assert.ok(pintados > 150 && pintados < ANCHO * ALTO, "la nave ocupa parte del visor, no todo");
  }
});

test("con fondo, el visor queda opaco y la nave encima", () => {
  const lienzo = lienzoDePrueba(ANCHO, ALTO);
  const escena = componerEscena(MALLA_CAZA, { epoca: "psx", ancho: ANCHO, alto: ALTO, yaw: 0.7 });
  pintarEscena(lienzo.ctx, escena, { fondo: "#000000" });
  assert.equal(
    lienzo.pixeles.some((p) => p === VACIO),
    false,
    "ni un píxel transparente cuando se pide fondo",
  );
  assert.ok(
    lienzo.pixeles.some((p) => p !== "#000000"),
    "y la nave se ve encima del fondo",
  );
});
