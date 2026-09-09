// Test para armas-catalogo.mjs

import { describe, it, before } from "node:test";
import assert from "node:assert/strict";

let ARMAS_POR_CLASE;
let piezasArma;

before(async () => {
  const mod = await import("../scripts/armas-catalogo.mjs");
  ARMAS_POR_CLASE = mod.ARMAS_POR_CLASE;
  piezasArma = mod.piezasArma;
});

describe("armas-catalogo", () => {
  it("tiene exactamente las 12 clases del SRD", () => {
    const claves = Object.keys(ARMAS_POR_CLASE);
    const esperadas = [
      "barbaro",
      "bardo",
      "clerigo",
      "druida",
      "guerrero",
      "monje",
      "paladin",
      "explorador",
      "picaro",
      "hechicero",
      "brujo",
      "mago",
    ];
    assert.strictEqual(claves.length, 12, `esperaba 12 armas, hay ${claves.length}: ${claves.join(",")}`);
    for (const c of esperadas) {
      assert.ok(claves.includes(c), `falta la clase ${c}`);
    }
  });

  it("el hacha tiene hoja lateral ancha y corta, unida al extremo del mango", () => {
    const [mango, hoja] = ARMAS_POR_CLASE.barbaro.piezas;
    assert.ok(hoja.medidas[0] >= mango.medidas[0] * 4, "no otra vara como la espada");
    assert.ok(hoja.medidas[0] > hoja.medidas[1], "hoja ancha, no una lámina vertical");
    assert.ok(hoja.medidas[1] < mango.medidas[1] / 2, "cabeza concentrada en el extremo");
    assert.ok(hoja.centro[0] > mango.centro[0], "silueta lateral, no espada simétrica");
    const max = (p, axis) => p.centro[axis] + p.medidas[axis] / 2;
    const min = (p, axis) => p.centro[axis] - p.medidas[axis] / 2;
    for (const axis of [0, 1, 2]) {
      assert.ok(min(hoja, axis) <= max(mango, axis) && min(mango, axis) <= max(hoja, axis),
        "hoja flotante sin contacto con el mango");
    }
    assert.ok(min(hoja, 1) >= min(mango, 1) + mango.medidas[1] * 0.7);
    const geometry = clase => ARMAS_POR_CLASE[clase].piezas.map(({ centro, medidas }) => ({ centro, medidas }));
    for (const clase of ["guerrero", "paladin", "druida"]) {
      assert.notDeepEqual(geometry("barbaro"), geometry(clase), "no basta cambiar nombre/color");
    }
  });

  it("cada arma tiene al menos 2 piezas", () => {
    for (const [clase, arma] of Object.entries(ARMAS_POR_CLASE)) {
      assert.ok(Array.isArray(arma.piezas), `${clase}: piezas no es array`);
      assert.ok(arma.piezas.length >= 2, `${clase}: tiene ${arma.piezas.length} piezas, se esperan >=2`);
    }
  });

  it("el filo del hacha no flota y todas sus cajas tienen volumen finito", () => {
    const piezas = piezasArma("barbaro", [-3, 2, 7]);
    for (let i = 0; i < piezas.length; i++) {
      const p = piezas[i];
      assert.ok(p.centro.every(Number.isFinite));
      assert.ok(p.medidas.every(n => Number.isFinite(n) && n > 0));
      if (i === 0) continue;
      assert.ok(piezas.slice(0, i).some(q => p.centro.every((v, axis) =>
        Math.abs(v - q.centro[axis]) <= (p.medidas[axis] + q.medidas[axis]) / 2)),
      "cada pieza nueva toca al menos una pieza anterior");
    }
  });

  it("piezasArma traslada correctamente las piezas", () => {
    const originales = ARMAS_POR_CLASE.barbaro.piezas;
    const trasladadas = piezasArma("barbaro", [1, 2, 3]);
    assert.strictEqual(trasladadas.length, originales.length);
    for (let i = 0; i < originales.length; i++) {
      const o = originales[i].centro;
      const t = trasladadas[i].centro;
      assert.strictEqual(t[0], o[0] + 1);
      assert.strictEqual(t[1], o[1] + 2);
      assert.strictEqual(t[2], o[2] + 3);
    }
  });

  it("piezasArma lanza error con clase desconocida", () => {
    assert.throws(() => piezasArma("noexiste"), /Clase desconocida/);
  });

  it("cada pieza tiene nombre, color, centro y medidas", () => {
    for (const [clase, arma] of Object.entries(ARMAS_POR_CLASE)) {
      for (const p of arma.piezas) {
        assert.ok(typeof p.nombre === "string" && p.nombre.length > 0, `${clase}: pieza sin nombre`);
        assert.ok(typeof p.color === "string" && p.color.length > 0, `${clase}: pieza sin color`);
        assert.ok(Array.isArray(p.centro) && p.centro.length === 3, `${clase}: centro inválido`);
        assert.ok(Array.isArray(p.medidas) && p.medidas.length === 3, `${clase}: medidas inválidas`);
      }
    }
  });

  it("ARMAS_POR_CLASE está congelado", () => {
    assert.throws(() => {
      ARMAS_POR_CLASE.nueva = { nombre: "x", piezas: [] };
    });
    assert.throws(() => {
      ARMAS_POR_CLASE.barbaro.piezas.push({});
    });
  });
});
