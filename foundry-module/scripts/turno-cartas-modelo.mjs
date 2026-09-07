// Modelo puro de tarjetas de combate (#1030).
// La carta combina capas de campaña, raza, clase y estado de combate. No
// conoce Foundry, DOM ni assets: un consumidor puede pintarla o serializarla.

export const RAZAS = Object.freeze(["humano", "elfo", "enano"]);
export const CLASES = Object.freeze(["guerrero", "mago", "picaro"]);
export const BANDOS = Object.freeze(["aliado", "enemigo", "neutral"]);
export const ESTADOS = Object.freeze(["herido", "ventaja", "concentracion", "muerto"]);
export const BADGES = Object.freeze(["concentracion", "inspiracion", "agotamiento"]);

const PALETAS = Object.freeze({
  humano: Object.freeze({ marco: "#c9b48a", acento: "#f0e4c4" }),
  elfo: Object.freeze({ marco: "#8fa3d9", acento: "#d8f3dc" }),
  enano: Object.freeze({ marco: "#c8a24a", acento: "#ffe8a3" }),
});

const ICONOS_CLASE = Object.freeze({ guerrero: "espada", mago: "runa", picaro: "daga" });
const ICONOS_ESTADO = Object.freeze({ herido: "cruz", ventaja: "estrella", concentracion: "ojo", muerto: "calavera" });
const ICONOS_BADGE = Object.freeze({ concentracion: "foco", inspiracion: "chispa", agotamiento: "fatiga" });

function opcion(valor, catalogo, fallback) {
  return typeof valor === "string" && catalogo.includes(valor) ? valor : fallback;
}

function texto(valor, fallback) {
  return typeof valor === "string" && valor.trim() !== "" ? valor.trim() : fallback;
}

export function normalizarTarjeta(entrada = {}) {
  const raza = opcion(entrada.raza, RAZAS, "humano");
  const clase = opcion(entrada.clase, CLASES, "guerrero");
  const bando = opcion(entrada.bando, BANDOS, "neutral");
  const estado = Array.isArray(entrada.estados)
    ? entrada.estados.filter((valor, indice, valores) => ESTADOS.includes(valor) && valores.indexOf(valor) === indice)
    : [];
  const shiny = entrada.shiny === true;
  const agotamiento = Number.isInteger(entrada.agotamiento)
    ? Math.max(0, Math.min(6, entrada.agotamiento))
    : 0;
  // La normalización tiene que ser idempotente: si `entrada` ya es una
  // tarjeta normalizada (p.ej. la que produce combinarTarjetas al fusionar
  // una capa parcial), concentracion/inspiracion ya no existen como
  // booleanos sueltos — solo sobreviven dentro de `badges`. Sin este
  // respaldo, volver a normalizar una tarjeta ya normalizada perdía ambos
  // badges.
  const badgesPrevios = Array.isArray(entrada.badges) ? entrada.badges : [];
  const concentracion = entrada.concentracion === true || badgesPrevios.includes("concentracion");
  const inspiracion = entrada.inspiracion === true || badgesPrevios.includes("inspiracion");
  const badges = [
    concentracion ? "concentracion" : null,
    inspiracion ? "inspiracion" : null,
    agotamiento > 0 ? "agotamiento" : null,
  ].filter(Boolean);
  return Object.freeze({
    id: texto(entrada.id, "sin-id"),
    nombre: texto(entrada.nombre, "Sin nombre"),
    raza,
    clase,
    bando,
    shiny,
    concentracion,
    inspiracion,
    estados: Object.freeze(estado),
    badges: Object.freeze(badges),
    agotamiento,
    visual: Object.freeze({
      paleta: PALETAS[raza],
      iconoClase: ICONOS_CLASE[clase],
      iconoEstados: Object.freeze(estado.map((valor) => ICONOS_ESTADO[valor])),
      iconoBadges: Object.freeze(badges.map((valor) => ICONOS_BADGE[valor])),
      marcoShiny: shiny ? "ornamentado" : "simple",
    }),
  });
}

export function combinarTarjetas(base, overlay = {}) {
  return normalizarTarjeta({ ...base, ...overlay, estados: overlay.estados ?? base?.estados });
}

