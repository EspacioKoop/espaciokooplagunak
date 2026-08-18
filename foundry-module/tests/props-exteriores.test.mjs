// Los vocabularios de exterior por ambiente, y su mezcla (#589).

import assert from "node:assert/strict";
import test from "node:test";

import { VOCABULARIO, colocarProp, mezclarVocabularios } from "../scripts/nave-props.mjs";
import {
  VOCABULARIO_COSTA,
  VOCABULARIO_MARITIMO,
  VOCABULARIO_URBANO,
} from "../scripts/props-exteriores.mjs";
import { VOCABULARIO_PLAYA } from "../scripts/playa-escena.mjs";

/* ---- la mezcla ------------------------------------------------------------- */

test("con lo que hay se puede montar un puerto sin modelar nada (#589)", () => {
  // Es la medida del punto 5: un catálogo pobre obliga a modelar, y modelar es
  // lo que hace que una escena cueste cinco PRs en vez de uno. Un muelle
  // necesita por dónde amarrar, algo clavado en el agua, algo que flote, y
  // calle: si algo de eso falta, la escena siguiente empieza modelando.
  const puerto = mezclarVocabularios(VOCABULARIO_MARITIMO, VOCABULARIO_URBANO);
  for (const clave of ["noray", "pilote", "barca", "boya", "poste", "banco", "papelera", "cajas"]) {
    assert.ok(puerto[clave], `un puerto sin ${clave} obliga a modelar`);
  }
});

test("una escena de puerto pide marítimo y urbano, y no hereda la duna", () => {
  // Es el ejemplo literal de #589, y la razón de que los ambientes estén
  // separados: con una lista sola, el puerto se trae el matojo de duna.
  const puerto = mezclarVocabularios(VOCABULARIO_MARITIMO, VOCABULARIO_URBANO);
  assert.ok(puerto.boya && puerto.poste, "lo que pidió, lo tiene");
  assert.ok(!puerto.matojo, "y lo que no pidió, no");
});

test("una clave repetida rompe al mezclar en vez de ganar en silencio", () => {
  // La peor variante posible sería que el último callara al primero: la escena
  // pediría `mesa` creyendo que es una y saldría la otra, sin fallo en ningún
  // sitio y con un cuadro sutilmente equivocado.
  assert.throws(
    () => mezclarVocabularios(VOCABULARIO_COSTA, VOCABULARIO_COSTA),
    /roca/,
    "debería decir QUÉ clave choca",
  );
});

test("el error dice en cuáles de los vocabularios está el choque", () => {
  try {
    mezclarVocabularios(VOCABULARIO_URBANO, VOCABULARIO_MARITIMO, VOCABULARIO_URBANO);
    assert.fail("tenía que haber roto");
  } catch (error) {
    assert.match(error.message, /0/);
    assert.match(error.message, /2/);
  }
});

test("mezclar no toca los vocabularios de origen", () => {
  const antes = Object.keys(VOCABULARIO_COSTA).length;
  mezclarVocabularios(VOCABULARIO_COSTA, VOCABULARIO_MARITIMO);
  assert.equal(Object.keys(VOCABULARIO_COSTA).length, antes);
});

test("la mezcla sale congelada, como cualquier vocabulario", () => {
  const mezcla = mezclarVocabularios(VOCABULARIO_COSTA, VOCABULARIO_URBANO);
  assert.ok(Object.isFrozen(mezcla));
});

test("mezclar cero vocabularios da uno vacío, no un error", () => {
  assert.deepEqual(Object.keys(mezclarVocabularios()), []);
});

test("un prop de una mezcla se coloca igual que uno de su vocabulario", () => {
  const mezcla = mezclarVocabularios(VOCABULARIO_COSTA, VOCABULARIO_URBANO);
  assert.deepEqual(
    colocarProp("roca", { x: 3, z: 4, vocabulario: mezcla }),
    colocarProp("roca", { x: 3, z: 4, vocabulario: VOCABULARIO_COSTA }),
  );
});

/* ---- el reparto por ambientes ---------------------------------------------- */

test("la playa es exactamente la suma de los tres ambientes (#589)", () => {
  assert.deepEqual(
    Object.keys(VOCABULARIO_PLAYA).sort(),
    [
      ...Object.keys(VOCABULARIO_COSTA),
      ...Object.keys(VOCABULARIO_MARITIMO),
      ...Object.keys(VOCABULARIO_URBANO),
    ].sort(),
  );
});

test("los tres ambientes no se solapan entre sí", () => {
  // Si se solaparan, mezclarlos rompería — y la playa no arrancaría.
  assert.doesNotThrow(() =>
    mezclarVocabularios(VOCABULARIO_COSTA, VOCABULARIO_MARITIMO, VOCABULARIO_URBANO),
  );
});

test("ni con el de la nave, que es el que más se va a mezclar", () => {
  assert.doesNotThrow(() => mezclarVocabularios(VOCABULARIO, VOCABULARIO_URBANO));
});

test("cada ambiente sigue siendo corto por su cuenta", () => {
  // La regla de `nave-props.mjs` no se relaja al haber más listas: un catálogo
  // largo es la vía rápida a que cada sitio parezca de otro mundo.
  for (const [nombre, vocabulario] of [
    ["costa", VOCABULARIO_COSTA],
    ["marítimo", VOCABULARIO_MARITIMO],
    ["urbano", VOCABULARIO_URBANO],
  ]) {
    assert.ok(Object.keys(vocabulario).length <= 8, `el vocabulario ${nombre} se está alargando`);
  }
});

test("nada de cubos: cada prop de exterior se lee por sus partes (#579)", () => {
  for (const vocabulario of [VOCABULARIO_COSTA, VOCABULARIO_MARITIMO, VOCABULARIO_URBANO]) {
    for (const [clave, prop] of Object.entries(vocabulario)) {
      assert.ok(prop.partes.length >= 3, `${clave} tiene que leerse, no solo ocupar sitio`);
    }
  }
});
