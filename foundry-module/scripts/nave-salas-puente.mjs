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
// físico al que se llega.
//
// LA CONSOLA (#509) es lo que sí distingue "estar en la sala" de "llegar al
// puesto": un mueble con pantalla en el centro de la sala, y una ZONA delante
// de él —separada a propósito del punto de entrada, para que acercarse sea un
// gesto y no algo que ya haya pasado al cruzar la puerta— que dispara el
// aviso hacia fuera (`nave-catalogo-andar.mjs` lo traduce a `puesto`). La
// consola en sí NO abre nada: solo es la superficie física. Quien interpreta
// el aviso y abre `station-workspaces.mjs` es quien tenga la ventana montada
// (`andar-nave-app.mjs`) — la misma separación entre "aporta la estancia" y
// "decide qué hacer con lo que pasa en ella" que ya sigue el resto del motor
// de andar.
//
// Puro: solo compone `crearSalaCaja` y los datos de `nave-pasillo-puente.mjs`,
// que ya son puros.

import { SECCION } from "./paleta.mjs";
import { crearSalaCaja, detalleConsola } from "./nave-sala-caja.mjs";
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
 *  mirando hacia la ventana (yaw = +x). Delante a propósito de la ZONA de la
 *  consola (ver `zonaConsola`), no encima: llegar a la sala y acercarse al
 *  puesto son dos gestos distintos. */
export function entradaEstacion() {
  return { x: 2, z: PROFUNDIDAD / 2, yaw: Math.PI / 2 };
}

/** El mueble de la consola: cuerpo y pantalla, centrado en la sala, entre la
 *  entrada y la ventana. La pantalla mira hacia la puerta —el acento de la
 *  cantina, `SECCION.entrable`, el mismo que ya marca "aquí se puede
 *  entrar/interactuar" en el marco de las ventanas (#508)—. */
const CENTRO_CONSOLA_X = 4;
const CUERPO_CONSOLA = { centro: [CENTRO_CONSOLA_X, 0.5, PROFUNDIDAD / 2], medidas: [1.2, 1.0, 1.0] };
function mobiliarioConsola() {
  return [
    { nombre: "consolaCuerpo", ...CUERPO_CONSOLA, color: SECCION.mamparo },
    {
      nombre: "consolaPantalla",
      centro: [CENTRO_CONSOLA_X - 0.55, 1.0, PROFUNDIDAD / 2],
      medidas: [0.08, 0.6, 0.7],
      color: SECCION.entrable,
      // Ya la cubre el cuerpo de la consola: un segundo obstáculo sería
      // redundante y solo complicaría la colisión sin cambiar nada real.
      colision: false,
    },
    // Botones/palanca en la tapa (#509 QA: "botones o palancas") — misma
    // pieza compartida que usa `nave-sala-ingenieria.mjs`, ver `detalleConsola`.
    ...detalleConsola(CUERPO_CONSOLA.centro, CUERPO_CONSOLA.medidas),
  ];
}

/** Zona de pie, delante de la consola, donde acercarse dispara el aviso
 *  (#509). Separada del punto de entrada (`entradaEstacion`, en x=2) y del
 *  cuerpo de la consola (x:3.4-4.6): hay que caminar hasta ella, no basta con
 *  cruzar la puerta. */
export function zonaConsola() {
  return { x: 2.6, z: Z_PUERTA, ancho: 0.8, profundidad: PROFUNDIDAD_PUERTA };
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
      mobiliario: mobiliarioConsola(),
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
