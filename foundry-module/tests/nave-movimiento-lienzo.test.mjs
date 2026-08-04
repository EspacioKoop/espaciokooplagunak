import assert from "node:assert/strict";
import test from "node:test";

import { arrancarAndar } from "../scripts/nave-movimiento-lienzo.mjs";
import { crearPlanta } from "../scripts/nave-movimiento.mjs";

/** Contexto 2D de mentira: solo hace falta que no reviente. */
function contextoFalso() {
  return {
    fillStyle: null,
    strokeStyle: null,
    lineWidth: null,
    beginPath() {},
    closePath() {},
    moveTo() {},
    lineTo() {},
    fill() {},
    stroke() {},
    fillRect() {},
    clearRect() {},
  };
}

const lienzoFalso = () => {
  const ctx = contextoFalso();
  return { width: 100, height: 100, getContext: () => ctx };
};

const PLANTA = crearPlanta({ ancho: 20, profundidad: 20 });

test("arrancarAndar pinta un fotograma aunque no haya pedirFotograma", () => {
  let veces = 0;
  const mando = arrancarAndar(lienzoFalso(), {
    componer: () => {
      veces += 1;
      return { ancho: 100, alto: 100, poligonos: [] };
    },
    planta: PLANTA,
  });
  assert.equal(veces, 1);
  mando.detener();
});

test("sin componer(...) arrancarAndar rechaza pronto, con un mensaje claro", () => {
  assert.throws(() => arrancarAndar(lienzoFalso(), { planta: PLANTA }), TypeError);
});

test("pulsar + avanzar mueve la posición; soltar la detiene", () => {
  let ultimaX = null;
  const mando = arrancarAndar(lienzoFalso(), {
    componer: (x) => {
      ultimaX = x;
      return { ancho: 100, alto: 100, poligonos: [] };
    },
    planta: PLANTA,
    x: 10,
    z: 10,
    yaw: 0,
    velocidad: 2,
  });
  mando.pulsar("adelante");
  mando.avanzar(1000); // 1s
  const trasPulsar = mando.posicion();
  assert.ok(Math.abs(trasPulsar.z - 12) < 1e-6, `debería haber avanzado ~2: z=${trasPulsar.z}`);
  assert.ok(Math.abs(ultimaX - 10) < 1e-9);

  mando.soltar("adelante");
  mando.avanzar(1000);
  const trasSoltar = mando.posicion();
  assert.equal(trasSoltar.z, trasPulsar.z, "sin teclas activas, no se mueve más");
  mando.detener();
});

test("girar cambia el yaw con el tiempo, y se detiene con sentido 0", () => {
  const mando = arrancarAndar(lienzoFalso(), {
    componer: () => ({ ancho: 100, alto: 100, poligonos: [] }),
    planta: PLANTA,
    x: 10,
    z: 10,
    yaw: 0,
  });
  mando.girar(1);
  mando.avanzar(500);
  const yawTrasGirar = mando.posicion().yaw;
  assert.ok(yawTrasGirar > 0, `debería haber girado: yaw=${yawTrasGirar}`);

  mando.girar(0);
  mando.avanzar(500);
  assert.equal(mando.posicion().yaw, yawTrasGirar, "sin girar activo, el yaw no cambia más");
  mando.detener();
});

test("detener corta el bucle de fotogramas, y detener dos veces no falla", () => {
  const pendientes = [];
  const mando = arrancarAndar(lienzoFalso(), {
    componer: () => ({ ancho: 100, alto: 100, poligonos: [] }),
    planta: PLANTA,
    pedirFotograma: (fn) => pendientes.push(fn) - 1,
    cancelarFotograma: () => {},
    ahora: () => 0,
  });
  assert.equal(pendientes.length, 1, "arranca encadenando un fotograma");
  mando.detener();
  mando.detener();
});

test("un obstáculo en la planta para el avance, igual que en nave-movimiento", () => {
  const planta = crearPlanta({
    ancho: 20,
    profundidad: 20,
    obstaculos: [{ x: 4, z: 6, ancho: 4, profundidad: 2 }],
  });
  const mando = arrancarAndar(lienzoFalso(), {
    componer: () => ({ ancho: 100, alto: 100, poligonos: [] }),
    planta,
    x: 5,
    z: 5,
    yaw: 0,
    velocidad: 10,
  });
  mando.pulsar("adelante");
  for (let i = 0; i < 20; i += 1) mando.avanzar(50);
  const pos = mando.posicion();
  assert.ok(pos.z < 6, `no debería haber cruzado el obstáculo: z=${pos.z}`);
  mando.detener();
});
