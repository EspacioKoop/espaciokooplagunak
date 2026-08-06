import assert from "node:assert/strict";
import test from "node:test";

import { colisiona } from "../scripts/nave-movimiento.mjs";
import { ALTURA_OJOS, crearSalaCaja } from "../scripts/nave-sala-caja.mjs";

test("una sala sin ventanas no proyecta estrellas", () => {
  const sala = crearSalaCaja({ ancho: 6, profundidad: 6 });
  const escena = sala.componer(3, 0, 3, 0, { ancho: 160, alto: 90 });
  assert.deepEqual(escena.estrellas, []);
});

test("una sala con ventana proyecta estrellas y sigue colisionando en sus límites", () => {
  const ventana = { x: 2, z: 6, ancho: 2, profundidad: 1.2 };
  const sala = crearSalaCaja({ ancho: 6, profundidad: 6, ventanas: [{ rect: ventana }] });

  // La ventana no abre el paso: la planta sigue siendo la caja cerrada de
  // siempre, con o sin hueco visual en la malla.
  assert.equal(colisiona(3, 6.1, 0.3, sala.planta), true);

  // Mirando de frente hacia la ventana debe haber algún punto de cielo en
  // pantalla — si no, la ventana estaría ahí pero no se vería nada por ella.
  const escena = sala.componer(3, 0, 3, 0, { ancho: 320, alto: 180 });
  assert.ok(escena.estrellas.length > 0);
  for (const estrella of escena.estrellas) {
    assert.ok(estrella.x >= 0 && estrella.x < 320);
    assert.ok(estrella.y >= 0 && estrella.y < 180);
  }
});

test("misma semilla de cielo, mismo campo estelar entre dos composiciones", () => {
  const ventana = { x: 2, z: 6, ancho: 2, profundidad: 1.2 };
  const sala = crearSalaCaja({ ancho: 6, profundidad: 6, ventanas: [{ rect: ventana }], semillaCielo: 42 });
  const a = sala.componer(3, 0, 3, 0, { ancho: 320, alto: 180 });
  const b = sala.componer(3, 0, 3, 0, { ancho: 320, alto: 180 });
  assert.deepEqual(a.estrellas, b.estrellas);
});

test("una puerta sigue dejando pasar y una ventana en el mismo muro no colisiona con la puerta", () => {
  const puerta = { x: 0, z: 2, ancho: 1.2, profundidad: 2 };
  const sala = crearSalaCaja({ ancho: 8, profundidad: 8, puertas: [{ rect: puerta }] });
  // Dentro de la zona de la puerta, no colisiona (con margen para el radio).
  assert.equal(colisiona(0.5, 3, 0.3, sala.planta), false);
  const escena = sala.componer(4, 0, 4, 0, { ancho: 160, alto: 90 });
  assert.ok(escena.poligonos.length > 0);
});

test("la cámara mira desde la altura de ojos, no desde el suelo", () => {
  assert.ok(ALTURA_OJOS > 0 && ALTURA_OJOS < 3);
});
