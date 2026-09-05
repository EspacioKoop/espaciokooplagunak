// Las tablas del generador de NPC (#676): coherentes, y LIMPIAS.
//
// La segunda mitad de este fichero es la parte que importa dentro de seis meses.
// El issue declara cuatro referencias y solo una es importable: del SRD 5.1
// (CC-BY-4.0) entra el texto, y de Shin Megami Tensei, Persona y Pokémon entra
// SOLO la mecánica. Las mecánicas no se registran; los nombres y el arte sí.
//
// Esa frase, escrita en un comentario, dura hasta que alguien amplíe las tablas
// un martes por la tarde. Escrita como una prueba que recorre cada cadena que el
// generador puede emitir, se cumple sola.
import assert from "node:assert/strict";
import test from "node:test";

import {
  AFINIDADES,
  ARQUETIPOS,
  DADO_POR_TALLA,
  DANO_SRD,
  ELEMENTOS,
  LINEAS,
  NATURALEZAS,
  SILABAS,
} from "../../scripts/npc-generador/npc-tablas.mjs";
import { generarNpc } from "../../scripts/npc-generador/npc-generador.mjs";

test("cada elemento se resuelve contra un tipo de daño real del SRD", () => {
  for (const elemento of ELEMENTOS) {
    assert.ok(DANO_SRD.includes(elemento.dano),
              `${elemento.id}: «${elemento.dano}» no es un tipo de daño del SRD 5.1`);
  }
});

test("fuerte y debil de un elemento son NATURALEZAS, y distintas entre sí", () => {
  // Poner ahí el id de otro elemento compila igual y rompe la matriz en
  // silencio; y ser fuerte y débil contra lo mismo no significa nada.
  for (const elemento of ELEMENTOS) {
    assert.ok(NATURALEZAS.includes(elemento.fuerte), `${elemento.id}.fuerte`);
    assert.ok(NATURALEZAS.includes(elemento.debil), `${elemento.id}.debil`);
    assert.notEqual(elemento.fuerte, elemento.debil, `${elemento.id}`);
  }
});

test("los identificadores no se repiten", () => {
  for (const [nombre, lista] of [["elementos", ELEMENTOS], ["arquetipos", ARQUETIPOS],
                                 ["líneas", LINEAS]]) {
    const ids = lista.map((e) => e.id);
    assert.equal(new Set(ids).size, ids.length, `hay ids repetidos en ${nombre}`);
  }
});

test("cada arquetipo tiene una talla con dado de golpe y una naturaleza", () => {
  for (const arquetipo of ARQUETIPOS) {
    assert.ok(DADO_POR_TALLA[arquetipo.talla], `${arquetipo.id}: talla desconocida`);
    assert.ok(NATURALEZAS.includes(arquetipo.naturaleza), `${arquetipo.id}: naturaleza`);
  }
});

test("toda línea tiene tres etapas", () => {
  // El generador indexa etapa 0, 1 y 2 según el desafío: una línea más corta
  // devolvería `undefined` como forma actual.
  for (const linea of LINEAS) {
    assert.equal(linea.etapas.length, 3, `la línea ${linea.id}`);
  }
});

test("los pesos de afinidad son positivos y el conjunto suma algo", () => {
  const total = Object.values(AFINIDADES).reduce((s, a) => s + a.peso, 0);
  assert.ok(total > 0);
  for (const [grado, { peso }] of Object.entries(AFINIDADES)) {
    assert.ok(peso > 0, `el grado ${grado} tiene peso ${peso}: nunca saldría`);
  }
});

test("las tablas están congeladas: nadie las muta por accidente", () => {
  assert.throws(() => { ELEMENTOS.push({}); });
  assert.throws(() => { ARQUETIPOS[0].talla = "enorme"; });
});

// --- La puerta: ni un nombre de las obras de referencia -----------------------

/**
 * Términos de las obras que se citan como referencia MECÁNICA. Ninguno puede
 * aparecer en un dato que el generador emita.
 *
 * No pretende ser exhaustiva —no se puede— sino cubrir lo que de verdad se
 * cuela: el nombre de la franquicia y las criaturas que cualquiera escribiría
 * sin pensar por ser las más conocidas.
 */
const PROHIBIDOS = [
  // Franquicias y sus términos propios
  "pokemon", "pokémon", "pokeball", "poké", "persona", "megami", "megaten",
  "shin megami", "arcana", "velvet room", "nintendo", "atlus", "game freak",
  // Criaturas y tipos que se escriben solos
  "pikachu", "charizard", "bulbasaur", "squirtle", "charmander", "eevee",
  "mewtwo", "jigglypuff", "snorlax", "gengar", "lucario", "psyduck",
  "jack frost", "pyro jack", "izanagi", "orpheus", "arsene", "thanatos",
  "mara", "pixie", "cerberus", "agi", "bufu", "zio", "garu", "megido",
  // D&D: el SRD 5.1 es CC-BY, pero la marca y lo que quedó FUERA del SRD no
  "dungeons", "dragons", "d&d", "wizards of the coast", "beholder",
  "mind flayer", "illithid", "displacer beast", "githyanki", "umber hulk",
  "carrion crawler", "yuan-ti", "kuo-toa", "slaad",
  // Argon HUD: no se copia código, tampoco su nombre dentro del dato
  "argon", "enhancedcombathud",
];

/** Todas las cadenas que el generador puede llegar a emitir. */
function cadenasEmitidas() {
  const cadenas = [
    ...SILABAS.inicio, ...SILABAS.medio, ...SILABAS.final,
    ...NATURALEZAS,
    ...ELEMENTOS.flatMap((e) => [e.id, e.fuerte, e.debil]),
    ...ARQUETIPOS.flatMap((a) => [a.id, a.talla, a.naturaleza, ...a.acciones]),
    ...LINEAS.flatMap((l) => [l.id, ...l.etapas]),
    ...Object.keys(AFINIDADES),
    ...Object.keys(DADO_POR_TALLA),
  ];
  // Y las fichas de verdad, que es donde acaban combinadas.
  for (let i = 0; i < 300; i += 1) {
    const npc = generarNpc({ semilla: `limpieza-${i}`, desafio: i % 21 });
    cadenas.push(npc.nombre, npc.formaActual, npc.evolucionaA ?? "", npc.id);
  }
  return cadenas;
}

test("ninguna cadena emitida contiene un término de las obras de referencia", () => {
  const sucias = [];
  for (const cadena of cadenasEmitidas()) {
    const normal = String(cadena).toLowerCase();
    for (const termino of PROHIBIDOS) {
      if (normal.includes(termino)) sucias.push(`«${cadena}» contiene «${termino}»`);
    }
  }
  assert.deepEqual(sucias, [],
    "De estas obras se toma la MECÁNICA, nunca los nombres. Las mecánicas no se " +
    "registran; los nombres y el arte sí.\n" + sucias.join("\n"));
});

test("los tipos de daño del SRD sí pueden aparecer: es la capa importable", () => {
  // La puerta de arriba no puede acabar prohibiendo lo ÚNICO que sí se puede
  // usar. El SRD 5.1 es CC-BY-4.0 y sus tipos de daño entran con atribución.
  assert.ok(DANO_SRD.includes("fire"));
  const npc = generarNpc({ semilla: "atribucion", desafio: 2 });
  assert.match(npc.procedencia_reglas, /SRD 5\.1.*CC-BY-4\.0/);
});
