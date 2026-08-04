import assert from "node:assert/strict";
import test from "node:test";

import {
  ALTURA_MAXIMA_SALTO,
  colisiona,
  crearPlanta,
  mover,
  puertaTocada,
  vectorLocal,
} from "../scripts/nave-movimiento.mjs";

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
  assert.deepEqual(quieto, { x: 5, z: 5, y: 0, velocidadY: 0 });
  const sinTiempo = mover({ x: 5, z: 5, yaw: 0, activas: new Set(["adelante"]), dt: 0, planta });
  assert.deepEqual(sinTiempo, { x: 5, z: 5, y: 0, velocidadY: 0 });
});

test("mover: saltar en el suelo impulsa hacia arriba y la gravedad lo trae de vuelta", () => {
  const planta = crearPlanta({ ancho: 10, profundidad: 10 });
  const dt = 1 / 60; // ritmo de fotograma real, no un `dt` de test artificialmente grande
  let estado = { x: 5, z: 5, y: 0, velocidadY: 0 };
  estado = mover({ ...estado, yaw: 0, activas: new Set(["saltar"]), dt, planta });
  assert.ok(estado.y > 0, `debería haber despegado: y=${estado.y}`);
  assert.ok(estado.velocidadY > 0, "sube con velocidad vertical positiva");

  // Seguir "manteniendo" saltar en el aire no debe reiniciar el impulso: solo
  // cuenta al iniciar el salto desde el suelo.
  let maximo = estado.y;
  for (let i = 0; i < 200 && estado.y > 0; i += 1) {
    estado = mover({ ...estado, yaw: 0, activas: new Set(["saltar"]), dt, planta });
    maximo = Math.max(maximo, estado.y);
  }
  assert.equal(estado.y, 0, "vuelve a tocar el suelo");
  assert.equal(estado.velocidadY, 0, "sin velocidad vertical al aterrizar");
  // Integración discreta: el fotograma de despegue no frena por gravedad ese
  // mismo paso, así que el pico real se pasa un poco del límite analítico
  // (v²/2g) — el margen cubre ese error de discretización a 60fps, no lo
  // reemplaza por un límite laxo.
  assert.ok(maximo <= ALTURA_MAXIMA_SALTO * 1.2, `no debería superar el límite con margen: máximo=${maximo}`);
});

test("mover: agacharse en el suelo baja la cámara sin física de gravedad", () => {
  const planta = crearPlanta({ ancho: 10, profundidad: 10 });
  const agachado = mover({ x: 5, z: 5, y: 0, velocidadY: 0, yaw: 0, activas: new Set(["agachado"]), dt: 0.1, planta });
  assert.ok(agachado.y < 0, `debería haber bajado: y=${agachado.y}`);
  assert.equal(agachado.velocidadY, 0);

  const dePie = mover({ ...agachado, yaw: 0, activas: new Set(), dt: 0.1, planta });
  assert.equal(dePie.y, 0, "soltar la tecla vuelve a la altura normal");
});

test("mover: agacharse en el aire no hace nada, solo aplica en el suelo", () => {
  const planta = crearPlanta({ ancho: 10, profundidad: 10 });
  const enElAire = { x: 5, z: 5, y: 0.3, velocidadY: 1 };
  const paso = mover({ ...enElAire, yaw: 0, activas: new Set(["agachado"]), dt: 0.1, planta });
  assert.ok(paso.y > 0, "sigue en el aire, la gravedad sigue integrando, no se clava a -offset");
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

test("puertaTocada: null sin solape, la puerta cuando se solapa", () => {
  const puertas = [
    { rect: { x: 4, z: 8, ancho: 2, profundidad: 0.5 }, destino: { estancia: "b" } },
  ];
  assert.equal(puertaTocada(1, 1, 0.3, puertas), null);
  const tocada = puertaTocada(5, 8.2, 0.3, puertas);
  assert.equal(tocada?.destino?.estancia, "b");
});

test("puertaTocada: una puerta no bloquea el paso, solo se detecta", () => {
  // A diferencia de un obstáculo, una puerta jamás debería usarse dentro de
  // `planta.obstaculos` — este test documenta que `mover` no la conoce en
  // absoluto: la traspone sin más porque no es responsabilidad suya.
  const planta = crearPlanta({ ancho: 10, profundidad: 10 });
  const paso = mover({ x: 5, z: 4.5, yaw: 0, activas: new Set(["adelante"]), dt: 1, planta, velocidad: 2 });
  assert.ok(paso.z > 4.5);
});

test("puertaTocada: sin puertas, o con lista vacía, no revienta", () => {
  assert.equal(puertaTocada(1, 1, 0.3, []), null);
  assert.equal(puertaTocada(1, 1, 0.3, undefined), null);
});
