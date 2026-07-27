import assert from "node:assert/strict";
import test from "node:test";

import {
  porcentajeBarra,
  nivelRecurso,
  nivelCalor,
  barraRecurso,
  barrasSistema,
  aplicarBarraDom,
  UMBRALES,
} from "../scripts/barras-estado.mjs";

test("el porcentaje se acota y redondea; sin máximo no hay barra", () => {
  assert.equal(porcentajeBarra(50, 200), 25);
  assert.equal(porcentajeBarra(200, 200), 100);
  assert.equal(porcentajeBarra(0, 200), 0);
  // Un casco negativo (destruido) no pinta barra por debajo de cero.
  assert.equal(porcentajeBarra(-10, 200), 0);
  // Ni una lectura por encima del máximo desborda la pista.
  assert.equal(porcentajeBarra(300, 200), 100);
  // Sin datos suficientes: null («no pintes barra»), nunca 0 («todo perdido»).
  for (const caso of [[null, 100], [50, 0], [50, null], ["x", 100], [50, undefined]]) {
    assert.equal(porcentajeBarra(caso[0], caso[1]), null, `esperaba null en ${JSON.stringify(caso)}`);
  }
});

test("la severidad de un recurso empeora al vaciarse", () => {
  assert.equal(nivelRecurso(100), "ok");
  assert.equal(nivelRecurso(UMBRALES.recursoAviso + 1), "ok");
  assert.equal(nivelRecurso(UMBRALES.recursoAviso), "aviso");
  assert.equal(nivelRecurso(UMBRALES.recursoCritico + 1), "aviso");
  assert.equal(nivelRecurso(UMBRALES.recursoCritico), "critico");
  assert.equal(nivelRecurso(0), "critico");
  assert.equal(nivelRecurso(null), null);
});

test("la severidad del calor empeora al subir (criterio invertido)", () => {
  assert.equal(nivelCalor(0), "ok");
  assert.equal(nivelCalor(UMBRALES.calorAviso - 1), "ok");
  assert.equal(nivelCalor(UMBRALES.calorAviso), "aviso");
  assert.equal(nivelCalor(UMBRALES.calorCritico - 1), "aviso");
  assert.equal(nivelCalor(UMBRALES.calorCritico), "critico");
  assert.equal(nivelCalor(100), "critico");
  // Un sistema frío es "ok" y uno vacío de salud es "critico": el mismo 0
  // significa lo contrario según la magnitud.
  assert.equal(nivelCalor(0), "ok");
  assert.equal(nivelRecurso(0), "critico");
});

test("barraRecurso combina porcentaje y nivel, o null sin lectura", () => {
  assert.deepEqual(barraRecurso(200, 200), { pct: 100, nivel: "ok" });
  assert.deepEqual(barraRecurso(20, 200), { pct: 10, nivel: "critico" });
  assert.equal(barraRecurso(20, 0), null);
});

test("barrasSistema escala la potencia a su rango real (hasta 300%)", () => {
  const barras = barrasSistema({ health: 100, heat: 0, power: 100 });
  assert.deepEqual(barras.salud, { pct: 100, nivel: "ok" });
  assert.deepEqual(barras.calor, { pct: 0, nivel: "ok" });
  // Potencia nominal (100%) llena un tercio de la pista, no la pista entera.
  assert.equal(barras.potencia.pct, 33);
  // Y la potencia no tiene severidad: es una consigna, no un peligro.
  assert.equal(barras.potencia.nivel, "ok");
  assert.equal(barrasSistema({ health: 100, heat: 0, power: 300 }).potencia.pct, 100);

  const dañado = barrasSistema({ health: 10, heat: 90, power: 0 });
  assert.equal(dañado.salud.nivel, "critico");
  assert.equal(dañado.calor.nivel, "critico");
});

// DOM mínimo: lo justo que toca aplicarBarraDom.
function celda({ conTexto = true, conBarra = true } = {}) {
  const relleno = { style: {}, dataset: {} };
  const texto = { textContent: "" };
  return {
    textContent: "",
    relleno,
    texto,
    querySelector(sel) {
      if (sel === "[data-texto]") return conTexto ? texto : null;
      if (sel === "[data-relleno]") return conBarra ? relleno : null;
      return null;
    },
  };
}

test("aplicarBarraDom actualiza texto y relleno sin rehacer el DOM", () => {
  const nodo = celda();
  aplicarBarraDom(nodo, "150 / 200", { pct: 75, nivel: "ok" });
  assert.equal(nodo.texto.textContent, "150 / 200");
  assert.equal(nodo.relleno.style.width, "75%");
  assert.equal(nodo.relleno.dataset.nivel, "ok");

  aplicarBarraDom(nodo, "40 / 200", { pct: 20, nivel: "critico" });
  assert.equal(nodo.texto.textContent, "40 / 200");
  assert.equal(nodo.relleno.style.width, "20%");
  assert.equal(nodo.relleno.dataset.nivel, "critico");
});

test("sin lectura, el relleno se vacía y pierde su nivel", () => {
  const nodo = celda();
  aplicarBarraDom(nodo, "? / ?", { pct: 50, nivel: "ok" });
  aplicarBarraDom(nodo, "? / ?", null);
  assert.equal(nodo.relleno.style.width, "0%");
  assert.equal("nivel" in nodo.relleno.dataset, false);
});

test("una celda sin barra sigue recibiendo su texto (el número es la verdad)", () => {
  const plano = celda({ conTexto: false, conBarra: false });
  aplicarBarraDom(plano, "80%", { pct: 80, nivel: "ok" });
  assert.equal(plano.textContent, "80%");
  // Y un nodo ausente no revienta el patch de telemetría.
  assert.doesNotThrow(() => aplicarBarraDom(null, "80%", { pct: 80, nivel: "ok" }));
});
