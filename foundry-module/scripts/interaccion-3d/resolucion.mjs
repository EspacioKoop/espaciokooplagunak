// Motor de resolución del contrato standalone de interacción (#868).
//
// POR QUÉ EXISTE. #861 proponía diez mecánicas calcadas de dnd5e (habilidad,
// ventaja, tirada de dado) para objetos de la nave 3D. @VaroTv7 frenó eso: el
// juego tiene que poder resolver una interacción completa sin Foundry ni
// ningún sistema de reglas externo, así que el motor que decide fallo/éxito no
// puede llamarse "d20" ni depender de una CD. Este archivo es esa resolución
// propia: un margen entre una `dificultad` (0..1, la probabilidad de serie de
// que la aproximación baste) y una `tirada` (0..1, provista por quien llama —
// nunca generada aquí, para que la prueba sea determinista y el motor no
// dependa de ninguna fuente de azar concreta).
//
// CUATRO BANDAS, NO DOS. Un fallo raso y una complicación no son el mismo
// resultado: la banda `pifia` es lo que abre la puerta a que el terminal
// empeore en vez de quedarse igual, que es la mitad del vertical de prueba
// (terminal deteriorado). Y un éxito holgado merece más que uno raspado, por
// la misma razón que #553 separa "ganar" de "ganar a lo grande".
//
// Puro: ni Foundry, ni DOM, ni azar propio. Se prueba desde Node con `tirada`
// fija.

export const BANDAS = Object.freeze({
  PIFIA: "pifia",
  FALLO: "fallo",
  EXITO: "exito",
  CRITICO: "critico",
});

/**
 * Fracción del margen de éxito que cuenta como "holgado" y sube a `critico`.
 *
 * Con `dificultad` 0,65 y este umbral, una `tirada` por debajo de 0,65 * 0,3 =
 * 0,195 es crítico: aproximadamente uno de cada tres éxitos de esa
 * aproximación, no uno de cada veinte — este motor no es un d20 y no tiene por
 * qué imitar su rareza.
 */
export const FRACCION_CRITICO = 0.3;

/**
 * Margen por encima de `dificultad`, en la misma escala 0..1, que cuenta como
 * complicación y baja a `pifia` en vez de quedarse en `fallo` raso.
 */
export const MARGEN_PIFIA = 0.3;

function validarUnidad(nombre, valor) {
  const numero = Number(valor);
  if (!Number.isFinite(numero) || numero < 0 || numero > 1) {
    throw new RangeError(`resolverAproximacion: \`${nombre}\` debe estar en [0, 1], recibido ${valor}`);
  }
  return numero;
}

/**
 * Resuelve una aproximación: dada su `dificultad` (probabilidad de serie de
 * bastar) y una `tirada` ya generada por quien llama, devuelve la banda y el
 * margen que la produjo (`margen > 0` es éxito, cuanto mayor más holgado).
 */
export function resolverAproximacion({ dificultad, tirada }) {
  const d = validarUnidad("dificultad", dificultad);
  const t = validarUnidad("tirada", tirada);
  const margen = d - t;

  let banda;
  if (margen >= d * FRACCION_CRITICO && margen > 0) {
    banda = BANDAS.CRITICO;
  } else if (margen >= 0) {
    banda = BANDAS.EXITO;
  } else if (margen >= -MARGEN_PIFIA) {
    banda = BANDAS.FALLO;
  } else {
    banda = BANDAS.PIFIA;
  }

  return Object.freeze({ banda, margen, dificultad: d, tirada: t });
}
