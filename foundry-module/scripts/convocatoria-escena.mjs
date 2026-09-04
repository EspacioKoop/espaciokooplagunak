/**
 * Difusión de la convocatoria a toda la mesa (#832): el disparador que le
 * faltaba a `convocatoria-estancia.mjs`.
 *
 * Capa fina de TRANSPORTE, igual que `alerta-escena.mjs` lo es de
 * `nivel-alerta.mjs`: la regla de quién puede convocar y de dónde se aterriza
 * vive en el módulo puro, y aquí solo está cómo viaja esa decisión del GM a
 * los demás clientes.
 *
 * POR AJUSTE DE MUNDO Y NO POR SOCKET. `game.socket` no acredita a quien
 * emite —lo dice ya `station-workspace-ui.mjs` y por eso el relé de órdenes no
 * lo usa para autoridad—, así que un mensaje «convocad a la playa» sería
 * falsificable por cualquiera de la mesa. Un ajuste de mundo lo escribe solo
 * el GM porque el propio Foundry rechaza la escritura a los demás: la
 * comprobación de rol de `convocar` sigue estando, pero deja de ser la única.
 *
 * NO SE APLICA AL CARGAR, y ahí se separa de la alerta a propósito. Una alerta
 * es un ESTADO sostenido y quien entra tarde tiene que verla; una convocatoria
 * es un MOMENTO. Aplicar el ajuste vigente al conectarse arrastraría a la playa
 * a quien entra dos horas después, por una llamada que ya pasó.
 *
 * QUÉ NO HACE. No escribe quién fue convocado ni cuándo, más allá del sello que
 * necesita el propio transporte: esto transporta, que es uno de los tres verbos
 * que `docs/FOUNDRY.md` permite a una escena. No concede, no cuenta y no
 * recuerda.
 */

import { convocar } from "./convocatoria-estancia.mjs";
import { CATALOGO_ANDAR } from "./nave-catalogo-andar.mjs";

export const AJUSTE_CONVOCATORIA = "convocatoriaVigente";

/**
 * A dónde se puede convocar: las estancias SIN PUERTAS, y no una lista escrita
 * al lado.
 *
 * Es la misma regla que hace falta contar en prosa —la playa (#587) y el museo
 * (#598) no cuelgan de ningún mamparo de la nave, así que no se llega a ellas
 * andando— convertida en una consulta al catálogo. Escribir los dos ids a mano
 * los dejaría desincronizados el día que una de las dos gane una puerta o que
 * aparezca una tercera estancia suelta; derivarlos no puede pasar eso.
 *
 * Convocar a la cantina no está prohibido por gusto: es que ya se llega
 * andando, y una convocatoria que teletransporta adonde podías ir con los pies
 * le quita el paseo a la tripulación sin dar nada a cambio.
 */
export function destinosConvocables(catalogo = CATALOGO_ANDAR) {
  return Object.freeze(catalogo.ids.filter((id) => catalogo.obtener(id)?.puertas.length === 0));
}

export function registrarAjusteConvocatoria(moduleId, ajustes = game.settings) {
  ajustes.register(moduleId, AJUSTE_CONVOCATORIA, {
    scope: "world",
    config: false,
    type: Object,
    default: null,
  });
}

/**
 * Publica la convocatoria. Devuelve el destino publicado, o `null` si no hay
 * convocatoria que hacer — que es exactamente lo que decida `convocar`: quien
 * llama no es GM, la estancia no existe, o su entrada está bloqueada.
 *
 * El `sello` no es decoración. Un ajuste que no cambia de valor no despierta a
 * nadie, así que sin él convocar dos veces seguidas a la misma estancia
 * llamaría una sola vez: la segunda llamada se perdería en silencio, que es el
 * peor modo de fallo posible para un aviso.
 */
export async function publicarConvocatoria({
  moduleId,
  idEstancia,
  rol = game.user?.isGM ? "GM" : "jugador",
  ajustes = game.settings,
  catalogo = CATALOGO_ANDAR,
  ahora = () => Date.now(),
}) {
  const destino = convocar(idEstancia, rol, { catalogo });
  if (!destino) return null;
  const publicado = { estancia: idEstancia, ...destino, sello: ahora() };
  await ajustes.set(moduleId, AJUSTE_CONVOCATORIA, publicado);
  return publicado;
}

/**
 * Conecta la escucha en todos los clientes. `alConvocar` recibe el destino
 * publicado y decide qué hacer con él —hoy, abrir la ventana de andar en esa
 * estancia—: este módulo no conoce ninguna ventana.
 *
 * Devuelve la función para desregistrar, como el resto de cableados del módulo.
 */
export function registrarEscuchaConvocatoria(moduleId, { hooks = globalThis.Hooks, alConvocar } = {}) {
  const alCambiarAjuste = (setting) => {
    if (setting?.key !== `${moduleId}.${AJUSTE_CONVOCATORIA}`) return;
    const destino = setting.value;
    // Un ajuste borrado (o un mundo viejo con basura dentro) no es una llamada.
    if (!destino?.estancia) return;
    alConvocar?.(destino);
  };
  hooks.on("updateSetting", alCambiarAjuste);
  return () => hooks.off("updateSetting", alCambiarAjuste);
}
