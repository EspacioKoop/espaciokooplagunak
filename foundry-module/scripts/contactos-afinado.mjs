// Afinado de contactos para el puesto de sensores (#809).
//
// Aplica la resolución de `bandas-sensores.mjs` a contactos ya degradados,
// SIN exponer posición exacta ni inventar identidad.
//
// Reglas:
// - solo modifica contactos ya publicables (dentro de alcance);
// - un fallo devuelve la lectura anterior sin tocarla;
// - un éxito reduce la incertidumbre un nivel: eco → candidato → identificado;
// - la identidad (callsign/facción) no se inventa aquí: el llamador decide
//   mostrarla según el `estado` resultante.
//
// Puro: ni Foundry, ni DOM, ni red.

import { ESTADO_LECTURA, afinarContacto } from "./asistencia/bandas-sensores.mjs";

/**
 * Mapea la banda espacial del contacto (`corto`/`largo`) a un estado inicial
 * para el afinado. La nave propia ya viene identificada de origen.
 */
function estadoInicialDe(contacto) {
  if (contacto?.esJugador) return ESTADO_LECTURA.IDENTIFICADO;
  const banda = contacto?.banda;
  if (banda === "corto") return ESTADO_LECTURA.CANDIDATO;
  if (banda === "largo") return ESTADO_LECTURA.ECO;
  return ESTADO_LECTURA.ECO;
}

/**
 * Transforma la lista de contactos degradados aplicando un afinado opcional.
 *
 * @param {{contactos: Array, alcance: object}|null} payload
 * @param {{modificador: number, cd: number, estadoInicial?: string}|null} afinado
 * @returns {{contactos: Array, alcance: object}|null}
 */
export function aplicarAfina(payload, afinado) {
  if (!payload || !Array.isArray(payload.contactos)) return payload;
  if (!afinado || !Number.isFinite(Number(afinado.modificador)) || !Number.isFinite(Number(afinado.cd))) {
    return payload;
  }
  const modificador = Number(afinado.modificador);
  const cd = Number(afinado.cd);
  const contactos = payload.contactos.map((contacto) => {
    const estadoInicial = String(afinado.estadoInicial ?? estadoInicialDe(contacto));
    const { contacto: afinadoContacto, cambio } = afinarContacto(
      { ...contacto, estado: estadoInicial },
      modificador,
      cd,
    );
    if (!cambio) return contacto;
    return { ...afinadoContacto };
  });
  return { ...payload, contactos };
}
