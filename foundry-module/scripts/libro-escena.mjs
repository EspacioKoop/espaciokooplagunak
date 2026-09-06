// Libro 3D interactuable en escena (#853): una estancia pequeña con un libro en un pedestal.
// Se puede acercar, abrir y pasar hojas (animación pendiente, estado definido).
// Consumidor previsto: nave-catalogo-andar.mjs (como estancia adicional).

import { crearSalaCaja } from "./nave-sala-caja.mjs";
import { declararInteracciones } from "./nave-interaccion.mjs";
import { libroGeometria } from "./libro-geometria.mjs";
import { mallaPagina, colocarPagina } from "./libro-pagina.mjs";
import { PAGINA } from "./paleta.mjs";
import { ANCHO_PUERTA, GROSOR_PUERTA } from "./nave-planta-phobos.mjs";

/* ---- medidas de la sala ---------------------------------------------------- */

/** Una estancia pequeña para el libro: 2x2 metros. */
export const ANCHO = 2.0;
export const PROFUNDIDAD = 2.0;

/** Altura libre bajo la cual se considera colisión con el suelo. */
export const ALTURA_LIBRE = 0.1;

/* ---- colocar el libro ------------------------------------------------------ */

/** El libro en su estado cerrado y sin hoja en vuelo. */
export const LIBRO_CERRADO = libroGeometria(0, 0); // apertura=0, hojaVuelo=0

/** El libro abierto plano y hoja sobre la tapa derecha. */
export const LIBRO_ABIERTO = libroGeometria(Math.PI, Math.PI); // apertura=π, hojaVuelo=apertura

/** El libro abierto plano y hoja en medio (para pasar página). */
export const LIBRO_PASA_HOJA = libroGeometria(Math.PI, Math.PI / 2); // apertura=π, hojaVuelo=apertura/2

/** Una página de ejemplo (semilla 1). */
export const PAGINA_EJEMPLO = mallaPagina(1);

/** Coloca el libro (geometría) y una página (malla con color) en el origen. */
export function colocarLibroYPagina(libroGeom, paginaGeom, semillaPagina) {
  // El libro está centrado en el origen, y la página va sobre la hoja.
  // La hoja está en el lado -1 (izquierda) cuando hojaVuelo=0, y en +1 (derecha) cuando hojaVuelo=apertura.
  // En libro-pagina.mjs, colocarPagina asume que la cara es la de la hoja que gira.
  // Para simplificar, asumimos que la página se coloca sobre la cara correcta de la hoja.
  // En una implementación completa, habría que transformar la página según la posición de la hoja.
  // Aquí, solo colocamos la página en el mismo plano que el libro (y=0) y sobre la hoja (z=0).
  // Esto es una aproximación para la escena estática.

  const pagina = colocarPagina(semillaPagina, { eje: "z", plano: 0, sentido: 1, u0: -0.1, largo: 0.2 }); // cara aproximada de la hoja

  return {
    libro: libroGeom,
    pagina: pagina,
  };
}

/* ---- la salida ------------------------------------------------------------- */

/** Por dónde se vuelve a la estancia anterior (por ejemplo, el museo). */
export const SALIDA = Object.freeze({
  centro: [ANCHO / 2, 0.05, 0.0], // justo dentro de la puerta
  medidas: [1.1, 0.1, 0.35],
});

/** Donde se aparece al entrar: en el centro del frente, mirando al libro. */
export const ENTRADA = Object.freeze({ x: ANCHO / 2, z: PROFUNDIDAD / 2, yaw: 0 });

/* ---- la estancia ----------------------------------------------------------- */

function mobiliario() {
  const piezas = [];

  // Suelo simple (opcional, para que se vea mejor)
  piezas.push({
    centro: [ANCHO / 2, ALTURA_LIBRE / 2, PROFUNDIDAD / 2],
    medidas: [ANCHO, ALTURA_LIBRE, PROFUNDIDAD],
    color: 0x8B4513, // marrón suelo
    colision: false,
  });

  // Libro en el centro de la estancia, a 0.1 del suelo (para no colisionar)
  const libroYPagina = colocarLibroYPagina(LIBRO_CERRADO, PAGINA_EJEMPLO, 1);
  piezas.push({
    malla: libroYPagina.libro,
    centro: [ANCHO / 2, 0.1 + (LIBRO_CERRADO.vertices.reduce((max, v) => Math.max(max, v[1]), -Infinity) + 0.1), PROFUNDIDAD / 2],
    medidas: [0.2, 0.15, 0.02], // aproximado del libro
    color: 0xF5DEB3, // trigo
    colision: false,
  });

  // Página del libro (sobre la hoja, approximado)
  piezas.push({
    malla: libroYPagina.pagina.malla,
    centro: [ANCHO / 2, 0.1 + (LIBRO_CERRADO.vertices.reduce((max, v) => Math.max(max, v[1]), -Infinity) + 0.02), PROFUNDIDAD / 2],
    medidas: [0.2, 0.001, 0.15], // página muy delgada
    color: PAGINA.papel,
    colision: false,
  });

  // Salida
  piezas.push({ centro: [...SALIDA.centro], medidas: [...SALIDA.medidas], color: 0xA9A9A9 });

  return piezas;
}

/** Los puntos de interacción: uno para abrir/cerrar el libro y otro para salir. */
export const INTERACCIONES = declararInteracciones([
  {
    id: "libro-abrir",
    punto: [ANCHO / 2, PROFUNDIDAD / 2], // centro del libro
    orientacion: 0,
    accion: { tipo: "libro-toggle", estado: "cerrado" }, // opaco para el motor de andar
  },
  {
    id: "salida",
    punto: [SALIDA.centro[0], SALIDA.centro[2]],
    orientacion: Math.PI,
    accion: { tipo: "estancia", estancia: "museo" }, // volver al museo (ejemplo)
  },
]);

const SALA = crearSalaCaja({
  ancho: ANCHO,
  profundidad: PROFUNDIDAD,
  mobiliario: mobiliario(),
  colorMuro: 0x808080, // gris pared
  colorColumna: 0x808080,
  pielObjetos: false,
  semillaMural: 20260906,
});

export const PLANTA_LIBRO = SALA.planta;
export const componerLibro = SALA.componer;
// Se exportan para pruebas: el reparto es la parte que hay que poder interrogar.
// (funciones ya exportadas arriba)