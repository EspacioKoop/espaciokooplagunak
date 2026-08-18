// El horizonte, prerenderizado a PNG (#584).
//
// EL PRIMER BINARIO DEL REPOSITORIO, y conviene decir por qué merece serlo. No
// es por velocidad: generar el matte cuesta milisegundos, y el motivo que da
// #584 —«la piel se pinta en cada cliente en cada carga»— medido resulta ser
// decenas de milisegundos una sola vez. Lo que un PNG en el árbol da y un
// generador no:
//
//  1. SE PUEDE MIRAR. Un cambio en el dibujo aparece en el PR como una imagen
//     distinta, no como cuarenta líneas de aritmética que hay que ejecutar
//     mentalmente para saber si el horizonte quedó mejor o peor.
//  2. ES LA MISMA PUERTA POR LA QUE ENTRARÍA ARTE DE FUERA. Una textura CC0
//     (#571) y una nuestra prerenderizada entran por el mismo sitio y se cargan
//     con el mismo código. Si no existe esa puerta, traer material obliga a
//     inventarla con las prisas del primer PR que lo intente.
//  3. FIJA EL DIBUJO. El generador puede cambiar; el asset dice qué se veía.
//
// LA PUERTA DE REPRODUCIBILIDAD ES LO QUE LO HACE SEGURO. Mismo generador, mismo
// byte —el codificador no comprime, así que no depende de la versión de nada— y
// una prueba compara lo del árbol con lo que sale ahora. Un binario que nadie
// puede regenerar es una deuda; uno que se regenera con un comando y se verifica
// en CI, no.

import { codificarPngIndexado } from "./png-indexado.mjs";
import { CAPAS, pngDeTextura, texturaDeRejilla, rejillaHorizonte } from "./horizonte-matte.mjs";

/** Cómo se llama el PNG de una capa. */
export function ficheroDeCapa(nombre) {
  return `${nombre}.png`;
}

/**
 * Los PNG de todas las capas, listos para escribir.
 *
 * Se genera desde la MISMA función que usa el módulo en caliente, no desde una
 * copia: si se bifurcaran, el asset y lo que se pinta dejarían de ser lo mismo y
 * la puerta de reproducibilidad estaría verificando una mentira.
 */
export function ficherosHorizonte() {
  return new Map(
    CAPAS.map((capa) => [
      ficheroDeCapa(capa.nombre),
      codificarPngIndexado(
        pngDeTextura(texturaDeRejilla(rejillaHorizonte({ semilla: capa.semilla, contenido: capa.contenido }))),
      ),
    ]),
  );
}
