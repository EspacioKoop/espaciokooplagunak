// El rig del avatar y sus anclajes (#897 sobre #603).
//
// Lo que hay que demostrar aquí son dos cosas distintas. Una: que sacar los
// puntos de un rig NO mueve nada de lo que ya se veía —la equivalencia con la
// cuenta a mano que sustituye, que es la única razón por la que este cambio
// puede entrar sin ojos delante—. Y dos: que el rig da lo que una tabla de
// puntos no daba, que es orientación y giro.

import assert from "node:assert/strict";
import test from "node:test";

import {
  ANCLAS,
  anclasAvatar,
  dimensionesCuerpo,
  huesosAvatar,
  poseConRumbo,
  proporciones,
  puntosAvatar,
} from "../scripts/avatar/avatar-rig.mjs";
import {
  ALTO_BASE,
  GESTOS,
  RAZAS,
  SILUETAS,
  SITIOS,
  anclasHumoDeLaGente,
  medidasDeAvatar,
  piezasAvatar,
} from "../scripts/cantina-avatar.mjs";

/** Un cuerpo de referencia: humano de silueta neutra, con los pies en el
 *  origen. Ni la raza ni la silueta lo alteran (factor 1), así que las cifras
 *  de abajo son las del cuerpo base y se pueden leer a ojo. */
const BASE = Object.freeze({ escala: ALTO_BASE, ancho: 1, pies: [0, 0, 0] });

const CASI = 1e-9;

function cerca(a, b, mensaje) {
  for (let i = 0; i < 3; i += 1) {
    assert.ok(Math.abs(a[i] - b[i]) < CASI, `${mensaje}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`);
  }
}

/* ---- que no se ha movido nada --------------------------------------------- */

test("los anclajes caen donde los ponía la cuenta a mano", () => {
  // Estas cifras NO se derivan aquí de las mismas fórmulas que el módulo, que
  // sería una tautología: son los valores que estaban escritos a mano en
  // `manosDelGesto`, `distintivoDeClase` y `puntaDelCigarro` antes de #897,
  // para el cuerpo base. Si el rig los mueve, esta prueba se entera.
  const a = anclasAvatar(BASE);
  cerca(a.manoDerecha.punto, [0.3, 0.83936, 0.06], "mano derecha en reposo");
  cerca(a.manoIzquierda.punto, [-0.3, 0.83936, 0.06], "mano izquierda en reposo");
  cerca(a.boca.punto, [0.26, 1.4364, 0.4], "punta del cigarro");
  cerca(a.hombro.punto, [0.34, 1.17992, -0.16], "hombro del distintivo");
});

test("el ancla del humo es la misma punta de cigarro que dibuja la brasa", () => {
  // Éste es el fallo original de #439: el humo y la brasa salían de dos cuentas
  // separadas. Ahora salen del mismo hueso, y se exige sobre la PIEZA dibujada
  // y el ANCLA declarada, no sobre la fórmula que ambas usan.
  const persona = { id: "x", raza: "enano", silueta: "ancha", gesto: "fumar", clase: "monje" };
  const [humo] = anclasHumoDeLaGente([persona]);
  assert.ok(humo, "no se declaró el ancla de humo");
  // `anclasHumoDeLaGente` sienta a la gente en los SITIOS de la cantina, así
  // que la brasa se pide en ese mismo sitio para poder compararlas.
  const piezas = piezasAvatar(persona, { pies: SITIOS[0].pies });
  const brasa = piezas.find((p) => p.nombre.endsWith("Brasa"));
  assert.ok(brasa, "no se dibujó la brasa");
  cerca(brasa.centro, humo.punto, "el humo no sale de la brasa");
});

