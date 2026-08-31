// Credencial de la API de Freesound (#604), en memoria de sesión y solo para
// el GM — el mismo modelo ya tomado para el token del puente (#183,
// `bridge-token-session.mjs`): una clave de API es un secreto, y un secreto
// no vive en `module.json` ni en un ajuste de mundo legible por jugadores.
// No hay migración legada que hacer aquí porque el ajuste nunca existió en
// otra forma: esto es más simple que `bridge-token-session.mjs` porque no
// arrastra ese problema.

let apiKey = "";

/** Solo el GM puede leerla; cualquier otro rol ve cadena vacía, igual que
 *  `getBridgeToken`. */
export function getFreesoundKey() {
  return game.user?.isGM ? apiKey : "";
}

export function setFreesoundKey(value) {
  apiKey = String(value ?? "").trim();
  return Boolean(apiKey);
}

export function clearFreesoundKey() {
  apiKey = "";
}
