// Adaptador opcional SRD 5.1 para el libro 3D (#1037).
//
// El núcleo solo recibe una interacción y devuelve un resultado. No importa
// Foundry, no guarda lecturas y no contiene texto de ninguna obra externa.
// El consumidor de escena puede pintar `marcadorInvestigacion` junto al libro.

import { prisma } from "./escena-primitivas.mjs";

export const HABILIDADES_INVESTIGACION = Object.freeze(["investigacion", "historia", "arcana"]);
export const PROCEDENCIA_SRD = "SRD 5.1 (D&D 5e, 2014) — CC-BY-4.0";

const COLORES_RESULTADO = Object.freeze({
  exito: "#8bd450",
  fallo: "#d45050",
});

function validarHabilidad(habilidad) {
  if (!HABILIDADES_INVESTIGACION.includes(habilidad)) {
    throw new RangeError(`habilidad no permitida para el libro: ${habilidad}`);
  }
}

/** Resuelve una prueba de habilidad SRD 5.1 sin generar aleatoriedad. */
export function resolverInvestigacion({ habilidad, dc, modificador = 0, tiradas = [10] } = {}) {
  validarHabilidad(habilidad);
  if (!Number.isInteger(dc) || dc < 0) throw new RangeError("dc debe ser un entero no negativo");
  if (!Number.isInteger(modificador)) throw new TypeError("modificador debe ser entero");
  if (!Array.isArray(tiradas) || tiradas.length < 1 || tiradas.length > 2) {
    throw new RangeError("tiradas debe contener una o dos tiradas");
  }
  if (tiradas.some((tirada) => !Number.isInteger(tirada) || tirada < 1 || tirada > 20)) {
    throw new RangeError("cada tirada debe estar entre 1 y 20");
  }
  const tirada = tiradas.length === 2 ? Math.max(...tiradas) : tiradas[0];
  const total = tirada + modificador;
  return Object.freeze({
    habilidad,
    dc,
    modificador,
    tirada,
    total,
    exito: total >= dc,
    procedencia: PROCEDENCIA_SRD,
  });
}

/** Marcador de escena mínimo: el resultado se ve sin introducir UI ni estado persistente. */
export function marcadorInvestigacion(resultado, posicion = [0, 0, 0]) {
  if (!resultado || typeof resultado.exito !== "boolean") throw new TypeError("resultado inválido");
  if (!Array.isArray(posicion) || posicion.length !== 3 || posicion.some((valor) => !Number.isFinite(valor))) {
    throw new TypeError("posicion debe ser [x, y, z]");
  }
  return Object.freeze({
    tipo: "resultado-investigacion-srd",
    estado: resultado.exito ? "exito" : "fallo",
    color: COLORES_RESULTADO[resultado.exito ? "exito" : "fallo"],
    posicion: Object.freeze([...posicion]),
    malla: prisma(posicion, { radioAbajo: 0.035, radioArriba: 0.02, alto: 0.08, lados: 8 }),
    etiqueta: `${resultado.habilidad} ${resultado.total}/${resultado.dc}`,
  });
}
