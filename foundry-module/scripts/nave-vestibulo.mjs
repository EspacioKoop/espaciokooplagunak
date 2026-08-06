// El vestíbulo (#508): el nudo real que conecta la cantina con el resto de
// la nave — cantina, ingeniería y el pasillo del puente, cada una por su
// propio muro.
//
// SUSTITUYE A "a" COMO NUDO. La sala de pruebas del motor (#427,
// `nave-movimiento-sala-prueba.mjs`) hizo ese papel mientras se demostraba
// que la costura entre estancias aguantaba, pero su propio archivo lo decía
// desde el principio: "no es la geografía definitiva de la nave". El
// vestíbulo es esa geografía — una sala con nombre y sitio propio en la
// planta, no un banco de pruebas reconvertido en pasillo por comodidad. "a"
// y "b" vuelven a ser solo lo que siempre debieron ser: el banco de pruebas
// del motor, sin ninguna puerta hacia la nave real.
//
// Sin ventana a propósito: es tránsito, igual que el pasillo del puente, no
// un sitio donde quedarse.
//
// Puro: solo compone `crearSalaCaja`, que ya es pura.

import { SECCION } from "./paleta.mjs";
import { crearSalaCaja } from "./nave-sala-caja.mjs";

/** Puerta hacia la cantina, en el muro oeste (x=0). */
export const PUERTA_VESTIBULO_HACIA_CANTINA = { x: 0, z: 2, ancho: 1.2, profundidad: 2 };
/** Puerta hacia ingeniería, en el muro norte (z=0). */
export const PUERTA_VESTIBULO_HACIA_INGENIERIA = { x: 2, z: 0, ancho: 2, profundidad: 1.2 };
/** Puerta hacia el pasillo del puente, en el muro este (x=6). */
export const PUERTA_VESTIBULO_HACIA_PASILLO = { x: 4.8, z: 2, ancho: 1.2, profundidad: 2 };

const SALA = crearSalaCaja({
  ancho: 6,
  profundidad: 6,
  puertas: [
    { rect: PUERTA_VESTIBULO_HACIA_CANTINA },
    { rect: PUERTA_VESTIBULO_HACIA_INGENIERIA },
    { rect: PUERTA_VESTIBULO_HACIA_PASILLO },
  ],
  // SECCION.casco (el valor por defecto de crearSalaCaja) y NO
  // SECCION.mamparo (QA: "hay un espacio vacío entre salas"): el fondo entre
  // estancias de `andar-nave-app.mjs` usa justo `mamparo`, así que unos
  // muros del mismo color se camuflan contra él — la sala entera se leía
  // como vacío en vez de como una sala real. `casco` es el mismo tono que ya
  // usan ingeniería y las salas de estación, así que de paso queda
  // consistente en toda la nave.
});

export const PLANTA_VESTIBULO = SALA.planta;
export const componerVestibulo = SALA.componer;
