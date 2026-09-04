// Lectura de atraque en la consola (#391, rebanada 6 de #362).
//
// Lo que se está protegiendo no es el formato de una etiqueta: es que la consola
// no diga nada cuando el puente no ha dicho nada. `docking: null` significa dos
// cosas a la vez —la nave está libre, o el componente no se pudo leer— y pintar
// «sin atracar» elige una de las dos sin saberlo.

import test from "node:test";
import assert from "node:assert/strict";

import { prepareDocking } from "../scripts/ship-view/ship-view.mjs";

const i18n = {
  localize: (clave) => clave,
  format: (clave, datos) => `${clave}:${datos?.target ?? ""}`,
};

test("sin lectura de atraque no hay nada que pintar", () => {
  for (const nave of [null, undefined, {}, { docking: null }]) {
    const salida = prepareDocking(nave, i18n);
    assert.deepEqual(salida, { estado: null, objetivo: null, etiqueta: null });
  }
});

test("un estado que no reconocemos NO se convierte en atraque", () => {
  // El puente ya normaliza, pero esta capa no puede fiarse de eso: un puente
  // viejo, un proxy o una prueba pueden entregar cualquier cosa, y de ahí no
  // puede salir una lámina de atraque.
  for (const state of ["undocking", "NotDocking", 0, 1, true, null, {}]) {
    assert.equal(prepareDocking({ docking: { state } }, i18n).estado, null, String(state));
  }
});

test("atracando y atracada son estados distintos y se dicen distinto", () => {
  const atracando = prepareDocking({ docking: { state: "docking" } }, i18n);
  const atracada = prepareDocking({ docking: { state: "docked" } }, i18n);
  assert.equal(atracando.estado, "docking");
  assert.equal(atracada.estado, "docked");
  assert.equal(atracando.etiqueta, "LAGUNAK.Espacios.Atraque.Atracando");
  assert.equal(atracada.etiqueta, "LAGUNAK.Espacios.Atraque.Atracada");
});

test("con objetivo se dice contra qué; sin él, solo el estado", () => {
  const conObjetivo = prepareDocking(
    { docking: { state: "docked", target: { callsign: "Argia", class: "Station" } } },
    i18n,
  );
  assert.equal(conObjetivo.etiqueta, "LAGUNAK.Espacios.Atraque.AtracadaEn:Argia");
  assert.deepEqual(conObjetivo.objetivo, { callsign: "Argia", clase: "Station" });

  // «Estamos atracando» es cierto aunque no se sepa contra qué. La etiqueta NO
  // rellena el hueco con un «desconocido», que se leería como el nombre del sitio.
  const sinObjetivo = prepareDocking({ docking: { state: "docking", target: null } }, i18n);
  assert.equal(sinObjetivo.etiqueta, "LAGUNAK.Espacios.Atraque.Atracando");
  assert.equal(sinObjetivo.objetivo, null);
});

test("un objetivo a medias conserva lo que sí publicó el puente", () => {
  const soloClase = prepareDocking(
    { docking: { state: "docked", target: { callsign: "", class: "Station" } } },
    i18n,
  );
  // Sin indicativo la etiqueta no lo inventa, pero la clase sigue disponible
  // para quien quiera dibujar la silueta: son dos datos distintos.
  assert.equal(soloClase.etiqueta, "LAGUNAK.Espacios.Atraque.Atracada");
  assert.deepEqual(soloClase.objetivo, { callsign: null, clase: "Station" });

  const soloIndicativo = prepareDocking(
    { docking: { state: "docking", target: { callsign: "Hondar 4" } } },
    i18n,
  );
  assert.deepEqual(soloIndicativo.objetivo, { callsign: "Hondar 4", clase: null });
});

test("sin i18n sigue devolviendo algo legible en vez de undefined", () => {
  const salida = prepareDocking({ docking: { state: "docked", target: { callsign: "Argia" } } }, null);
  assert.equal(typeof salida.etiqueta, "string");
  assert.ok(salida.etiqueta.includes("Argia"));
});

