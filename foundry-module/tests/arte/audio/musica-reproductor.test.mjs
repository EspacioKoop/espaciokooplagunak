import assert from "node:assert/strict";
import test from "node:test";

import { crearReproductor } from "../../../scripts/arte/audio/musica-reproductor.mjs";

/**
 * Doble de Web Audio: registra lo que se programó sin sintetizar nada. Permite
 * probar el reproductor desde Node, que es justo lo que exige el criterio de
 * #344 («testeable sin Foundry ni Web Audio»).
 */
function contextoFalso() {
  const ctx = {
    currentTime: 0,
    sampleRate: 44100,
    destination: { nombre: "salida" },
    osciladores: [],
    ganancias: [],
    reanudado: 0,
    createOscillator() {
      const osc = {
        frequency: { value: 0 },
        inicio: null,
        fin: null,
        parado: false,
        connect() {},
        start(t) {
          osc.inicio = t;
        },
        stop(t) {
          osc.fin = t ?? "ya";
          osc.parado = true;
        },
      };
      ctx.osciladores.push(osc);
      return osc;
    },
    createGain() {
      const g = {
        gain: {
          value: 0,
          eventos: [],
          setValueAtTime(v, t) {
            g.gain.eventos.push(["set", v, t]);
          },
          linearRampToValueAtTime(v, t) {
            g.gain.eventos.push(["lineal", v, t]);
          },
          exponentialRampToValueAtTime(v, t) {
            g.gain.eventos.push(["exp", v, t]);
          },
        },
        connect() {},
      };
      ctx.ganancias.push(g);
      return g;
    },
    async resume() {
      ctx.reanudado += 1;
    },
  };
  return ctx;
}

/** Temporizador manual: nada corre solo, los tramos se encadenan a mano. */
function relojFalso() {
  const pendientes = new Map();
  let id = 0;
  return {
    programar(fn, ms) {
      id += 1;
      pendientes.set(id, { fn, ms });
      return id;
    },
    cancelar(cual) {
      pendientes.delete(cual);
    },
    get cuantos() {
      return pendientes.size;
    },
    disparar() {
      const [cual, tarea] = [...pendientes.entries()].at(-1);
      pendientes.delete(cual);
      tarea.fn();
      return tarea.ms;
    },
  };
}

function nuevo(opciones = {}) {
  const contexto = contextoFalso();
  const reloj = relojFalso();
  const reproductor = crearReproductor({
    contexto,
    programar: reloj.programar,
    cancelar: reloj.cancelar,
    ...opciones,
  });
  return { contexto, reloj, reproductor };
}

test("no suena nada hasta que el usuario lo habilita", () => {
  const { contexto, reproductor } = nuevo();
  reproductor.poner("bach");
  assert.equal(reproductor.habilitado, false);
  assert.equal(contexto.osciladores.length, 0, "audio antes del gesto del usuario");
  // Pero el registro queda anotado: al habilitar, arranca lo que ya se pidió.
  assert.equal(reproductor.registro, "bach");
});

test("habilitar arranca lo que ya se había pedido y es idempotente", async () => {
  const { contexto, reproductor } = nuevo();
  reproductor.poner("bach");
  await reproductor.habilitar();
  assert.ok(contexto.osciladores.length > 0, "debería haber programado notas");
  assert.equal(contexto.reanudado, 1);

  const cuantos = contexto.osciladores.length;
  await reproductor.habilitar();
  assert.equal(contexto.reanudado, 1, "el segundo gesto no vuelve a arrancar");
  assert.equal(contexto.osciladores.length, cuantos);
});

test("cada nota tiene envolvente: ataque, sostén y caída que no llega a cero", async () => {
  const { contexto, reproductor } = nuevo();
  reproductor.poner("mahler");
  await reproductor.habilitar();
  // La primera ganancia es la salida general; las siguientes, las envolventes.
  const sobre = contexto.ganancias[1];
  const tipos = sobre.gain.eventos.map(([tipo]) => tipo);
  assert.deepEqual(tipos, ["set", "lineal", "set", "exp"]);
  const [, destinoFinal] = sobre.gain.eventos.at(-1);
  assert.ok(destinoFinal > 0, "exponentialRamp a 0 exacto es inválido en Web Audio");
});

test("la música de ambiente entra por debajo de las voces de la mesa", async () => {
  const { contexto, reproductor } = nuevo();
  await reproductor.habilitar();
  assert.ok(contexto.ganancias[0].gain.value < 0.5, "la salida general no puede tapar la conversación");
});

test("poner el mismo registro no reinicia: una orden repetida no da un salto", async () => {
  const { contexto, reproductor } = nuevo();
  reproductor.poner("bach");
  await reproductor.habilitar();
  const cuantos = contexto.osciladores.length;
  reproductor.poner("bach");
  assert.equal(contexto.osciladores.length, cuantos);
  assert.equal(contexto.osciladores.filter((o) => o.parado && o.fin === "ya").length, 0);
});

