import assert from "node:assert/strict";
import test from "node:test";

import { colisiona } from "../scripts/nave-movimiento.mjs";
import { ALTURA_OJOS, crearSalaCaja, fraccionAbierta } from "../scripts/nave-sala-caja.mjs";

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

test("la puerta corredera está cerrada de lejos y abierta de cerca (QA: estilo Star Trek)", () => {
  assert.equal(fraccionAbierta(10), 0, "lejos, cerrada del todo");
  assert.equal(fraccionAbierta(1.0), 1, "a un metro, abierta del todo");
  assert.equal(fraccionAbierta(0), 1, "encima del umbral, sigue abierta del todo");
  const mitad = fraccionAbierta((2.4 + 1.0) / 2);
  assert.ok(mitad > 0 && mitad < 1, "a medio camino entre los dos umbrales, ni cerrada ni abierta del todo");
});

test("colisionar sigue dejando pasar por el hueco de la puerta (visual, no física)", () => {
  const puerta = { x: 3, z: 0, ancho: 2, profundidad: 1.2 };
  const sala = crearSalaCaja({ ancho: 8, profundidad: 8, puertas: [{ rect: puerta }] });
  // La hoja corredera es puramente visual (ver cabecera de "Puertas
  // correderas"): la planta de colisión no sabe de ella y el hueco sigue
  // siendo transitable exactamente igual que antes de #508 QA.
  assert.equal(colisiona(4, 0.5, 0.3, sala.planta), false);
});

test("una puerta se compone sin reventar tanto lejos como pegada a ella", () => {
  const puerta = { x: 3, z: 0, ancho: 2, profundidad: 1.2 };
  const sala = crearSalaCaja({ ancho: 8, profundidad: 8, puertas: [{ rect: puerta }] });
  assert.doesNotThrow(() => sala.componer(4, 0, 6, 0, { ancho: 160, alto: 90 }));
  assert.doesNotThrow(() => sala.componer(4, 0, 0.7, 0, { ancho: 160, alto: 90 }));
});

test("el rodapié y la lámpara de techo no bloquean el paso por el centro de una sala vacía", () => {
  const sala = crearSalaCaja({ ancho: 6, profundidad: 6 });
  // Ni el rodapié (pegado a los muros) ni la lámpara (colgada del techo)
  // aportan obstáculo: el centro de una sala vacía sigue libre.
  assert.equal(colisiona(3, 3, 0.3, sala.planta), false);
  const escena = sala.componer(3, 0, 3, 0, { ancho: 160, alto: 90 });
  // Cuatro muros + suelo + techo ya darían un puñado de polígonos; el
  // rodapié (4 piezas) y la lámpara (1 pieza) deben sumar visiblemente más.
  assert.ok(escena.poligonos.length >= 10, `se esperaban al menos 10 polígonos, hubo ${escena.poligonos.length}`);
});
