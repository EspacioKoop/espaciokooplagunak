/**
 * Alarma compartida por dependencia entre sistemas (#482, frente 2 de #479).
 *
 * Distinta de `nivel-alerta.mjs`/`alerta-escena.mjs` (#338): aquel es un nivel
 * (verde/amarilla/roja) que resume la salud GENERAL de la nave (casco, energía,
 * sistemas caídos) y sirve de ambientación de mesa. Esto es otra cosa: un umbral
 * de UN sistema (calor de reactor) correlacionado con el estado de OTRO sistema
 * (potencia de escudos) — una dependencia real entre dos puestos, no un resumen
 * de salud. También distinta de `alertas-nave.mjs` (#125/fase 3, flanco único
 * anotado una vez en la bitácora): esto es un estado SOSTENIDO mientras la
 * correlación se mantiene, visible en vivo en vez de un registro histórico.
 *
 * La dependencia: un reactor sobrecalentado (ingeniería) correlaciona con
 * potencia reducida en los escudos (armas) — ambos puestos ven la MISMA alarma,
 * pero con información parcial distinta: ingeniería ve la causa (el calor que
 * está gestionando), armas ve el efecto (la potencia que le falta y por qué).
 *
 * Lógica pura: sin Foundry, sin red, sin reloj — testeable desde Node. La
 * autoridad de los valores sigue siendo de la simulación; este módulo solo
 * traduce una lectura de telemetría ya publicada a una alarma legible.
 */

// Fracciones [0,1] tal cual las publica `/v1/state` (heat) y ratio de potencia
// nominal (power: 1.0 = 100 %, hasta 3.0 con sobrecarga) — mismas unidades
// crudas que usa `alertas-nave.mjs`, sin pasar por el *100 de `ship-view.mjs`.
export const UMBRAL_CALOR_REACTOR = Object.freeze({ entrar: 0.8, salir: 0.7 });
export const UMBRAL_POTENCIA_ESCUDO = 1.0; // por debajo de la nominal se considera reducida

export const CLAVE_ALARMA_CRUZADA = "reactor-escudos";

function numero(valor) {
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

// Histéresis solo en el calor (fluctúa tick a tick); la potencia de escudos la
// fija directamente ingeniería vía slider, así que un único umbral basta —no
// hay ruido de telemetría que suavizar en ese eje.
function calorReactorCritico(nave, yaActiva) {
  const calor = numero(nave?.systems?.reactor?.heat);
  if (calor === null) return false;
  const umbral = yaActiva ? UMBRAL_CALOR_REACTOR.salir : UMBRAL_CALOR_REACTOR.entrar;
  return calor >= umbral;
}

function potenciasEscudo(nave) {
  return {
    frontshield: numero(nave?.systems?.frontshield?.power),
    rearshield: numero(nave?.systems?.rearshield?.power),
  };
}

function escudoMasReducido(potencias) {
  const entradas = Object.entries(potencias).filter(([, valor]) => valor !== null);
  if (entradas.length === 0) return null;
  return entradas.reduce((peor, actual) => (actual[1] < peor[1] ? actual : peor));
}

/**
 * ¿Está activa la alarma cruzada ahora? `activaPrevia` habilita la histéresis
 * del calor, igual que `nivelDeAlerta(nave, nivelPrevio)`. Sin datos
 * utilizables en cualquiera de los dos sistemas correlacionados, no se
 * inventa una alarma: los `null` de telemetría ausente se tratan como
 * "sin lectura", nunca como "sin problema" ni como "en alarma".
 */
export function alarmaCruzadaActiva(nave, activaPrevia = false) {
  if (!nave || typeof nave !== "object") return false;
  if (!calorReactorCritico(nave, Boolean(activaPrevia))) return false;
  const peor = escudoMasReducido(potenciasEscudo(nave));
  if (peor === null) return false;
  return peor[1] < UMBRAL_POTENCIA_ESCUDO;
}

/**
 * Datos de la alarma activa, para las dos variantes de texto. `sistemaEscudo`
 * es el más afectado de los dos (front/rear), para señalar dónde mirar sin
 * obligar a leer ambos valores.
 */
export function datosAlarmaCruzada(nave) {
  const calor = numero(nave?.systems?.reactor?.heat);
  const peor = escudoMasReducido(potenciasEscudo(nave));
  return {
    calorReactorPct: calor === null ? null : Math.round(calor * 100),
    potenciaEscudoPct: peor === null ? null : Math.round(peor[1] * 100),
    sistemaEscudo: peor === null ? null : peor[0],
  };
}

// Puestos que reciben una variante de la alarma. Los demás no la ven —no
// es información que necesiten para decidir nada— aunque el ajuste de mundo
// que la transporta sea legible por cualquiera.
export const PUESTOS_ALARMA_CRUZADA = Object.freeze(["engineering", "weapons"]);

/**
 * Texto de la alarma para un puesto concreto: ingeniería ve la causa (el
 * calor que está gestionando), armas ve el efecto (la potencia que le falta).
 * Con un puesto fuera de `PUESTOS_ALARMA_CRUZADA` devuelve `null`: esta
 * alarma no le concierne.
 */
export function textoAlarmaCruzada(datos, puesto) {
  if (!PUESTOS_ALARMA_CRUZADA.includes(puesto)) return null;
  const variante = puesto === "engineering" ? "Causa" : "Efecto";
  return {
    tituloKey: `LAGUNAK.AlarmaCruzada.ReactorEscudos.${variante}.Titulo`,
    resumenKey: `LAGUNAK.AlarmaCruzada.ReactorEscudos.${variante}.Resumen`,
    datos: datos ?? {},
  };
}
