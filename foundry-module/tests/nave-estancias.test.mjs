import assert from "node:assert/strict";
import test from "node:test";

import { declararInteracciones } from "../scripts/nave-interaccion.mjs";
import { crearPlanta } from "../scripts/nave-movimiento.mjs";
import { crearCatalogoEstancias, declararEstancia, puntoDeLlegada, resolverArranque } from "../scripts/nave-estancias.mjs";

const PLANTA_A = crearPlanta({ ancho: 10, profundidad: 10 });
const PLANTA_B = crearPlanta({ ancho: 6, profundidad: 6 });

test("declararEstancia exige planta y componer", () => {
  assert.throws(() => declararEstancia({ planta: PLANTA_A }), TypeError);
  assert.throws(() => declararEstancia({ componer: () => ({}) }), TypeError);
});

test("declararEstancia: la entrada por defecto es el centro de la planta", () => {
  const estancia = declararEstancia({ planta: PLANTA_A, componer: () => ({}) });
  assert.deepEqual(estancia.entrada, { x: 5, z: 5, yaw: 0 });
});

test("crearCatalogoEstancias valida al construir: una puerta a una estancia inexistente revienta", () => {
  assert.throws(
    () =>
      crearCatalogoEstancias({
        a: {
          planta: PLANTA_A,
          componer: () => ({}),
          puertas: [{ rect: { x: 0, z: 0, ancho: 1, profundidad: 1 }, destino: { estancia: "no-existe" } }],
        },
      }),
    RangeError,
  );
});

test("crearCatalogoEstancias: dos estancias que se referencian entre sí construyen sin fallo", () => {
  const catalogo = crearCatalogoEstancias({
    a: {
      planta: PLANTA_A,
      componer: () => ({ sala: "a" }),
      puertas: [{ rect: { x: 4, z: 9, ancho: 2, profundidad: 1 }, destino: { estancia: "b", x: 3, z: 0.5, yaw: Math.PI } }],
    },
    b: {
      planta: PLANTA_B,
      componer: () => ({ sala: "b" }),
      puertas: [{ rect: { x: 2, z: -0.5, ancho: 2, profundidad: 1 }, destino: { estancia: "a", x: 5, z: 8.5, yaw: 0 } }],
    },
  });
  assert.deepEqual(catalogo.ids, ["a", "b"]);
  assert.equal(catalogo.tiene("a"), true);
  assert.equal(catalogo.tiene("c"), false);
  assert.equal(catalogo.obtener("c"), null);
});

test("puntoDeLlegada: usa lo que fija la puerta y rellena lo que falta con la entrada de la estancia", () => {
  const catalogo = crearCatalogoEstancias({
    a: { planta: PLANTA_A, componer: () => ({ sala: "a" }), entrada: { x: 1, z: 1, yaw: 0.5 } },
    b: { planta: PLANTA_B, componer: () => ({ sala: "b" }) },
  });
  // La puerta fija x/z/yaw completos: manda ella, no la entrada de "a".
  const llegadaCompleta = puntoDeLlegada(catalogo, { estancia: "a", x: 7, z: 2, yaw: Math.PI });
  assert.deepEqual(llegadaCompleta, {
    estancia: "a",
    planta: PLANTA_A,
    componer: catalogo.obtener("a").componer,
    puertas: [],
    interacciones: [],
    x: 7,
    z: 2,
    yaw: Math.PI,
  });

  // Sin nada más que el id: cae en la entrada por defecto de "b" (su centro).
  const llegadaPorDefecto = puntoDeLlegada(catalogo, { estancia: "b" });
  assert.equal(llegadaPorDefecto.x, 3);
  assert.equal(llegadaPorDefecto.z, 3);
});

test("puntoDeLlegada: estancia desconocida devuelve null, no revienta", () => {
  const catalogo = crearCatalogoEstancias({ a: { planta: PLANTA_A, componer: () => ({}) } });
  assert.equal(puntoDeLlegada(catalogo, { estancia: "z" }), null);
});

