import assert from "node:assert/strict";
import test from "node:test";

import { colisiona } from "../scripts/nave-movimiento.mjs";
import {
  PLANTA_VESTIBULO,
  componerVestibulo,
  PUERTA_VESTIBULO_HACIA_CANTINA,
  PUERTA_VESTIBULO_HACIA_INGENIERIA,
  PUERTA_VESTIBULO_HACIA_PASILLO,
} from "../scripts/nave-vestibulo.mjs";

test("el vestíbulo colisiona en sus límites salvo en sus tres puertas", () => {
  assert.equal(colisiona(-0.1, 3, 0.3, PLANTA_VESTIBULO), true);
  for (const puerta of [PUERTA_VESTIBULO_HACIA_CANTINA, PUERTA_VESTIBULO_HACIA_INGENIERIA, PUERTA_VESTIBULO_HACIA_PASILLO]) {
    const cx = Math.min(Math.max(puerta.x + puerta.ancho / 2, 0.5), PLANTA_VESTIBULO.ancho - 0.5);
    const cz = Math.min(Math.max(puerta.z + puerta.profundidad / 2, 0.5), PLANTA_VESTIBULO.profundidad - 0.5);
    assert.equal(colisiona(cx, cz, 0.3, PLANTA_VESTIBULO), false, `colisiona en la puerta ${JSON.stringify(puerta)}`);
  }
});

test("las tres puertas no se solapan entre sí", () => {
  const puertas = [PUERTA_VESTIBULO_HACIA_CANTINA, PUERTA_VESTIBULO_HACIA_INGENIERIA, PUERTA_VESTIBULO_HACIA_PASILLO];
  for (const puerta of puertas) {
    const centro = { x: puerta.x + puerta.ancho / 2, z: puerta.z + puerta.profundidad / 2 };
    const otras = puertas.filter((p) => p !== puerta);
    for (const otra of otras) {
      const dentro =
        centro.x >= otra.x && centro.x <= otra.x + otra.ancho && centro.z >= otra.z && centro.z <= otra.z + otra.profundidad;
      assert.equal(dentro, false, "dos puertas del vestíbulo se solapan");
    }
  }
});

test("componerVestibulo devuelve una escena con polígonos y sin estrellas (sin ventana a propósito)", () => {
  const escena = componerVestibulo(3, 0, 3, 0, { ancho: 200, alto: 100 });
  assert.ok(escena.poligonos.length > 0);
  assert.deepEqual(escena.estrellas, []);
});
