import assert from "node:assert/strict";
import test from "node:test";

import {
  AJUSTE_FILTROS,
  AJUSTE_GRANO,
  GRANO,
  GRANO_APAGADO,
  OPCIONES_GRANO,
  MODULO_FXMASTER,
  aplicarFiltrosEscena,
  filtrosParaEscena,
  fxmasterDisponible,
  registrarSincroniaFiltros,
  sincronizarFiltrosEscena,
} from "../scripts/filtros-escena.mjs";
import { AJUSTE_NIVEL_ALERTA } from "../scripts/alerta-escena.mjs";
import { ALERTA } from "../scripts/paleta.mjs";

const modulosCon = (activo) => ({ get: (id) => (id === MODULO_FXMASTER ? { active: activo } : undefined) });
const apiFalsa = () => {
  const aplicados = [];
  return { aplicados, filters: { setFilters: async (f) => aplicados.push(f) } };
};

test("verde no tiñe: la escena limpia es la ausencia de filtros, no un filtro neutro", () => {
  // Importa que sea el array vacío y no un tinte transparente: `setFilters([])`
  // es justamente cómo FXMaster RETIRA el efecto al bajar la alerta.
  assert.deepEqual(filtrosParaEscena({ nivel: "verde" }), []);
  assert.deepEqual(filtrosParaEscena(), []);
});

test("amarilla y roja tiñen con el color de la paleta, no con uno inventado aquí", () => {
  for (const nivel of ["amarilla", "roja"]) {
    const [filtro] = filtrosParaEscena({ nivel });
    assert.equal(filtro.type, "color");
    // El del BORDE, no el del texto: el rojo del aviso está aclarado para
    // leerse en tamaño pequeño y como tinte de escena saldría lavado.
    assert.equal(filtro.options.color.value, ALERTA.niveles[nivel].borde);
    assert.equal(filtro.options.color.apply, true);
  }
});

test("roja pesa más que amarilla, pero ninguna apaga la escena", () => {
  const [amarilla] = filtrosParaEscena({ nivel: "amarilla" });
  const [roja] = filtrosParaEscena({ nivel: "roja" });
  assert.ok(roja.options.contrast > amarilla.options.contrast);
  assert.ok(roja.options.brightness < amarilla.options.brightness);
  // El suelo de legibilidad: con la alerta puesta hay que poder seguir leyendo
  // el mapa. Un tinte que deja la escena a oscuras no es tensión, es un estorbo.
  assert.ok(roja.options.brightness >= 0.85, "la roja no puede apagar la mesa");
});

test("un nivel que la paleta no conoce no pinta nada en vez de lavar la escena", () => {
  // Sin color en la paleta, un tinte «neutro» saldría blanco: se ve como un
  // fallo de render, no como una alerta. Mejor no tocar la escena.
  assert.deepEqual(filtrosParaEscena({ nivel: "azul" }), []);
});

test("el grano retro es un filtro aparte y convive con el tinte", () => {
  // Son ejes independientes a propósito: la época es un parámetro (#362) y la
  // alerta es estado de la nave. Ni el uno implica el otro ni se pisan.
  const soloGrano = filtrosParaEscena({ retro: true, epoca: "gamecube" });
  assert.deepEqual(soloGrano, [{ type: "oldfilm", options: { ...GRANO.gamecube } }]);

  const ambos = filtrosParaEscena({ nivel: "roja", retro: true, epoca: "psx" });
  assert.deepEqual(
    ambos.map((f) => f.type),
    ["color", "oldfilm"],
  );
});

test("la PSX ensucia más que la GameCube, y ninguna vira a sepia", () => {
  assert.ok(GRANO.psx.noise > GRANO.gamecube.noise);
  // «old film» es el nombre de FXMaster, no nuestra intención: se quiere ruido
  // de consola, no de proyector.
  assert.equal(GRANO.psx.sepia, 0);
  assert.equal(GRANO.gamecube.sepia, 0);
});

test("una época desconocida cae en PSX en vez de quedarse sin grano", () => {
  const [filtro] = filtrosParaEscena({ retro: true, epoca: "dreamcast" });
  assert.deepEqual(filtro.options, { ...GRANO.psx });
});

