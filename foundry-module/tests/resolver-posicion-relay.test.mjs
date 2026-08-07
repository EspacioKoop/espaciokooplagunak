import assert from "node:assert/strict";
import test from "node:test";

import { resolverPosicionRelativa } from "../scripts/resolver-posicion-relay.mjs";

const CENTRO = { x: 1000, y: 2000 };

function cerca(a, b, margen = 1e-6) {
  assert.ok(Math.abs(a - b) < margen, `${a} ≉ ${b}`);
}

test("los cuatro rumbos cardinales caen donde debe caer cada uno", () => {
  const norte = resolverPosicionRelativa({ centro: CENTRO, lectura: { distancia: 500, rumboDeg: 0 } });
  cerca(norte.x, 1000);
  cerca(norte.y, 1500);

  const este = resolverPosicionRelativa({ centro: CENTRO, lectura: { distancia: 500, rumboDeg: 90 } });
  cerca(este.x, 1500);
  cerca(este.y, 2000);

  const sur = resolverPosicionRelativa({ centro: CENTRO, lectura: { distancia: 500, rumboDeg: 180 } });
  cerca(sur.x, 1000);
  cerca(sur.y, 2500);

  const oeste = resolverPosicionRelativa({ centro: CENTRO, lectura: { distancia: 500, rumboDeg: 270 } });
  cerca(oeste.x, 500);
  cerca(oeste.y, 2000);
});

test("es la inversa exacta del rumbo que publican los contactos degradados", () => {
  // La prueba que de verdad importa: si esta conversión y la de
  // `contactos-degradados.mjs` divergieran, los puntos de ruta caerían en el
  // sitio equivocado sin que fallara nada. Se reimplementa aquí el rumbo tal y
  // como lo calcula aquel módulo y se comprueba el viaje de ida y vuelta.
  const rumboDeContacto = (cx, cy, x, y) => {
    const grados = (Math.atan2(x - cx, -(y - cy)) * 180) / Math.PI;
    return grados < 0 ? grados + 360 : grados;
  };
  for (const destino of [
    { x: 1300, y: 1700 },
    { x: 400, y: 2600 },
    { x: 1000, y: 100 },
    { x: -500, y: 2000 },
  ]) {
    const dx = destino.x - CENTRO.x;
    const dy = destino.y - CENTRO.y;
    const distancia = Math.hypot(dx, dy);
    const rumboDeg = rumboDeContacto(CENTRO.x, CENTRO.y, destino.x, destino.y);
    const vuelta = resolverPosicionRelativa({ centro: CENTRO, lectura: { distancia, rumboDeg } });
    cerca(vuelta.x, destino.x, 1e-6);
    cerca(vuelta.y, destino.y, 1e-6);
  }
});

test("distancia cero es la propia nave, que es una marca legítima", () => {
  const aqui = resolverPosicionRelativa({ centro: CENTRO, lectura: { distancia: 0, rumboDeg: 137 } });
  cerca(aqui.x, 1000);
  cerca(aqui.y, 2000);
});

test("una distancia negativa se rechaza en vez de leerse como marcha atrás", () => {
  assert.equal(
    resolverPosicionRelativa({ centro: CENTRO, lectura: { distancia: -100, rumboDeg: 0 } }),
    null,
  );
});

test("sin datos utilizables no se aproxima al centro: se devuelve null", () => {
  // Colocar el punto de ruta encima de la nave porque no se supo leer el rumbo
  // sería peor que no colocarlo: parecería una decisión.
  for (const caso of [
    { centro: null, lectura: { distancia: 100, rumboDeg: 0 } },
    { centro: CENTRO, lectura: null },
    { centro: CENTRO, lectura: { distancia: "lejos", rumboDeg: 0 } },
    { centro: CENTRO, lectura: { distancia: 100, rumboDeg: "norte" } },
    { centro: { x: 1000 }, lectura: { distancia: 100, rumboDeg: 0 } },
    { centro: CENTRO, lectura: { distancia: Number.NaN, rumboDeg: 0 } },
    { centro: CENTRO, lectura: { distancia: 100, rumboDeg: Number.POSITIVE_INFINITY } },
  ]) {
    assert.equal(resolverPosicionRelativa(caso), null, JSON.stringify(caso));
  }
});
