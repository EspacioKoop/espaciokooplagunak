// El pintado del visor del piloto (#362).
//
// Lo afirmable aquí no es geometría —eso ya lo cubre `visor-piloto.test.mjs`—
// sino las tres decisiones de la superficie: dónde se pinta y dónde no, que un
// visor apagado se LIMPIA en vez de quedarse con el sondeo anterior congelado, y
// que el rumbo del modelo llega de verdad a la escena.

import assert from "node:assert/strict";
import test from "node:test";

import { SELECTOR, pintarVisorPiloto } from "../../scripts/visor-piloto/visor-piloto-lienzo.mjs";

/** Contexto 2D de mentira que apunta lo que le piden. */
function ctxFalso() {
  return {
    rects: [],
    limpiezas: [],
    trazos: 0,
    fillStyle: null,
    strokeStyle: null,
    lineWidth: 1,
    fillRect(x, y, w, h) {
      this.rects.push({ x, y, w, h, estilo: this.fillStyle });
    },
    clearRect(x, y, w, h) {
      this.limpiezas.push({ x, y, w, h });
    },
    beginPath() {},
    moveTo() {},
    lineTo() {},
    closePath() {},
    fill() {
      this.trazos += 1;
    },
    stroke() {},
  };
}

/** Raíz de mentira con un solo lienzo en la ranura del visor. */
function raizConLienzo({ ancho = 192, alto = 108 } = {}) {
  const ctx = ctxFalso();
  const lienzo = { width: ancho, height: alto, getContext: () => ctx };
  return {
    ctx,
    raiz: { querySelector: (selector) => (selector === SELECTOR ? lienzo : null) },
  };
}

const SONDEO = {
  alcance: { corto: 5000, largo: 30000 },
  contactos: [
    {
      banda: "corto",
      esJugador: false,
      callsign: "CN-1",
      faction: "Human Navy",
      distancia: 2000,
      rumboDeg: 10,
      precision: 10,
      rumboPrecision: 1,
    },
  ],
};

test("sin lienzo no se pinta: esta consola no es la de pilotaje", () => {
  // Las demás consolas comparten plantilla y NO tienen la ranura del visor.
  // Buscarla y no encontrarla es lo normal, no un error que haya que avisar.
  assert.equal(pintarVisorPiloto({ querySelector: () => null }, { sensores: SONDEO }), null);
  assert.equal(pintarVisorPiloto(null, { sensores: SONDEO }), null);
  assert.equal(pintarVisorPiloto(undefined, null), null);
});

test("hay lienzo y hay sondeo: se pinta", () => {
  const { ctx, raiz } = raizConLienzo();
  const escena = pintarVisorPiloto(raiz, { sensores: SONDEO, cascoRumbo: 0 });
  assert.notEqual(escena, null);
  assert.equal(escena.dibujados, 1);
  assert.ok(ctx.trazos > 0, "no ha llegado ni un polígono al lienzo");
  // El tamaño del búfer sale del propio lienzo y no de una constante paralela.
  assert.equal(escena.ancho, 192);
  assert.equal(escena.alto, 108);
});

test("sin sondeo se LIMPIA, que no es lo mismo que no hacer nada", () => {
  // Dejar el fotograma anterior en pantalla haría pasar por actual un sondeo
  // viejo, que es exactamente la mentira que el cuarto estado (#353) evita.
  const { ctx, raiz } = raizConLienzo();
  assert.equal(pintarVisorPiloto(raiz, { sensores: null }), null);
  assert.equal(ctx.limpiezas.length, 1);
  assert.deepEqual(ctx.limpiezas[0], { x: 0, y: 0, w: 192, h: 108 });
  assert.equal(ctx.trazos, 0);
  assert.equal(ctx.rects.length, 0, "apagado es limpio del todo: ni cielo");
});

test("un sondeo vacío SÍ se pinta, porque «he mirado y no hay nada» es un dato", () => {
  const { ctx, raiz } = raizConLienzo();
  const escena = pintarVisorPiloto(raiz, { sensores: { contactos: [], alcance: { largo: 30000 } } });
  assert.notEqual(escena, null);
  assert.equal(escena.dibujados, 0);
  // Lo que separa «apagado» de «vacío» no es la limpieza —un fotograma
  // transparente SIEMPRE empieza limpiando— sino que aquí se llega a pintar
  // algo: el cielo. Un visor apagado deja el lienzo limpio y ya está.
  assert.ok(ctx.rects.length > 0, "el vacío se ve con su cielo");
  assert.ok(escena.estrellas.length > 0);
});

test("el rumbo del modelo llega a la escena y mueve el sector", () => {
  const centro = (escena) => {
    const xs = escena.poligonos.flatMap((p) => p.puntos.map((punto) => punto.x));
    return xs.reduce((a, b) => a + b, 0) / xs.length;
  };
  const uno = pintarVisorPiloto(raizConLienzo().raiz, { sensores: SONDEO, cascoRumbo: 0 });
  const otro = pintarVisorPiloto(raizConLienzo().raiz, { sensores: SONDEO, cascoRumbo: 90 });
  assert.ok(centro(uno) !== centro(otro), "el rumbo del modelo no está entrando");
});

test("sin lectura de rumbo no se resta un cero disfrazado", () => {
  // `cascoRumbo` es null cuando no hay lectura (#353), y ahí el visor enseña
  // marcaciones absolutas: peor que restarlas bien, mucho mejor que fingir que
  // la nave apunta al norte.
  const sinRumbo = pintarVisorPiloto(raizConLienzo().raiz, { sensores: SONDEO, cascoRumbo: null });
  const conCero = pintarVisorPiloto(raizConLienzo().raiz, { sensores: SONDEO, cascoRumbo: 0 });
  assert.deepEqual(sinRumbo.poligonos, conCero.poligonos);
});
