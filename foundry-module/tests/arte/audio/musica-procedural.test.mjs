import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  generarPieza,
  frecuencia,
  registroParaAlerta,
  encadenarTramos,
  REGISTROS,
  TIMBRES,
} from "../../../scripts/arte/audio/musica-procedural.mjs";

const EXTENSIONES_AUDIO = /\.(?:aac|aif|aiff|caf|flac|m4a|mid|midi|mp3|oga|ogg|opus|wav|webm|wma)$/i;

async function buscarActivosAudio(directorio) {
  const encontrados = [];

  async function recorrer(actual) {
    for (const entrada of await readdir(actual, { withFileTypes: true })) {
      if (entrada.name === ".git") continue;
      const ruta = join(actual, entrada.name);
      if (entrada.isDirectory()) await recorrer(ruta);
      else if (entrada.isFile() && EXTENSIONES_AUDIO.test(entrada.name)) encontrados.push(ruta);
    }
  }

  await recorrer(directorio);
  return encontrados;
}

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
    fs.readFile(new URL("../../../scripts/arte/audio/musica-procedural.mjs", import.meta.url), "utf8"),
  );
  const listaLargaDeNotas = /\[\s*(?:\d{2,3}\s*,\s*){7,}/;
  assert.doesNotMatch(fuente, listaLargaDeNotas, "parece una transcripción literal");
});

test("el módulo Foundry no distribuye ficheros de audio ni MIDI", async () => {
  // El juego heredado sí conserva voces y efectos propios bajo `resources/`.
  // La frontera legal de #344 es el módulo distribuible donde vive este arte.
  const raiz = fileURLToPath(new URL("../", import.meta.url));
  const encontrados = await buscarActivosAudio(raiz);
  assert.deepEqual(
    encontrados,
    [],
    `el arte procedural no puede incorporar grabaciones, MIDI ni otros activos de audio: ${encontrados.join(", ")}`,
  );
});

test("la guardia inspecciona node_modules dentro de una ruta empaquetable", async () => {
  const raiz = await mkdtemp(join(tmpdir(), "lagunak-audio-guard-"));
  const directorioEmpaquetable = join(raiz, "scripts", "node_modules", "dependencia");
  const activo = join(directorioEmpaquetable, "muestra.ogg");
  try {
    await mkdir(directorioEmpaquetable, { recursive: true });
    await writeFile(activo, "regresion: no es audio real");
    assert.deepEqual(await buscarActivosAudio(raiz), [activo]);
  } finally {
    await rm(raiz, { recursive: true, force: true });
  }
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

// ---- Instrumentos y variación ---------------------------------------------

test("cada timbre es un espectro, no una muestra de audio", () => {
  for (const [nombre, t] of Object.entries(TIMBRES)) {
    assert.ok(Array.isArray(t.parciales) && t.parciales.length > 0, `${nombre} sin parciales`);
    assert.equal(t.parciales[0], 1, `${nombre}: el fundamental es la referencia`);
    assert.ok(t.ataqueMs >= 0 && t.decaimientoMs > 0, `${nombre} sin envolvente`);
  }
  // La madera vibra INARMÓNICA: es lo que la hace sonar a tabla y no a nota.
  assert.ok(Array.isArray(TIMBRES.madera.inarmonicos));
  assert.notEqual(TIMBRES.madera.inarmonicos[1], 2, "un parcial inarmónico no puede ser el doble exacto");
  // La flauta apenas tiene segundo armónico: por eso se mezcla sin pelear.
  assert.ok(TIMBRES.flauta.parciales[1] < 0.15);
});

test("todas las notas declaran un timbre existente", () => {
  for (const registro of REGISTROS) {
    for (const n of generarPieza("s", { registro, compases: 6 }).notas) {
      assert.ok(n.timbre, `${registro}: nota sin timbre`);
      assert.ok(TIMBRES[n.timbre], `${registro}: timbre desconocido ${n.timbre}`);
    }
  }
});

test("la txalaparta alterna estrictamente entre los dos ejecutantes", () => {
  // La regla del instrumento: nunca golpea dos veces seguidas el mismo. El
  // ritmo solo existe en el encaje de los dos, que es justo el tema del juego.
  const { notas } = generarPieza("s", { registro: "txalaparta", compases: 8, flautas: false });
  const turnos = [];
  let ultimo = null;
  for (const n of notas) {
    if (n.voz !== ultimo) {
      turnos.push(n.voz);
      ultimo = n.voz;
    }
  }
  for (let i = 1; i < turnos.length; i += 1) {
    assert.notEqual(turnos[i], turnos[i - 1], "el mismo ejecutante golpeó dos turnos seguidos");
  }
  assert.ok(turnos.includes("ttakun") && turnos.includes("herrena"), "faltan los dos papeles");
});

test("las flautas acompañan sin competir: tarde, por debajo y con huecos", () => {
  const pieza = generarPieza("s", { registro: "bordon", compases: 12 });
  const flautas = pieza.notas.filter((n) => n.voz === "flauta");
  assert.ok(flautas.length > 0, "no entraron las flautas");

  // Por debajo de todo lo demás.
  const otras = pieza.notas.filter((n) => n.voz !== "flauta");
  const maxFlauta = Math.max(...flautas.map((n) => n.intensidad));
  assert.ok(maxFlauta < Math.max(...otras.map((n) => n.intensidad)), "las flautas tapan la voz principal");

  // No entran en el primer compás: se suman a algo que ya sonaba.
  const compas = pieza.duracionMs / 12;
  assert.ok(Math.min(...flautas.map((n) => n.inicioMs)) >= compas, "las flautas entran demasiado pronto");

  // Y se pueden apagar del todo.
  const sinFlautas = generarPieza("s", { registro: "bordon", compases: 12, flautas: false });
  assert.equal(sinFlautas.notas.filter((n) => n.voz === "flauta").length, 0);
});

test("paganini corre y mahler pesa: se distinguen por el oído", () => {
  const corre = generarPieza("s", { registro: "paganini", compases: 4 });
  const pesa = generarPieza("s", { registro: "mahler", compases: 4 });
  // Muchas más notas por segundo: urgencia con agencia frente a peso sin salida.
  const densidad = (p) => p.notas.length / (p.duracionMs / 1000);
  assert.ok(densidad(corre) > densidad(pesa) * 2, "la carrera debe ser mucho más densa");
});

test("los tramos encadenados derivan sin saltos ni repetirse", () => {
  const cadena = encadenarTramos("mesa", { registro: "bandura", tramos: 6 });
  assert.equal(cadena.tramos.length, 6);

  const tonicas = cadena.tramos.map((t) => t.tonica);
  assert.ok(new Set(tonicas).size > 1, "no varía: es un bucle idéntico");
  // Pero la deriva es acotada: nunca se va de tesitura ni de carácter.
  for (const t of tonicas) assert.ok(Math.abs(t - 57) <= 4, `tónica fuera de rango: ${t}`);
  for (const t of cadena.tramos) assert.ok(t.bpm >= 30 && t.bpm <= 200);

  // Los tramos van uno detrás de otro, sin solaparse ni dejar hueco.
  for (let i = 1; i < cadena.tramos.length; i += 1) {
    assert.ok(cadena.tramos[i].inicioMs > cadena.tramos[i - 1].inicioMs);
  }
  // Y sigue siendo determinista para toda la mesa.
  assert.deepEqual(encadenarTramos("mesa", { registro: "bandura", tramos: 6 }), cadena);
});
