// Avatares de la cantina (#423).
//
// Lo que se afirma aquí es lo que no se ve mirando un muñeco: que la licencia
// se respeta (nada de razas con marca registrada en el catálogo), que una
// descripción rota sigue apareciendo, y que la proporción es la del estilo —
// cabeza enorme, cuatro cabezas de alto— y no la de una figura realista.

import assert from "node:assert/strict";
import test from "node:test";

import {
  ALTO_BASE,
  CLASES,
  RAZAS,
  SILUETAS,
  SITIOS,
  normalizarAvatar,
  piezasAvatar,
  piezasDeLaGente,
} from "../scripts/cantina-avatar.mjs";

test("las doce clases del SRD 5.1 están, y solo esas", () => {
  // El SRD 5.1 está bajo CC-BY-4.0: las clases se pueden nombrar con
  // atribución. Doce, ni una inventada.
  assert.equal(CLASES.length, 12);
  for (const clase of ["paladin", "picaro", "mago", "monje"]) {
    assert.ok(CLASES.includes(clase), `falta ${clase}`);
  }
});

test("ninguna raza con marca registrada entra en el catálogo", () => {
  // Ésta es la prueba que protege el proyecto de verdad. Dragonborn, tiefling,
  // gnomo, semiorco y semielfo NO están en el SRD 5.1: no se nombran, ni
  // siquiera «por defecto». Quien juegue una escribe la suya en el campo libre.
  for (const prohibida of ["dragonborn", "draconido", "tiefling", "gnomo", "semiorco", "semielfo"]) {
    assert.ok(!RAZAS.includes(prohibida), `${prohibida} no está bajo CC-BY-4.0`);
  }
  assert.deepEqual(RAZAS, ["humano", "enano", "elfo", "mediano", "otra"]);
});

test("una descripción rota no impide aparecer", () => {
  // No aparecer es peor que aparecer raro: quien entra a la cantina tiene que
  // estar en la sala aunque su ficha esté a medias.
  const av = normalizarAvatar({ raza: "no-existe", clase: 7, silueta: null, pelo: "x" });
  assert.ok(RAZAS.includes(av.raza));
  assert.ok(CLASES.includes(av.clase));
  assert.ok(SILUETAS.includes(av.silueta));
  assert.equal(av.pelo, 0);
  assert.ok(piezasAvatar({}).length > 0);
  assert.ok(piezasAvatar(undefined).length > 0);
});

test("la proporción es la del estilo: cabeza enorme, no figura realista", () => {
  // Con pocos polígonos una figura estilizada se lee y una proporcionada se
  // deshace. La cabeza se lleva más de un quinto del alto total.
  const piezas = piezasAvatar({ raza: "humano" }, { pies: [0, 0, 0] });
  const cabeza = piezas.find((p) => p.nombre.endsWith("Cabeza"));
  assert.ok(cabeza.medidas[1] / ALTO_BASE > 0.2, "la cabeza es demasiado pequeña para el estilo");
});

test("la raza cambia estatura y anchura, y nada más", () => {
  const alto = (raza) => {
    const piezas = piezasAvatar({ raza }, { pies: [0, 0, 0] });
    return Math.max(...piezas.map((p) => p.centro[1] + p.medidas[1] / 2));
  };
  assert.ok(alto("mediano") < alto("humano"), "el mediano no es más bajo");
  assert.ok(alto("elfo") > alto("humano"), "el elfo no es más alto");
  // Y el enano es más bajo pero más ancho: si solo encogiera, sería un niño.
  const enano = piezasAvatar({ raza: "enano" }, { pies: [0, 0, 0] });
  const humano = piezasAvatar({ raza: "humano" }, { pies: [0, 0, 0] });
  const torso = (piezas) => piezas.find((p) => p.nombre.endsWith("Torso")).medidas[0];
  assert.ok(torso(enano) > torso(humano), "el enano no es más ancho");
});

test("cada clase con distintivo lo lleva, y el monje no lleva nada", () => {
  for (const clase of ["paladin", "mago", "clerigo", "bardo", "picaro"]) {
    const piezas = piezasAvatar({ clase }, { pies: [0, 0, 0] });
    assert.ok(piezas.some((p) => p.nombre.endsWith("Distintivo")), `${clase} no lleva nada`);
  }
  // El monje va con las manos vacías, y eso también dice quién es.
  const monje = piezasAvatar({ clase: "monje" }, { pies: [0, 0, 0] });
  assert.ok(!monje.some((p) => p.nombre.endsWith("Distintivo")));
});

test("quien mira no se ve a sí mismo", () => {
  // La cámara está en sus ojos: solo vería su propia nuca.
  const solos = piezasDeLaGente([{ id: "yo" }], { omitirId: "yo" });
  assert.deepEqual(solos, []);
  assert.ok(piezasDeLaGente([{ id: "yo" }, { id: "otra" }], { omitirId: "yo" }).length > 0);
});

test("nadie se sienta encima de nadie, y sobra gente antes que sitios", () => {
  const gente = Array.from({ length: 20 }, (_, i) => ({ id: `p${i}` }));
  const piezas = piezasDeLaGente(gente);
  const cabezas = piezas.filter((p) => p.nombre.endsWith("Cabeza"));
  assert.equal(cabezas.length, SITIOS.length, "se han colocado más avatares que sitios");
  const sitios = new Set(cabezas.map((p) => `${p.centro[0]},${p.centro[2]}`));
  assert.equal(sitios.size, cabezas.length, "hay dos personas en el mismo sitio");
});
