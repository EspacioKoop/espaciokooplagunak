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

test("pulsar saltar sube y baja y, que llega a componer como segundo argumento", () => {
  const valoresY = [];
  const mando = arrancarAndar(lienzoFalso(), {
    componer: (x, y) => {
      valoresY.push(y);
      return { ancho: 100, alto: 100, poligonos: [] };
    },
    planta: PLANTA,
    x: 10,
    z: 10,
    yaw: 0,
  });
  mando.pulsar("saltar");
  mando.avanzar(100);
  mando.soltar("saltar");
  for (let i = 0; i < 50; i += 1) mando.avanzar(50);

  assert.ok(valoresY.some((y) => y > 0), "debería haber pasado por el aire");
  assert.equal(mando.posicion().y, 0, "vuelve a aterrizar de pie");
  mando.detener();
});

test("cambiarEstancia aterriza de pie: un salto en curso no sobrevive al cruce de puerta", () => {
  const mando = arrancarAndar(lienzoFalso(), {
    componer: () => ({ ancho: 100, alto: 100, poligonos: [] }),
    planta: crearPlanta({ ancho: 10, profundidad: 10 }),
    x: 5,
    z: 5,
    yaw: 0,
  });
  mando.pulsar("saltar");
  mando.avanzar(50);
  assert.ok(mando.posicion().y > 0, "en el aire antes del cambio");

  mando.cambiarEstancia({ planta: crearPlanta({ ancho: 6, profundidad: 6 }), x: 1, z: 1, yaw: 0 });
  assert.equal(mando.posicion().y, 0, "aterriza de pie al cambiar de estancia");
  mando.detener();
});

test("alTocarPuerta se dispara al entrar en su rectángulo, con lo que traiga destino", () => {
  const puertas = [{ rect: { x: 4, z: 8, ancho: 2, profundidad: 1 }, destino: { estancia: "b", x: 1, z: 1 } }];
  const destinos = [];
  const mando = arrancarAndar(lienzoFalso(), {
    componer: () => ({ ancho: 100, alto: 100, poligonos: [] }),
    planta: crearPlanta({ ancho: 10, profundidad: 10 }),
    puertas,
    alTocarPuerta: (destino) => destinos.push(destino),
    x: 5,
    z: 7,
    yaw: 0,
    velocidad: 4,
  });
  mando.pulsar("adelante");
  mando.avanzar(300); // z: 7 -> ~8.2, dentro del rectángulo de la puerta
  assert.equal(destinos.length, 1);
  assert.equal(destinos[0].estancia, "b");
  mando.detener();
});

test("alTocarConsola se dispara al entrar en su zona, solo una vez (#509)", () => {
  const consolas = [{ rect: { x: 4, z: 8, ancho: 2, profundidad: 1 }, puesto: "engineering" }];
  const avisos = [];
  const mando = arrancarAndar(lienzoFalso(), {
    componer: () => ({ ancho: 100, alto: 100, poligonos: [] }),
    planta: crearPlanta({ ancho: 10, profundidad: 10 }),
    consolas,
    alTocarConsola: (puesto) => avisos.push(puesto),
    x: 5,
    z: 7,
    yaw: 0,
    velocidad: 4,
  });
  mando.pulsar("adelante");
  mando.avanzar(300); // z: 7 -> ~8.2, dentro de la zona
  assert.deepEqual(avisos, ["engineering"], "un único aviso al entrar");

  // Seguir de pie dentro no repite el aviso: es un flanco, no un nivel.
  mando.avanzar(200);
  mando.avanzar(200);
  assert.deepEqual(avisos, ["engineering"]);

  // Salir y volver a entrar sí lo dispara otra vez.
  mando.soltar("adelante");
  mando.pulsar("atras");
  mando.avanzar(500);
  mando.soltar("atras");
  mando.pulsar("adelante");
  mando.avanzar(500);
  assert.equal(avisos.length, 2, "salir y reentrar dispara un segundo aviso");
  mando.detener();
});

