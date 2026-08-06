import assert from "node:assert/strict";
import test from "node:test";

import { poligonosOtrosJugadores } from "../scripts/nave-avatares-render.mjs";

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
