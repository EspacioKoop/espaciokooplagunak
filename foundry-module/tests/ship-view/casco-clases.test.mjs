import assert from "node:assert/strict";
import test from "node:test";

import {
  CASCOS_POR_CLASE,
  cascoDeClase,
  claveDeClase,
  mallaDeClase,
} from "../../scripts/ship-view/casco-clases.mjs";
import { CASCO_POR_DEFECTO } from "../../scripts/retro3d.mjs";
import { desmontarLamina, montarLaminaContacto } from "../../scripts/lamina-contacto.mjs";

test("una clase desconocida dibuja el casco de serie, no un hueco", () => {
  // El catálogo del juego crece sin avisar a este módulo, así que la clase que
  // no está aquí NO es un error. Una nave genérica dice «hay algo ahí»; un
  // hueco donde debería haber una nave se lee como que el módulo está roto.
  for (const rara of ["Vaporizador", "", null, undefined, 42, {}]) {
    const casco = cascoDeClase(rara);
    assert.equal(casco.conocida, false);
    assert.deepEqual(casco.medidas, { ...CASCO_POR_DEFECTO });
  }
  // Y se puede saber que era desconocida, por si quien pinta quiere decirlo.
  assert.equal(cascoDeClase("Starfighter").conocida, true);
});

test("el nombre de clase se normaliza: una mayúscula no crea un desconocido", () => {
  // Viene con la caja que le puso quien escribió la plantilla del juego.
  for (const variante of ["Starfighter", "starfighter", "STARFIGHTER", " Star Fighter ", "star-fighter", "star_fighter"]) {
    assert.equal(claveDeClase(variante), "starfighter", `${variante} debería normalizar`);
    assert.equal(cascoDeClase(variante).conocida, true);
  }
  assert.equal(claveDeClase("   "), null, "solo espacios no es una clase");
});

test("las clases se distinguen de verdad, que es para lo que existe el catálogo", () => {
  // Si dos clases dieran la misma silueta, la lámina no aportaría nada sobre
  // leer el nombre en la tabla de al lado.
  const siluetas = new Set(
    Object.keys(CASCOS_POR_CLASE).map((clase) => JSON.stringify(cascoDeClase(clase).medidas)),
  );
  assert.equal(siluetas.size, Object.keys(CASCOS_POR_CLASE).length, "hay clases con la misma forma");

  // Y las relaciones que se prometen en el comentario se cumplen.
  const caza = CASCOS_POR_CLASE.starfighter;
  const carguero = CASCOS_POR_CLASE.freighter;
  const acorazado = CASCOS_POR_CLASE.dreadnought;
  assert.ok(caza.envergadura > carguero.envergadura, "el caza es casi todo ala");
  assert.ok(carguero.manga > caza.manga, "el carguero es una caja");
  assert.ok(acorazado.eslora > caza.eslora, "el acorazado es largo");
});

test("mallaDeClase entrega una malla lista para pintar", () => {
  const { malla, conocida, clave } = mallaDeClase("Corvette");
  assert.equal(conocida, true);
  assert.equal(clave, "corvette");
  assert.equal(malla.vertices.length, 6);
  assert.ok(malla.caras.length > 0);
  // La corbeta es más larga que el caza: se ve en el vértice del morro.
  assert.ok(mallaDeClase("Corvette").malla.vertices[0][2] > mallaDeClase("Starfighter").malla.vertices[0][2]);
});

// ---- La lámina --------------------------------------------------------------

function raizConLienzo() {
  const ordenes = [];
  const ctx = new Proxy(
    { fill: () => ordenes.push("fill"), stroke: () => ordenes.push("stroke") },
    {
      get: (obj, prop) => obj[prop] ?? (() => ordenes.push(String(prop))),
      set: () => true,
    },
  );
  const lienzo = { width: 120, height: 90, getContext: () => ctx };
  return {
    ordenes,
    querySelector: (sel) => (sel === "[data-lagunak-lamina]" ? lienzo : null),
  };
}

test("montar la lámina detiene la anterior: nada de bucles huérfanos", () => {
  // Sin esto, cada cambio de selección deja un bucle pintando sobre un lienzo
  // que ya no está en el documento.
  const raiz = raizConLienzo();
  const pendientes = [];
  let cancelados = 0;
  const opciones = {
    movimientoReducido: () => false,
    pedirFotograma: (fn) => { pendientes.push(fn); return pendientes.length; },
    cancelarFotograma: () => (cancelados += 1),
    ahora: () => 0,
  };

  montarLaminaContacto(raiz, { clase: "Frigate", color: "#00e5ff" }, opciones);
  assert.equal(cancelados, 0);
  montarLaminaContacto(raiz, { clase: "Corvette", color: "#ff2e88" }, opciones);
  assert.equal(cancelados, 1, "la primera lámina se detuvo al montar la segunda");

  assert.equal(desmontarLamina(raiz), true);
  assert.equal(cancelados, 2);
  assert.equal(desmontarLamina(raiz), false, "desmontar de más no hace daño");
});

test("un render que sustituye la raíz tampoco deja bucles huérfanos", () => {
  // Foundry puede tirar la raíz entera y montar otra en el mismo render. Si la
  // parada se guardara contra el elemento, la raíz nueva no encontraría la del
  // bucle anterior y aquel seguiría pintando sobre un lienzo desconectado.
  const primera = raizConLienzo();
  const segunda = raizConLienzo();
  const ventana = { nombre: "mapa vivo" };
  const pendientes = [];
  let cancelados = 0;
  const opciones = {
    dueño: ventana,
    movimientoReducido: () => false,
    pedirFotograma: (fn) => { pendientes.push(fn); return pendientes.length; },
    cancelarFotograma: () => (cancelados += 1),
    ahora: () => 0,
  };

  montarLaminaContacto(primera, { clase: "Frigate", color: "#00e5ff" }, opciones);
  assert.equal(cancelados, 0);
  montarLaminaContacto(segunda, { clase: "Corvette", color: "#ff2e88" }, opciones);
  assert.equal(cancelados, 1, "la lámina de la raíz sustituida se detuvo");

  assert.equal(desmontarLamina(segunda, ventana), true);
  assert.equal(cancelados, 2);
  // Y cerrar la ventana desde la raíz vieja tampoco resucita nada.
  assert.equal(desmontarLamina(primera, ventana), false);
});

test("sin contacto seleccionado o sin lienzo no se monta nada", () => {
  const raiz = raizConLienzo();
  assert.equal(montarLaminaContacto(raiz, null), null);
  assert.equal(montarLaminaContacto({ querySelector: () => null }, { clase: "Frigate" }), null);
  assert.equal(montarLaminaContacto(null, { clase: "Frigate" }), null);
});

test("la lámina dice qué clase pintó, y si la conocía", () => {
  const raiz = raizConLienzo();
  const opciones = { movimientoReducido: () => true, pedirFotograma: () => 0 };
  assert.deepEqual(
    montarLaminaContacto(raiz, { clase: "Dreadnought", color: "#ef233c" }, opciones),
    { clase: "dreadnought", conocida: true },
  );
  assert.deepEqual(
    montarLaminaContacto(raiz, { clase: "Vaporizador", color: "#ef233c" }, opciones),
    { clase: "vaporizador", conocida: false },
  );
  assert.ok(raiz.ordenes.includes("fill"), "y ha pintado de verdad");
});
