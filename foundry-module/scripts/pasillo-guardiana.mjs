// La silueta de la Guardiana y sus centinelas (pasillo de los recuerdos).
//
// NO ES UN ESCANEO. El museo escanea vaciados reales porque sus piezas
// declaran una procedencia arqueológica (#598) — esto es al revés: la
// Guardiana es un personaje ORIGINAL de esta ficción (`naturaleza:
// "obra-propia"` en `pasillo-recuerdos-piezas.mjs`), así que su malla sale de
// las mismas primitivas con las que este módulo ya construye cualquier otra
// cosa de la escena (`escena-primitivas.mjs`), no de `tools/convertir-estatua.mjs`.
//
// UNA SOLA SILUETA, DOS TAMAÑOS. La propia Guardiana y sus centinelas
// comparten la misma función de forma —túnica cónica, capucha, dos alas
// plegadas de cuervo— y solo cambian de escala: es la misma disciplina de
// #550 aplicada a un personaje en vez de a un mueble, para que la fila entera
// se lea como una guardia y no como quince intentos distintos de dibujar lo
// mismo.
//
// Puro: solo geometría. Ni Foundry, ni DOM, ni color propio (#351) — el color
// entra desde fuera, de `PASILLO` en `paleta.mjs`.

import { caja, prisma, trasladar } from "./escena-primitivas.mjs";

/** Funde varias mallas en una sola, desplazando los índices de cara de cada
 *  una por el número de vértices ya acumulados. Es el mismo patrón que
 *  `nave-luminaria.mjs` o `nave-piel-suelo.mjs` aplican al fundir por color,
 *  aquí sobre una sola pieza con un solo color. */
function fundir(mallas) {
  const vertices = [];
  const caras = [];
  for (const malla of mallas) {
    const desde = vertices.length;
    vertices.push(...malla.vertices);
    for (const cara of malla.caras) caras.push(cara.map((i) => desde + i));
  }
  return { vertices, caras };
}

/**
 * La silueta, centrada en planta y apoyada en el suelo (`y = 0`), igual que
 * las mallas del museo — así `colocarGuardiana` puede tratarla exactamente
 * como una pieza escaneada y no necesita un segundo camino de colocación.
 *
 * @param {number} alto Alto total en metros. 2,2 es lo que miden ya las
 *   piezas del museo (`tools/convertir-estatua.mjs`, `alto` por defecto): las
 *   dos filas del pasillo quedan a los ojos a la misma altura.
 */
export function estatuaGuardiana(alto = 2.2) {
  // Proporciones de la silueta, como fracción del alto total: cambiar `alto`
  // reescala la figura entera en vez de dejar una capucha del tamaño de antes
  // sobre un cuerpo más alto o más bajo.
  const altoTunica = alto * 0.68;
  const altoCabeza = alto * 0.14;
  const altoCapucha = alto * 0.18;
  const radioBase = alto * 0.24;
  const radioHombros = alto * 0.13;
  const yTunica = 0;
  const yCabeza = altoTunica;
  const yCapucha = altoTunica + altoCabeza * 0.4;

  const tunica = prisma([0, yTunica, 0], {
    radioAbajo: radioBase,
    radioArriba: radioHombros,
    alto: altoTunica,
    lados: 8,
  });
  const cabeza = prisma([0, yCabeza, 0], {
    radioAbajo: radioHombros * 0.9,
    radioArriba: radioHombros * 0.6,
    alto: altoCabeza,
    lados: 8,
  });
  // La capucha remata en punta: es lo que separa esta silueta de un maniquí
  // sin más, y lo que se lee de perfil según se avanza por el pasillo.
  const capucha = prisma([0, yCapucha, 0], {
    radioAbajo: radioHombros * 1.05,
    radioArriba: 0,
    alto: altoCapucha,
    lados: 8,
  });

  // Dos alas de cuervo PLEGADAS contra la espalda: cajas finas, más anchas
  // abajo que arriba, giradas hacia fuera desde los hombros. Plegadas y no
  // extendidas a propósito — una escultura de museo no vuela, vela; una
  // silueta extendida en un pasillo estrecho además pisaría el paso.
  const anchoAla = radioBase * 0.22;
  const altoAla = altoTunica * 0.78;
  const alaIzquierda = trasladar(
    caja([0, altoTunica - altoAla / 2, 0], [anchoAla, altoAla, radioBase * 0.9]),
    [-(radioHombros + anchoAla * 0.4), 0, -radioBase * 0.1],
  );
  const alaDerecha = trasladar(
    caja([0, altoTunica - altoAla / 2, 0], [anchoAla, altoAla, radioBase * 0.9]),
    [radioHombros + anchoAla * 0.4, 0, -radioBase * 0.1],
  );

  return fundir([tunica, cabeza, capucha, alaIzquierda, alaDerecha]);
}
