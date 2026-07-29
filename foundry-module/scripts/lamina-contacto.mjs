// Lámina del contacto seleccionado (#362, rebanada 4): la nave ajena, dibujada.
//
// Por qué GameCube y no PSX. El casco propio de la consola va en PSX porque es
// ambiente de cabina y se mira de reojo. Esto es lo contrario: el GM la mira
// FIJA para reconocer con qué se está encontrando la tripulación, y ahí los
// dieciséis tonos y la ausencia de temblor se ganan el sitio. Es exactamente el
// caso para el que la época se dejó como parámetro en vez de como dos módulos.
//
// Por qué SÍ gira aquí y no en la consola. El casco propio apunta al rumbo real
// y girarlo sería mentir. Una lámina no dice hacia dónde va nadie: es una ficha
// de reconocimiento, y girar es lo que deja ver la silueta entera —que es justo
// el dato— sin que nadie tenga que orbitar la cámara a mano.
//
// El bucle se para solo: montar otra lámina de la misma ventana detiene la
// anterior. Sin eso, cada cambio de selección dejaría un bucle huérfano pintando
// sobre un lienzo que ya no está en el documento.
//
// La parada se guarda contra la ventana, no contra la raíz del DOM. Un render
// estructural de Foundry puede sustituir la raíz entera: si la clave fuera el
// elemento, la nueva raíz no encontraría la parada de la anterior y ese primer
// bucle seguiría vivo para siempre. La instancia de la aplicación es lo único
// que sobrevive a los remontajes, así que es la clave correcta.

import { girarNave } from "./retro3d-lienzo.mjs";
import { mallaDeClase } from "./casco-clases.mjs";

const bucles = new WeakMap();

/** La ventana si la hay; si no, la propia raíz, que es mejor que nada. */
function claveDe(raiz, dueño) {
  return dueño ?? raiz;
}

/**
 * Detiene la lámina de esta ventana, si la había. Llamarlo de más no hace daño.
 *
 * @param {Element} raiz raíz de la ventana del mapa.
 * @param {object} [dueño] instancia de la aplicación, estable entre renders.
 */
export function desmontarLamina(raiz, dueño) {
  const clave = claveDe(raiz, dueño);
  const parar = clave == null ? null : bucles.get(clave);
  if (!parar) return false;
  bucles.delete(clave);
  parar();
  return true;
}

/**
 * Monta (o remonta) la lámina del contacto seleccionado.
 *
 * @param {Element} raiz raíz de la ventana del mapa.
 * @param {{clase?: string|null, color?: string}|null} detalle
 * @param {object} opciones puntos de entrada inyectables para las pruebas.
 * @param {object} [opciones.dueño] instancia de la aplicación, estable entre renders.
 * @returns {{clase: string|null, conocida: boolean}|null}
 */
export function montarLaminaContacto(raiz, detalle, opciones = {}) {
  const { dueño, selector = "[data-lagunak-lamina]", ...restoOpciones } = opciones;
  desmontarLamina(raiz, dueño);
  // El selector es parámetro desde #391: la misma lámina sirve para el contacto
  // seleccionado del mapa y para el objetivo de atraque de la consola. Lo que
  // cambia entre las dos es dónde se pinta y cuándo existe, no cómo se dibuja.
  const lienzo = raiz?.querySelector?.(selector);
  if (!lienzo || !detalle) return null;

  const { malla, conocida, clave } = mallaDeClase(detalle.clase);
  const parar = girarNave(lienzo, {
    ...restoOpciones,
    malla,
    // El color de facción es el mismo que el blip del mapa: la lámina y el punto
    // del radar tienen que leerse como el mismo objeto.
    color: detalle.color,
    epoca: "gamecube",
    pitch: 0.34,
    posicion: [0, 0, 5.4],
    fov: 52,
    vueltaMs: 24000,
  });
  bucles.set(claveDe(raiz, dueño), parar);
  return { clase: clave, conocida };
}