test("cada gesto deja las manos donde las dejaba antes", () => {
  // Los seis gestos, con sus posiciones de mano tal y como estaban escritas.
  const esperado = {
    quieto: { der: [0.3, 0.83936, 0.06], izq: [-0.3, 0.83936, 0.06] },
    saludo: { der: [0.42, 1.4964, 0.1], izq: [-0.3, 0.83936, 0.06] },
    brindis: { der: [0.34, 1.17992, 0.24], izq: [-0.3, 0.83936, 0.06] },
    fumar: { der: [0.26, 1.3764, 0.22], izq: [-0.3, 0.83936, 0.06] },
    hombros: { der: [0.46, 0.9632, 0.16], izq: [-0.46, 0.9632, 0.16] },
    pensar: { der: [0.12, 1.3364, 0.26], izq: [-0.3, 0.83936, 0.06] },
  };
  assert.deepEqual(Object.keys(esperado).sort(), [...GESTOS].sort(), "falta un gesto por cubrir");
  for (const [gesto, { der, izq }] of Object.entries(esperado)) {
    const piezas = piezasAvatar({ raza: "humano", silueta: "neutra", gesto, clase: "monje" });
    cerca(piezas.find((p) => p.nombre.endsWith("ManoDer")).centro, der, `mano derecha en «${gesto}»`);
    cerca(piezas.find((p) => p.nombre.endsWith("ManoIzq")).centro, izq, `mano izquierda en «${gesto}»`);
  }
});

test("las cajas del cuerpo salen del mismo rig que los anclajes", () => {
  // La propiedad que este módulo existe para garantizar: la mano DIBUJADA y el
  // anclaje del que cuelga lo que lleva son el mismo hueso, para cualquier
  // cuerpo. Si un día divergen, un cigarro se queda flotando al lado de una
  // mano que ya no está ahí — que es exactamente lo que pasaba antes.
  for (const raza of RAZAS) {
    for (const silueta of SILUETAS) {
      const descripcion = { raza, silueta, gesto: "fumar", clase: "guerrero" };
      const pies = [1.5, -1.75, -2.2];
      const piezas = piezasAvatar(descripcion, { pies });
      // Ni la boca, ni el hombro, ni la mano izquierda dependen del gesto
      // «fumar», que solo mueve la derecha: por eso se piden en reposo.
      const anclas = anclasAvatar(medidasDeAvatar(descripcion, pies));
      const donde = (sufijo) => piezas.find((p) => p.nombre.endsWith(sufijo)).centro;
      cerca(donde("Brasa"), anclas.boca.punto, `brasa y boca separadas con ${raza}/${silueta}`);
      cerca(donde("Distintivo"), anclas.hombro.punto, `distintivo y hombro separados con ${raza}/${silueta}`);
      cerca(donde("ManoIzq"), anclas.manoIzquierda.punto, `mano izquierda suelta con ${raza}/${silueta}`);
    }
  }
});

/* ---- lo que una tabla de puntos no daba ------------------------------------ */

test("cada anclaje trae orientación unitaria, y no una cualquiera", () => {
  const a = anclasAvatar(BASE);
  for (const nombre of Object.keys(ANCLAS)) {
    const { orientacion } = a[nombre];
    assert.ok(orientacion, `«${nombre}» sin orientación`);
    const largo = Math.hypot(...orientacion);
    assert.ok(Math.abs(largo - 1) < CASI, `«${nombre}» con orientación no unitaria (${largo})`);
  }
  // La boca apunta hacia DELANTE (+z domina): es lo que hace que un cigarro
  // colgado de ella asome de la cara y no del cogote. Con un punto suelto esto
  // no se podía ni preguntar.
  const { orientacion } = a.boca;
  assert.ok(orientacion[2] > 0.7, `la boca no mira adelante (${JSON.stringify(orientacion)})`);
  // Y la cabeza cuelga del torso hacia arriba.
  cerca(a.cabeza.orientacion, [0, 1, 0], "la cabeza no apunta arriba");
});