test("sin alTocarConsola, tocar una zona de consola no hace nada (no revienta)", () => {
  const mando = arrancarAndar(lienzoFalso(), {
    componer: () => ({ ancho: 100, alto: 100, poligonos: [] }),
    planta: crearPlanta({ ancho: 10, profundidad: 10 }),
    consolas: [{ rect: { x: 4, z: 8, ancho: 2, profundidad: 1 }, puesto: "engineering" }],
    x: 5,
    z: 8.3,
    yaw: 0,
  });
  mando.avanzar(16);
  mando.detener();
});

test("cambiarEstancia sustituye las consolas y reinicia el flanco de entrada", () => {
  const avisos = [];
  const mando = arrancarAndar(lienzoFalso(), {
    componer: () => ({ ancho: 100, alto: 100, poligonos: [] }),
    planta: crearPlanta({ ancho: 10, profundidad: 10 }),
    consolas: [{ rect: { x: 4, z: 4, ancho: 2, profundidad: 2 }, puesto: "captain" }],
    alTocarConsola: (puesto) => avisos.push(puesto),
    x: 5,
    z: 5, // ya dentro de la zona de la consola de "a"
    yaw: 0,
  });
  mando.avanzar(16);
  assert.deepEqual(avisos, ["captain"], "el punto de partida ya cuenta como entrada");

  // La estancia nueva tiene su propia consola, en la MISMA zona local (5,5):
  // el cambio de sala tiene que volver a disparar el aviso, no darlo por
  // visto porque la posición numérica no cambió.
  mando.cambiarEstancia({
    planta: crearPlanta({ ancho: 10, profundidad: 10 }),
    consolas: [{ rect: { x: 4, z: 4, ancho: 2, profundidad: 2 }, puesto: "engineering" }],
    x: 5,
    z: 5,
    yaw: 0,
  });
  mando.avanzar(16);
  assert.deepEqual(avisos, ["captain", "engineering"]);
  mando.detener();
});

test("sin alTocarPuerta, tocar una puerta no hace nada (no revienta)", () => {
  const mando = arrancarAndar(lienzoFalso(), {
    componer: () => ({ ancho: 100, alto: 100, poligonos: [] }),
    planta: crearPlanta({ ancho: 10, profundidad: 10 }),
    puertas: [{ rect: { x: 4, z: 8, ancho: 2, profundidad: 1 }, destino: {} }],
    x: 5,
    z: 8.3,
    yaw: 0,
  });
  mando.avanzar(16);
  mando.detener();
});

test("cambiarEstancia sustituye planta, render y posición sin reiniciar el bucle", () => {
  const pendientes = [];
  let vecesComponerA = 0;
  let vecesComponerB = 0;
  const mando = arrancarAndar(lienzoFalso(), {
    componer: () => {
      vecesComponerA += 1;
      return { ancho: 100, alto: 100, poligonos: [] };
    },
    planta: crearPlanta({ ancho: 10, profundidad: 10 }),
    x: 1,
    z: 1,
    yaw: 0,
    pedirFotograma: (fn) => pendientes.push(fn) - 1,
    cancelarFotograma: () => {},
    ahora: () => 0,
  });
  assert.equal(pendientes.length, 1, "un solo fotograma pedido antes del cambio");

  const plantaB = crearPlanta({ ancho: 6, profundidad: 6 });
  mando.cambiarEstancia({
    planta: plantaB,
    componer: () => {
      vecesComponerB += 1;
      return { ancho: 100, alto: 100, poligonos: [] };
    },
    x: 2,
    z: 2,
    yaw: Math.PI,
  });

  assert.deepEqual(mando.posicion(), { x: 2, z: 2, y: 0, yaw: Math.PI });
  assert.ok(vecesComponerB >= 1, "se repinta con la nueva composición al cambiar");

  // El bucle sigue siendo el MISMO: no se pidió un fotograma nuevo, solo se
  // sustituyó lo que el ya pendiente va a usar al dispararse.
  assert.equal(pendientes.length, 1);
  pendientes.pop()(16);
  assert.ok(vecesComponerB >= 2, "el fotograma siguiente ya usa la composición nueva");
  assert.equal(vecesComponerA, 1, "y ya no llama a la composición vieja");

  mando.detener();
});
