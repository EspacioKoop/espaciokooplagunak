import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  ALTO,
  ANCHO,
  CLASES,
  RAZAS,
  colorEn,
  retratoCombatiente,
} from "../scripts/avatar/retrato-combatiente.mjs";
import { COMBATIENTE } from "../scripts/paleta.mjs";

const FONDO = new Set([COMBATIENTE.fondo.lejos, COMBATIENTE.fondo.cerca, COMBATIENTE.contorno]);

/** Ancho de la figura en una fila: lo que no es fondo ni contorno. */
function anchoFigura(retrato, y) {
  let ancho = 0;
  for (let x = 0; x < retrato.ancho; x += 1) {
    if (!FONDO.has(colorEn(retrato, x, y))) ancho += 1;
  }
  return ancho;
}

/**
 * Píxeles de piel en una fila. Es la medida buena para comparar cabezas: el
 * ancho de figura cuenta también melena y capucha, así que un elfo de cara
 * estrecha con el pelo largo salía «más ancho» que un humano.
 */
function anchoPiel(retrato, raza, y) {
  const pieles = new Set(COMBATIENTE.piel[raza].flatMap((tono) => Object.values(tono)));
  let ancho = 0;
  for (let x = 0; x < retrato.ancho; x += 1) {
    if (pieles.has(colorEn(retrato, x, y))) ancho += 1;
  }
  return ancho;
}

/** La fila más ancha de piel: el punto más ancho de la cara. */
function anchoMaximoPiel(retrato, raza) {
  let mayor = 0;
  for (let y = 0; y < retrato.alto; y += 1) mayor = Math.max(mayor, anchoPiel(retrato, raza, y));
  return mayor;
}

function colores(retrato) {
  return new Set(retrato.paleta);
}

test("la rejilla tiene el tamaño declarado y un índice por celda", () => {
  const retrato = retratoCombatiente({ raza: "humano", clase: "guerrero", semilla: 1 });
  assert.equal(retrato.ancho, ANCHO);
  assert.equal(retrato.alto, ALTO);
  assert.equal(retrato.pixeles.length, ANCHO * ALTO);
  for (const indice of retrato.pixeles) {
    assert.ok(indice < retrato.paleta.length, "todo índice cae dentro de la paleta");
  }
});

test("la misma semilla da siempre el mismo retrato", () => {
  for (const raza of RAZAS) {
    for (const clase of CLASES) {
      const a = retratoCombatiente({ raza, clase, semilla: "brenna" });
      const b = retratoCombatiente({ raza, clase, semilla: "brenna" });
      assert.deepEqual(Array.from(a.pixeles), Array.from(b.pixeles), `${raza} ${clase} es estable`);
      assert.deepEqual(a.paleta, b.paleta);
    }
  }
});

test("la semilla cambia el tono, no la silueta", () => {
  // El sorteo elige piel y pelo; las proporciones las pone la raza. Si una
  // semilla moviera la silueta, dos personajes de la misma raza dejarían de
  // reconocerse como tal, que es lo que este módulo tiene que garantizar.
  const filas = [20, 30, 40];
  const a = retratoCombatiente({ raza: "humano", clase: "mago", semilla: 1 });
  const b = retratoCombatiente({ raza: "humano", clase: "mago", semilla: 999 });
  for (const y of filas) {
    assert.equal(anchoFigura(a, y), anchoFigura(b, y), `la fila ${y} mide igual`);
  }
});

test("cada raza tiene proporciones propias, no el mismo muñeco repintado", () => {
  // Es la corrección de fondo del primer diseño: variar solo el tinte dejaba
  // tres razas indistinguibles en silueta.
  const humano = anchoMaximoPiel(retratoCombatiente({ raza: "humano", clase: "mago", semilla: 7 }), "humano");
  const elfo = anchoMaximoPiel(retratoCombatiente({ raza: "elfo", clase: "mago", semilla: 7 }), "elfo");
  const enano = anchoMaximoPiel(retratoCombatiente({ raza: "enano", clase: "mago", semilla: 7 }), "enano");

  assert.ok(enano > humano, `el enano es más ancho de cara (${enano}) que el humano (${humano})`);
  assert.ok(humano > elfo, `el elfo es más estrecho de cara (${elfo}) que el humano (${humano})`);
});

