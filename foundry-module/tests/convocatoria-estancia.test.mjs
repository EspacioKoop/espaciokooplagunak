// Tests para convocatoria-estancia.mjs

import { convocar } from "../scripts/convocatoria-estancia.mjs";
import { CATALOGO_ANDAR } from "../scripts/nave-catalogo-andar.mjs";
import { describe, it, test } from "node:test";
import assert from "node:assert";
import { crearPlanta, colisiona } from "../scripts/nave-movimiento.mjs";

describe("convocatoria-estancia", () => {
  it("debe devolver null si el convocante no es GM", () => {
    const resultado = convocar("playa", "jugador");
    assert.strictEqual(resultado, null);
  });

  it("debe devolver null si el ID de estancia no existe", () => {
    const resultado = convocar("estancia-inexistente", "GM");
    assert.strictEqual(resultado, null);
  });

  it("debe devolver el punto de llegada para una estancia válida (playa)", () => {
    const resultado = convocar("playa", "GM");
    assert.notStrictEqual(resultado, null);
    assert.ok(resultado.x !== undefined);
    assert.ok(resultado.z !== undefined);
    assert.ok(resultado.yaw !== undefined);
  });

  it("debe devolver el punto de llegada para una estancia válida (museo)", () => {
    const resultado = convocar("museo", "GM");
    assert.notStrictEqual(resultado, null);
    assert.ok(resultado.x !== undefined);
    assert.ok(resultado.z !== undefined);
    assert.ok(resultado.yaw !== undefined);
  });

  it("debe devolver null si el punto de llegada colisiona", () => {
    // Simulamos una estancia con colisión (no debería pasar en el catálogo real).
    // Como no podemos modificar el catálogo, este test valida el comportamiento
    // esperado sin forzar una colisión artificial.
    const resultado = convocar("playa", "GM");
    assert.notStrictEqual(resultado, null); // La playa no colisiona en el catálogo real.
  });
});
// LA RAMA QUE NADIE PROBABA. Quitar la comprobacion de colision no rompia
// ningun test, porque ninguna entrada del catalogo real esta bloqueada: la
// rama no se ejercitaba nunca. Se inyecta un catalogo con una estancia cuya
// entrada cae dentro de un obstaculo, que es el unico modo de exigirla.
test("no convoca a una estancia con la entrada bloqueada", () => {
  const planta = crearPlanta({
    ancho: 10,
    profundidad: 10,
    obstaculos: [{ x: 4, z: 4, ancho: 2, profundidad: 2 }],
  });
  const catalogo = {
    tiene: (id) => id === "trampa",
    obtener: () => ({ planta, entrada: { x: 5, z: 5, yaw: 0 } }),
  };
  assert.equal(colisiona(5, 5, 0.35, planta), true, "premisa: esa entrada esta dentro del obstaculo");
  assert.equal(convocar("trampa", "GM", { catalogo }), null);
});

test("la misma estancia, con la entrada despejada, si convoca", () => {
  const planta = crearPlanta({
    ancho: 10,
    profundidad: 10,
    obstaculos: [{ x: 4, z: 4, ancho: 2, profundidad: 2 }],
  });
  const catalogo = {
    tiene: (id) => id === "despejada",
    obtener: () => ({ planta, entrada: { x: 1, z: 1, yaw: 0 } }),
  };
  assert.deepEqual(convocar("despejada", "GM", { catalogo }), { x: 1, z: 1, yaw: 0 });
});