// ---- La lámina del objetivo (#391, rebanada 6 de #362) ----------------------

import { montarLaminaContacto, desmontarLamina } from "../scripts/lamina-contacto.mjs";
import { buildWorkspaceModel } from "../scripts/station-workspaces.mjs";

function raizConLienzo(selector) {
  const ordenes = [];
  const ctx = new Proxy(
    { fill: () => ordenes.push("fill") },
    { get: (obj, prop) => obj[prop] ?? (() => ordenes.push(String(prop))), set: () => true },
  );
  const lienzo = { width: 112, height: 84, getContext: () => ctx };
  return { ordenes, querySelector: (sel) => (sel === selector ? lienzo : null) };
}

test("la lámina se pinta en el lienzo que se le pida, no en uno fijo", () => {
  // La misma lámina sirve al contacto del mapa y al objetivo de atraque; lo que
  // cambia es dónde se pinta y cuándo existe, no cómo se dibuja.
  const raiz = raizConLienzo("[data-lagunak-atraque]");
  const opciones = { movimientoReducido: () => true, pedirFotograma: () => 0 };
  // Con el selector por defecto no encuentra lienzo y no monta nada.
  assert.equal(montarLaminaContacto(raiz, { clase: "Station" }, opciones), null);
  const salida = montarLaminaContacto(
    raiz,
    { clase: "Station", color: "#7d8597" },
    { ...opciones, selector: "[data-lagunak-atraque]" },
  );
  assert.deepEqual(salida, { clase: "station", conocida: true });
  assert.ok(raiz.ordenes.includes("fill"));
  desmontarLamina(raiz);
});

test("una clase de objetivo desconocida cae en el casco de serie, no en un hueco", () => {
  // Un hueco donde debería haber una nave se lee como que el módulo está roto;
  // una silueta genérica dice «hay algo ahí».
  const raiz = raizConLienzo("[data-lagunak-atraque]");
  const salida = montarLaminaContacto(
    raiz,
    { clase: "PlataformaOrbital" },
    { movimientoReducido: () => true, pedirFotograma: () => 0, selector: "[data-lagunak-atraque]" },
  );
  assert.equal(salida.conocida, false);
  assert.ok(raiz.ordenes.includes("fill"), "y aun así se pinta algo");
  desmontarLamina(raiz);
});

test("SIN atraque el modelo no trae lámina: no hay lienzo que interpretar", () => {
  const base = {
    station: "navigation",
    isGM: false,
    users: [],
    moduleId: "lagunak",
    i18n: { localize: (k) => k, format: (k) => k },
    connection: "ok",
  };
  const sinAtraque = buildWorkspaceModel({ ...base, statePayload: { ship: { systems: {} } } });
  assert.equal(sinAtraque.atraque, null);

  const conAtraque = buildWorkspaceModel({
    ...base,
    statePayload: {
      ship: { systems: {}, docking: { state: "docked", target: { callsign: "Argia", class: "Station" } } },
    },
  });
  assert.deepEqual(conAtraque.atraque, { estado: "docked", clase: "Station" });
});

test("un objetivo sin clase publicada sigue trayendo lámina", () => {
  // La clase es opcional; el atraque no. Sin clase la lámina dibuja el casco de
  // serie, que es información («hay algo ahí»), no un error.
  const modelo = buildWorkspaceModel({
    station: "captain",
    isGM: false,
    users: [],
    moduleId: "lagunak",
    i18n: { localize: (k) => k, format: (k) => k },
    connection: "ok",
    statePayload: { ship: { systems: {}, docking: { state: "docking", target: { callsign: "Hondar 4" } } } },
  });
  assert.deepEqual(modelo.atraque, { estado: "docking", clase: null });
});

// ---- Las dos láminas conviven (#374 + #391) ---------------------------------

