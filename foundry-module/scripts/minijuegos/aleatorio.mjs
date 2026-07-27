// Generador de números pseudoaleatorios determinista para los minijuegos.
//
// Por qué existe: el contrato de minijuegos (docs/MINIJUEGOS_FOUNDRY.md, #308)
// exige un reductor determinista —mismo estado inicial y misma secuencia de
// acciones producen el mismo resultado— y prohíbe que el motor llame a
// `Math.random()`. Toda la aleatoriedad se consume a través de una semilla que
// el coordinador crea y conserva; este módulo es esa fuente.
//
// Es una primitiva independiente del póker: cualquier minijuego (blackjack,
// dominó, dados) puede reutilizarla. No depende de Foundry ni del DOM.
//
// El estado del generador es un entero de 32 bits serializable, de modo que el
// coordinador puede guardarlo en su estado privado en memoria y reanudar la
// misma secuencia sin volver a barajar desde datos públicos.

const MASK_32 = 0xffffffff;

// Normaliza cualquier entrada (número, cadena) a una semilla entera de 32 bits.
// Permite sembrar tanto con un entero como con un identificador de sesión.
export function normalizarSemilla(semilla) {
  if (typeof semilla === "number" && Number.isFinite(semilla)) {
    return (semilla >>> 0) || 1;
  }
  const texto = String(semilla ?? "");
  // Hash tipo FNV-1a de 32 bits: estable y bien distribuido para cadenas.
  let hash = 0x811c9dc5;
  for (let i = 0; i < texto.length; i += 1) {
    hash ^= texto.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) || 1;
}

// Crea un generador determinista (algoritmo mulberry32). Devuelve un objeto con
// operaciones puras respecto a su propio estado interno; dos generadores con la
// misma semilla emiten exactamente la misma secuencia.
export function crearAleatorio(semilla) {
  let estado = normalizarSemilla(semilla);

  // Devuelve un flotante en [0, 1). No usa Math.random().
  function siguiente() {
    estado = (estado + 0x6d2b79f5) & MASK_32;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // Entero en [min, max] inclusive, distribución uniforme.
  function enteroEntre(min, max) {
    if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
      throw new RangeError("enteroEntre: rango inválido");
    }
    return min + Math.floor(siguiente() * (max - min + 1));
  }

  return {
    siguiente,
    enteroEntre,
    // Instantánea serializable del estado para reanudar la misma secuencia.
    exportarEstado() {
      return estado >>> 0;
    },
    importarEstado(valor) {
      estado = normalizarSemilla(valor);
    },
  };
}

// Mezcla Fisher-Yates de una copia del arreglo usando un generador dado. No muta
// la entrada (pureza) y consume la aleatoriedad del generador compartido.
export function mezclar(elementos, aleatorio) {
  const copia = [...elementos];
  for (let i = copia.length - 1; i > 0; i -= 1) {
    const j = aleatorio.enteroEntre(0, i);
    const tmp = copia[i];
    copia[i] = copia[j];
    copia[j] = tmp;
  }
  return copia;
}
