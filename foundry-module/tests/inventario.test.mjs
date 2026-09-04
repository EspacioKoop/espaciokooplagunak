// Inventario físico por personaje (#963/#964).

import assert from "node:assert/strict";
import test from "node:test";

import {
  CATEGORIAS,
  SLOTS_EQUIPO,
  TAMANO_HOTBAR,
  agregar,
  asignarHotbar,
  crearInventario,
  desequipar,
  equipadoEn,
  equipar,
  excedePeso,
  marcarClave,
  objetoPorId,
  pesoActual,
  quitar,
} from "../scripts/inventario.mjs";

test("un inventario nuevo está vacío, sin límite y con las tres categorías", () => {
  const inv = crearInventario();
  assert.equal(inv.limitePeso, null);
  for (const categoria of CATEGORIAS) assert.deepEqual(inv[categoria], []);
  assert.equal(inv.hotbar.length, TAMANO_HOTBAR);
  assert.ok(inv.hotbar.every((h) => h === null));
  for (const slot of SLOTS_EQUIPO) assert.equal(inv.equipo[slot], null);
});

test("solo las 3 categorías, y ninguna cuarta a mano", () => {
  assert.deepEqual(CATEGORIAS, ["armas", "curacion", "objetos"]);
});

test("un límite de peso negativo, NaN o no numérico se trata como sin límite", () => {
  assert.equal(crearInventario({ limitePeso: -5 }).limitePeso, null);
  assert.equal(crearInventario({ limitePeso: NaN }).limitePeso, null);
  assert.equal(crearInventario({ limitePeso: "80" }).limitePeso, null);
  assert.equal(crearInventario({ limitePeso: 0 }).limitePeso, null);
  assert.equal(crearInventario({ limitePeso: 80 }).limitePeso, 80);
});

test("sin límite de peso, excedePeso nunca bloquea nada", () => {
  const inv = crearInventario({ limitePeso: null });
  assert.equal(excedePeso(inv, { peso: 999999 }), false);
});

test("con límite de peso, un objeto que se pasa no entra", () => {
  let inv = crearInventario({ limitePeso: 10 });
  inv = agregar(inv, { id: "a", peso: 8 }, "objetos");
  const antes = inv;
  inv = agregar(inv, { id: "b", peso: 5 }, "objetos");
  assert.equal(inv, antes, "debería haberse rechazado por peso, y no lo hizo");
  inv = agregar(inv, { id: "c", peso: 2 }, "objetos");
  assert.notEqual(inv, antes);
  assert.equal(pesoActual(inv), 10);
});

test("agregar rechaza categoría desconocida y objeto sin id, sin reventar", () => {
  const inv = crearInventario();
  assert.equal(agregar(inv, { id: "x" }, "mochila-imaginaria"), inv);
  assert.equal(agregar(inv, {}, "objetos"), inv);
  assert.equal(agregar(inv, { id: "" }, "objetos"), inv);
});

test("un id no puede estar en dos categorías a la vez", () => {
  let inv = crearInventario();
  inv = agregar(inv, { id: "llave" }, "objetos");
  const antes = inv;
  inv = agregar(inv, { id: "llave" }, "armas");
  assert.equal(inv, antes);
});

test("quitar libera el id y no revienta si no existe", () => {
  let inv = crearInventario();
  inv = agregar(inv, { id: "a" }, "objetos");
  inv = quitar(inv, "a", "objetos");
  assert.equal(objetoPorId(inv, "a"), null);
  const antes = inv;
  assert.equal(quitar(inv, "no-existe", "objetos"), antes);
});

test("soltar un objeto limpia el slot de equipo que apuntaba a él (#964: sin puntero colgante)", () => {
  let inv = crearInventario();
  inv = agregar(inv, { id: "espada" }, "armas");
  inv = equipar(inv, "espada", "manoDerecha");
  assert.equal(equipadoEn(inv, "manoDerecha").id, "espada");
  inv = quitar(inv, "espada", "armas");
  assert.equal(inv.equipo.manoDerecha, null);
  assert.equal(equipadoEn(inv, "manoDerecha"), null);
});

test("soltar un objeto también limpia el hueco de hotbar que apuntaba a él", () => {
  let inv = crearInventario();
  inv = agregar(inv, { id: "pocion" }, "curacion");
  inv = asignarHotbar(inv, 0, "pocion");
  inv = quitar(inv, "pocion", "curacion");
  assert.equal(inv.hotbar[0], null);
});

test("doble empuñadura: mano derecha e izquierda son slots independientes", () => {
  let inv = crearInventario();
  inv = agregar(inv, { id: "daga1" }, "armas");
  inv = agregar(inv, { id: "daga2" }, "armas");
  inv = equipar(inv, "daga1", "manoDerecha");
  inv = equipar(inv, "daga2", "manoIzquierda");
  assert.equal(equipadoEn(inv, "manoDerecha").id, "daga1");
  assert.equal(equipadoEn(inv, "manoIzquierda").id, "daga2");
});