test("declararEstancia: sin interacciones, la lista queda vacía (no undefined)", () => {
  const estancia = declararEstancia({ planta: PLANTA_A, componer: () => ({}) });
  assert.deepEqual(estancia.interacciones, []);
});

test("declararEstancia: una interacción no necesita destino, a diferencia de una puerta (#509)", () => {
  const estancia = declararEstancia({
    planta: PLANTA_A,
    componer: () => ({}),
    interacciones: declararInteracciones([
      { id: "consola-engineering", zona: { x: 4, z: 4, ancho: 1, profundidad: 1 }, accion: { puesto: "engineering" } },
    ]),
  });
  assert.equal(estancia.interacciones.length, 1);
  assert.equal(estancia.interacciones[0].accion.puesto, "engineering");
});

test("crearCatalogoEstancias no exige que una interacción apunte a ninguna estancia: 'accion' es opaca", () => {
  // A diferencia de una puerta, una interacción no referencia otra estancia del
  // catálogo — validar su `accion` contra algo sería mezclar "dónde está la
  // nave" con "qué se puede hacer en ella", que es justo lo que este módulo no
  // sabe.
  assert.doesNotThrow(() =>
    crearCatalogoEstancias({
      a: {
        planta: PLANTA_A,
        componer: () => ({}),
        interacciones: declararInteracciones([
          { id: "cualquiera", punto: [4, 4], accion: { puesto: "puesto-que-no-existe-en-ningun-sitio" } },
        ]),
      },
    }),
  );
});

test("puntoDeLlegada incluye las interacciones de la estancia destino", () => {
  const interacciones = declararInteracciones([
    { id: "consola-engineering", zona: { x: 4, z: 4, ancho: 1, profundidad: 1 } },
  ]);
  const catalogo = crearCatalogoEstancias({
    a: { planta: PLANTA_A, componer: () => ({}), interacciones },
  });
  const llegada = puntoDeLlegada(catalogo, { estancia: "a" });
  assert.deepEqual(llegada.interacciones, interacciones);
});

/* ---- resolverArranque (#508) --------------------------------------------- */

const CATALOGO_ARRANQUE = crearCatalogoEstancias({
  a: { planta: PLANTA_A, componer: () => ({}) },
  b: { planta: PLANTA_B, componer: () => ({}) },
});

test("resolverArranque: lo pedido manda sobre lo guardado, y sin heredar sus coordenadas", () => {
  // Pedir entrar a "b" y reaparecer en "a" porque es donde se cerró la ventana
  // sería no obedecer; y llegar a "b" con las coordenadas de "a" dejaría al
  // jugador en un punto de OTRA sala, que puede estar dentro de un muro.
  const arranque = resolverArranque(CATALOGO_ARRANQUE, {
    pedida: "b",
    guardada: { estancia: "a", x: 1, z: 2 },
    porDefecto: "a",
  });
  assert.deepEqual(arranque, { estancia: "b", guardada: null });
});

test("resolverArranque: sin nada pedido se vuelve a donde se quedó", () => {
  const guardada = { estancia: "b", x: 1, z: 2 };
  assert.deepEqual(resolverArranque(CATALOGO_ARRANQUE, { guardada, porDefecto: "a" }), {
    estancia: "b",
    guardada,
  });
});

test("resolverArranque: un id que el catálogo no conoce cae al siguiente escalón", () => {
  // Ni una sala de la sección que apunte a una estancia retirada, ni un
  // checkpoint de una sesión con otro catálogo, dejan a nadie en la nada.
  assert.deepEqual(
    resolverArranque(CATALOGO_ARRANQUE, { pedida: "no-existe", guardada: { estancia: "b" }, porDefecto: "a" }),
    { estancia: "b", guardada: { estancia: "b" } },
  );
  assert.deepEqual(
    resolverArranque(CATALOGO_ARRANQUE, { pedida: "no-existe", guardada: { estancia: "tampoco" }, porDefecto: "a" }),
    { estancia: "a", guardada: null },
  );
  assert.deepEqual(resolverArranque(CATALOGO_ARRANQUE, { porDefecto: "a" }), { estancia: "a", guardada: null });
});
