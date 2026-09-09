// Los vocabularios de exterior por ambiente, y su mezcla (#589).

import assert from "node:assert/strict";
import test from "node:test";

import { VOCABULARIO, colocarProp, mezclarVocabularios } from "../scripts/nave-props.mjs";
import {
  VOCABULARIO_BOSQUE,
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
    mezclarVocabularios(VOCABULARIO_COSTA, VOCABULARIO_MARITIMO, VOCABULARIO_URBANO, VOCABULARIO_BOSQUE),
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
    ["bosque", VOCABULARIO_BOSQUE],
  ]) {
    assert.ok(Object.keys(vocabulario).length <= 8, `el vocabulario ${nombre} se está alargando`);
  }
});

test("nada de cubos: cada prop de exterior se lee por sus partes (#579)", () => {
  for (const vocabulario of [VOCABULARIO_COSTA, VOCABULARIO_MARITIMO, VOCABULARIO_URBANO, VOCABULARIO_BOSQUE]) {
    for (const [clave, prop] of Object.entries(vocabulario)) {
      assert.ok(prop.partes.length >= 3, `${clave} tiene que leerse, no solo ocupar sitio`);
    }
  }
});

/* ---- el bosque ------------------------------------------------------------- */

test("con el bosque se puede cerrar un claro sin modelar nada", () => {
  // La medida es la misma que la del puerto: una linde necesita masa alta que
  // tape, algo bajo que rompa el suelo y algo que diga que el bosque es viejo.
  // Si falta alguna de las tres, la escena siguiente empieza modelando.
  for (const clave of ["arbol", "tocon", "helecho"]) {
    assert.ok(VOCABULARIO_BOSQUE[clave], `una linde sin ${clave} obliga a modelar`);
  }
});

test("el bosque no se solapa con los otros ambientes", () => {
  assert.doesNotThrow(() => mezclarVocabularios(VOCABULARIO_BOSQUE, VOCABULARIO_COSTA));
  assert.doesNotThrow(() => mezclarVocabularios(VOCABULARIO_BOSQUE, VOCABULARIO, VOCABULARIO_URBANO));
});

test("un árbol tapa de verdad: es más alto que quien anda por debajo", () => {
  // Un borde que se cierra con arbustos no cierra nada — se ve por encima. La
  // altura de ojos al andar es 1,45 m (`nave-camara.mjs`), así que la copa tiene
  // que quedar muy por encima de eso o la linde deja ver el vacío de detrás.
  const { piezas } = colocarProp("arbol", { x: 0, z: 0, vocabulario: VOCABULARIO_BOSQUE });
  const alto = Math.max(...piezas.map((pieza) => pieza.centro[1] + pieza.medidas[1] / 2));
  assert.ok(alto > 3.5, `un árbol de ${alto} m no tapa a nadie`);
});

test("el sotobosque es bajo, o dejaría de ser sotobosque", () => {
  for (const clave of ["tocon", "helecho"]) {
    const { piezas } = colocarProp(clave, { x: 0, z: 0, vocabulario: VOCABULARIO_BOSQUE });
    const alto = Math.max(...piezas.map((pieza) => pieza.centro[1] + pieza.medidas[1] / 2));
    assert.ok(alto < 1, `${clave} mide ${alto} m: eso ya no se pisa, se rodea`);
  }
});

test("ningún prop del bosque es un verde plano de una sola pieza", () => {
  // Tres tonos de follaje existen para que una masa vegetal tenga profundidad;
  // si un prop usara uno solo, sería una mancha.
  const { piezas } = colocarProp("arbol", { x: 0, z: 0, vocabulario: VOCABULARIO_BOSQUE });
  const colores = new Set(piezas.map((pieza) => pieza.color));
  assert.ok(colores.size >= 4, "un árbol de un solo color es una seta");
});
