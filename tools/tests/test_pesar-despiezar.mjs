import assert from "node:assert/strict";
import test from "node:test";

import { crearRig, deformarMalla } from "../../foundry-module/scripts/rig-esqueleto.mjs";
import { pesosAutomaticos, extraerRegion } from "../pesar-despiezar.mjs";

// Brazo de prueba: dos tramos de 1 m en +y, sección en xz. Mismo que la fase 1.
const MALLA = {
  vertices: [
    [-0.1, 0, -0.1], [0.1, 0, -0.1], [0.1, 0, 0.1], [-0.1, 0, 0.1],
    [-0.1, 1, -0.1], [0.1, 1, -0.1], [0.1, 1, 0.1], [-0.1, 1, 0.1],
    [-0.1, 2, -0.1], [0.1, 2, -0.1], [0.1, 2, 0.1], [-0.1, 2, 0.1],
  ],
  caras: [[0, 1, 2, 3], [4, 5, 6, 7], [8, 9, 10, 11]],
};
const RIG = crearRig([
  { id: "brazo", cabeza: [0, 0, 0] },
  { id: "antebrazo", padre: "brazo", cabeza: [0, 1, 0] },
]);

const CASI = 1e-6;

/** Centro de un anillo de cuatro vértices (la sección tiene grosor). */
function centro(vertices, desde) {
  const cuatro = vertices.slice(desde, desde + 4);
  return [0, 1, 2].map((eje) => cuatro.reduce((s, v) => s + v[eje], 0) / 4);
}

function pesoDe(inf, idx) {
  const e = inf.find((x) => x.indice === idx);
  return e ? e.peso : 0;
}

test("pesosAutomaticos no deja vértice sin hueso y respeta el tope", () => {
  const pesos = pesosAutomaticos(MALLA, RIG);
  assert.equal(pesos.length, MALLA.vertices.length);
  for (const inf of pesos) {
    assert.ok(inf.length >= 1, "un vértice sin hueso");
    assert.ok(inf.length <= 4, "más de 4 influencias");
    const suma = inf.reduce((s, { peso }) => s + peso, 0);
    assert.ok(Math.abs(suma - 1) < CASI, "los pesos no suman 1");
  }
});

test("la mano queda del antebrazo sin pesos a mano", () => {
  const pesos = pesosAutomaticos(MALLA, RIG);
  const brazoIdx = RIG.indice.get("brazo");
  const anteIdx = RIG.indice.get("antebrazo");
  // Mano (vértices 8..11): el hueso más cercano es el antebrazo.
  for (let v = 8; v < 12; v += 1) {
    assert.ok(
      pesoDe(pesos[v], anteIdx) > pesoDe(pesos[v], brazoIdx),
      `la mano ${v} no quedó del antebrazo`,
    );
  }
});

test("CRITERIO fase 2: con pesos automáticos el antebrazo se dobla con gradiente", () => {
  const pesos = pesosAutomaticos(MALLA, RIG);
  const doblado = deformarMalla(MALLA, RIG, pesos, {
    antebrazo: { eje: [0, 0, 1], angulo: Math.PI / 2 },
  });
  const manoAntes = centro(MALLA.vertices, 8);
  const mano = centro(doblado.vertices, 8);
  const hombroAntes = centro(MALLA.vertices, 0);
  const hombro = centro(doblado.vertices, 0);

  const dxMano = mano[0] - manoAntes[0];
  const dxHombro = hombro[0] - hombroAntes[0];
  // La mano se va a -x (el codo es el pivote) y se mueve más que el hombro:
  // hay un gradiente a lo largo del brazo, no un tajo ni un amasijo.
  assert.ok(dxMano < -0.3, `la mano no fue a -x (dx=${dxMano})`);
  assert.ok(Math.abs(dxMano) > Math.abs(dxHombro), "el hombro se mueve más que la mano");

  // «El hombro se mueve MENOS que la mano» no prueba nada: con los pesos
  // anteriores el hombro se iba 0,7 m y seguía cumpliéndolo. Lo que el PR
  // afirma es que el hombro está QUIETO, y eso se fija con tolerancia.
  const TOLERANCIA = 1e-9;
  assert.ok(
    Math.hypot(...[0, 1, 2].map((e) => hombro[e] - hombroAntes[e])) < TOLERANCIA,
    `el hombro se movió (${hombro})`,
  );
  // El pivote es el codo: se queda donde estaba.
  const codoAntes = centro(MALLA.vertices, 4);
  const codo = centro(doblado.vertices, 4);
  assert.ok(
    Math.hypot(...[0, 1, 2].map((e) => codo[e] - codoAntes[e])) < TOLERANCIA,
    `el codo no es el pivote (${codo})`,
  );
  // Y el tramo codo-mano conserva su longitud: girar no es estirar.
  const largo = Math.hypot(...[0, 1, 2].map((e) => mano[e] - codo[e]));
  const largoAntes = Math.hypot(...[0, 1, 2].map((e) => manoAntes[e] - codoAntes[e]));
  assert.ok(Math.abs(largo - largoAntes) < 1e-9, `el antebrazo cambió de largo (${largo})`);
  assert.ok(doblado.vertices.every((v) => v.every(Number.isFinite)), "hay NaNs");
  assert.equal(doblado.caras.length, MALLA.caras.length, "la topología cambió");
});