test("cambiar de registro corta lo que sonaba y arranca lo nuevo", async () => {
  const { contexto, reproductor } = nuevo();
  reproductor.poner("bach");
  await reproductor.habilitar();
  const primeros = [...contexto.osciladores];

  reproductor.poner("txalaparta");
  assert.ok(primeros.every((o) => o.fin === "ya"), "lo anterior debe callar de inmediato");
  assert.ok(contexto.osciladores.length > primeros.length, "y debe sonar lo nuevo");
  assert.equal(reproductor.registro, "txalaparta");
});

test("el silencio calla y no deja temporizadores colgando", async () => {
  const { contexto, reproductor, reloj } = nuevo();
  reproductor.poner("bandura");
  await reproductor.habilitar();
  assert.equal(reloj.cuantos, 1, "debe haber un tramo encadenado pendiente");

  reproductor.poner(null);
  assert.equal(reproductor.registro, null);
  assert.equal(reloj.cuantos, 0, "un temporizador vivo resucitaría la música");
  assert.ok(contexto.osciladores.every((o) => o.fin === "ya"));
});

test("los tramos se encadenan solos y no repiten el mismo material", async () => {
  const { contexto, reproductor, reloj } = nuevo();
  reproductor.poner("bach");
  await reproductor.habilitar();
  const primero = contexto.osciladores.map((o) => o.frequency.value);

  const espera = reloj.disparar();
  assert.ok(espera > 0, "el encadenado no puede programarse en el pasado");
  const segundo = contexto.osciladores.slice(primero.length).map((o) => o.frequency.value);
  assert.ok(segundo.length > 0, "debería haber sonado un tramo nuevo");
  assert.notDeepEqual(segundo, primero, "un bucle idéntico cansa a la tercera vuelta");
  assert.equal(reloj.cuantos, 1, "y debe quedar programado el siguiente");
});

test("misma semilla, misma música: la mesa entera oye lo mismo sin sincronizar nada", async () => {
  const a = nuevo({ semilla: "mesa-1" });
  const b = nuevo({ semilla: "mesa-1" });
  const c = nuevo({ semilla: "mesa-2" });
  for (const { reproductor } of [a, b, c]) {
    reproductor.poner("bandura");
    await reproductor.habilitar();
  }
  const frecuencias = ({ contexto }) => contexto.osciladores.map((o) => o.frequency.value);
  assert.deepEqual(frecuencias(a), frecuencias(b));
  assert.notDeepEqual(frecuencias(a), frecuencias(c));
});

test("detener deja el reproductor inactivo, sin perder el gesto del usuario", async () => {
  const { contexto, reproductor, reloj } = nuevo();
  reproductor.poner("bach");
  await reproductor.habilitar();
  reproductor.detener();
  assert.equal(reproductor.registro, null);
  assert.equal(reloj.cuantos, 0);
  // Antes esto quedaba en `true`, y era el bug: el botón alternante entraba
  // otra vez en el ramal de cortar y la música no volvía sin recargar.
  assert.equal(reproductor.habilitado, false);
  // El gesto sí se conserva: no se crea una salida nueva ni se vuelve a
  // reanudar el contexto al reactivar.
  const gananciasAntes = contexto.ganancias.length;
  await reproductor.habilitar();
  assert.equal(contexto.reanudado, 2, "resume es idempotente y barato, se puede repetir");
  assert.equal(contexto.ganancias.length, gananciasAntes, "no debe duplicar la salida general");
});

test("activar → cortar → activar vuelve a sonar, que es el contrato del botón", async () => {
  const { contexto, reproductor } = nuevo();
  reproductor.poner("bach");
  await reproductor.habilitar();
  const trasPrimera = contexto.osciladores.length;
  assert.ok(trasPrimera > 0);

  reproductor.detener();
  assert.equal(reproductor.habilitado, false);

  // El cableado real reaplica el mando vigente antes de reactivar, igual que
  // hace `alternarAudioLocal` en main.mjs.
  reproductor.poner("bach");
  await reproductor.habilitar();
  assert.ok(
    contexto.osciladores.length > trasPrimera,
    "el segundo encendido debe programar notas nuevas, no quedarse mudo",
  );
  assert.equal(reproductor.habilitado, true);
  assert.equal(reproductor.registro, "bach");
});

test("ningún parcial se programa por encima de Nyquist", async () => {
  const { contexto, reproductor } = nuevo();
  // La txalaparta tiene parciales inarmónicos hasta 13,3× el fundamental: es el
  // registro con más riesgo de aliasing.
  reproductor.poner("txalaparta");
  await reproductor.habilitar();
  assert.ok(contexto.osciladores.length > 0);
  for (const osc of contexto.osciladores) {
    assert.ok(osc.frequency.value < contexto.sampleRate / 2, `aliasing a ${osc.frequency.value} Hz`);
  }
});