test("sin FXMaster no hay integración, y eso no es un error", () => {
  assert.equal(fxmasterDisponible({ modulos: modulosCon(false), api: apiFalsa() }), false);
  assert.equal(fxmasterDisponible({ modulos: { get: () => undefined }, api: apiFalsa() }), false);
  assert.equal(fxmasterDisponible({ modulos: modulosCon(true), api: apiFalsa() }), true);
});

test("un FXMaster que renombre su API degrada a «no está» en vez de reventar", () => {
  // Se comprueba la función y no solo el módulo activo: esto es una integración
  // oportunista con un módulo ajeno que no controlamos y que puede cambiar.
  assert.equal(fxmasterDisponible({ modulos: modulosCon(true), api: {} }), false);
  assert.equal(fxmasterDisponible({ modulos: modulosCon(true), api: { filters: {} } }), false);
  assert.equal(fxmasterDisponible({ modulos: modulosCon(true), api: undefined }), false);
});

test("solo el GM escribe: los filtros viven en banderas de la escena", async () => {
  const api = apiFalsa();
  const comun = { modulos: modulosCon(true), api, nivel: "roja" };
  assert.equal(await aplicarFiltrosEscena({ ...comun, esGM: false }), null);
  assert.deepEqual(api.aplicados, [], "un jugador no toca el documento de mundo");

  const aplicado = await aplicarFiltrosEscena({ ...comun, esGM: true });
  assert.equal(api.aplicados.length, 1);
  assert.deepEqual(api.aplicados[0], aplicado);
});

test("el GM sin FXMaster tampoco hace nada, sin ruido", async () => {
  const api = apiFalsa();
  assert.equal(await aplicarFiltrosEscena({ modulos: modulosCon(false), api, esGM: true, nivel: "roja" }), null);
  assert.deepEqual(api.aplicados, []);
});

test("volver a verde limpia la escena en vez de dejar el tinte pegado", async () => {
  const api = apiFalsa();
  await aplicarFiltrosEscena({ modulos: modulosCon(true), api, esGM: true, nivel: "roja" });
  await aplicarFiltrosEscena({ modulos: modulosCon(true), api, esGM: true, nivel: "verde" });
  assert.deepEqual(api.aplicados[1], [], "la bajada de alerta retira el filtro");
});

const MODULO = "espaciokoop-lagunak";
const ajustesFalsos = ({ encendido = true, nivel = "verde", grano = GRANO_APAGADO } = {}) => ({
  get: (mod, clave) => {
    if (mod !== MODULO) return undefined;
    if (clave === AJUSTE_FILTROS) return encendido;
    if (clave === AJUSTE_GRANO) return grano;
    if (clave === AJUSTE_NIVEL_ALERTA) return { nivel, motivos: [] };
    return undefined;
  },
});
const entorno = (opciones) => ({
  moduleId: MODULO,
  ajustes: ajustesFalsos(opciones),
  esGM: true,
  modulos: modulosCon(true),
});

test("encender el ajuste en plena alerta roja tiñe ya, sin esperar a que cambie el nivel", async () => {
  // El fallo que motivó `sincronizarFiltrosEscena`: engancharse solo al cambio
  // de nivel deja la escena limpia mientras la nave arde, porque el nivel ya
  // estaba puesto antes de que nadie encendiera nada.
  const api = apiFalsa();
  const filtros = await sincronizarFiltrosEscena({ ...entorno({ nivel: "roja" }), api });
  assert.equal(filtros.length, 1);
  assert.equal(filtros[0].type, "color");
});

test("con el ajuste apagado se limpia la escena, no se deja el tinte pegado", async () => {
  // Un rojo que sobrevive a desactivar la integración es peor que no tenerla:
  // ya no queda nada en la interfaz que explique de dónde sale.
  const api = apiFalsa();
  const filtros = await sincronizarFiltrosEscena({ ...entorno({ encendido: false, nivel: "roja" }), api });
  assert.deepEqual(filtros, []);
  assert.deepEqual(api.aplicados[0], []);
});

