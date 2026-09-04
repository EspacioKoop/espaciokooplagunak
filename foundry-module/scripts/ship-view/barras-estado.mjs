// Barras de estado del panel de nave: lógica pura que convierte la telemetría
// (casco, energía, salud/calor/potencia de sistemas) en un modelo visual de
// porcentaje + nivel de severidad. Sin Foundry, DOM ni red — testeable desde
// Node — para que las plantillas y los patchers de telemetría de V1/V2 solo
// consuman su salida (patrón ship-view.mjs).
//
// Niveles: "ok" | "aviso" | "critico". Para recursos (casco, energía, salud)
// lo malo es quedarse SIN; para el calor lo malo es llegar AL MÁXIMO.

export const UMBRALES = Object.freeze({
  recursoAviso: 60, // por debajo, amarillo
  recursoCritico: 25, // por debajo, rojo
  calorAviso: 50, // por encima, amarillo
  calorCritico: 80, // por encima, rojo
});

// Porcentaje entero acotado a [0, 100], o null si la telemetría no da para
// calcularlo (sin máximo, valores no numéricos…). Un null significa «no pintes
// barra», nunca «barra a cero»: cero real es información, dato ausente no.
export function porcentajeBarra(valor, maximo) {
  // Number(null) y Number("") son 0: sin este filtro, una lectura AUSENTE se
  // pintaría como barra vacía, que es justo la mentira opuesta («destruido»).
  const v = numero(valor);
  const m = numero(maximo);
  if (v == null || m == null || m <= 0) return null;
  return Math.max(0, Math.min(100, Math.round((v / m) * 100)));
}

function numero(valor) {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

export function nivelRecurso(pct) {
  if (pct == null) return null;
  if (pct <= UMBRALES.recursoCritico) return "critico";
  if (pct <= UMBRALES.recursoAviso) return "aviso";
  return "ok";
}

export function nivelCalor(pct) {
  if (pct == null) return null;
  if (pct >= UMBRALES.calorCritico) return "critico";
  if (pct >= UMBRALES.calorAviso) return "aviso";
  return "ok";
}

// Modelo de una barra de recurso (casco, energía): {pct, nivel} o null.
export function barraRecurso(valor, maximo) {
  const pct = porcentajeBarra(valor, maximo);
  return pct == null ? null : { pct, nivel: nivelRecurso(pct) };
}

// Modelo de barras de un sistema a partir de la fila ya preparada por
// prepareSystemRows (health/heat/power en porcentaje 0–100, potencia hasta
// 300). La potencia no tiene severidad: es una consigna, no un peligro.
export function barrasSistema({ health, heat, power } = {}) {
  const salud = porcentajeBarra(health, 100);
  const calor = porcentajeBarra(heat, 100);
  const potencia = porcentajeBarra(power, 300);
  return {
    salud: salud == null ? null : { pct: salud, nivel: nivelRecurso(salud) },
    calor: calor == null ? null : { pct: calor, nivel: nivelCalor(calor) },
    potencia: potencia == null ? null : { pct: potencia, nivel: "ok" },
  };
}

// Actualiza en el DOM una celda con barra sin reconstruirla: texto en
// [data-texto] y ancho/nivel en [data-relleno]. Framework-free a propósito;
// los patchers de telemetría V1/V2 la comparten para no duplicar el detalle.
export function aplicarBarraDom(nodo, texto, barra) {
  if (!nodo) return;
  // Sin hijo [data-texto] la celda es texto plano (celdas sin barra, o una
  // plantilla anterior): se escribe el nodo entero. El texto es la verdad y
  // nunca puede quedarse sin actualizar por culpa del adorno.
  const textoNodo = nodo.querySelector?.("[data-texto]") ?? nodo;
  if (textoNodo.textContent !== texto) textoNodo.textContent = texto;
  const relleno = nodo.querySelector?.("[data-relleno]");
  if (!relleno) return;
  if (barra == null) {
    relleno.style.width = "0%";
    delete relleno.dataset.nivel;
    return;
  }
  const ancho = `${barra.pct}%`;
  if (relleno.style.width !== ancho) relleno.style.width = ancho;
  if (relleno.dataset.nivel !== barra.nivel) relleno.dataset.nivel = barra.nivel;
}

// Marca visible de «no hay lectura». No es "0%": un sistema del que no
// sabemos nada no está destruido, y un cero real sí es información.
export const SIN_DATO = "—";

// Texto de un porcentaje ya calculado, o la marca de ausencia.
export function textoPorcentaje(valor) {
  return Number.isFinite(valor) ? `${valor}%` : SIN_DATO;
}
