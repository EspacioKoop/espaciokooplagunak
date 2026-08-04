// Adaptador de contenido plutonium/5etools, restringido a 2014 (#332).
//
// Contrato funcional únicamente: resolverCriaturas / resolverObjetos /
// resolverHechizos. Nunca la estructura interna de plutonium ni de 5etools
// (comentario 1 del issue) — si el proveedor cambia sus flags o su
// organización interna, el impacto queda confinado a este archivo y a
// plutonium-filtro-edicion.mjs, no se propaga al resto del módulo.
//
// El resto del código no debería poder distinguir si un resultado procede
// del SRD o de aquí (comentario 3 del issue): por eso la salida es siempre
// el mismo modelo interno {id, nombre, tipo, edicion, origen, datos}. Un
// adaptador SRD futuro debería producir la misma forma.
//
// Puro: recibe colecciones ya extraídas (arrays de documentos), nunca lee
// `game` ni ningún global de Foundry. Quien wire esto puede pasar listas
// vacías o no llamarlo en absoluto cuando plutonium está ausente: cero
// regresión en el resto del módulo (criterios de aceptación del issue).

import { clasificarDocumento } from "./plutonium-filtro-edicion.mjs";

function modeloInterno(documento, tipo, edicion) {
  return {
    id: documento.id ?? documento._id ?? null,
    nombre: documento.name ?? null,
    tipo,
    edicion,
    origen: "plutonium",
    datos: documento.system ?? {},
  };
}

function resolverTipo(documentos, tipo, registrarRechazo) {
  const aceptados = [];
  for (const documento of documentos ?? []) {
    const veredicto = clasificarDocumento(documento);
    if (veredicto.aceptado) {
      aceptados.push(modeloInterno(documento, tipo, veredicto.edicion));
      continue;
    }
    if (typeof registrarRechazo === "function") {
      registrarRechazo({
        id: documento?.id ?? documento?._id ?? null,
        nombre: documento?.name ?? null,
        motivo: veredicto.motivo,
      });
    }
  }
  return aceptados;
}

/** @param {object[]} actores Documentos Actor ya extraídos del mundo. */
export function resolverCriaturas(actores, { registrarRechazo } = {}) {
  return resolverTipo(actores, "criatura", registrarRechazo);
}

/** @param {object[]} items Documentos Item ya extraídos del mundo (sin hechizos). */
export function resolverObjetos(items, { registrarRechazo } = {}) {
  const objetos = (items ?? []).filter((item) => item?.type !== "spell");
  return resolverTipo(objetos, "objeto", registrarRechazo);
}

/** @param {object[]} items Documentos Item ya extraídos del mundo, tipo "spell". */
export function resolverHechizos(items, { registrarRechazo } = {}) {
  const hechizos = (items ?? []).filter((item) => item?.type === "spell");
  return resolverTipo(hechizos, "hechizo", registrarRechazo);
}
