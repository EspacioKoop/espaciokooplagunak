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
  GESTOS,
  RAZAS,
  SILUETAS,
  SITIOS,
  anclasHumoDeLaGente,
  intensidadCalada,
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

test("la gramática PSX usa mallas octogonales y volúmenes estrechados", () => {
  const piezas = piezasAvatar({ raza: "humano", clase: "guerrero" }, { pies: [0, 0, 0] });
  for (const pieza of piezas) {
    assert.ok(pieza.malla, `${pieza.nombre} no tiene malla propia`);
    assert.equal(pieza.malla.vertices.length, 16, `${pieza.nombre} no tiene dos anillos de ocho vértices`);
    assert.ok(pieza.malla.caras.length >= 9, `${pieza.nombre} no está cerrado`);
  }
  const torso = piezas.find((pieza) => pieza.nombre.endsWith("Torso"));
  const radio = (anillo) => Math.hypot(torso.malla.vertices[anillo][0], torso.malla.vertices[anillo][2]);
  assert.notEqual(radio(0), radio(8), "el torso conserva lados paralelos");
});

test("la raza rompe la silueta además de cambiar proporciones", () => {
  const nombres = (raza) => piezasAvatar({ raza }, { pies: [0, 0, 0] }).map((pieza) => pieza.nombre);
  assert.ok(nombres("enano").some((nombre) => nombre.endsWith("Barba")));
  assert.ok(nombres("elfo").some((nombre) => nombre.endsWith("OrejaIzq")));
  assert.ok(nombres("mediano").some((nombre) => nombre.endsWith("CabezaGrande")));
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

// Gestos de cuerpo (#423): estos avatares no tienen cara, así que el gesto vive
// en las manos — que además son la parte exagerada del estilo.
test("cada gesto cambia dónde están las manos", () => {
  const manos = (gesto) =>
    JSON.stringify(
      piezasAvatar({ gesto }, { pies: [0, 0, 0] })
        .filter((p) => p.nombre.includes("Mano"))
        .map((p) => p.centro),
    );
  const vistos = new Set(GESTOS.map(manos));
  assert.equal(vistos.size, GESTOS.length, "hay dos gestos con la misma postura");
});

test("brindar saca una jarra y fumar saca cigarro con brasa", () => {
  const nombres = (gesto) => piezasAvatar({ gesto }, { pies: [0, 0, 0] }).map((p) => p.nombre);
  assert.ok(nombres("brindis").some((n) => n.endsWith("Jarra")));
  const fumando = nombres("fumar");
  assert.ok(fumando.some((n) => n.endsWith("Cigarro")));
  // La brasa es un píxel y es lo único claro de una silueta que fuma en
  // penumbra: sin ella, el cigarro no se ve y el gesto no se lee.
  assert.ok(fumando.some((n) => n.endsWith("Brasa")));
});

// La punta encendida del cigarro (#439): sube de brillo en la calada y se
// apaga entre una y la siguiente, en vez de arder fija todo el rato.
test("la calada sube y baja, con pausas apagadas de por medio", () => {
  assert.equal(intensidadCalada(0, 0), 0, "empieza apagada");
  assert.ok(intensidadCalada(260, 0) > 0.9, "el pico de la calada está bien encendido");
  assert.equal(intensidadCalada(3000, 0), 0, "hay pausa apagada entre caladas");
  for (let ms = 0; ms < 5000; ms += 37) {
    const v = intensidadCalada(ms, 0);
    assert.ok(v >= 0 && v <= 1, `fuera de rango en ${ms}ms: ${v}`);
  }
});

test("la calada es determinista: el mismo instante da siempre el mismo brillo", () => {
  assert.equal(intensidadCalada(1234, 2), intensidadCalada(1234, 2));
});

test("dos fumadores no dan la calada a la vez", () => {
  // El desfase es por sitio (`indice`), no por reloj: si coincidiera, una sala
  // llena de fumadores parpadearía como un cartel, no como gente fumando.
  const puntos = new Set();
  for (let ms = 0; ms < 4200; ms += 50) {
    puntos.add(`${intensidadCalada(ms, 0).toFixed(3)}|${intensidadCalada(ms, 1).toFixed(3)}`);
  }
  const enSincronia = [...puntos].every((par) => {
    const [a, b] = par.split("|");
    return a === b;
  });
  assert.ok(!enSincronia, "dos sitios distintos están dando la calada exactamente a la vez");
});

test("el humo solo sale de quien fuma, y sigue el punto del cigarro", () => {
  const gente = [
    { id: "a", gesto: "fumar" },
    { id: "b", gesto: "brindis" },
    { id: "c", gesto: "fumar" },
  ];
  const anclas = anclasHumoDeLaGente(gente);
  assert.equal(anclas.length, 2, "solo dos de los tres fuman");
  for (const ancla of anclas) {
    assert.equal(ancla.tipo, "humo");
    assert.ok(ancla.largo > 0);
    assert.equal(ancla.punto.length, 3);
  }
});

test("quien mira no alimenta su propio humo", () => {
  const gente = [{ id: "yo", gesto: "fumar" }, { id: "otra", gesto: "fumar" }];
  const anclas = anclasHumoDeLaGente(gente, { omitirId: "yo" });
  assert.equal(anclas.length, 1);
});

test("un gesto que no existe deja a la persona quieta, no rota", () => {
  const raro = piezasAvatar({ gesto: "bailar-break" }, { pies: [0, 0, 0] });
  const quieto = piezasAvatar({ gesto: "quieto" }, { pies: [0, 0, 0] });
  assert.deepEqual(raro, quieto);
});

test("no hay gestos de cara, y es a propósito", () => {
  // Estos avatares no tienen ojos ni boca: es lo que los hace legibles a esta
  // resolución. Si algún día se añade un guiño, hará falta darles cara primero,
  // y eso es una decisión de estilo — no un gesto más.
  for (const gesto of GESTOS) {
    const piezas = piezasAvatar({ gesto }, { pies: [0, 0, 0] });
    assert.ok(!piezas.some((p) => /Ojo|Boca|Ceja/.test(p.nombre)), `${gesto} ha inventado una cara`);
  }
});
