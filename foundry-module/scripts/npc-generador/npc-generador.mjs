// Generador de NPC aleatorios para la nave recorrible (#676).
//
// QUÉ ES. Una función: semilla + valor de desafío → una ficha completa. La misma
// semilla da SIEMPRE el mismo NPC, así que un habitante de una sala se puede
// reconstruir desde su id en cualquier cliente sin transmitir la ficha entera, y
// una prueba puede fijar un caso sin copiar cuarenta números.
//
// QUÉ NO ES, Y ESTO IMPORTA MÁS. No pinta, no habla, no recuerda. No sabe que
// existe Foundry. La sala donde aparece, la conversación y —sobre todo— llevar
// la cuenta de a quién has conocido son otra cosa: lo último ni siquiera está
// decidido (#598 lo dejó abierto para el bestiario, porque *recordar* es del
// núcleo y no de una escena). Un generador que además guardase sería el mismo
// error, en pequeño.
//
// LAS CUATRO CAPAS DE LA FICHA. Cada referencia del issue aporta una:
//
//   1. **5e (2014)** — atributos, modificadores, CA, PG y competencia. Sale del
//      SRD 5.1 (CC-BY-4.0) y se calcula con SUS fórmulas, no con imitaciones.
//   2. **Afinidades** — seis grados por elemento. Es lo que hace que un NPC se
//      lea por sus huecos y no por su montón de PG.
//   3. **Naturaleza y línea** — la matriz de efectividad y las etapas.
//   4. **Reparto de acciones** — acción / adicional / reacción / movimiento, que
//      es la forma que un HUD de combate necesita.
//
// De la 1 se importa texto; de las otras tres, solo la mecánica. El porqué —y el
// choque de licencias con Argon HUD, GPL-3.0 contra el GPL-2.0 de este árbol—
// está en `npc-tablas.mjs`, junto a las tablas que lo obedecen.
//
// Puro: ni Foundry, ni DOM, ni red, ni `Math.random()`. Toda la aleatoriedad
// entra por `minijuegos/aleatorio.mjs`, igual que en los minijuegos (#308).

import { crearAleatorio, normalizarSemilla } from "../minijuegos/aleatorio.mjs";
import {
  AFINIDADES,
  ARQUETIPOS,
  DADO_POR_TALLA,
  DANO_SRD,
  ELEMENTOS,
  LINEAS,
  NATURALEZAS,
  SILABAS,
} from "./npc-tablas.mjs";

/** Valor de desafío mínimo y máximo que este generador cubre. */
export const DESAFIO_MIN = 0;
export const DESAFIO_MAX = 20;

/**
 * Modificador de característica — SRD 5.1: `floor((valor - 10) / 2)`.
 */
export function modificador(valor) {
  if (!Number.isFinite(valor)) throw new TypeError("modificador: valor no numérico");
  return Math.floor((valor - 10) / 2);
}

/**
 * Bonificador de competencia por valor de desafío — SRD 5.1, tabla de
 * competencia por VD: +2 hasta VD 4, y +1 más cada cuatro VD a partir de ahí.
 *
 * Se escribe como fórmula y no como tabla de veintiún casos a propósito: una
 * tabla copiada a mano se equivoca en una fila y nadie lo ve.
 */
export function competencia(desafio) {
  const vd = Math.max(0, Number(desafio) || 0);
  return 2 + Math.max(0, Math.ceil((vd - 4) / 4));
}

/**
 * Efectividad de un elemento contra una naturaleza: 2 si es fuerte, 0,5 si es
 * débil, 1 si le da igual.
 *
 * La matriz NO se escribe: se deriva de lo que cada elemento declara. Siete
 * elementos por cuatro naturalezas son veintiocho casillas, y veintiocho
 * casillas escritas a mano son veintiocho sitios donde equivocarse.
 */
export function efectividad(elementoId, naturaleza) {
  const elemento = ELEMENTOS.find((e) => e.id === elementoId);
  if (!elemento) throw new RangeError(`efectividad: elemento desconocido «${elementoId}»`);
  if (!NATURALEZAS.includes(naturaleza)) {
    throw new RangeError(`efectividad: naturaleza desconocida «${naturaleza}»`);
  }
  if (elemento.fuerte === naturaleza) return 2;
  if (elemento.debil === naturaleza) return 0.5;
  return 1;
}

/**
 * Daño que recibe de verdad, cruzando efectividad con afinidad.
 *
 * Devuelve un número con signo: negativo significa que NO le hace daño sino que
 * le viene bien (`absorbe`) o que se lo devuelve a quien pegó (`repele`). Quién
 * come ese número es decisión de quien lo consuma, no de aquí — este módulo no
 * conoce el combate, solo la ficha.
 */
export function danoRecibido(base, elementoId, npc) {
  const afinidad = npc.afinidades[elementoId] ?? "neutral";
  const { factor } = AFINIDADES[afinidad];
  return base * efectividad(elementoId, npc.naturaleza) * factor;
}

/** Nombre propio compuesto de sílabas. No es palabra de ningún idioma real. */
function componerNombre(azar) {
  const trozo = (lista) => lista[azar.enteroEntre(0, lista.length - 1)];
  return trozo(SILABAS.inicio) + trozo(SILABAS.medio) + trozo(SILABAS.final);
}

/**
 * Los seis atributos. La base sube con el desafío —un VD 12 no puede tener los
 * mismos números que un VD 1— y el sesgo del arquetipo la inclina.
 */
