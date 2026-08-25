// Reproductor de ficheros de audio para la playa (#571).

import assert from "node:assert/strict";
import test from "node:test";

import { CATALOGO, crearReproductorDePlaya } from "../scripts/audio-playa.mjs";

/* ---- dobles ---------------------------------------------------------------- */

function contextoFalso() {
  const creados = { fuentes: [], ganancias: [] };
  const ganancia = () => {
    const g = {
      value: 0,
      cancelScheduledValues() {},
      setValueAtTime(v) {
        this.value = v;
      },
      linearRampToValueAtTime(v) {
        this.value = v;
      },
    };
    const nodo = { gain: g, connect() {} };
    creados.ganancias.push(nodo);
    return nodo;
  };
  return {
    creados,
    currentTime: 0,
    destination: {},
    createGain: ganancia,
    createBufferSource() {
      const f = {
        buffer: null,
        loop: false,
        onended: null,
        parado: false,
        connect() {},
        start() {
          this.arrancado = true;
        },
        stop() {
          this.parado = true;
        },
      };
      creados.fuentes.push(f);
      return f;
    },
    decodeAudioData: async (datos) => ({ decodificado: datos }),
  };
}

const cargarFalso = (ruta) => `datos:${ruta}`;

/* ---- catálogo -------------------------------------------------------------- */

test("el catálogo declara el mar con su procedencia", () => {
  assert.ok(CATALOGO.mar);
  assert.equal(CATALOGO.mar.ruta, "data/audio/mar.wav");
  assert.equal(CATALOGO.mar.bucle, true);
  assert.equal(CATALOGO.mar.volumen, 0.4);
  assert.equal(CATALOGO.mar.procedencia.fuente, "OpenGameArt.org (Jasinski)");
  assert.equal(CATALOGO.mar.procedencia.licencia, "CC0 1.0");
  assert.equal(
    CATALOGO.mar.procedencia.enlace,
    "https://opengameart.org/content/beach-ocean-waves",
  );
});

test("el catálogo está congelado", () => {
  assert.ok(Object.isFrozen(CATALOGO));
  assert.ok(Object.isFrozen(CATALOGO.mar));
  assert.ok(Object.isFrozen(CATALOGO.mar.procedencia));
});

/* ---- reproductor ----------------------------------------------------------- */

test("crearReproductorDePlaya devuelve un reproductor cableado al catálogo", () => {
  const contexto = contextoFalso();
  const r = crearReproductorDePlaya({ contexto, cargar: cargarFalso });
  assert.equal(r.conoce("mar"), true);
  assert.equal(r.conoce("inexistente"), false);
});

test("suena el mar en bucle con rampa", async () => {
  const contexto = contextoFalso();
  const r = crearReproductorDePlaya({ contexto, cargar: cargarFalso });
  const mando = await r.sonar("mar");
  assert.ok(mando);
  assert.equal(contexto.creados.fuentes.length, 1);
  assert.equal(contexto.creados.fuentes[0].loop, true);
  assert.ok(contexto.creados.fuentes[0].arrancado);
  const g = contexto.creados.ganancias.at(-1).gain;
  assert.ok(g.value > 0, "acaba en su volumen");
});

test("pararTodo deja la escena en silencio", async () => {
  const contexto = contextoFalso();
  const r = crearReproductorDePlaya({ contexto, cargar: cargarFalso });
  await r.sonar("mar");
  await r.sonar("mar");
  r.pararTodo();
  assert.equal(r.activos, 0);
});

test("un nombre mal escrito revienta al pedirlo", async () => {
  const contexto = contextoFalso();
  const r = crearReproductorDePlaya({ contexto, cargar: cargarFalso });
  assert.equal(r.conoce("mar"), true);
  assert.equal(r.conoce("marr"), false);
  await assert.rejects(() => r.sonar("marr"), /no está en el catálogo/);
});