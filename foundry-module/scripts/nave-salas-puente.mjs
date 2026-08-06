// Las cinco salas de puesto del puente (#508): mando, navegación, sensores,
// comunicaciones y armas — los cinco puestos que `seccion-nave.mjs` agrupa
// hoy bajo una única sala "puente" en la sección 2D. Aquí, en 3D, cada uno
// tiene la suya: es justo lo que pide #508 ("al menos una sala por puesto").
//
// LAS CINCO SON LA MISMA FORMA A PROPÓSITO: una caja con una puerta al
// pasillo del puente (`nave-pasillo-puente.mjs`) en su muro oeste y una
// ventana al espacio en el muro este, enfrente de la puerta — quien entra ve
// el espacio de inmediato, sin tener que darse la vuelta. Repetir la forma
// cinco veces en vez de inventar una geometría distinta por puesto es
// deliberado: la sala no es donde vive el contenido de cada puesto —eso ya
// lo tiene la consola de puesto, `station-workspaces.mjs`— es solo el sitio
// físico al que se llega. Diferenciar su geometría sería decoración que nadie
// pidió; #509 (abrir la consola al llegar) es donde de verdad se nota la
// diferencia entre un puesto y otro.
//
// Puro: solo compone `crearSalaCaja` y los datos de `nave-pasillo-puente.mjs`,
// que ya son puros.

import { SECCION } from "./paleta.mjs";
import { crearSalaCaja } from "./nave-sala-caja.mjs";
import { ESTACIONES } from "./nave-pasillo-puente.mjs";

const ANCHO = 6;
const PROFUNDIDAD = 6;
const ANCHO_HUECO = 1.2;
const PROFUNDIDAD_PUERTA = 2;
/** Centrada en el muro: a media profundidad menos la mitad del hueco. */
const Z_PUERTA = PROFUNDIDAD / 2 - PROFUNDIDAD_PUERTA / 2;
/** La ventana es más ancha que la puerta (#508 feedback: casi todo el muro,
 *  margen de 1 a cada lado) — es lo que se mira al entrar, no un trámite. */
const PROFUNDIDAD_VENTANA = 4;
const Z_VENTANA = PROFUNDIDAD / 2 - PROFUNDIDAD_VENTANA / 2;

/** Puerta al pasillo, en el muro oeste (x=0). */
function puertaHaciaPasillo() {
  return { x: 0, z: Z_PUERTA, ancho: ANCHO_HUECO, profundidad: PROFUNDIDAD_PUERTA };
}

/** Ventana al espacio, en el muro este (x=ancho), enfrente de la puerta. */
function ventanaEspacio() {
  return { x: ANCHO - ANCHO_HUECO, z: Z_VENTANA, ancho: ANCHO_HUECO, profundidad: PROFUNDIDAD_VENTANA };
}

/** Dónde aparece quien entra desde el pasillo: pasado el hueco de la puerta,
 *  mirando hacia la ventana (yaw = +x). */
export function entradaEstacion() {
  return { x: 2, z: PROFUNDIDAD / 2, yaw: Math.PI / 2 };
}

/** Puerta de vuelta al pasillo — la misma que `puertaHaciaPasillo()`, expuesta
 *  con el nombre que usa `nave-catalogo-andar.mjs` para no repetir números. */
export const PUERTA_ESTACION_HACIA_PASILLO = puertaHaciaPasillo();

const SALAS = new Map(
  ESTACIONES.map((estacion) => {
    const sala = crearSalaCaja({
      ancho: ANCHO,
      profundidad: PROFUNDIDAD,
      puertas: [{ rect: puertaHaciaPasillo() }],
      ventanas: [{ rect: ventanaEspacio() }],
      colorMuro: SECCION.casco,
      // Una semilla por estación: cada ventana mira un trozo distinto del
      // mismo cielo (misma idea que `semillaCielo` en `cantina-escena.mjs`).
      semillaCielo: 20260806 + estacion.z,
    });
    return [estacion.id, sala];
  }),
);

/** `{planta, componer}` de la sala de esa estación (id de `ESTACIONES`), o
 *  `undefined` si el id no es una estación del puente. */
export function salaEstacion(id) {
  return SALAS.get(id);
}
