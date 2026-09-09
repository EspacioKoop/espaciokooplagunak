#!/usr/bin/env node
/**
 * SONDA (#976, con vistas a #897 y #973): una figura con BRAZOS, para poder
 * ponerle algo en la mano.
 *
 * Existe porque el avatar que hay hoy —`cantina-avatar.mjs`, estilo FF7— no
 * tiene manos: son cuatro cajas (piernas, torso, cabeza y pelo) y el brazo
 * está deliberadamente fuera. Con ese cuerpo no hay dónde anclar una espada,
 * así que esto añade lo mínimo para que exista el anclaje: hombro, brazo,
 * antebrazo y mano.
 *
 * NO sustituye al avatar del módulo ni pretende ser el de #974: conserva sus
 * proporciones (cuatro cabezas de alto, `ALTO_BASE`) y sus colores, para que
 * lo que se vea aquí se parezca a lo que ya hay y no a un cuerpo distinto.
 */
import { caja } from "../foundry-module/scripts/escena-primitivas.mjs";
import { ALTO_BASE } from "../foundry-module/scripts/cantina-avatar.mjs";
import { AVATAR, RETRATO, FACCIONES } from "../foundry-module/scripts/paleta.mjs";
import { sombrear } from "../foundry-module/scripts/retro3d.mjs";

/** Gira una malla alrededor de un punto, en el plano indicado. */
export function girar(pieza, [px, py, pz], angulo, eje = "z") {
  const c = Math.cos(angulo);
  const s = Math.sin(angulo);
  return {
    ...pieza,
    vertices: pieza.vertices.map(([x, y, z]) => {
      const dx = x - px, dy = y - py, dz = z - pz;
      if (eje === "z") return [px + dx * c - dy * s, py + dx * s + dy * c, pz + dz];
      if (eje === "x") return [px + dx, py + dy * c - dz * s, pz + dy * s + dz * c];
      return [px + dx * c + dz * s, py + dy, pz - dx * s + dz * c];
    }),
  };
}

/** Desplaza una malla. */
export function mover(pieza, [dx, dy, dz]) {
  return { ...pieza, vertices: pieza.vertices.map(([x, y, z]) => [x + dx, y + dy, z + dz]) };
}

/**
 * Cuerpo completo. Devuelve las piezas y, aparte, DÓNDE está la mano derecha:
 * ese punto es el anclaje, y es todo lo que un arma necesita saber del cuerpo
 * que la lleva —la idea de #897, reducida a lo mínimo que se puede enseñar—.
 */
export function piezasFigura({ pies = [0, 0, 0], piel = 1, pelo = 1, ropa = 2 } = {}) {
  const [px, py, pz] = pies;
  const alto = ALTO_BASE;
  const colorPiel = RETRATO.cascos[piel];
  const colorPelo = AVATAR.pelos[pelo];
  const colorRopa = FACCIONES[ropa];
  const colorBota = sombrear(colorRopa, 0.6);
  // La manga, un paso por debajo de la ropa: con el mismo tono exacto el brazo
  // desaparece dentro del torso y la figura se lee como un bloque sin brazos.
  const colorManga = sombrear(colorRopa, 0.78);

  const altoCabeza = alto * 0.26;
  const altoTorso = alto * 0.36;
  const altoPiernas = alto - altoCabeza - altoTorso;

  const yTorso = py + altoPiernas + altoTorso / 2;
  const yCabeza = py + altoPiernas + altoTorso + altoCabeza / 2;
  const anchoTorso = 0.46;

  // Dos piernas y no un bloque: en cuanto hay brazos, un tronco único abajo
  // se lee como una peana y deshace el resto.
  const piernas = [-1, 1].map((lado) =>
    caja([px + lado * 0.11, py + altoPiernas / 2 + 0.06, pz], [0.17, altoPiernas - 0.12, 0.2]));
  const botas = [-1, 1].map((lado) =>
    caja([px + lado * 0.11, py + 0.05, pz - 0.02], [0.19, 0.1, 0.26]));

  const torso = caja([px, yTorso, pz], [anchoTorso, altoTorso, 0.3]);
  const cabeza = caja([px, yCabeza, pz], [0.38, altoCabeza, 0.36]);
  const pelaje = caja([px, yCabeza + altoCabeza * 0.42, pz - 0.02], [0.42, altoCabeza * 0.34, 0.4]);

  // El brazo derecho: hombro, brazo, antebrazo y mano, colgando y algo
  // separado del cuerpo para que la hoja no cruce el torso.
  const xHombro = px + anchoTorso / 2 + 0.04;
  const yHombro = yTorso + altoTorso / 2 - 0.05;
  const largoBrazo = 0.3;
  const largoAntebrazo = 0.28;
  const yCodo = yHombro - largoBrazo;
  const yMuneca = yCodo - largoAntebrazo;

  const brazo = caja([xHombro, yHombro - largoBrazo / 2, pz], [0.13, largoBrazo, 0.15]);
  const antebrazo = caja([xHombro, yCodo - largoAntebrazo / 2, pz], [0.115, largoAntebrazo, 0.13]);
  // La mano en tres piezas: palma, dedos cerrados y pulgar cruzado. Con una
  // caja sola, un arma metida ahí no se ve agarrada — se ve atravesando un
  // guante. Los dedos y el pulgar son lo que dice que el puño está CERRADO
  // alrededor de algo.
  const yMano = yMuneca - 0.05;
  const mano = caja([xHombro, yMano, pz], [0.11, 0.12, 0.1]);
  const dedos = caja([xHombro, yMano - 0.005, pz + 0.075], [0.105, 0.115, 0.06]);
  const pulgar = caja([xHombro - 0.045, yMano + 0.01, pz + 0.04], [0.05, 0.055, 0.11]);

  // El izquierdo, simétrico y sin nada que sujetar.
  const xHombroIzq = px - anchoTorso / 2 - 0.04;
  const brazoIzq = caja([xHombroIzq, yHombro - largoBrazo / 2, pz], [0.13, largoBrazo, 0.15]);
  const antebrazoIzq = caja([xHombroIzq, yCodo - largoAntebrazo / 2, pz], [0.115, largoAntebrazo, 0.13]);
  const manoIzq = caja([xHombroIzq, yMuneca - 0.05, pz], [0.12, 0.11, 0.14]);

  // El brazo derecho va APARTE del resto del cuerpo, y no por capricho: es lo
  // que permite girarlo con lo que lleve en la mano como una sola cosa. Ese es
  // el punto de #897 reducido a lo mínimo — el anclaje sale del cuerpo, y lo
  // anclado se mueve con él sin saber nada de anatomía.
  const brazoDerecho = [
    { ...brazo, color: colorManga },
    { ...antebrazo, color: colorPiel },
    { ...mano, color: colorPiel },
    { ...dedos, color: sombrear(colorPiel, 0.88) },
    { ...pulgar, color: colorPiel },
  ];

  const piezas = [
    ...piernas.map((p) => ({ ...p, color: colorRopa })),
    ...botas.map((p) => ({ ...p, color: colorBota })),
    { ...torso, color: colorRopa },
    { ...brazoIzq, color: colorManga },
    { ...antebrazoIzq, color: colorPiel },
    { ...manoIzq, color: colorPiel },
    { ...cabeza, color: colorPiel },
    { ...pelaje, color: colorPelo },
  ];

  return {
    piezas,
    brazoDerecho,
    // El anclaje: dentro del puño, no en su superficie.
    manoDerecha: [xHombro, yMano, pz],
    hombroDerecho: [xHombro, yHombro, pz],
  };
}
