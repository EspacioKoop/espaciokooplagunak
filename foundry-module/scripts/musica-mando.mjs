/**
 * Mando del GM sobre la música de a bordo (#347, enmienda a #344).
 *
 * #344 fijó que el registro lo eligiera el nivel de alerta y nada más. Se
 * enmienda a propósito: la alerta sabe si el casco está roto, pero **no sabe si
 * el momento es solemne, ridículo o tierno**. Un funeral improvisado y una
 * guardia aburrida son los dos alerta verde, y no deberían sonar igual. Quien
 * lee la mesa es el GM.
 *
 * La derivación automática no desaparece — es el modo por defecto. Esto es un
 * **override explícito**, con vuelta a automático.
 *
 * Módulo PURO: ni Foundry, ni Web Audio, ni reloj, ni Math.random(). El
 * transporte (ajuste de mundo) y el sonido viven en `musica-reproductor.mjs` y
 * en el cableado de `main.mjs`.
 */

import { REGISTROS, registroParaAlerta } from "./musica-procedural.mjs";

export const AJUSTE_MUSICA = "musicaDeAbordo";

export const MODOS = Object.freeze(["auto", "fijo"]);

/**
 * Mando por defecto: automático y sonando. Es lo que ve un mundo que nunca ha
 * tocado el ajuste, y también el suelo al que se cae cualquier valor corrupto.
 */
export const MANDO_POR_DEFECTO = Object.freeze({ modo: "auto", registro: "bach", silencio: false });

/**
 * Normaliza lo que haya en el ajuste a un mando `{ modo, registro, silencio }`.
 *
 * **Falla cerrado**: un `modo` o un `registro` que no reconocemos no se
 * conserva ni se sortea al azar — se vuelve al automático, que siempre suena a
 * algo coherente con la ficción. Un mundo antiguo sin el ajuste, o con basura
 * dentro, tiene que seguir funcionando: la música es adorno y no puede tumbar
 * la sesión de nadie.
 */
export function normalizarMando(valor) {
  const modo = MODOS.includes(valor?.modo) ? valor.modo : "auto";
  const registroValido = REGISTROS.includes(valor?.registro);
  return {
    // Un modo «fijo» apuntando a un registro inexistente no es fijo: es un
    // mando roto, y se degrada a automático en vez de quedarse mudo.
    modo: modo === "fijo" && registroValido ? "fijo" : "auto",
    registro: registroValido ? valor.registro : MANDO_POR_DEFECTO.registro,
    silencio: valor?.silencio === true,
  };
}

/**
 * Qué debe sonar ahora mismo: el registro elegido por el GM si mandó uno, y si
 * no, el que deriva del nivel de alerta (#338).
 *
 * Devuelve `null` cuando toca silencio, que no es lo mismo que un registro
 * vacío: quien reproduce distingue «para» de «no sé qué poner».
 */
export function registroEfectivo(mando, nivelAlerta = "verde") {
  const { modo, registro, silencio } = normalizarMando(mando);
  if (silencio) return null;
  return modo === "fijo" ? registro : registroParaAlerta(nivelAlerta);
}

/**
 * Aplica una orden del GM y dice si cambió algo.
 *
 * El `cambia` no es cortesía: cada `set` de un ajuste de mundo se difunde a
 * todos los clientes de la mesa, así que republicar un mando idéntico es
 * tráfico y un corte de audio a cambio de nada.
 *
 * Órdenes: `{ tipo: "fijar", registro }`, `{ tipo: "auto" }`,
 * `{ tipo: "silencio", silencio }`. Una orden desconocida no hace nada.
 */
export function aplicarOrden(mando, orden) {
  const actual = normalizarMando(mando);
  let siguiente = actual;

  if (orden?.tipo === "fijar" && REGISTROS.includes(orden.registro)) {
    // Fijar un registro también reanuda: pedir una música concreta estando en
    // silencio quiere decir «pon esto», no «guárdalo para luego».
    siguiente = { modo: "fijo", registro: orden.registro, silencio: false };
  } else if (orden?.tipo === "auto") {
    siguiente = { ...actual, modo: "auto", silencio: false };
  } else if (orden?.tipo === "silencio") {
    siguiente = { ...actual, silencio: orden.silencio !== false };
  }

  const cambia =
    siguiente.modo !== actual.modo ||
    siguiente.registro !== actual.registro ||
    siguiente.silencio !== actual.silencio;
  return { mando: siguiente, cambia };
}

