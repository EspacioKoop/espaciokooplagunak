import assert from "node:assert/strict";
import test from "node:test";

import {
  generarPieza,
  frecuencia,
  registroParaAlerta,
  REGISTROS,
} from "../scripts/musica-procedural.mjs";

test("misma semilla, misma pieza: la mesa oye lo mismo sin sincronizar audio", () => {
  const a = generarPieza("guardia-1", { registro: "bach" });
  const b = generarPieza("guardia-1", { registro: "bach" });
  assert.deepEqual(a, b);
  const c = generarPieza("guardia-2", { registro: "bach" });
  assert.notDeepEqual(a.notas, c.notas);
});

test("un registro desconocido falla cerrado", () => {
  for (const malo of ["mozart", "", null, 7]) {
    assert.throws(() => generarPieza("s", { registro: malo }), RangeError);
  }
});

test("las notas caen en un rango audible y sensato", () => {
  for (const registro of REGISTROS) {
    const { notas } = generarPieza("s", { registro, compases: 12 });
    assert.ok(notas.length > 0);
    for (const n of notas) {
      assert.ok(n.midi >= 36 && n.midi <= 91, `${registro}: nota fuera de rango ${n.midi}`);
      assert.ok(Number.isInteger(n.midi));
      assert.ok(n.duracionMs > 0);
      assert.ok(n.inicioMs >= 0);
      assert.ok(n.intensidad > 0 && n.intensidad <= 1);
    }
  }
});

test("los parámetros absurdos se acotan en vez de romper", () => {
  const lento = generarPieza("s", { bpm: -50 });
  assert.equal(lento.bpm, 30);
  const rapido = generarPieza("s", { bpm: 10000 });
  assert.equal(rapido.bpm, 200);
  assert.equal(generarPieza("s", { compases: 0 }).notas.length > 0, true);
  assert.equal(generarPieza("s", { compases: 9999 }).duracionMs > 0, true);
  assert.doesNotThrow(() => generarPieza("s", { tonica: "x", bpm: "y", compases: "z" }));
});

test("las notas salen ordenadas por tiempo y la duración cubre la última", () => {
  const { notas, duracionMs } = generarPieza("s", { registro: "mahler", compases: 6 });
  for (let i = 1; i < notas.length; i += 1) {
    assert.ok(notas[i].inicioMs >= notas[i - 1].inicioMs, "desordenada");
  }
  const ultimoFin = Math.max(...notas.map((n) => n.inicioMs + n.duracionMs));
  assert.equal(duracionMs, ultimoFin);
});

test("bach dialoga a varias voces; mahler pesa en bloque", () => {
  const bach = generarPieza("s", { registro: "bach", compases: 4 });
  const mahler = generarPieza("s", { registro: "mahler", compases: 4 });

  // Bach: la respuesta imita a la guía, así que ambas voces existen.
  const voces = new Set(bach.notas.map((n) => n.voz));
  assert.ok(voces.has("guia") && voces.has("respuesta"), "falta el diálogo imitativo");

  // Mahler: acordes simultáneos — varias notas comparten instante de ataque.
  const porInicio = new Map();
  for (const n of mahler.notas) porInicio.set(n.inicioMs, (porInicio.get(n.inicioMs) ?? 0) + 1);
  assert.ok([...porInicio.values()].some((c) => c >= 3), "falta el bloque de acorde");

  // Y sus notas duran más: es marcha, no contrapunto.
  const mediaBach = bach.notas.reduce((s, n) => s + n.duracionMs, 0) / bach.notas.length;
  const mediaMahler = mahler.notas.reduce((s, n) => s + n.duracionMs, 0) / mahler.notas.length;
  assert.ok(mediaMahler > mediaBach, "la marcha debe sostener más que el contrapunto");
});

test("la frecuencia sigue el temperamento igual con La4 = 440", () => {
  assert.equal(Math.round(frecuencia(69)), 440);
  assert.equal(Math.round(frecuencia(81)), 880, "una octava arriba dobla");
  assert.equal(Math.round(frecuencia(57)), 220, "una octava abajo mitad");
});

test("la música sigue a la ficción: la alerta elige el registro", () => {
  assert.equal(registroParaAlerta("verde"), "bach");
  assert.equal(registroParaAlerta("amarilla"), "mahler");
  assert.equal(registroParaAlerta("roja"), "mahler");
  // Un nivel desconocido no debe dejar la mesa en silencio ni en marcha fúnebre.
  assert.equal(registroParaAlerta(undefined), "bach");
  assert.equal(registroParaAlerta("loQueSea"), "bach");
});

test("no se distribuye obra ajena: el módulo no contiene melodía citable", async () => {
  // Guardia de intención: la legalidad de esto depende de que las notas se
  // GENEREN, no de que estén escritas en el fuente. Si alguien pega una
  // transcripción, este test debe estorbar.
  const fuente = await import("node:fs/promises").then((fs) =>
    fs.readFile(new URL("../scripts/musica-procedural.mjs", import.meta.url), "utf8"),
  );
  const listaLargaDeNotas = /\[\s*(?:\d{2,3}\s*,\s*){7,}/;
  assert.doesNotMatch(fuente, listaLargaDeNotas, "parece una transcripción literal");
});

// ---- Cozy: acogedor, no mecánico ------------------------------------------

test("el registro calmado respira y se apoya en un pedal cálido", () => {
  const { notas, duracionMs } = generarPieza("s", { registro: "bach", compases: 8 });

  // Pedal: una sola nota grave que sostiene TODA la pieza. Es lo que hace que
  // el contrapunto acompañe en vez de exigir seguimiento.
  const pedal = notas.filter((n) => n.voz === "pedal");
  assert.equal(pedal.length, 1);
  assert.equal(pedal[0].duracionMs, duracionMs, "el pedal debe cubrir la pieza entera");
  assert.ok(pedal[0].intensidad < 0.25, "y quedarse debajo, sin taparlo todo");

  // Respira: hay compases donde la voz guía calla. Sin silencio no es música de
  // fondo agradable, es goteo.
  const compasesConGuia = new Set(
    notas.filter((n) => n.voz === "guia").map((n) => Math.floor(n.inicioMs / (duracionMs / 8))),
  );
  assert.ok(compasesConGuia.size < 8, "la voz guía nunca calla");
});

test("lo cotidiano suena más suave que la tensión", () => {
  const calma = generarPieza("s", { registro: "bach", compases: 8 });
  const tension = generarPieza("s", { registro: "mahler", compases: 8 });

  const pico = (p) => Math.max(...p.notas.map((n) => n.intensidad));
  assert.ok(pico(calma) < pico(tension), "la guardia tranquila no debe pegar más que la alarma");

  // Y va despacio por defecto: es música para una mesa que está hablando.
  assert.ok(calma.bpm <= 60, `tempo demasiado vivo para acompañar: ${calma.bpm}`);
});