/** Raíz con las DOS ranuras: la del contacto del mapa y la del objetivo. */
function raizConDosLienzos() {
  const lienzo = (nombre, ordenes) => {
    const ctx = new Proxy(
      { fill: () => ordenes.push(`fill:${nombre}`) },
      { get: (obj, prop) => obj[prop] ?? (() => {}), set: () => true },
    );
    return { width: 112, height: 84, getContext: () => ctx };
  };
  const ordenes = [];
  const mapa = lienzo("mapa", ordenes);
  const atraque = lienzo("atraque", ordenes);
  return {
    ordenes,
    querySelector: (sel) =>
      sel === "[data-lagunak-lamina]" ? mapa : sel === "[data-lagunak-atraque]" ? atraque : null,
  };
}

/** Bucle vivo con fotogramas controlados, para poder ver si lo paran. */
function bucleEspia(etiqueta, cancelados) {
  let siguiente = 0;
  return {
    movimientoReducido: () => false,
    pedirFotograma: () => `${etiqueta}:${(siguiente += 1)}`,
    cancelarFotograma: (id) => cancelados.push(id),
  };
}

test("montar la lámina de atraque NO apaga la del contacto: son ranuras distintas", () => {
  // El registro va por dueño, porque es lo único que sobrevive a un remontaje,
  // pero el montaje va por ranura. Si el desmontaje previo no distinguiera la
  // ranura, la ventana que enseña las dos perdería la primera en silencio: sin
  // error, sin hueco, solo un lienzo que deja de girar.
  const raiz = raizConDosLienzos();
  const dueño = { nombre: "consola" };
  const cancelados = [];

  montarLaminaContacto(raiz, { clase: "Frigate" }, { ...bucleEspia("mapa", cancelados), dueño });
  montarLaminaContacto(raiz, { clase: "Station" }, {
    ...bucleEspia("atraque", cancelados),
    dueño,
    selector: "[data-lagunak-atraque]",
  });

  assert.deepEqual(cancelados, [], "montar una ranura ha parado el bucle de la otra");
  assert.ok(raiz.ordenes.some((o) => o === "fill:mapa"), "la del mapa se pintó");
  assert.ok(raiz.ordenes.some((o) => o === "fill:atraque"), "la del atraque se pintó");

  // Y remontar la MISMA ranura sí para la anterior: si no, cada cambio de
  // selección dejaría un bucle huérfano, que es el fallo que #374 ya cerró.
  montarLaminaContacto(raiz, { clase: "Cruiser" }, { ...bucleEspia("mapa2", cancelados), dueño });
  assert.ok(
    cancelados.some((id) => String(id).startsWith("mapa:")),
    "remontar la misma ranura debe parar su bucle anterior",
  );
});

test("cerrar la ventana para TODAS sus láminas, no solo la última", () => {
  // Al cerrar no queda nada que pintar. Parar solo una ranura dejaría la otra
  // girando contra un lienzo fuera del documento, que es el bucle huérfano de
  // siempre pero más difícil de ver, porque el cierre parece haber funcionado.
  const raiz = raizConDosLienzos();
  const dueño = { nombre: "consola" };
  const cancelados = [];

  montarLaminaContacto(raiz, { clase: "Frigate" }, { ...bucleEspia("mapa", cancelados), dueño });
  montarLaminaContacto(raiz, { clase: "Station" }, {
    ...bucleEspia("atraque", cancelados),
    dueño,
    selector: "[data-lagunak-atraque]",
  });

  assert.equal(desmontarLamina(raiz, dueño), true);
  assert.ok(cancelados.some((id) => String(id).startsWith("mapa:")), "quedó viva la del mapa");
  assert.ok(cancelados.some((id) => String(id).startsWith("atraque:")), "quedó viva la del atraque");
  assert.equal(desmontarLamina(raiz, dueño), false, "llamarlo de más no debe hacer daño");
});