test("los tres momentos que resincronizan, y el desregistro los suelta todos", async () => {
  // Los filtros son banderas POR ESCENA: abrir otra escena la deja sin saber
  // nada de la alerta en curso, y por eso `canvasReady` cuenta tanto como el
  // cambio de nivel.
  const registrados = new Map();
  const hooks = {
    on: (nombre, fn) => registrados.set(nombre, fn),
    off: (nombre, fn) => {
      if (registrados.get(nombre) === fn) registrados.delete(nombre);
    },
  };
  const api = apiFalsa();
  const desregistrar = registrarSincroniaFiltros(MODULO, { hooks, api, ...entorno({ nivel: "roja" }) });
  assert.deepEqual([...registrados.keys()].sort(), ["canvasReady", "lagunakNivelAlerta", "updateSetting"]);

  desregistrar();
  assert.deepEqual([...registrados.keys()], [], "no se deja ningún hook colgando");
});

test("el escucha del ajuste ignora los ajustes de otra gente", () => {
  // `updateSetting` se dispara para TODOS los ajustes del mundo, incluidos los
  // de los otros cien módulos instalados.
  const registrados = new Map();
  const hooks = { on: (n, fn) => registrados.set(n, fn), off: () => {} };
  const api = apiFalsa();
  registrarSincroniaFiltros(MODULO, { hooks, api, ...entorno() });
  registrados.get("updateSetting")({ key: "otro-modulo.loQueSea", value: true });
  assert.deepEqual(api.aplicados, [], "un ajuste ajeno no toca nuestra escena");
});

test("la época del grano es un ajuste propio, no un interruptor pegado a la alerta", async () => {
  // Se puede tener grano sin alerta y alerta sin grano: son dos ejes.
  const api = apiFalsa();
  const soloGrano = await sincronizarFiltrosEscena({ ...entorno({ grano: "psx" }), api });
  assert.deepEqual(
    soloGrano.map((f) => f.type),
    ["oldfilm"],
    "verde con grano: solo grano",
  );

  const ambos = await sincronizarFiltrosEscena({ ...entorno({ nivel: "roja", grano: "gamecube" }), api });
  assert.deepEqual(
    ambos.map((f) => f.type),
    ["color", "oldfilm"],
  );
  assert.deepEqual(ambos[1].options, { ...GRANO.gamecube });
});

test("«apagado» es una opción de la lista, no un booleano encima", () => {
  // La época es un parámetro (#362): el ajuste elige CUÁL, y no tener grano es
  // una elección más. Un segundo interruptor daría dos estados para lo mismo.
  assert.equal(OPCIONES_GRANO[0], GRANO_APAGADO, "y es la opción por defecto, la primera");
  for (const opcion of OPCIONES_GRANO.slice(1)) {
    assert.ok(opcion in GRANO, `${opcion} tiene grano definido`);
  }
  assert.equal(OPCIONES_GRANO.length, Object.keys(GRANO).length + 1);
});

test("el interruptor general manda: apagarlo quita también el grano", async () => {
  // Su descripción promete devolver la escena al GM. Dejarle el grano puesto
  // sería incumplirlo por la puerta de atrás.
  const api = apiFalsa();
  const filtros = await sincronizarFiltrosEscena({
    ...entorno({ encendido: false, nivel: "roja", grano: "psx" }),
    api,
  });
  assert.deepEqual(filtros, []);
});

test("una época guardada que ya no existe no deja un filtro roto", async () => {
  // Un mundo que se guardó con una época que luego se retiró del catálogo.
  const api = apiFalsa();
  const filtros = await sincronizarFiltrosEscena({ ...entorno({ grano: "dreamcast" }), api });
  assert.deepEqual(filtros, [], "no se inventa un grano por defecto a espaldas del GM");
});

test("tocar la época resincroniza, igual que tocar el interruptor", () => {
  const registrados = new Map();
  const hooks = { on: (n, fn) => registrados.set(n, fn), off: () => {} };
  const api = apiFalsa();
  registrarSincroniaFiltros(MODULO, { hooks, api, ...entorno({ grano: "psx" }) });
  registrados.get("updateSetting")({ key: `${MODULO}.${AJUSTE_GRANO}` });
  assert.equal(api.aplicados.length, 1, "el cambio de época se ve al momento");
});