test("el rumbo gira el cuerpo entero sobre sus pies", () => {
  // El yaw no es un caso especial: es un giro del hueso raíz. Lo que se exige
  // es lo que lo hace un giro y no un empujón — la distancia de cada anclaje al
  // eje de los pies no cambia, y a media vuelta todo queda en el lado opuesto.
  const recto = anclasAvatar(BASE);
  const media = anclasAvatar(BASE, { yaw: Math.PI });
  for (const nombre of Object.keys(ANCLAS)) {
    const a = recto[nombre].punto;
    const b = media[nombre].punto;
    assert.ok(Math.abs(a[1] - b[1]) < CASI, `«${nombre}» cambió de altura al girar`);
    assert.ok(
      Math.abs(Math.hypot(a[0], a[2]) - Math.hypot(b[0], b[2])) < CASI,
      `«${nombre}» cambió de radio al girar`,
    );
  }
  cerca(media.boca.punto, [-recto.boca.punto[0], recto.boca.punto[1], -recto.boca.punto[2]], "media vuelta");
  // Y gira sobre los PIES de esa persona, no sobre el origen del mundo.
  const lejos = { ...BASE, pies: [5, 0, -3] };
  const giradoLejos = anclasAvatar(lejos, { yaw: Math.PI });
  cerca(
    giradoLejos.boca.punto,
    [5 - recto.boca.punto[0], recto.boca.punto[1], -3 - recto.boca.punto[2]],
    "el giro no es sobre los pies",
  );
});

test("una pose explícita de la raíz manda sobre el rumbo", () => {
  // Quien declara la raíz sabe más que el apaño del yaw, y silenciarlo sería
  // que una pose deliberada dejara de aplicarse sin decir nada.
  const propia = { raiz: { eje: [0, 1, 0], angulo: 0 } };
  assert.equal(poseConRumbo(propia, Math.PI), propia);
  assert.deepEqual(poseConRumbo({}, 0), {});
  assert.deepEqual(poseConRumbo({}, Number.NaN), {});
});

test("un gesto es una pose PARCIAL: quieto no declara nada", () => {
  // Si «quieto» tuviera que declarar los dos brazos, cada gesto nuevo sería una
  // copia del cuerpo entero y todos envejecerían juntos. El reposo del rig ES
  // la postura quieta.
  const enReposo = puntosAvatar(BASE);
  const conPoseVacia = puntosAvatar(BASE, { pose: {} });
  for (const id of Object.keys(enReposo)) cerca(enReposo[id], conPoseVacia[id], `hueso ${id}`);
});

/* ---- la forma del esqueleto ------------------------------------------------ */

test("el esqueleto cuelga entero de la raíz y la raíz está en los pies", () => {
  const huesos = huesosAvatar(BASE);
  const ids = new Set(huesos.map((h) => h.id));
  const raices = huesos.filter((h) => !h.padre);
  assert.equal(raices.length, 1, "hay más de una raíz");
  assert.equal(raices[0].id, "raiz");
  cerca(raices[0].cabeza, BASE.pies, "la raíz no está en los pies");
  for (const hueso of huesos) {
    if (!hueso.padre) continue;
    assert.ok(ids.has(hueso.padre), `«${hueso.id}» cuelga de un hueso que no existe`);
  }
  // Todo anclaje nombra un hueso de verdad: ampliar `ANCLAS` sin añadir el
  // hueso es el fallo que convertiría esto otra vez en una tabla de puntos.
  for (const [ancla, hueso] of Object.entries(ANCLAS)) {
    assert.ok(ids.has(hueso), `el ancla «${ancla}» apunta a un hueso inexistente («${hueso}»)`);
  }
});

test("las proporciones siguen siendo cuatro cabezas", () => {
  const { altoCabeza, altoTorso, altoPiernas } = proporciones(ALTO_BASE);
  assert.ok(Math.abs(altoCabeza + altoTorso + altoPiernas - ALTO_BASE) < CASI, "el cuerpo no suma su altura");
  // La cabeza es la cuarta parte larga del cuerpo: es la firma del estilo de
  // #423 y no un número que se pueda mover sin querer.
  assert.ok(altoCabeza / ALTO_BASE > 0.24 && altoCabeza / ALTO_BASE < 0.28, "la cabeza dejó de ser enorme");
  const d = dimensionesCuerpo(BASE);
  assert.ok(d.yReposo < d.yTorso, "la mano en reposo no cuelga por debajo del centro del torso");
});
