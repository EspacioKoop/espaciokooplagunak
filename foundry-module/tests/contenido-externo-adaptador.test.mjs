import assert from "node:assert/strict";
import test from "node:test";

import {
  ADAPTADOR_AUSENTE,
  ORIGENES,
  TIPOS,
  crearAdaptadorContenido,
} from "../scripts/contenido-externo/adaptador.mjs";
import { MOTIVOS } from "../scripts/contenido-externo/edicion.mjs";
import { crearProveedorFoundry, sistemaCompatible } from "../scripts/contenido-externo/proveedor-foundry.mjs";

// Datos sintéticos: nada de esto existe en ningún libro. Ver el comentario de
// `contenido-externo-edicion.test.mjs`.
const mundoMixto = {
  criaturas: () => [
    { name: "Rondador de escoria", type: "npc", system: { source: { book: "MM", rules: "2014" }, attributes: { hp: { max: 22 }, ac: { value: 13 } } } },
    { name: "Rondador revisado", type: "npc", system: { source: { book: "XMM", rules: "2024" } } },
    { name: "Bicho casero", type: "npc", system: { source: { book: "Servilleta" } } },
  ],
  objetos: () => [{ name: "Llave inglesa cantada", type: "tool", system: { source: { book: "XGE" } } }],
  hechizos: () => [
    { name: "Chispa de mantenimiento", type: "spell", system: { source: { book: "PHB" }, level: 1 } },
    { name: "Chispa de 2024", type: "spell", system: { source: { book: "XPHB" }, level: 1 } },
  ],
};

test("sin proveedor, todo vacío y nada roto", () => {
  assert.equal(ADAPTADOR_AUSENTE.disponible(), false);
  for (const resolver of ["resolverCriaturas", "resolverObjetos", "resolverHechizos"]) {
    const resultado = ADAPTADOR_AUSENTE[resolver]();
    assert.equal(resultado.disponible, false);
    assert.deepEqual(resultado.elementos, []);
    assert.deepEqual(resultado.descartes, []);
  }
});

test("solo pasa el contenido de 2014, con su motivo para lo demás", () => {
  const adaptador = crearAdaptadorContenido({ proveedor: mundoMixto });
  const criaturas = adaptador.resolverCriaturas();

  assert.equal(criaturas.disponible, true);
  assert.deepEqual(criaturas.elementos.map((e) => e.nombre), ["Rondador de escoria"]);
  assert.deepEqual(
    criaturas.descartes.map((d) => [d.nombre, d.motivo]),
    [
      ["Rondador revisado", MOTIVOS.REGLAS_2024],
      ["Bicho casero", MOTIVOS.FUENTE_DESCONOCIDA],
    ],
  );
});

test("el modelo interno es el mismo mirando cualquier tipo", () => {
  const adaptador = crearAdaptadorContenido({ proveedor: mundoMixto });
  const [criatura] = adaptador.resolverCriaturas().elementos;
  const [objeto] = adaptador.resolverObjetos().elementos;
  const [hechizo] = adaptador.resolverHechizos().elementos;

  for (const elemento of [criatura, objeto, hechizo]) {
    // Quien consuma esto no puede distinguir de qué proveedor salió más allá de
    // `origen`: mismo modelo para todo, venga de donde venga.
    assert.deepEqual(Object.keys(elemento).sort(), [
      "claseArmadura", "edicion", "fuente", "id", "nivel", "nombre",
      "origen", "puntosGolpe", "refDocumento", "tipo",
    ]);
    assert.equal(elemento.origen, ORIGENES.MUNDO);
    assert.equal(elemento.edicion, "2014");
    assert.ok(Object.isFrozen(elemento));
  }

  assert.equal(criatura.tipo, TIPOS.CRIATURA);
  assert.equal(criatura.puntosGolpe, 22);
  assert.equal(criatura.claseArmadura, 13);
  // Lo que un tipo no tiene sale a `null`, no a `undefined` ni a 0 inventado.
  assert.equal(objeto.puntosGolpe, null);
  assert.equal(hechizo.nivel, 1);
});

test("se puede filtrar por encima del filtro de edición", () => {
  const adaptador = crearAdaptadorContenido({ proveedor: mundoMixto });
  const duros = adaptador.resolverCriaturas((e) => e.puntosGolpe > 100);
  assert.deepEqual(duros.elementos, []);
  // El filtro de mesa no borra el rastro del filtro de edición.
  assert.equal(duros.descartes.length, 2);
});

test("un proveedor que explota degrada a ausente, no tumba la sesión", () => {
  const roto = {
    criaturas() { throw new Error("plutonium se ha ido"); },
    objetos: () => "esto no es una lista",
    hechizos: () => null,
  };
  const adaptador = crearAdaptadorContenido({ proveedor: roto });
  assert.deepEqual(adaptador.resolverCriaturas().elementos, []);
  assert.deepEqual(adaptador.resolverObjetos().elementos, []);
  assert.deepEqual(adaptador.resolverHechizos().elementos, []);
});

test("un proveedor a medias no invalida lo que sí sabe dar", () => {
  const aMedias = { criaturas: mundoMixto.criaturas };
  const adaptador = crearAdaptadorContenido({ proveedor: aMedias });
  assert.equal(adaptador.disponible(), true);
  assert.equal(adaptador.resolverCriaturas().elementos.length, 1);
  assert.deepEqual(adaptador.resolverHechizos().elementos, []);
});

test("el diagnóstico cuenta los descartes por motivo", () => {
  const adaptador = crearAdaptadorContenido({ proveedor: mundoMixto });
  const { descartesPorMotivo, disponible } = adaptador.diagnostico();
  assert.equal(disponible, true);
  assert.equal(descartesPorMotivo[MOTIVOS.REGLAS_2024], 1);
  assert.equal(descartesPorMotivo[MOTIVOS.FUENTE_DESCONOCIDA], 1);
  assert.equal(descartesPorMotivo[MOTIVOS.FUENTE_2024], 1);
  assert.equal(descartesPorMotivo[MOTIVOS.SIN_METADATOS], 0);
});

test("el proveedor de Foundry reparte actores e ítems por tipo", () => {
  const juego = {
    system: { id: "dnd5e" },
    actors: { contents: [{ name: "A", type: "npc" }, { name: "B", type: "scene-junk" }] },
    items: [{ name: "C", type: "weapon" }, { name: "D", type: "spell" }],
  };
  const proveedor = crearProveedorFoundry(juego);
  assert.deepEqual(proveedor.criaturas().map((d) => d.name), ["A"]);
  assert.deepEqual(proveedor.objetos().map((d) => d.name), ["C"]);
  assert.deepEqual(proveedor.hechizos().map((d) => d.name), ["D"]);
  assert.equal(sistemaCompatible(juego), true);
});

test("sin mundo y con otro sistema, el proveedor no inventa nada", () => {
  const vacio = crearProveedorFoundry(undefined);
  assert.deepEqual(vacio.criaturas(), []);
  assert.deepEqual(vacio.objetos(), []);
  assert.deepEqual(vacio.hechizos(), []);
  assert.equal(sistemaCompatible(undefined), false);
  assert.equal(sistemaCompatible({ system: { id: "pf2e" } }), false);
});
