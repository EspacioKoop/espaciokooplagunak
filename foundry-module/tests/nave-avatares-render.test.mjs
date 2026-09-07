import assert from "node:assert/strict";
import test from "node:test";

import { poligonosOtrosJugadores } from "../scripts/nave-avatares-render.mjs";
import { piezasAvatar } from "../scripts/cantina-avatar.mjs";

const OPCIONES_BASE = { camara: [0, 1.6, 0], yaw: 0, ancho: 480, alto: 270, fov: 62 };

test("sin jugadores no hay nada que pintar", () => {
  assert.deepEqual(poligonosOtrosJugadores([], OPCIONES_BASE), []);
  assert.deepEqual(poligonosOtrosJugadores(null, OPCIONES_BASE), []);
  assert.deepEqual(poligonosOtrosJugadores(undefined, OPCIONES_BASE), []);
});

test("un jugador delante de la cámara produce polígonos visibles", () => {
  const poligonos = poligonosOtrosJugadores(
    [{ x: 0, y: 0, z: 3, avatar: {} }],
    OPCIONES_BASE,
  );
  assert.ok(poligonos.length > 0, "el cuerpo del avatar debe proyectar al menos un polígono");
  for (const poligono of poligonos) {
    assert.ok(Array.isArray(poligono.puntos) && poligono.puntos.length >= 3);
    assert.equal(typeof poligono.color, "string");
    assert.equal(typeof poligono.profundidad, "number");
  }
});

test("dos jugadores idénticos duplican exactamente el recuento de polígonos", () => {
  // Misma posición a propósito: así la geometría de cada uno es idéntica y
  // el recuento tiene que duplicarse EXACTO, sin depender de un recorte por
  // perspectiva que difiera entre uno y otro por estar a distinto ángulo.
  const unJugador = poligonosOtrosJugadores([{ x: 0, y: 0, z: 3, avatar: {} }], OPCIONES_BASE);
  const dosJugadores = poligonosOtrosJugadores(
    [
      { x: 0, y: 0, z: 3, avatar: {} },
      { x: 0, y: 0, z: 3, avatar: {} },
    ],
    OPCIONES_BASE,
  );
  assert.equal(dosJugadores.length, unJugador.length * 2);
});

test("un jugador detrás de la cámara (fuera de volumen de dibujo) no produce polígonos", () => {
  const poligonos = poligonosOtrosJugadores(
    [{ x: 0, y: 0, z: -5, avatar: {} }],
    OPCIONES_BASE,
  );
  assert.deepEqual(poligonos, []);
});

test("solo importa la posición RELATIVA a la cámara, no las coordenadas absolutas", () => {
  const enElOrigen = poligonosOtrosJugadores([{ x: 0, y: 0, z: 3, avatar: {} }], {
    ...OPCIONES_BASE,
    camara: [0, 1.6, 0],
  });
  const trasladado = poligonosOtrosJugadores([{ x: 105, y: 0, z: 208, avatar: {} }], {
    ...OPCIONES_BASE,
    camara: [105, 1.6, 205],
  });
  assert.equal(trasladado.length, enElOrigen.length);
  // Las profundidades (distancia a cámara) deben coincidir exactamente: es la
  // misma escena, solo desplazada en el mundo.
  const profundidadesA = enElOrigen.map((p) => p.profundidad).sort((a, b) => a - b);
  const profundidadesB = trasladado.map((p) => p.profundidad).sort((a, b) => a - b);
  assert.deepEqual(profundidadesB, profundidadesA);
});

test("un jugador sin avatar elegido no revienta: se normaliza a un cuerpo genérico", () => {
  assert.doesNotThrow(() => poligonosOtrosJugadores([{ x: 0, y: 0, z: 3 }], OPCIONES_BASE));
  const poligonos = poligonosOtrosJugadores([{ x: 0, y: 0, z: 3 }], OPCIONES_BASE);
  assert.ok(poligonos.length > 0);
});

test("un avatar visto de muy cerca no dispara vértices fuera de cuadro (#510)", () => {
  // Mismo bug que ya se arregló en la geometría de la sala y en los planos
  // fijos de la cantina: sin recorte lateral, un jugador casi encima de la
  // cámara (cruzarse en un pasillo estrecho) infla su caja hasta cubrir la
  // pantalla entera con coordenadas de miles de píxeles.
  for (const yaw of [0, 0.3, 0.8, 1.0, 1.2, 1.4]) {
    const poligonos = poligonosOtrosJugadores(
      [{ x: 0.3, y: 0, z: 0.15, avatar: {} }],
      { camara: [0, 1.45, 0], yaw, ancho: 480, alto: 270, fov: 62 },
    );
    for (const poligono of poligonos) {
      for (const punto of poligono.puntos) {
        assert.ok(
          Math.abs(punto.x) < 5000 && Math.abs(punto.y) < 5000,
          `yaw=${yaw}: vértice disparado (${punto.x}, ${punto.y})`,
        );
      }
    }
  }
});

