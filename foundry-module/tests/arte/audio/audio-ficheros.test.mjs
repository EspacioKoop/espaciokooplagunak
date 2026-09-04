// El reproductor de ficheros de audio (#571).

import assert from "node:assert/strict";
import test from "node:test";

import {
  MAXIMO_SIMULTANEOS,
  crearReproductorDeFicheros,
  declararSonidos,
} from "../../../scripts/arte/audio/audio-ficheros.mjs";

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

const CATALOGO = declararSonidos({
  ola: {
    ruta: "audio/ola.ogg",
    bucle: true,
    procedencia: { fuente: "prueba", licencia: "CC0 1.0", enlace: "https://example.invalid" },
  },
  puerta: {
    ruta: "audio/puerta.ogg",
    procedencia: { fuente: "prueba", licencia: "CC0 1.0", enlace: "https://example.invalid" },
  },
});

const cargarFalso = (ruta) => `datos:${ruta}`;

/* ---- la procedencia es obligatoria ----------------------------------------- */

test("un sonido sin licencia no se puede ni declarar", () => {
  // La comprobación va aquí y no en una prueba a propósito: un sonido sin
  // procedencia no debe llegar a sonar NI EN DESARROLLO, porque en desarrollo es
  // donde se cuela.
  assert.throws(
    () => declararSonidos({ x: { ruta: "a.ogg", procedencia: { fuente: "y", enlace: "z" } } }),
    /licencia/,
  );
});

test("el error dice qué sonido y qué campo falta", () => {
  try {
    declararSonidos({ trueno: { ruta: "t.ogg", procedencia: { licencia: "CC0", enlace: "z" } } });
    assert.fail("tenía que haber roto");
  } catch (error) {
    assert.match(error.message, /trueno/);
    assert.match(error.message, /fuente/);
  }
});

test("el catálogo sale congelado, con su procedencia dentro", () => {
  assert.ok(Object.isFrozen(CATALOGO));
  assert.equal(CATALOGO.ola.procedencia.licencia, "CC0 1.0");
});

/* ---- sonar ----------------------------------------------------------------- */

test("suena, y en bucle si lo declara", async () => {
  const contexto = contextoFalso();
  const r = crearReproductorDeFicheros({ contexto, catalogo: CATALOGO, cargar: cargarFalso });
  await r.sonar("ola");
  assert.equal(contexto.creados.fuentes.length, 1);
  assert.equal(contexto.creados.fuentes[0].loop, true);
  assert.ok(contexto.creados.fuentes[0].arrancado);
});

test("entra en rampa, no de golpe", async () => {
  // Una forma de onda que empieza lejos del cero chasquea, y ese clic delata un
  // reproductor casero antes que ninguna otra cosa.
  const contexto = contextoFalso();
  const r = crearReproductorDeFicheros({ contexto, catalogo: CATALOGO, cargar: cargarFalso });
  await r.sonar("puerta");
  const g = contexto.creados.ganancias.at(-1).gain;
  assert.ok(g.value > 0, "acaba en su volumen");
});

test("el búfer se decodifica UNA vez por ruta", async () => {
  // Decodificar es caro y el mismo sonido se pide muchas veces: hacerlo en cada
  // disparo se oiría como un tirón.
  let veces = 0;
  const contexto = contextoFalso();
  const r = crearReproductorDeFicheros({
    contexto,
    catalogo: CATALOGO,
    cargar: (ruta) => {
      veces += 1;
      return `datos:${ruta}`;
    },
  });
  await Promise.all([r.sonar("puerta"), r.sonar("puerta"), r.sonar("puerta")]);
  assert.equal(veces, 1);
});

test("hay tope de sonidos a la vez", async () => {
  // Sin tope, un fallo de lógica encadena cientos y satura la salida.
  const contexto = contextoFalso();
  const r = crearReproductorDeFicheros({ contexto, catalogo: CATALOGO, cargar: cargarFalso });
  for (let i = 0; i < MAXIMO_SIMULTANEOS + 4; i += 1) await r.sonar("ola");
  assert.equal(r.activos, MAXIMO_SIMULTANEOS);
});

test("un sonido de una vez se descuenta al acabar", async () => {
  // Si no, el tope se llena de sonidos que ya no suenan y la escena se queda muda.
  const contexto = contextoFalso();
  const r = crearReproductorDeFicheros({ contexto, catalogo: CATALOGO, cargar: cargarFalso });
  await r.sonar("puerta");
  assert.equal(r.activos, 1);
  contexto.creados.fuentes.at(-1).onended();
  assert.equal(r.activos, 0);
});

test("parar corta con rampa y descuenta", async () => {
  const contexto = contextoFalso();
  const r = crearReproductorDeFicheros({ contexto, catalogo: CATALOGO, cargar: cargarFalso });
  const mando = await r.sonar("ola");
  mando.parar();
  assert.equal(r.activos, 0);
  assert.ok(contexto.creados.fuentes.at(-1).parado);
});

test("pararTodo deja la escena en silencio", async () => {
  // Lo pide cualquier cambio de estancia: los sonidos de un sitio no pueden
  // seguir oyéndose en otro.
  const contexto = contextoFalso();
  const r = crearReproductorDeFicheros({ contexto, catalogo: CATALOGO, cargar: cargarFalso });
  await r.sonar("ola");
  await r.sonar("ola");
  r.pararTodo();
  assert.equal(r.activos, 0);
});

test("un nombre mal escrito revienta al pedirlo, no en silencio", async () => {
  const contexto = contextoFalso();
  const r = crearReproductorDeFicheros({ contexto, catalogo: CATALOGO, cargar: cargarFalso });
  assert.equal(r.conoce("ola"), true);
  assert.equal(r.conoce("olaa"), false);
  await assert.rejects(() => r.sonar("olaa"), /no está en el catálogo/);
});