function tirarAtributos(azar, arquetipo, desafio) {
  const suelo = 8 + Math.min(6, Math.floor(desafio / 3));
  const atributos = {};
  for (const clave of ["fue", "des", "con", "int", "sab", "car"]) {
    const bruto = suelo + azar.enteroEntre(0, 5) + (arquetipo.sesgo[clave] ?? 0);
    // El SRD acota las características de criatura entre 1 y 30.
    atributos[clave] = Math.min(30, Math.max(1, bruto));
  }
  return atributos;
}

/**
 * Afinidades por elemento, sorteadas con los pesos de la tabla. Un NPC con las
 * siete en `neutral` no tiene nada que leer, así que se garantiza AL MENOS una
 * debilidad: es el hueco por el que se le gana, y sin él la capa entera sobra.
 */
function tirarAfinidades(azar) {
  const grados = Object.keys(AFINIDADES);
  const total = grados.reduce((suma, g) => suma + AFINIDADES[g].peso, 0);
  const afinidades = {};
  for (const elemento of ELEMENTOS) {
    let dado = azar.enteroEntre(0, total - 1);
    let elegido = grados[grados.length - 1];
    for (const grado of grados) {
      dado -= AFINIDADES[grado].peso;
      if (dado < 0) { elegido = grado; break; }
    }
    afinidades[elemento.id] = elegido;
  }
  if (!Object.values(afinidades).includes("debil")) {
    const elemento = ELEMENTOS[azar.enteroEntre(0, ELEMENTOS.length - 1)];
    afinidades[elemento.id] = "debil";
  }
  return afinidades;
}

/**
 * Reparte lo que sabe hacer en los cuatro cajones que un HUD de combate necesita
 * (acción, adicional, reacción, movimiento).
 *
 * Es la FORMA del dato, no código de nadie: quien tenga instalado un HUD que lea
 * esta forma lo verá repartido, y quien no lo tenga verá la ficha entera igual.
 * Deriva de las acciones del arquetipo, así que un arquetipo nuevo no obliga a
 * tocar esto.
 */
export function repartirAcciones(npc) {
  const [ofensiva, utilidad, defensiva] = npc.acciones;
  return {
    accion: [ofensiva],
    adicional: [utilidad],
    reaccion: [defensiva],
    movimiento: [`desplazarse-${npc.velocidad}`],
  };
}

/**
 * Genera un NPC. `semilla` es lo único obligatorio: dos llamadas con la misma
 * semilla y el mismo desafío devuelven fichas idénticas.
 */
export function generarNpc({ semilla, desafio = 1 } = {}) {
  if (semilla === undefined || semilla === null || semilla === "") {
    throw new TypeError("generarNpc: hace falta una semilla");
  }
  const vd = Number(desafio);
  if (!Number.isFinite(vd) || vd < DESAFIO_MIN || vd > DESAFIO_MAX) {
    throw new RangeError(`generarNpc: desafío fuera de [${DESAFIO_MIN}, ${DESAFIO_MAX}]`);
  }

  const azar = crearAleatorio(semilla);
  const arquetipo = ARQUETIPOS[azar.enteroEntre(0, ARQUETIPOS.length - 1)];
  const linea = LINEAS[azar.enteroEntre(0, LINEAS.length - 1)];
  // La etapa sale del desafío, no del azar: la misma criatura más crecida es
  // más peligrosa, y al revés sería incoherente con su propia ficha.
  const etapa = vd >= 9 ? 2 : vd >= 4 ? 1 : 0;

  const atributos = tirarAtributos(azar, arquetipo, vd);
  const modCon = modificador(atributos.con);
  const modDes = modificador(atributos.des);
  const caras = DADO_POR_TALLA[arquetipo.talla];
  const dados = Math.max(1, Math.round(2 + vd * 1.5));
  // PG del SRD: media del dado de golpe por dado, más CON por dado. Mínimo 1.
  const puntosDeGolpe = Math.max(1, Math.floor(dados * ((caras + 1) / 2 + modCon)));

  const npc = {
    id: `npc-${normalizarSemilla(semilla).toString(16)}-${vd}`,
    nombre: componerNombre(azar),
    arquetipo: arquetipo.id,
    linea: linea.id,
    etapa,
    formaActual: linea.etapas[etapa],
    evolucionaA: etapa < linea.etapas.length - 1 ? linea.etapas[etapa + 1] : null,
    naturaleza: arquetipo.naturaleza,
    talla: arquetipo.talla,
    desafio: vd,
    competencia: competencia(vd),
    atributos,
    modificadores: Object.fromEntries(
      Object.entries(atributos).map(([k, v]) => [k, modificador(v)])),
    clase_armadura: 10 + modDes + Math.min(4, Math.floor(vd / 4)),
    puntos_de_golpe: puntosDeGolpe,
    dados_de_golpe: `${dados}d${caras}${modCon ? (modCon > 0 ? "+" : "") + dados * modCon : ""}`,
    velocidad: 9, // metros; la nave se anda en metros (#540)
    afinidades: tirarAfinidades(azar),
    acciones: [...arquetipo.acciones],
    // Procedencia de la mitad importable, para que viaje CON la ficha y no en un
    // documento que nadie abre.
    procedencia_reglas: "SRD 5.1 (D&D 5e, 2014) — CC-BY-4.0",
  };
  npc.reparto_acciones = repartirAcciones(npc);
  return npc;
}

export { DANO_SRD };
