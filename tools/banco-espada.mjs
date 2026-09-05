#!/usr/bin/env node
/**
 * SONDA, no módulo: una espada larga construida con las primitivas que ya usa
 * el módulo, para ver en el banco (#976) cómo se lee un arma con este motor
 * antes de decidir nada sobre #967.
 *
 * Vive en `tools/` a propósito. Un arma de verdad sería un módulo de arte, y
 * un módulo de arte no puede declarar colores propios (#351): tendría que
 * traer su grupo a `paleta.mjs`, y eso es una decisión de paleta que no se
 * toma de refilón dentro de una prueba. Aquí no hace falta ninguno nuevo: `AVATAR.acero` está
 * declarado como "armas y armaduras" y `AVATAR.madera` como "báculos, laúdes",
 * o sea que la paleta ya se había adelantado a esto. Los tonos intermedios
 * salen de `sombrear`, no escritos a mano.
 */
import { caja, prisma } from "../foundry-module/scripts/escena-primitivas.mjs";
import { AVATAR } from "../foundry-module/scripts/paleta.mjs";
import { sombrear } from "../foundry-module/scripts/retro3d.mjs";

// El acero y la madera salen de `AVATAR`, que ya los tiene declarados para
// "armas y armaduras" y para "báculos, laúdes": la paleta se adelantó a esto.
// Los tonos intermedios NO se escriben —eso sería declarar color propio, que
// es lo que prohíbe #351—: se sacan del mismo acero con `sombrear`, la función
// con la que el motor ya oscurece cualquier cara.
const ACERO = AVATAR.acero;
const ACERO_CLARO = sombrear(ACERO, 1.18);
const ACERO_HUECO = sombrear(ACERO, 0.55);
const CUERO = AVATAR.madera;
const CUERO_VUELTA = sombrear(CUERO, 0.7);

const LARGO_HOJA = 1.0;   // espada larga: hoja de un metro
const LARGO_PUNTA = 0.18; // el tramo que cierra en punta
const LARGO_RICASSO = 0.09; // el talón sin filo, justo sobre los gavilanes
const LARGO_EMPUNADURA = 0.22;
const ANCHO_GAVILAN = 0.26;

/**
 * La hoja es un prisma de CUATRO lados girado 45°, no una caja: esa sección en
 * rombo es lo que le da el filo y la arista central, y con las caras planas de
 * este motor el filo se lee como un cambio de tono, no como un contorno.
 *
 * Va en tres tramos y no en uno porque una espada no es un triángulo: el
 * RICASSO (el talón sin filo sobre la guarda) es más grueso, el cuerpo se
 * estrecha despacio y la punta cierra rápido. Con un solo prisma cónico se lee
 * como un pincho; con tres, como un arma que alguien forjó.
 */
function hoja(base) {
  const yRicasso = base;
  const yCuerpo = base + LARGO_RICASSO;
  const yPunta = base + LARGO_HOJA - LARGO_PUNTA;
  const seccion = { lados: 4, giro: Math.PI / 4 };

  const ricasso = prisma([0, yRicasso, 0], {
    ...seccion, radioAbajo: 0.05, radioArriba: 0.048, alto: LARGO_RICASSO, tapaAbajo: true,
  });
  const cuerpo = prisma([0, yCuerpo, 0], {
    ...seccion, radioAbajo: 0.048, radioArriba: 0.034, alto: yPunta - yCuerpo,
  });
  const punta = prisma([0, yPunta, 0], {
    ...seccion, radioAbajo: 0.034, radioArriba: 0.004, alto: LARGO_PUNTA,
  });

  // El VACEO: la acanaladura que recorre la hoja. Aquí no se puede excavar
  // —el motor no resta geometría—, así que se pone un prisma más estrecho
  // ligeramente por delante, en el tono de hueco de la rampa. A esta
  // resolución un surco es una franja oscura, que es exactamente lo que hace.
  //
  // Va POR FUERA, apoyado en las dos caras vistas, no dentro: un prisma más
  // estrecho metido en el eje queda tapado por la propia hoja y no se ve nada
  // —el motor no tiene transparencias ni resta geometría—. Apoyado en la cara
  // sí se lee, porque a esta resolución un surco es una franja oscura.
  const vaceos = [1, -1].map((lado) =>
    prisma([lado * 0.026, yCuerpo, lado * 0.026], {
      lados: 4, giro: Math.PI / 4, radioAbajo: 0.016, radioArriba: 0.010,
      alto: (yPunta - yCuerpo) * 0.94,
    }));

  return [
    { ...ricasso, color: ACERO },
    { ...cuerpo, color: ACERO_CLARO },
    ...vaceos.map((v) => ({ ...v, color: ACERO_HUECO })),
    { ...punta, color: ACERO_CLARO },
  ];
}

