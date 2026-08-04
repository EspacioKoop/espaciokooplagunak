import assert from "node:assert/strict";
import test from "node:test";

import { colisiona, crearPlanta, mover, vectorLocal } from "../scripts/nave-movimiento.mjs";

test("crearPlanta exige medidas positivas", () => {
  assert.throws(() => crearPlanta({ ancho: 0, profundidad: 5 }), RangeError);
  assert.throws(() => crearPlanta({ ancho: 5, profundidad: -1 }), RangeError);
});

test("colisiona: fuera de los límites de la planta siempre colisiona", () => {
  const planta = crearPlanta({ ancho: 10, profundidad: 10 });
  assert.equal(colisiona(-0.1, 5, 0.3, planta), true);
  assert.equal(colisiona(5, 10.2, 0.3, planta), true);
  assert.equal(colisiona(5, 5, 0.3, planta), false);
});

test("colisiona: un círculo choca con un obstáculo aunque su centro no esté dentro", () => {
  const planta = crearPlanta({
    ancho: 10,
    profundidad: 10,
    obstaculos: [{ x: 4, z: 4, ancho: 2, profundidad: 2 }],
  });
  // Centro justo al lado del obstáculo (borde en x=6), radio 0.5: se solapa.
  assert.equal(colisiona(6.3, 5, 0.5, planta), true);
  // Más lejos, ya no se solapa.
  assert.equal(colisiona(7, 5, 0.5, planta), false);
  // Dentro del obstáculo, siempre colisiona.
  assert.equal(colisiona(5, 5, 0.1, planta), true);
});

test("vectorLocal: diagonal normalizada, no más rápida que un solo eje", () => {
  const soloAdelante = vectorLocal(new Set(["adelante"]));
  const diagonal = vectorLocal(new Set(["adelante", "derecha"]));
  assert.ok(Math.abs(Math.hypot(soloAdelante.x, soloAdelante.z) - 1) < 1e-9);
  assert.ok(Math.abs(Math.hypot(diagonal.x, diagonal.z) - 1) < 1e-9);
});

test("vectorLocal: direcciones opuestas se cancelan, no hay teclas activas", () => {
  const v = vectorLocal(new Set(["adelante", "atras", "izquierda", "derecha"]));
  assert.deepEqual(v, { x: 0, z: 0 });
});

test("vectorLocal acepta un objeto plano además de un Set", () => {
  const v = vectorLocal({ adelante: true });
  assert.equal(v.z, 1);
  assert.equal(v.x, 0);
});

test("mover: sin teclas activas, o sin dt, no cambia la posición", () => {
  const planta = crearPlanta({ ancho: 10, profundidad: 10 });
  const quieto = mover({ x: 5, z: 5, yaw: 0, activas: new Set(), dt: 1, planta });
  assert.deepEqual(quieto, { x: 5, z: 5 });
  const sinTiempo = mover({ x: 5, z: 5, yaw: 0, activas: new Set(["adelante"]), dt: 0, planta });
  assert.deepEqual(sinTiempo, { x: 5, z: 5 });
});

test("mover: adelante con yaw=0 avanza en +z, la velocidad es distancia/tiempo", () => {
  const planta = crearPlanta({ ancho: 10, profundidad: 10 });
  const paso = mover({
    x: 5,
    z: 5,
    yaw: 0,
    activas: new Set(["adelante"]),
    dt: 1,
    planta,
    velocidad: 2,
  });
  assert.ok(Math.abs(paso.x - 5) < 1e-9);
  assert.ok(Math.abs(paso.z - 7) < 1e-9);
});

test("mover: yaw gira la dirección de avance", () => {
  const planta = crearPlanta({ ancho: 20, profundidad: 20 });
  // Mirando a +90°, "adelante" debería desplazar en +x en vez de +z.
  const paso = mover({
    x: 10,
    z: 10,
    yaw: Math.PI / 2,
    activas: new Set(["adelante"]),
    dt: 1,
    planta,
    velocidad: 1,
  });
  assert.ok(Math.abs(paso.z - 10) < 1e-6);
  assert.ok(paso.x > 10);
});

test("mover: una pared para el avance en su eje sin teleportar a través", () => {
  const planta = crearPlanta({
    ancho: 10,
    profundidad: 10,
    obstaculos: [{ x: 4.5, z: 6, ancho: 1, profundidad: 3 }],
  });
  // Yendo hacia +z a toda velocidad, un paso grande no debe cruzar la pared.
  const paso = mover({
    x: 5,
    z: 5,
    yaw: 0,
    activas: new Set(["adelante"]),
    dt: 1,
    planta,
    velocidad: 10,
    radio: 0.3,
  });
  assert.ok(paso.z < 5.7, `no debería haber cruzado la pared: z=${paso.z}`);
  assert.equal(colisiona(paso.x, paso.z, 0.3, planta), false);
});

test("mover: rozar una pared en diagonal desliza, no bloquea el otro eje", () => {
  // Pared vertical a la derecha (obstáculo ancho en x, largo en z). Moverse en
  // diagonal adelante+derecha debería seguir avanzando en z aunque x se pare.
  const planta = crearPlanta({
    ancho: 10,
    profundidad: 10,
    obstaculos: [{ x: 6, z: 0, ancho: 4, profundidad: 10 }],
  });
  const activas = new Set(["adelante", "derecha"]);
  let pos = { x: 5, z: 5 };
  for (let i = 0; i < 30; i += 1) {
    pos = mover({ ...pos, yaw: 0, activas, dt: 0.1, planta, velocidad: 2, radio: 0.3 });
  }
  // Debería haberse acercado a la pared en x (sin cruzarla) y haber avanzado
  // en z de todos modos: deslizar, no clavarse.
  assert.ok(pos.z > 5.5, `debería haber avanzado en z: z=${pos.z}`);
  assert.equal(colisiona(pos.x, pos.z, 0.3, planta), false);
});

test("mover: nunca deja al andante fuera de los límites de la planta", () => {
  const planta = crearPlanta({ ancho: 6, profundidad: 6 });
  let pos = { x: 3, z: 3 };
  const activas = new Set(["adelante"]);
  for (let i = 0; i < 100; i += 1) {
    pos = mover({ ...pos, yaw: 0, activas, dt: 0.5, planta, velocidad: 3, radio: 0.4 });
  }
  assert.ok(pos.z + 0.4 <= planta.profundidad + 1e-9, `se salió del fondo: z=${pos.z}`);
});
