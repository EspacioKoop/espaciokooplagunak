#!/usr/bin/env node
/**
 * SONDA (#976, propuesta para #897): objetos que se llevan en la mano, con un
 * contrato que no es «de armas».
 *
 * Dos ideas, y ninguna es específica de una espada:
 *
 * 1. CADA OBJETO DECLARA SU AGARRE — dónde se cierra el puño, medido desde su
 *    propio origen. Lo declara la pieza y no el cuerpo: una espada se coge por
 *    el mango, una jarra por el asa y una linterna por el mango también, pero a
 *    otra altura. Un cuerpo no tiene por qué saber cómo es cada trasto que le
 *    pongan en la mano; sólo tiene que ofrecer el punto.
 *
 * 2. LLEVAR NO ES UN GESTO. `atrezoDelGesto` en `cantina-avatar.mjs` decide qué
 *    llevas a partir de lo que estás haciendo —la jarra sale con «brindis», el
 *    cigarro con «fumar»—, y eso obliga a inventar un gesto «empuñar» para que
 *    alguien pueda llevar una espada, gesto que además excluiría a los otros
 *    cinco. Aquí lo que se lleva es un PORTE por anclaje, independiente del
 *    gesto: se puede fumar con la espada en la mano, o brindar con ella en la
 *    izquierda.
 */
import { caja, prisma } from "../foundry-module/scripts/escena-primitivas.mjs";
import { AVATAR, CACHARROS } from "../foundry-module/scripts/paleta.mjs";
import { sombrear } from "../foundry-module/scripts/retro3d.mjs";
import { piezasEspada, AGARRE as AGARRE_ESPADA } from "./banco-espada.mjs";

/**
 * El catálogo. Cada entrada devuelve `{piezas, agarre}` y NADA más: quien lo
 * cuelga no sabe si es un arma, una bebida o una herramienta, y no debe
 * saberlo. Un objeto nuevo es una entrada más, nunca una rama en el que cuelga.
 */
export const OBJETOS = Object.freeze({
  espada: () => ({ piezas: piezasEspada(0), agarre: AGARRE_ESPADA }),

  // Una jarra se coge por el asa, que no está en su eje: el agarre va DESPLAZADO
  // en x, y con eso solo la jarra ya cuelga bien sin tocar nada del cuerpo.
  jarra: () => {
    const cuerpo = prisma([0, 0, 0], { radioAbajo: 0.075, radioArriba: 0.085, alto: 0.22, lados: 8, tapaAbajo: true });
    const asa = caja([0.1, 0.11, 0], [0.045, 0.11, 0.035]);
    const espuma = prisma([0, 0.21, 0], { radioAbajo: 0.085, radioArriba: 0.08, alto: 0.03, lados: 8 });
    return {
      piezas: [
        { ...cuerpo, color: AVATAR.jarra },
        { ...asa, color: sombrear(AVATAR.jarra, 0.8) },
        { ...espuma, color: CACHARROS.trapo },
      ],
      agarre: [0.1, 0.11, 0],
    };
  },

  // Una linterna se coge por el mango, y encima el foco va EMISIVO: es la misma
  // excepción de #555 y funciona igual colgada de una mano que en un techo.
  linterna: () => {
    const mango = prisma([0, 0, 0], { radioAbajo: 0.028, radioArriba: 0.032, alto: 0.2, lados: 8, tapaAbajo: true });
    const cabeza = prisma([0, 0.2, 0], { radioAbajo: 0.045, radioArriba: 0.07, alto: 0.1, lados: 8 });
    const cristal = prisma([0, 0.295, 0], { radioAbajo: 0.068, radioArriba: 0.066, alto: 0.015, lados: 8 });
    return {
      piezas: [
        { ...mango, color: sombrear(AVATAR.acero, 0.7) },
        { ...cabeza, color: AVATAR.acero },
        { ...cristal, color: AVATAR.simbolo, emisivo: true },
      ],
      agarre: [0, 0.1, 0],
    };
  },

  // Y algo que no es ni arma ni bebida ni herramienta: un tablilla de datos,
  // que se sujeta por el canto y no por un mango.
  tablilla: () => {
    const tabla = caja([0, 0, 0], [0.2, 0.26, 0.022]);
    const pantalla = caja([0, 0.02, -0.014], [0.16, 0.19, 0.004]);
    return {
      piezas: [
        { ...tabla, color: sombrear(AVATAR.acero, 0.65) },
        { ...pantalla, color: AVATAR.simbolo, emisivo: true },
      ],
      agarre: [0, -0.1, 0.015],
    };
  },
});

/**
 * Cuelga un objeto de un punto de anclaje ya resuelto.
 *
 * Es TODA la operación: restar el agarre del objeto al punto de la mano. No
 * hay caso especial por tipo de objeto porque no hace falta ninguno — y esa es
 * la prueba de que el contrato es el correcto.
 */
export function sostener(nombre, punto) {
  const definicion = OBJETOS[nombre];
  if (!definicion) return [];
  const { piezas, agarre } = definicion();
  const [dx, dy, dz] = [punto[0] - agarre[0], punto[1] - agarre[1], punto[2] - agarre[2]];
  return piezas.map((p) => ({
    ...p,
    vertices: p.vertices.map(([x, y, z]) => [x + dx, y + dy, z + dz]),
  }));
}