test("el elfo tiene orejas en punta y el enano barba", () => {
  const elfo = retratoCombatiente({ raza: "elfo", clase: "mago", semilla: 3 });
  const humano = retratoCombatiente({ raza: "humano", clase: "mago", semilla: 3 });
  // Las puntas asoman por encima del pelo. Dibujadas antes que la melena
  // quedaban tapadas, que es como se descubrió que el orden importaba.
  const filaPunta = 21;
  assert.ok(anchoPiel(elfo, "elfo", filaPunta) > 0, "la punta de la oreja asoma sobre el pelo");
  assert.equal(anchoPiel(humano, "humano", filaPunta), 0, "un humano no tiene nada ahí arriba");

  const enano = retratoCombatiente({ raza: "enano", clase: "mago", semilla: 3 });
  const pelosEnano = COMBATIENTE.pelo.enano.flatMap((tono) => [tono.luz, tono.base, tono.sombra]);
  let barba = 0;
  for (let y = 46; y <= 50; y += 1) {
    for (let x = 0; x < ANCHO; x += 1) {
      if (pelosEnano.includes(colorEn(enano, x, y))) barba += 1;
    }
  }
  assert.ok(barba > 40, `la barba baja del mentón (${barba} píxeles bajo la fila 46)`);
});

test("la paleta se mantiene corta: es pixelart, no un JPEG pequeño", () => {
  for (const raza of RAZAS) {
    for (const clase of CLASES) {
      const retrato = retratoCombatiente({ raza, clase, semilla: 42 });
      assert.ok(
        retrato.paleta.length <= 24,
        `${raza} ${clase} usa ${retrato.paleta.length} colores; el tope de la disciplina es 24`,
      );
    }
  }
});

test("todo color sale de paleta.mjs; el módulo no declara ninguno propio", () => {
  // La regla de #351 aplicada a este módulo: si un color aparece aquí y no en
  // la paleta común, la carta y el resto del arte se desincronizan en silencio.
  const permitidos = new Set([
    COMBATIENTE.contorno,
    COMBATIENTE.fondo.lejos,
    COMBATIENTE.fondo.cerca,
    COMBATIENTE.ojo.blanco,
    COMBATIENTE.ojo.iris,
    COMBATIENTE.ojo.brillo,
  ]);
  for (const raza of RAZAS) {
    for (const tono of COMBATIENTE.piel[raza]) Object.values(tono).forEach((c) => permitidos.add(c));
    for (const tono of COMBATIENTE.pelo[raza]) Object.values(tono).forEach((c) => permitidos.add(c));
  }
  for (const clase of CLASES) Object.values(COMBATIENTE.ropa[clase]).forEach((c) => permitidos.add(c));

  for (const raza of RAZAS) {
    for (const clase of CLASES) {
      for (const color of colores(retratoCombatiente({ raza, clase, semilla: 5 }))) {
        assert.ok(permitidos.has(color), `${color} no está en COMBATIENTE de paleta.mjs`);
      }
    }
  }

  const fuente = readFileSync(
    new URL("../scripts/avatar/retrato-combatiente.mjs", import.meta.url),
    "utf8",
  );
  const literales = fuente.match(/#[0-9a-fA-F]{6}/g) ?? [];
  assert.deepEqual(literales, [], "el módulo no escribe colores literales");
});

test("es puro: ni Foundry, ni DOM, ni red", () => {
  const fuente = readFileSync(
    new URL("../scripts/avatar/retrato-combatiente.mjs", import.meta.url),
    "utf8",
  );
  for (const prohibido of ["document", "window", "fetch(", "canvas", "game."]) {
    assert.ok(!fuente.includes(prohibido), `no debe usar ${prohibido}`);
  }
});

test("una raza o clase desconocida falla en vez de inventarse un combatiente", () => {
  assert.throws(() => retratoCombatiente({ raza: "orco", clase: "mago" }), TypeError);
  assert.throws(() => retratoCombatiente({ raza: "humano", clase: "bardo" }), TypeError);
});
