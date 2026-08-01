// El primer consumidor de #332: qué contenido del mundo del usuario ha entrado,
// qué se ha quedado fuera y por qué.
//
// Hasta aquí la capa de contenido externo estaba completa y **no la leía nadie**
// —ni siquiera se construía el proveedor—, así que el clasificador podía estar
// descartando el mundo entero sin que nada lo dijera. Esto es lo que lo dice.
//
// ## Por qué el diagnóstico es el primer consumidor y no el último
//
// Es tentador enchufar antes los minijuegos y dejar el diagnóstico para luego.
// Sería el orden equivocado: el clasificador FALLA CERRADO a propósito, así que
// el modo de fallo natural de esta capa no es «sale algo raro» sino «no sale
// nada», y ese es justo el fallo que no se distingue de «no tengo contenido
// importado». Sin esta ventana, el primer consumidor de verdad se depura a
// ciegas relajando el criterio, que es exactamente lo que el diseño de #332
// quería evitar.
//
// ## Qué NO hace
//
// No corrige, no importa y no toca nada del mundo. Enseña. Tampoco decide si un
// elemento vale: eso ya lo hizo `edicion.mjs` y aquí solo se cuenta.
//
// Puro: ni Foundry, ni DOM, ni red. Recibe un adaptador y devuelve datos.

import { MOTIVOS } from "./edicion.mjs";
import { TIPOS } from "./adaptador.mjs";

/** Cuántos ejemplos se enseñan por tipo. Suficiente para reconocer el material. */
export const EJEMPLOS_POR_TIPO = 5;

/** Los tipos en el orden en que se pintan. Estable: es una tabla, no un mapa. */
export const ORDEN_TIPOS = Object.freeze([TIPOS.CRIATURA, TIPOS.OBJETO, TIPOS.HECHIZO]);

function resolverPorTipo(adaptador, tipo) {
  if (tipo === TIPOS.CRIATURA) return adaptador.resolverCriaturas();
  if (tipo === TIPOS.OBJETO) return adaptador.resolverObjetos();
  return adaptador.resolverHechizos();
}

/**
 * Vista del contenido externo, lista para pintar.
 *
 * Devuelve siempre la misma forma, haya o no proveedor: una ventana que enseña
 * ceros es información («no hay nada importado»), y una que no se puede abrir
 * porque falta un módulo ajeno no lo es.
 *
 * @param {object} adaptador un `crearAdaptadorContenido(...)`
 * @returns {{disponible: boolean, total: number, aceptados: number,
 *   descartados: number, tipos: object[], motivos: object[]}}
 */
export function inventarioContenido(adaptador) {
  const disponible = Boolean(adaptador?.disponible?.());

  const tipos = ORDEN_TIPOS.map((tipo) => {
    const resultado = disponible ? resolverPorTipo(adaptador, tipo) : null;
    const elementos = resultado?.elementos ?? [];
    const descartes = resultado?.descartes ?? [];
    return Object.freeze({
      tipo,
      aceptados: elementos.length,
      descartados: descartes.length,
      // Los nombres son lo que permite reconocer «esto es mi material» de un
      // vistazo. Sin ellos la ventana es una fila de números que no dice si el
      // que ha entrado es el contenido que el GM esperaba.
      ejemplos: Object.freeze(
        elementos
          .slice(0, EJEMPLOS_POR_TIPO)
          .map((elemento) => elemento?.nombre ?? "")
          .filter(Boolean),
      ),
    });
  });

  const aceptados = tipos.reduce((suma, fila) => suma + fila.aceptados, 0);
  const descartados = tipos.reduce((suma, fila) => suma + fila.descartados, 0);

  // Solo los motivos que han ocurrido de verdad: una lista con ocho ceros
  // esconde el único que importa. Ordenados de más a menos, que es el orden en
  // que se quiere leer «¿por qué no me sale nada?».
  const conteo = disponible ? (adaptador.diagnostico?.()?.descartesPorMotivo ?? {}) : {};
  const motivos = Object.values(MOTIVOS)
    .map((motivo) => ({ motivo, total: conteo[motivo] ?? 0 }))
    .filter((fila) => fila.total > 0)
    .sort((a, b) => b.total - a.total || a.motivo.localeCompare(b.motivo))
    .map((fila) => Object.freeze(fila));

  return Object.freeze({
    disponible,
    total: aceptados + descartados,
    aceptados,
    descartados,
    tipos: Object.freeze(tipos),
    motivos: Object.freeze(motivos),
  });
}

/**
 * El titular de la ventana, como CLAVE de traducción y no como frase. Distingue
 * los tres estados que el GM necesita separar y que un simple recuento confunde:
 * no hay integración, hay contenido pero el filtro se lo ha comido todo, o todo
 * en orden.
 *
 * El segundo caso es el que justifica la ventana entera: sin él, «0 criaturas»
 * y «no tengo criaturas importadas» se ven exactamente igual.
 */
export function titularInventario(inventario) {
  if (!inventario?.disponible) return "LAGUNAK.ContenidoExterno.Titular.SinProveedor";
  if (inventario.total === 0) return "LAGUNAK.ContenidoExterno.Titular.SinContenido";
  if (inventario.aceptados === 0) return "LAGUNAK.ContenidoExterno.Titular.TodoDescartado";
  return "LAGUNAK.ContenidoExterno.Titular.Correcto";
}