test("equipar exige que el objeto ya esté en el inventario", () => {
  const inv = crearInventario();
  assert.equal(equipar(inv, "fantasma", "manoDerecha"), inv);
});

test("equipar en un slot desconocido no revienta", () => {
  let inv = crearInventario();
  inv = agregar(inv, { id: "a" }, "objetos");
  assert.equal(equipar(inv, "a", "cola-prensil"), inv);
});

test("desequipar vacía el slot y es un no-op si ya estaba vacío", () => {
  let inv = crearInventario();
  inv = agregar(inv, { id: "casco" }, "objetos");
  inv = equipar(inv, "casco", "cabeza");
  inv = desequipar(inv, "cabeza");
  assert.equal(inv.equipo.cabeza, null);
  assert.equal(desequipar(inv, "cabeza"), inv);
});

test("los 9 slots de equipo son exactamente los acordados en #964, sin vocabulario 5e", () => {
  assert.deepEqual(SLOTS_EQUIPO, [
    "manoDerecha",
    "manoIzquierda",
    "cabeza",
    "cuerpo",
    "pies",
    "anillo1",
    "anillo2",
    "accesorio1",
    "accesorio2",
  ]);
});

test("marcarClave alterna el flag sin cambiar de categoría, y un id inexistente no revienta", () => {
  let inv = crearInventario();
  inv = agregar(inv, { id: "mapa" }, "objetos");
  inv = marcarClave(inv, "mapa", true);
  assert.equal(objetoPorId(inv, "mapa").clave, true);
  inv = marcarClave(inv, "mapa", false);
  assert.equal(objetoPorId(inv, "mapa").clave, false);
  const antes = inv;
  assert.equal(marcarClave(inv, "no-existe", true), antes);
});

test("un objeto nuevo nace sin marcar como clave por defecto", () => {
  const inv = agregar(crearInventario(), { id: "x" }, "objetos");
  assert.equal(objetoPorId(inv, "x").clave, false);
});

test("clave se normaliza a booleano aunque quien agrega el objeto pase basura", () => {
  const inv = agregar(crearInventario(), { id: "x", clave: "no" }, "objetos");
  assert.strictEqual(objetoPorId(inv, "x").clave, true, "\"no\" es una cadena truthy en JS");
  const inv2 = agregar(crearInventario(), { id: "y", clave: 0 }, "objetos");
  assert.strictEqual(objetoPorId(inv2, "y").clave, false);
});

test("asignarHotbar exige que el objeto ya esté en el inventario, y rechaza índices fuera de rango", () => {
  let inv = crearInventario();
  assert.equal(asignarHotbar(inv, 0, "fantasma"), inv);
  assert.equal(asignarHotbar(inv, -1, "x"), inv);
  assert.equal(asignarHotbar(inv, TAMANO_HOTBAR, "x"), inv);
  inv = agregar(inv, { id: "a" }, "objetos");
  inv = asignarHotbar(inv, 1, "a");
  assert.equal(inv.hotbar[1], "a");
  inv = asignarHotbar(inv, 1, null);
  assert.equal(inv.hotbar[1], null);
});

test("pesoActual no cuenta el equipo ni el hotbar aparte — son referencias al mismo objeto", () => {
  let inv = crearInventario();
  inv = agregar(inv, { id: "espada", peso: 4 }, "armas");
  inv = equipar(inv, "espada", "manoDerecha");
  inv = asignarHotbar(inv, 0, "espada");
  assert.equal(pesoActual(inv), 4, "equipar/hotbar no deberían duplicar el peso");
});

test("un objeto sin peso declarado cuenta como 0, no revienta la suma", () => {
  const inv = agregar(crearInventario({ limitePeso: 5 }), { id: "pluma" }, "objetos");
  assert.equal(pesoActual(inv), 0);
});

test("quitar exige la categoría del contrato de #964: la que no es deja el inventario igual", () => {
  let inv = crearInventario();
  inv = agregar(inv, { id: "mapa" }, "objetos");
  const antes = inv;
  // El objeto existe, pero no en la categoría declarada: transición sin cambios.
  assert.equal(quitar(inv, "mapa", "armas"), antes);
  // Categoría que no existe: tampoco puede borrar por autodetección.
  assert.equal(quitar(inv, "mapa", "categoria-inexistente"), antes);
  assert.equal(quitar(inv, "mapa", undefined), antes);
  // Y con la categoría correcta sí sale.
  assert.equal(objetoPorId(quitar(inv, "mapa", "objetos"), "mapa"), null);
});

test("quitar con la categoría equivocada no limpia equipo ni hotbar", () => {
  let inv = crearInventario();
  inv = agregar(inv, { id: "espada" }, "armas");
  inv = equipar(inv, "espada", "manoDerecha");
  inv = asignarHotbar(inv, 1, "espada");
  const fallido = quitar(inv, "espada", "curacion");
  assert.equal(fallido, inv);
  assert.equal(fallido.equipo.manoDerecha, "espada");
  assert.equal(fallido.hotbar[1], "espada");
});