test("extraerRegion aísla el antebrazo como pieza suelta", () => {
  const pesos = pesosAutomaticos(MALLA, RIG);
  const pieza = extraerRegion(MALLA, pesos, RIG, { hueso: "antebrazo", threshold: 0.6 });
  // La mano (y≈2) entra, el hombro (y≈0) no.
  assert.ok(pieza.vertices.some((v) => Math.abs(v[1] - 2) < CASI), "falta la mano en la pieza");
  assert.ok(!pieza.vertices.some((v) => Math.abs(v[1]) < CASI), "sobra el hombro en la pieza");
  // Todo vértice de la pieza pesa ≥ umbral para antebrazo (lo comprobamos por
  // coordenadas, porque la pieza no expone los índices originales).
  const anteIdx = RIG.indice.get("antebrazo");
  for (const v of pieza.vertices) {
    const orig = MALLA.vertices.findIndex(
      (o) => o[0] === v[0] && o[1] === v[1] && o[2] === v[2],
    );
    assert.ok(pesoDe(pesos[orig], anteIdx) >= 0.6, `vértice ${orig} en la pieza pesa < 0.6`);
  }
  // Caras bien formadas (índices dentro de rango, sin aristas colgando).
  assert.ok(pieza.caras.every((c) => c.every((i) => i >= 0 && i < pieza.vertices.length)));
});

test("extraerRegion no devuelve vértices sin cara", () => {
  // Un triángulo con un solo vértice por encima del umbral: antes devolvía
  // `{vertices: [uno], caras: []}` —una «pieza» de geometría suelta que no se
  // dibuja ni se toca—. Los vértices se derivan de las caras retenidas.
  const tri = {
    vertices: [[0, 0, 0], [5, 0, 0], [5, 5, 0]],
    caras: [[0, 1, 2]],
  };
  const rig = crearRig([{ id: "a", cabeza: [0, 0, 0] }, { id: "b", cabeza: [5, 5, 0] }]);
  const pesos = pesosAutomaticos(tri, rig);
  const pieza = extraerRegion(tri, pesos, rig, { hueso: "a", threshold: 0.5 });
  assert.deepEqual(pieza.caras, [], "una cara a medio umbral no debe entrar");
  assert.deepEqual(pieza.vertices, [], "quedó un vértice huérfano sin cara");

  // Y con umbral bajo la cara entra entera, con sus tres vértices y ni uno más.
  const todo = extraerRegion(tri, pesos, rig, { hueso: "a", threshold: 0 });
  assert.equal(todo.caras.length, 1);
  assert.equal(todo.vertices.length, 3);
});

test("extraerRegion falla con un hueso inexistente", () => {
  const pesos = pesosAutomaticos(MALLA, RIG);
  assert.throws(
    () => extraerRegion(MALLA, pesos, RIG, { hueso: "fantasma" }),
    /hueso inexistente/,
  );
});

test("malla real (Venus) se pesa y despieza sin degenerar", async () => {
  const { VENUS_DE_MILO } = await import("../../foundry-module/data/mallas/venus-de-milo.mjs");
  const rig = crearRig([
    { id: "cadera", cabeza: [0, 0, 0] },
    { id: "torso", padre: "cadera", cabeza: [0, 1, 0] },
  ]);
  const pesos = pesosAutomaticos(VENUS_DE_MILO, rig);
  const inclinada = deformarMalla(VENUS_DE_MILO, rig, pesos, {
    torso: { eje: [0, 0, 1], angulo: 0.2 },
  });
  assert.equal(inclinada.vertices.length, VENUS_DE_MILO.vertices.length);
  assert.ok(inclinada.vertices.every((v) => v.every(Number.isFinite)), "NaNs en Venus");
  const movidos = inclinada.vertices.filter((v, i) => v[0] !== VENUS_DE_MILO.vertices[i][0]).length;
  assert.ok(movidos > 0, "nada se movió");
  // Los pesos automáticos son un BLEND, no un tajo duro: hay vértices con
  // influencia intermedia del torso (ni 0 ni 1). Eso es justo lo que la fase 2
  // aporta sobre el reparto manual de la fase 1.
  const torsoIdx = rig.indice.get("torso");
  const intermedios = pesos.filter((inf) => {
    const w = pesoDe(inf, torsoIdx);
    return w > 0.1 && w < 0.9;
  }).length;
  assert.ok(intermedios > 0, "los pesos son un tajo, no un blend");

  // Con solo 2 huesos el torso siempre pesa >= 0.5 (es uno de los 2 más
  // cercanos), así que la región a umbral 0.5 es toda la malla: la partición
  // limpia necesita un esqueleto completo (fase 3/4). Aquí solo se ejercita
  // extraerRegion sobre una malla real y se exige que no dé vacío ni degenerada.
  const torso = extraerRegion(VENUS_DE_MILO, pesos, rig, { hueso: "torso", threshold: 0.5 });
  assert.ok(torso.vertices.length > 0, "la región torso está vacía");
  assert.ok(torso.vertices.every((v) => v.length === 3), "la región torso degeneró");
});