/**
 * Gavilanes, empuñadura y pomo: la cruz que hace que se lea como espada.
 *
 * Los gavilanes van en TRES piezas —el bloque central y dos remates— porque
 * una barra recta se lee como un travesaño de andamio. Con los remates un poco
 * más gruesos, la cruz tiene principio y final.
 */
function guarnicion(base) {
  const bloque = caja([0, base - 0.025, 0], [ANCHO_GAVILAN * 0.55, 0.055, 0.06]);
  const brazoIzq = caja([-ANCHO_GAVILAN * 0.4, base - 0.025, 0], [ANCHO_GAVILAN * 0.3, 0.04, 0.045]);
  const brazoDer = caja([ANCHO_GAVILAN * 0.4, base - 0.025, 0], [ANCHO_GAVILAN * 0.3, 0.04, 0.045]);
  const remateIzq = caja([-ANCHO_GAVILAN * 0.55, base - 0.025, 0], [0.045, 0.06, 0.06]);
  const remateDer = caja([ANCHO_GAVILAN * 0.55, base - 0.025, 0], [0.045, 0.06, 0.06]);

  const yPuno = base - 0.055 - LARGO_EMPUNADURA;
  const puno = prisma([0, yPuno, 0], {
    radioAbajo: 0.021, radioArriba: 0.025, alto: LARGO_EMPUNADURA, lados: 8, tapaAbajo: true,
  });
  // Las vueltas del cordaje: tres anillos, no una textura. La empuñadura lisa
  // se lee como plástico, y este motor no mapea texturas sobre un prisma.
  const anillos = [0.05, 0.11, 0.17].map((h) =>
    prisma([0, yPuno + h, 0], { radioAbajo: 0.027, radioArriba: 0.027, alto: 0.018, lados: 8 }));

  const pomo = prisma([0, yPuno - 0.05, 0], {
    radioAbajo: 0.024, radioArriba: 0.05, alto: 0.05, lados: 8, tapaAbajo: true,
  });
  const canto = prisma([0, yPuno - 0.012, 0], {
    radioAbajo: 0.05, radioArriba: 0.03, alto: 0.022, lados: 8,
  });

  return [
    { ...brazoIzq, color: ACERO },
    { ...brazoDer, color: ACERO },
    { ...remateIzq, color: ACERO_CLARO },
    { ...remateDer, color: ACERO_CLARO },
    { ...bloque, color: ACERO_CLARO },
    { ...puno, color: CUERO },
    ...anillos.map((a) => ({ ...a, color: CUERO_VUELTA })),
    { ...pomo, color: ACERO },
    { ...canto, color: ACERO_CLARO },
  ];
}

/**
 * DÓNDE VA EL PUÑO, medido desde el origen de la malla (la guarda).
 *
 * Lo declara el arma y no quien la coge: una espada sabe por dónde se agarra,
 * y un cuerpo no tiene por qué saber cómo es cada arma que le pongan en la
 * mano. Es el mismo reparto que propone #897 para los anclajes — el cuerpo
 * pone el punto, la pieza pone su asa.
 */
export const AGARRE = Object.freeze([0, -0.055 - LARGO_EMPUNADURA / 2, 0]);

/** Las piezas de la espada, con la guarda en el origen y la hoja hacia +y. */
export function piezasEspada(base = 0) {
  return [...hoja(base), ...guarnicion(base)];
}
