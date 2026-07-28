// Agente automático para turnos de NPC en el póker. Política pura y determinista:
// dada la vista privada del jugador y sus acciones permitidas, decide una acción
// cerrada, sin azar ni estado externo. Vive FUERA del motor (que debe seguir
// siendo un reductor puro de reglas); la capa de sesión lo invoca cuando el
// jugador de turno es un NPC (`controlador === "automatico"`).
//
// Se mantiene separado a propósito para poder sustituir la política (más lista,
// por dificultad, o incluso otra para blackjack) sin tocar el motor ni la UI.
//
// El determinismo es deliberado: con la misma mano y el mismo estado el NPC
// juega igual, de modo que una partida sembrada es reproducible de principio a
// fin, como exige el contrato de #308.

import { evaluarMano, CATEGORIAS } from "./evaluador-manos.mjs";

const RANGO = Object.freeze({ T: 10, J: 11, Q: 12, K: 13, A: 14 });

function valorDeCodigo(codigo) {
  const r = codigo.slice(0, -1);
  return RANGO[r] ?? Number(r);
}

// Fuerza aproximada de la mano en [0, 1]. Postflop usa el evaluador real sobre
// cartas propias + comunitarias; preflop usa una heurística de las dos cartas.
export function estimarFuerza(vista) {
  const mano = vista.tuMano ?? [];
  const comunitarias = vista.comunitarias ?? [];
  if (mano.length < 2) {
    return 0;
  }
  if (comunitarias.length >= 3) {
    const cartas = [...mano, ...comunitarias].map((codigo) => ({
      valor: valorDeCodigo(codigo),
      palo: codigo.slice(-1),
      codigo,
    }));
    const punt = evaluarMano(cartas);
    // Normaliza la categoría (1..9) a [0,1] y afina con la carta alta.
    const base = (punt.categoria - 1) / (CATEGORIAS.ESCALERA_COLOR - 1);
    const alta = (punt.desempate[0] ?? 2) / 14;
    return Math.min(1, base * 0.85 + alta * 0.15);
  }
  // Preflop: pareja, cartas altas y color aportan fuerza.
  const [a, b] = mano;
  const va = valorDeCodigo(a);
  const vb = valorDeCodigo(b);
  const pareja = va === vb;
  const suited = a.slice(-1) === b.slice(-1);
  const alto = Math.max(va, vb);
  let fuerza = (alto - 2) / 12 * 0.45;
  if (pareja) {
    fuerza += 0.35 + (va - 2) / 12 * 0.15;
  }
  if (suited) {
    fuerza += 0.08;
  }
  return Math.min(1, fuerza);
}

// Decide la acción del NPC de turno. `vista` es la vista privada del motor;
// `acciones` es el arreglo de acciones permitidas para ese jugador.
//
// Política conservadora por umbrales:
//   - si puede pasar gratis, pasa salvo mano fuerte (entonces sube modestamente);
//   - ante una apuesta, se retira si la mano es floja y el coste relativo alto;
//   - con mano fuerte sube; con mano media iguala.
export function decidirAccionAutomatica(vista, acciones) {
  if (!Array.isArray(acciones) || acciones.length === 0) {
    return null;
  }
  const fuerza = estimarFuerza(vista);
  const yo = (vista.jugadores ?? []).find((j) => j.userId === vista.turno);
  const porIgualar = yo ? Math.max(0, vista.apuestaActual - yo.apostadoRonda) : 0;
  const stack = yo?.stack ?? 0;
  const costeRelativo = stack > 0 ? porIgualar / (stack + porIgualar) : 1;

  const puede = (t) => acciones.includes(t);

  // Sin nada que igualar: pasar, y subir solo con mano fuerte.
  if (puede("check")) {
    if (fuerza >= 0.7 && puede("raise")) {
      return subida(vista, "modesta");
    }
    return { tipo: "check" };
  }

  // Hay que poner fichas para seguir.
  if (fuerza >= 0.8 && puede("raise")) {
    return subida(vista, "valor");
  }
  if (fuerza < 0.35 && costeRelativo > 0.15 && puede("fold")) {
    return { tipo: "fold" };
  }
  if (puede("call")) {
    return { tipo: "call" };
  }
  return { tipo: puede("check") ? "check" : "fold" };
}

// Construye una subida acotada: mínima ("modesta") o de doble incremento
// ("valor"), siempre respetando el máximo del jugador.
function subida(vista, estilo) {
  const yo = (vista.jugadores ?? []).find((j) => j.userId === vista.turno);
  const maximo = (yo?.stack ?? 0) + (yo?.apostadoRonda ?? 0);
  const incremento = estilo === "valor" ? vista.subidaMinima * 2 : vista.subidaMinima;
  const hasta = Math.min(maximo, vista.apuestaActual + incremento);
  return { tipo: "raise", parametros: { hasta } };
}