/**
 * Siguiente orden del ciclo del mando: automático → cada registro → silencio →
 * automático.
 *
 * Es un ciclo y no una ventana con menú a propósito: cambiar la música a mitad
 * de escena tiene que costar un clic desde los controles que el GM ya tiene
 * abiertos. Una ventana modal obligaría a apartar la vista del tablero justo en
 * el momento en que la mesa está esperando.
 */
export function siguienteOrden(mando) {
  const { modo, registro, silencio } = normalizarMando(mando);
  if (silencio) return { tipo: "auto" };
  if (modo === "auto") return { tipo: "fijar", registro: REGISTROS[0] };
  const posicion = REGISTROS.indexOf(registro);
  const siguiente = REGISTROS[posicion + 1];
  return siguiente ? { tipo: "fijar", registro: siguiente } : { tipo: "silencio", silencio: true };
}

/**
 * Cómo se anuncia el mando vigente: la clave i18n y el registro que suena de
 * verdad, para que el GM vea «automático (mahler)» y no tenga que deducirlo.
 */
export function descripcionMando(mando, nivelAlerta = "verde") {
  const normal = normalizarMando(mando);
  const efectivo = registroEfectivo(normal, nivelAlerta);
  if (normal.silencio) return { clave: "LAGUNAK.Musica.Silencio", registro: null };
  if (normal.modo === "auto") return { clave: "LAGUNAK.Musica.Auto", registro: efectivo };
  return { clave: claveDeRegistro(efectivo), registro: efectivo };
}

/** Etiqueta i18n de un registro, para el menú del GM. */
export function claveDeRegistro(registro) {
  return REGISTROS.includes(registro) ? `LAGUNAK.Musica.Registro.${registro}` : "LAGUNAK.Musica.Registro.auto";
}

// ---- Transporte: solo el GM escribe, toda la mesa lee ----------------------

export function registrarAjusteMusica(moduleId, ajustes = game.settings) {
  ajustes.register(moduleId, AJUSTE_MUSICA, {
    scope: "world",
    config: false,
    type: Object,
    default: { ...MANDO_POR_DEFECTO },
  });
}

/**
 * Publica una orden del GM. Devuelve el mando vigente tras la orden.
 *
 * Un cliente de jugador que llegue aquí no escribe nada: el ajuste es de mundo
 * y solo el GM manda sobre la música. Se comprueba igualmente en el cliente
 * para no depender de que Foundry rechace la escritura.
 */
export async function publicarOrdenMusica({
  moduleId,
  orden,
  ajustes = game.settings,
  esGM = Boolean(game.user?.isGM),
  hooks = globalThis.Hooks,
}) {
  const actual = normalizarMando(ajustes.get(moduleId, AJUSTE_MUSICA));
  if (!esGM) return actual;
  const { mando, cambia } = aplicarOrden(actual, orden);
  if (!cambia) return actual;
  await ajustes.set(moduleId, AJUSTE_MUSICA, mando);
  hooks?.callAll?.("lagunakMusica", mando, actual);
  return mando;
}

/**
 * Conecta la lectura en TODOS los clientes: aplica el mando vigente al entrar y
 * reacciona a cada cambio. Quien entra tarde a la sesión oye lo que la mesa
 * está oyendo, sin esperar a ninguna orden nueva.
 *
 * `alCambiar` recibe `(registro|null, mando)`. Devuelve una función para
 * desregistrar, como el resto de cableados del módulo.
 */
export function registrarEscuchaMusica(
  moduleId,
  { hooks = globalThis.Hooks, ajustes = game.settings, alCambiar, nivelAlerta = () => "verde" } = {},
) {
  const aplicar = (valor) => {
    const mando = normalizarMando(valor);
    alCambiar?.(registroEfectivo(mando, nivelAlerta()), mando);
  };
  aplicar(ajustes.get(moduleId, AJUSTE_MUSICA));

  const alCambiarAjuste = (setting) => {
    if (setting?.key !== `${moduleId}.${AJUSTE_MUSICA}`) return;
    aplicar(setting.value);
  };
  hooks.on("updateSetting", alCambiarAjuste);
  // La música en automático sigue a la alerta, así que también hay que
  // reaccionar cuando cambia la alerta sin que nadie toque el mando.
  const alCambiarAlerta = () => aplicar(ajustes.get(moduleId, AJUSTE_MUSICA));
  hooks.on("lagunakNivelAlerta", alCambiarAlerta);
  return () => {
    hooks.off("updateSetting", alCambiarAjuste);
    hooks.off("lagunakNivelAlerta", alCambiarAlerta);
  };
}
