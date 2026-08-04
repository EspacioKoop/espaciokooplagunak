// Adaptador de contenido externo de dnd5e (#332).
//
// Si el usuario ya tiene criaturas, objetos y hechizos importados en su mundo
// (plutonium/5etools u otra vía, bajo su responsabilidad), esto los pone a
// disposición del módulo **filtrados a la edición 2014**. Si no los tiene, o si
// no se pueden clasificar, el módulo funciona igual: esta capa entrega listas
// vacías y nadie se entera. No hay dependencia declarada en `module.json`, ni la
// habrá; y aquí no entra contenido de terceros, solo se LEE lo que ya está.
//
// ## Un contrato funcional, no la forma ajena
//
// Fuera de este archivo nadie sabe qué es plutonium. El resto del módulo pide
// «criaturas», «objetos» o «hechizos» y recibe SIEMPRE el mismo modelo interno,
// venga del SRD propio o de aquí (comentario 3 del issue). Por eso el adaptador
// toma un `proveedor` inyectado: la lógica es pura y probable en Node, y el
// único trozo que toca Foundry vive en `proveedor-foundry.mjs`.
//
// Si mañana plutonium reorganiza sus flags, se arregla en `edicion.mjs` y aquí,
// y ni una línea más del módulo se entera (comentario 1 del issue).
//
// ## Ausente no es error
//
// «No hay proveedor» y «el proveedor no devolvió nada» son el MISMO camino que
// «el usuario no ha importado nada»: `{ disponible: false, elementos: [] }`. Un
// módulo que reviente porque falta una integración opcional no es opcional.
//
// Puro: ni Foundry, ni DOM, ni red.

import { CLASIFICADOR, MOTIVOS, crearClasificador } from "./edicion.mjs";

/** Los tres tipos del contrato. No hay más, y añadir uno es una decisión. */
export const TIPOS = Object.freeze({
  CRIATURA: "criatura",
  OBJETO: "objeto",
  HECHIZO: "hechizo",
});

/** Origen del elemento en el modelo interno. El resto del módulo lo ignora. */
export const ORIGENES = Object.freeze({
  MUNDO: "mundo-externo",
});

function texto(valor) {
  return typeof valor === "string" ? valor.trim() : "";
}

function numeroOpcional(valor) {
  return Number.isFinite(valor) ? valor : null;
}

/**
 * Traduce un documento ajeno al modelo interno.
 *
 * Deliberadamente pobre: nombre, tipo, un puñado de números y la referencia al
 * documento original. El módulo no necesita más y copiar más campos sería
 * amarrarse a una forma que no controlamos. Quien quiera detalles, que abra la
 * ficha en Foundry con `refDocumento`.
 */
function normalizar(documento, tipo, veredicto) {
  const sistema = documento?.system ?? {};
  return Object.freeze({
    tipo,
    origen: ORIGENES.MUNDO,
    id: texto(documento?.id) || texto(documento?._id) || texto(documento?.uuid),
    nombre: texto(documento?.name),
    fuente: veredicto.detalle,
    edicion: veredicto.edicion,
    // Solo lo que tiene sentido en los tres tipos; el resto se queda fuera.
    nivel: numeroOpcional(sistema?.level?.value ?? sistema?.level),
    puntosGolpe: numeroOpcional(sistema?.attributes?.hp?.max),
    claseArmadura: numeroOpcional(sistema?.attributes?.ac?.value ?? sistema?.attributes?.ac?.flat),
    refDocumento: documento,
  });
}

function listaSegura(valor) {
  if (Array.isArray(valor)) return valor;
  if (valor && typeof valor[Symbol.iterator] === "function") return [...valor];
  return [];
}

/**
 * Crea el adaptador.
 *
 * @param {object} [opciones]
 * @param {object|null} [opciones.proveedor] Objeto con `criaturas()`,
 *   `objetos()` y `hechizos()`, cada uno devolviendo documentos del mundo.
 *   Cualquiera puede faltar: lo que falta se trata como vacío.
 * @param {object} [opciones.clasificador] Clasificador de edición. Se puede
 *   sustituir para que una mesa amplíe su lista blanca comprobada.
 */
export function crearAdaptadorContenido(opciones = {}) {
  const proveedor = opciones.proveedor ?? null;
  const clasificador = opciones.clasificador ?? CLASIFICADOR;

  /**
   * ¿Hay algo que leer? Ni siquiera esto puede lanzar: un proveedor roto es un
   * proveedor ausente, no una excepción en mitad de una sesión.
   */
  function disponible() {
    if (!proveedor || typeof proveedor !== "object") return false;
    return [TIPOS.CRIATURA, TIPOS.OBJETO, TIPOS.HECHIZO].some(
      (tipo) => typeof proveedor[metodoDe(tipo)] === "function",
    );
  }

  function metodoDe(tipo) {
    if (tipo === TIPOS.CRIATURA) return "criaturas";
    if (tipo === TIPOS.OBJETO) return "objetos";
    return "hechizos";
  }

  function resolver(tipo, filtro) {
    const vacio = Object.freeze({
      disponible: false,
      tipo,
      elementos: Object.freeze([]),
      descartes: Object.freeze([]),
    });
    if (!disponible()) return vacio;

    const metodo = proveedor[metodoDe(tipo)];
    if (typeof metodo !== "function") return Object.freeze({ ...vacio, disponible: true });

    let brutos;
    try {
      brutos = listaSegura(metodo.call(proveedor));
    } catch {
      // Un proveedor que explota degrada a «no hay nada», nunca tumba al módulo.
      return vacio;
    }

    const elementos = [];
    const descartes = [];
    for (const documento of brutos) {
      const veredicto = clasificador.clasificar(documento);
      if (!veredicto.aceptado) {
        // Cada descarte deja constancia de POR QUÉ (comentario 2 del issue):
        // sin esto, «no me sale nada» solo se depura relajando el criterio.
        descartes.push(
          Object.freeze({
            nombre: texto(documento?.name),
            motivo: veredicto.motivo,
            detalle: veredicto.detalle,
          }),
        );
        continue;
      }
      const elemento = normalizar(documento, tipo, veredicto);
      if (typeof filtro === "function" && !filtro(elemento)) continue;
      elementos.push(elemento);
    }

    return Object.freeze({
      disponible: true,
      tipo,
      elementos: Object.freeze(elementos),
      descartes: Object.freeze(descartes),
    });
  }

  return Object.freeze({
    disponible,
    /** @param {(elemento: object) => boolean} [filtro] */
    resolverCriaturas: (filtro) => resolver(TIPOS.CRIATURA, filtro),
    resolverObjetos: (filtro) => resolver(TIPOS.OBJETO, filtro),
    resolverHechizos: (filtro) => resolver(TIPOS.HECHIZO, filtro),
    /**
     * Resumen de descartes por motivo, para el diagnóstico del GM. No corrige
     * nada: enseña por qué se quedó fuera lo que se quedó fuera.
     */
    diagnostico() {
      const conteo = Object.create(null);
      for (const motivo of Object.values(MOTIVOS)) conteo[motivo] = 0;
      for (const tipo of Object.values(TIPOS)) {
        for (const descarte of resolver(tipo).descartes) {
          conteo[descarte.motivo] = (conteo[descarte.motivo] ?? 0) + 1;
        }
      }
      return Object.freeze({ disponible: disponible(), descartesPorMotivo: Object.freeze(conteo) });
    },
  });
}

/** Adaptador inerte: el módulo sin integración. Todo vacío, nada roto. */
export const ADAPTADOR_AUSENTE = crearAdaptadorContenido();

export { crearClasificador };
