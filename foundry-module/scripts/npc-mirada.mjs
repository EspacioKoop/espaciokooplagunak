// Política pura de mirada de personajes y NPC (#975, parte 1).
//
// Decide QUÉ objetivo corresponde a cada política y convierte su posición en un
// vector 3D acotado. No dibuja ojos, párpados ni cabeza; tampoco conoce Foundry,
// DOM, rig, reloj o estado global. Los consumidores aportarán instantáneas ya
// resueltas (incluido el objetivo de contagio con el retraso que decidan).

const VECTOR_CERO = Object.freeze([0, 0, 0]);
const FRENTE_PREDETERMINADO = Object.freeze([0, 0, 1]);
const EPSILON = 1e-12;

function esVector3(valor) {
  return Array.isArray(valor)
    && valor.length === 3
    && valor.every((componente) => Number.isFinite(componente));
}

function exigirVector3(valor, nombre) {
  if (!esVector3(valor)) {
    throw new TypeError(`mirada: ${nombre} debe ser un vector 3D finito`);
  }
  return valor;
}

function longitud(vector) {
  return Math.hypot(vector[0], vector[1], vector[2]);
}

function normalizar(vector, nombre) {
  const magnitud = longitud(vector);
  if (!Number.isFinite(magnitud)) {
    throw new TypeError(`mirada: la magnitud de ${nombre} debe ser finita`);
  }
  if (magnitud <= EPSILON) {
    throw new TypeError(`mirada: ${nombre} no puede ser el vector cero`);
  }
  return vector.map((componente) => componente / magnitud);
}

function productoEscalar(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function perpendicularEstable(frente) {
  const ejes = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const eje = ejes.reduce((mejor, candidato) => (
    Math.abs(productoEscalar(frente, candidato))
      < Math.abs(productoEscalar(frente, mejor)) ? candidato : mejor
  ));
  const proyeccion = productoEscalar(eje, frente);
  return normalizar(eje.map((valor, indice) => valor - proyeccion * frente[indice]), "borde del cono");
}

/**
 * Devuelve el desplazamiento hacia `objetivo`, limitado por alcance y por el
 * cono de `frente`. Dentro del alcance conserva la distancia real; fuera, la
 * recorta. Un objetivo coincidente produce `[0, 0, 0]`.
 */
export function calcularVectorMirada({
  personaje,
  objetivo,
  frente = FRENTE_PREDETERMINADO,
  semiangulo = Math.PI,
  alcance = 1,
} = {}) {
  exigirVector3(personaje, "personaje");
  exigirVector3(objetivo, "objetivo");
  exigirVector3(frente, "frente");
  if (!Number.isFinite(semiangulo) || semiangulo < 0 || semiangulo > Math.PI) {
    throw new TypeError("mirada: semiangulo debe estar entre 0 y PI");
  }
  if (!Number.isFinite(alcance) || alcance <= 0) {
    throw new TypeError("mirada: alcance debe ser mayor que cero");
  }

  const desplazamiento = objetivo.map((valor, indice) => valor - personaje[indice]);
  exigirVector3(desplazamiento, "desplazamiento");
  const distancia = longitud(desplazamiento);
  if (!Number.isFinite(distancia)) {
    throw new TypeError("mirada: la distancia al objetivo debe ser finita");
  }
  if (distancia <= EPSILON) return [...VECTOR_CERO];

  const eje = normalizar(frente, "frente");
  const direccion = desplazamiento.map((valor) => valor / distancia);
  const coseno = Math.max(-1, Math.min(1, productoEscalar(eje, direccion)));
  const angulo = Math.acos(coseno);
  let acotada = direccion;

  if (angulo > semiangulo) {
    const lateralBruto = direccion.map((valor, indice) => valor - coseno * eje[indice]);
    const lateral = longitud(lateralBruto) <= EPSILON
      ? perpendicularEstable(eje)
      : normalizar(lateralBruto, "componente lateral");
    acotada = eje.map((valor, indice) => (
      valor * Math.cos(semiangulo) + lateral[indice] * Math.sin(semiangulo)
    ));
  }

  const magnitud = Math.min(distancia, alcance);
  const resultado = acotada.map((componente) => componente * magnitud);
  exigirVector3(resultado, "resultado");
  return resultado;
}

const elegir = (nombre) => (contexto) => contexto[nombre];

const estrategias = {
  tarea: elegir("objetivoTarea"),
  "ronda-interes": (contexto) => {
    if (!Array.isArray(contexto.puntosInteres) || contexto.puntosInteres.length === 0) {
      throw new TypeError("mirada: puntosInteres debe contener al menos un objetivo");
    }
    if (!Number.isInteger(contexto.pasoInteres) || contexto.pasoInteres < 0) {
      throw new TypeError("mirada: pasoInteres debe ser un entero no negativo");
    }
    return contexto.puntosInteres[contexto.pasoInteres % contexto.puntosInteres.length];
  },
  contagio: elegir("objetivoContagio"),
  jugador: elegir("posicionJugador"),
  evitar: (contexto) => {
    exigirVector3(contexto.personaje, "personaje");
    exigirVector3(contexto.objetivoEvitar, "objetivoEvitar");
    return contexto.personaje.map((valor, indice) => 2 * valor - contexto.objetivoEvitar[indice]);
  },
  alarma: elegir("objetivoAlarma"),
};

/** Tabla declarativa única: añadir una política no reparte `switch` por el árbol. */
export const POLITICAS_MIRADA = Object.freeze(estrategias);

/**
 * Selecciona una posición objetivo. `alarmaActiva === true` fuerza `alarma`
 * antes de consultar la política pedida; cualquier contrato incompleto falla.
 */
export function resolverObjetivoMirada({ politica, contexto } = {}) {
  if (!contexto || typeof contexto !== "object" || Array.isArray(contexto)) {
    throw new TypeError("mirada: contexto debe ser un objeto");
  }
  if (contexto.alarmaActiva !== undefined && typeof contexto.alarmaActiva !== "boolean") {
    throw new TypeError("mirada: alarmaActiva debe ser booleana");
  }
  const nombre = contexto.alarmaActiva === true ? "alarma" : politica;
  if (!Object.hasOwn(POLITICAS_MIRADA, nombre)) {
    throw new RangeError(`mirada: política desconocida «${String(nombre)}»`);
  }
  const estrategia = POLITICAS_MIRADA[nombre];
  const objetivo = estrategia(contexto);
  exigirVector3(objetivo, `objetivo de ${nombre}`);
  return [...objetivo];
}

/** Compone la selección declarativa con la limitación geométrica del cono. */
export function resolverMirada({ politica, contexto, limites = {} } = {}) {
  if (!limites || typeof limites !== "object" || Array.isArray(limites)) {
    throw new TypeError("mirada: limites debe ser un objeto");
  }
  if (Object.hasOwn(limites, "personaje") || Object.hasOwn(limites, "objetivo")) {
    throw new TypeError("mirada: limites no puede sustituir personaje ni objetivo");
  }
  const objetivo = resolverObjetivoMirada({ politica, contexto });
  return calcularVectorMirada({ personaje: contexto.personaje, objetivo, ...limites });
}
