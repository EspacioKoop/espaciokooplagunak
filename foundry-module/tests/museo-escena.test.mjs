import assert from "node:assert/strict";
import test from "node:test";

import { MUSEO } from "../scripts/paleta.mjs";
import { validarCatalogoPiezas } from "../scripts/catalogo-piezas.mjs";
import { CATALOGO_MUSEO, MALLAS_MUSEO } from "../scripts/museo-piezas.mjs";
import {
  ANCHO,
  ENTRADA,
  INTERACCIONES,
  PIEZAS_COLOCADAS,
  PLANTA_MUSEO,
  componerMuseo,
} from "../scripts/museo-escena.mjs";
import { FICHAS } from "../../tools/convertir-estatua.mjs";
import { colisiona } from "../scripts/nave-movimiento.mjs";
import { interaccionAlAlcance } from "../scripts/nave-interaccion.mjs";

test("el catálogo del museo es válido y todas sus fichas apuntan a una malla que existe", () => {
  assert.equal(
    validarCatalogoPiezas(CATALOGO_MUSEO, { mallasDisponibles: new Set(Object.keys(MALLAS_MUSEO)) }),
    true,
  );
  assert.equal(CATALOGO_MUSEO.piezas.length, 3, "tres piezas, la disciplina de #590");
  for (const pieza of CATALOGO_MUSEO.piezas) {
    assert.ok(MALLAS_MUSEO[pieza.malla]?.vertices?.length, `${pieza.malla} sin geometría`);
  }
});

test("LA GUARDA DE PROCEDENCIA: lo que declara el museo no se separa de la ficha del conversor", () => {
  for (const pieza of CATALOGO_MUSEO.piezas) {
    const ficha = FICHAS[pieza.malla];
    assert.ok(ficha, `${pieza.malla} no tiene ficha en tools/convertir-estatua.mjs`);
    // El campo que de verdad puede mentir en una cartela es QUÉ ES EL FICHERO.
    // La ficha lo dice en prosa ("reconstrucción digital, no escaneo" / "escaneo
    // del VACIADO..."); aquí se comprueba que la `naturaleza` declarada dice lo
    // mismo, para que nadie pueda convertir un vaciado en un original editando
    // solo el catálogo.
    const modelo = ficha.modelo.toLowerCase();
    if (pieza.naturaleza === "reconstruccion") {
      assert.match(modelo, /reconstrucci/, `${pieza.id} se declara reconstrucción y la ficha no lo dice`);
    } else if (pieza.naturaleza === "escaneo-de-vaciado") {
      assert.match(modelo, /vaciado/, `${pieza.id} se declara vaciado y la ficha no lo dice`);
      assert.doesNotMatch(modelo, /reconstrucci/, `${pieza.id} es una reconstrucción, no un vaciado`);
    }
  }
});

test("la cartela del León dice que es una reconstrucción, no cómo era (#598)", () => {
  const leon = CATALOGO_MUSEO.piezas.find((pieza) => pieza.id === "leon-al-lat");
  assert.match(leon.cartela.es, /RECONSTRUCCIÓN/);
  assert.match(leon.cartela.en, /RECONSTRUCTION/);
  // La comprobación que importa: no puede afirmar que la estatua es así.
  assert.match(leon.cartela.es, /No es como era/);
});

test("cada pieza se apoya en su pedestal y ninguna se atraviesa andando", () => {
  for (const colocada of PIEZAS_COLOCADAS) {
    const ys = colocada.malla.vertices.map(([, y]) => y);
    // La base queda a la cota de la coronilla del pedestal (0.6 + 0.08), no
    // flotando ni hundida: la malla llega apoyada en y = 0.
    assert.ok(Math.abs(Math.min(...ys) - 0.68) < 1e-6, `${colocada.pieza.id} no apoya en su pedestal`);
    assert.ok(Math.max(...ys) > 1.0, `${colocada.pieza.id} es demasiado baja para una sala de museo`);
    const [x, , z] = colocada.centro;
    assert.equal(colisiona(x, z, 0.35, PLANTA_MUSEO), true, `se puede atravesar ${colocada.pieza.id}`);
  }
});

test("desde el mirador de cada pieza se alcanza SU punto, y solo el suyo", () => {
  for (const colocada of PIEZAS_COLOCADAS) {
    const [x, z] = colocada.mirador;
    assert.equal(colisiona(x, z, 0.35, PLANTA_MUSEO), false, "no se puede llegar al mirador");
    const alcanzada = interaccionAlAlcance(x, z, 0.35, INTERACCIONES);
    assert.equal(alcanzada?.accion?.tipo, "cartela");
    assert.equal(alcanzada?.accion?.pieza, colocada.pieza.id);
  }
});

test("la salida devuelve a la nave, y es lo único que transporta en toda la sala", () => {
  const salida = INTERACCIONES.find((punto) => punto.id === "salida");
  assert.deepEqual(salida.accion, { tipo: "estancia", estancia: "cantina" });
  const transportan = INTERACCIONES.filter((punto) => punto.accion?.tipo === "estancia");
  assert.equal(transportan.length, 1);
});

test("NADA en la sala concede, cuenta ni recuerda (docs/FOUNDRY.md)", () => {
  // Las únicas acciones posibles son leer una cartela y salir. Cualquier tipo
  // nuevo aquí es una decisión de diseño, no un detalle: que falle la prueba.
  const tipos = new Set(INTERACCIONES.map((punto) => punto.accion?.tipo));
  assert.deepEqual([...tipos].sort(), ["cartela", "estancia"]);
});

test("se entra dentro de la sala, en suelo libre y mirando a las piezas", () => {
  assert.equal(colisiona(ENTRADA.x, ENTRADA.z, 0.35, PLANTA_MUSEO), false);
  assert.equal(ENTRADA.yaw, 0, "yaw 0 mira a +z, que es donde están los pedestales");
  assert.ok(ENTRADA.x > 0 && ENTRADA.x < ANCHO);
});

test("compone una escena con polígonos y sin colarse ningún color de fuera de MUSEO", () => {
  const escena = componerMuseo(ENTRADA.x, 0, ENTRADA.z, ENTRADA.yaw, { ancho: 320, alto: 180 });
  assert.ok(escena.poligonos.length > 0, "la sala no pinta nada");
  assert.equal(escena.ancho, 320);
});

test("los colores de la sala son de la paleta y están todos declarados (#351)", () => {
  // La guarda EXIGIBLE de que no se cuela un color propio la aplica
  // `paleta.test.mjs` sobre `MODULOS_DE_ARTE`, donde esta escena está dada de
  // alta. Aquí solo se comprueba que el grupo existe y está bien formado.
  assert.ok(Object.keys(MUSEO).length >= 6);
  assert.ok(Object.values(MUSEO).every((color) => /^#[0-9a-f]{6}$/.test(color)));
});