export function galeriaDePrueba() {
  return RAZAS.flatMap((raza) => CLASES.map((clase) => normalizarTarjeta({
    id: `${raza}-${clase}`,
    nombre: `${raza} ${clase}`,
    raza,
    clase,
    bando: raza === "humano" ? "aliado" : raza === "elfo" ? "neutral" : "enemigo",
    shiny: clase === "mago",
    estados: clase === "guerrero" ? ["herido"] : clase === "picaro" ? ["ventaja"] : ["concentracion"],
  })));
}

export function tarjetasDeIniciativa(participantes, { activoId = null, siguienteId = null } = {}) {
  return participantes.map((participante, indice) => {
    const carta = normalizarTarjeta(participante);
    return Object.freeze({
      ...carta,
      posicion: indice,
      activo: carta.id === activoId,
      siguiente: carta.id === siguienteId,
    });
  });
}

// Adaptador pequeño para el contrato de #1029. El reducer sigue siendo la
// fuente de verdad: aquí solo se proyecta su estado a cartas visuales.
export function tarjetasDesdeEstadoTurno(estado) {
  const combatientes = Array.isArray(estado?.combatants) ? estado.combatants : [];
  const actual = estado?.active ? combatientes[estado.currentIndex] : null;
  const siguiente = actual && combatientes.length > 1
    ? combatientes[(estado.currentIndex + 1) % combatientes.length]
    : null;
  return tarjetasDeIniciativa(combatientes.map((combatiente) => ({
    ...combatiente,
    nombre: combatiente.name,
    raza: combatiente.race,
    clase: combatiente.className,
    shiny: combatiente.shiny,
    estados: combatiente.statuses,
    inspiracion: combatiente.inspiration,
    agotamiento: combatiente.exhaustion,
    // El campo bando explícito (p.ej. "neutral") tiene prioridad: `ally` es
    // solo el fallback binario cuando no hay bando declarado, no una fuente
    // de verdad que lo pise.
    bando: typeof combatiente.bando === "string"
      ? combatiente.bando
      : combatiente.ally
        ? "aliado"
        : "enemigo",
  })), { activoId: actual?.id ?? null, siguienteId: siguiente?.id ?? null });
}

function escapar(valor) {
  return String(valor).replace(/[&<>\"]/g, (caracter) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[caracter]));
}

// Boceto visual deliberadamente pequeño: sirve para comparar variantes sin
// fijar todavía el layout definitivo de la barra de iniciativa.
export function tarjetaSvg(entrada) {
  const carta = normalizarTarjeta(entrada);
  const paleta = carta.visual.paleta;
  const brillo = carta.shiny ? `<path d="M8 8h104v144H8z" fill="none" stroke="${paleta.acento}" stroke-width="3" stroke-dasharray="4 3"/>` : "";
  const insignias = [...carta.visual.iconoEstados, ...carta.visual.iconoBadges].map((icono, indice) => `<text x="${14 + indice * 20}" y="142" font-size="9">${escapar(icono)}</text>`).join("");
  const agotamiento = carta.agotamiento > 0 ? `<text x="106" y="151" text-anchor="end" fill="#ff8f9d" font-size="8">E${carta.agotamiento}/6</text>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 160" role="img" aria-label="${escapar(carta.nombre)}"><rect width="120" height="160" rx="8" fill="#141b33"/><rect x="5" y="5" width="110" height="150" rx="6" fill="${paleta.marco}"/><rect x="10" y="10" width="100" height="112" rx="4" fill="#0b0f18"/><text x="60" y="38" text-anchor="middle" fill="${paleta.acento}" font-size="25">${escapar(carta.visual.iconoClase)}</text><text x="60" y="78" text-anchor="middle" fill="#f4e8c8" font-size="11">${escapar(carta.raza)}</text><text x="60" y="94" text-anchor="middle" fill="#f4e8c8" font-size="11">${escapar(carta.clase)}</text><text x="60" y="112" text-anchor="middle" fill="#8fa3d9" font-size="9">${escapar(carta.bando)}</text><text x="14" y="142" fill="#f4e8c8">${insignias}</text>${agotamiento}${brillo}</svg>`;
}