test("el yaw de la cámara se traslada a la proyección de los avatares, igual que a la sala", () => {
  const sinGirar = poligonosOtrosJugadores([{ x: 0, y: 0, z: 3, avatar: {} }], { ...OPCIONES_BASE, yaw: 0 });
  const girado180 = poligonosOtrosJugadores([{ x: 0, y: 0, z: 3, avatar: {} }], {
    ...OPCIONES_BASE,
    yaw: Math.PI,
  });
  // Con la cámara mirando al revés, el jugador que antes estaba delante ahora
  // queda detrás: sin polígonos, mismo criterio que el resto de la geometría.
  assert.ok(sinGirar.length > 0);
  assert.deepEqual(girado180, []);
});

/* ---- altura: el offset de cámara no es la altura de los pies --------------- */

test("quien se agacha o se sienta NO se hunde en el suelo", () => {
  // El fallo que hacía visible sentarse, y que agacharse ya tenía: `y` es el
  // offset de CÁMARA (negativo agachado o sentado) y se pasaba como altura de
  // los pies, así que el cuerpo entero bajaba y los tobillos quedaban por
  // debajo del suelo.
  const camara = [0, 1.45, -4];
  const comun = { camara, yaw: 0, ancho: 200, alto: 120 };
  const dePie = poligonosOtrosJugadores([{ x: 0, y: 0, z: 0 }], comun);
  const sentado = poligonosOtrosJugadores([{ x: 0, y: -0.25, z: 0 }], comun);
  assert.ok(dePie.length > 0 && sentado.length > 0);

  // Mismo suelo bajo los pies en las dos posturas: lo que cambia es la cabeza.
  const alturasDePie = piezasAvatar({}, { pies: [0, 0, 0] }).map((p) => p.centro[1] - p.medidas[1] / 2);
  const alturasSentado = piezasAvatar({}, { pies: [0, 0, 0], flexion: 0.25 }).map(
    (p) => p.centro[1] - p.medidas[1] / 2,
  );
  assert.equal(Math.min(...alturasDePie), Math.min(...alturasSentado), "los pies no se mueven");
});

test("encogerse baja la cabeza EXACTAMENTE lo que baja la cámara", () => {
  // La cuenta que hace que el avatar y la cámara de su dueño coincidan: lo que
  // se le quita a las piernas es lo que baja todo lo que va encima.
  const cabeza = (flexion) => {
    const pieza = piezasAvatar({}, { pies: [0, 0, 0], flexion }).find(({ nombre }) =>
      nombre.endsWith("Cabeza"),
    );
    return pieza.centro[1];
  };
  assert.ok(Math.abs(cabeza(0) - cabeza(0.25) - 0.25) < 1e-12);
  assert.ok(Math.abs(cabeza(0) - cabeza(0.4) - 0.4) < 1e-12);
  // Y en cuanto se llega al tope deja de seguirla, que es lo que el tope hace.
  assert.ok(cabeza(0) - cabeza(0.6) < 0.6);
});

test("un cuerpo corto no se invierte al agacharse del todo", () => {
  // Un mediano no tiene medio metro de pierna que encoger. Pasado el tope el
  // cuerpo deja de seguir a la cámara al centímetro, que es lo correcto: lo
  // otro es una pierna de largo negativo.
  const piernas = piezasAvatar({ raza: "mediano" }, { pies: [0, 0, 0], flexion: 0.9 }).find(
    ({ nombre }) => nombre.endsWith("Pierna"),
  );
  assert.ok(piernas.medidas[1] > 0, "una pierna nunca mide menos que nada");
});

test("saltar sí despega los pies: hacia arriba el cuerpo entero sube", () => {
  const comun = { camara: [0, 1.45, -4], yaw: 0, ancho: 200, alto: 120 };
  const suelo = (y) =>
    Math.max(...poligonosOtrosJugadores([{ x: 0, y, z: 0 }], comun).flatMap((p) => p.puntos.map(({ y: py }) => py)));
  // Más arriba en el mundo es más ARRIBA en pantalla, o sea menor `py`.
  assert.ok(suelo(0.8) < suelo(0), "saltando el cuerpo entero tiene que subir");
});
