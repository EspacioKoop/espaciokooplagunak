import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  ANCHO_PUERTA,
  CELDA,
  SALAS_PHOBOS,
  conexiones,
  contacto,
  llegada,
  medidasSala,
  rectPuerta,
} from "../scripts/nave-planta-phobos.mjs";
import { CATALOGO_ANDAR } from "../scripts/nave-catalogo-andar.mjs";
import { PLANTA_CANTINA } from "../scripts/cantina-planta.mjs";
import { puertaTocada } from "../scripts/nave-movimiento.mjs";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * El catálogo expone `ids`/`obtener`, no un objeto llano. Se recorre con este
 * helper y no con `Object.entries(...)`: un acceso equivocado devolvería vacío y
 * dejaría pasar en falso todas las pruebas de abajo, que es justo lo que hizo
 * la primera versión de este archivo.
 */
function todasLasEstancias() {
  const pares = CATALOGO_ANDAR.ids.map((id) => [id, CATALOGO_ANDAR.obtener(id)]);
  assert.ok(pares.length > 5, "el catálogo llega vacío: el recorrido está roto");
  return pares;
}

/* ---- La copia no se puede pudrir en silencio ---- */

test("las salas copiadas son EXACTAMENTE las del shipTemplate del Phobos M3P", () => {
  // La planta es estática por decisión de #540 (standalone-first: sin puente
  // también hay que poder andar). El precio de copiar es que la copia se
  // desactualice, así que se compara contra el .lua de verdad.
  const lua = readFileSync(join(raiz, "scripts", "shipTemplates", "frigates.lua"), "utf8");
  const desdeM3P = lua.slice(lua.indexOf('copy("Phobos M3P")'));
  const bloque = desdeM3P.slice(0, desdeM3P.indexOf("addDoor"));

  const declaradas = [];
  for (const m of bloque.matchAll(/addRoom(System)?\((\d+),\s*(\d+),\s*(\d+),\s*(\d+)(?:,\s*"([^"]+)")?\)/g)) {
    declaradas.push({
      celda: { x: Number(m[2]), y: Number(m[3]), w: Number(m[4]), h: Number(m[5]) },
      sistema: m[6] ?? null,
    });
  }

  assert.equal(declaradas.length, 13, "el .lua declara trece salas");
  assert.equal(SALAS_PHOBOS.length, declaradas.length, "sobra o falta una sala en la copia");

  const clave = (s) => `${s.celda.x},${s.celda.y},${s.celda.w},${s.celda.h}:${s.sistema ?? "-"}`;
  assert.deepEqual(
    SALAS_PHOBOS.map(clave).sort(),
    declaradas.map(clave).sort(),
    "la copia de SALAS_PHOBOS ya no coincide con scripts/shipTemplates/frigates.lua",
  );
});

/* ---- Geometría de la rejilla ---- */

test("ninguna sala se solapa con otra", () => {
  for (const a of SALAS_PHOBOS) {
    for (const b of SALAS_PHOBOS) {
      if (a === b) continue;
      const solapaX = a.celda.x < b.celda.x + b.celda.w && b.celda.x < a.celda.x + a.celda.w;
      const solapaY = a.celda.y < b.celda.y + b.celda.h && b.celda.y < a.celda.y + a.celda.h;
      assert.equal(solapaX && solapaY, false, `${a.id} y ${b.id} ocupan la misma celda`);
    }
  }
});

test("tocarse solo por una esquina NO cuenta como contiguo", () => {
  // Por un vértice no se pasa. Si contase, la nave sería conexa sobre el papel
  // y estaría atascada al andar — la clase de fallo de #539.
  const a = { id: "a", celda: { x: 0, y: 0, w: 1, h: 1 }, sistema: null };
  const b = { id: "b", celda: { x: 1, y: 1, w: 1, h: 1 }, sistema: null };
  assert.equal(contacto(a, b), null);
});

test("el contacto es simétrico y con lados opuestos", () => {
  const opuesto = { este: "oeste", oeste: "este", norte: "sur", sur: "norte" };
  for (const { de, a, contacto: c } of conexiones()) {
    const vuelta = contacto(a, de);
    assert.ok(vuelta, `${a.id} no reconoce a ${de.id} como vecina`);
    assert.equal(vuelta.lado, opuesto[c.lado], `${de.id}→${a.id} y su vuelta no son opuestas`);
  }
});

test("toda sala es más grande que la cantina, incluida la más pequeña", () => {
  // El criterio de escala que fijó Varo: la cantina se siente pequeña, así que
  // ninguna sala de la rejilla debe quedar por debajo de ella.
  const areaCantina = PLANTA_CANTINA.ancho * PLANTA_CANTINA.profundidad;
  for (const sala of SALAS_PHOBOS) {
    const { ancho, profundidad } = medidasSala(sala);
    assert.ok(
      ancho * profundidad > areaCantina,
      `${sala.id} mide ${ancho}×${profundidad} y no supera la cantina (${PLANTA_CANTINA.ancho}×${PLANTA_CANTINA.profundidad})`,
    );
    assert.ok(ancho >= CELDA && profundidad >= CELDA, `${sala.id} mide menos de una celda`);
  }
});

/* ---- Las puertas se pueden usar de verdad ---- */

test("todo rect de puerta cae dentro de su sala y pegado a un muro", () => {
  for (const { de, contacto: c } of conexiones()) {
    const { ancho, profundidad } = medidasSala(de);
    const r = rectPuerta(de, c);
    assert.ok(r.x >= 0 && r.x + r.ancho <= ancho + 1e-9, `puerta de ${de.id} se sale en x: ${JSON.stringify(r)}`);
    assert.ok(r.z >= 0 && r.z + r.profundidad <= profundidad + 1e-9, `puerta de ${de.id} se sale en z`);
    const pegada =
      Math.abs(r.x) < 1e-9 ||
      Math.abs(r.x + r.ancho - ancho) < 1e-9 ||
      Math.abs(r.z) < 1e-9 ||
      Math.abs(r.z + r.profundidad - profundidad) < 1e-9;
    assert.ok(pegada, `la puerta de ${de.id} no toca ningún muro: ${JSON.stringify(r)}`);
  }
});

test("el punto de llegada NO cae sobre la puerta de vuelta: nada de rebotes", () => {
  // El fallo que describía el smoke como «te golpeas con el dintel»: aparecer
  // encima del rect disparador reactiva la puerta y devuelve al jugador.
  for (const [id, estancia] of todasLasEstancias()) {
    for (const puerta of estancia.puertas) {
      const destino = CATALOGO_ANDAR.obtener(puerta.destino.estancia);
      if (!destino) continue;
      const x = puerta.destino.x ?? destino.entrada.x;
      const z = puerta.destino.z ?? destino.entrada.z;
      const vuelta = puertaTocada(x, z, destino.puertas);
      assert.equal(
        vuelta?.destino?.estancia,
        undefined,
        `llegando de ${id} a ${puerta.destino.estancia} se pisa una puerta (${JSON.stringify({ x, z })})`,
      );
    }
  }
});

test("el punto de llegada está dentro de su sala", () => {
  for (const [id, estancia] of todasLasEstancias()) {
    for (const puerta of estancia.puertas) {
      const destino = CATALOGO_ANDAR.obtener(puerta.destino.estancia);
      if (!destino) continue;
      const x = puerta.destino.x ?? destino.entrada.x;
      const z = puerta.destino.z ?? destino.entrada.z;
      assert.ok(
        x > 0 && x < destino.planta.ancho && z > 0 && z < destino.planta.profundidad,
        `${id} manda a ${puerta.destino.estancia} fuera de la sala: ${JSON.stringify({ x, z })}`,
      );
    }
  }
});

/* ---- Alcanzabilidad: lo que #539 echaba en falta ---- */

test("TODA estancia es alcanzable desde la cantina", () => {
  // El síntoma literal del smoke: «solo se puede acceder a la cantina». Esta
  // prueba recorre el grafo real del catálogo, no el de las cajas de prueba.
  const estancias = Object.fromEntries(todasLasEstancias());
  const vistas = new Set(["cantina"]);
  const pendientes = ["cantina"];
  while (pendientes.length) {
    const actual = pendientes.pop();
    for (const puerta of estancias[actual].puertas) {
      const siguiente = puerta.destino.estancia;
      assert.ok(estancias[siguiente], `${actual} tiene una puerta a "${siguiente}", que no existe`);
      if (!vistas.has(siguiente)) {
        vistas.add(siguiente);
        pendientes.push(siguiente);
      }
    }
  }
  const inalcanzables = Object.keys(estancias).filter((id) => !vistas.has(id));
  assert.deepEqual(inalcanzables, [], `estancias a las que no se llega andando: ${inalcanzables.join(", ")}`);
});

test("todas las salas de la rejilla tienen al menos una puerta", () => {
  for (const sala of SALAS_PHOBOS) {
    const estancia = CATALOGO_ANDAR.obtener(sala.id);
    assert.ok(estancia, `${sala.id} no está en el catálogo`);
    assert.ok(estancia.puertas.length > 0, `${sala.id} es una sala tapiada`);
  }
});

test("cada puerta tiene su gemela de vuelta", () => {
  // Una puerta de ida sin vuelta encierra al jugador, que es peor que no tener
  // puerta: se nota cuando ya no puede salir.
  for (const [id, estancia] of todasLasEstancias()) {
    for (const puerta of estancia.puertas) {
      const destino = CATALOGO_ANDAR.obtener(puerta.destino.estancia);
      const vuelve = destino.puertas.some((p) => p.destino.estancia === id);
      assert.ok(vuelve, `de ${id} se va a ${puerta.destino.estancia} y no se puede volver`);
    }
  }
});

test("dos puertas de la misma sala no se pisan", () => {
  for (const [id, estancia] of todasLasEstancias()) {
    const rects = estancia.puertas.map((p) => p.rect);
    for (let i = 0; i < rects.length; i += 1) {
      for (let j = i + 1; j < rects.length; j += 1) {
        const a = rects[i];
        const b = rects[j];
        const solapa =
          a.x < b.x + b.ancho &&
          b.x < a.x + a.ancho &&
          a.z < b.z + b.profundidad &&
          b.z < a.z + a.profundidad;
        assert.equal(solapa, false, `${id} tiene dos puertas solapadas: ${JSON.stringify([a, b])}`);
      }
    }
  }
});

/* ---- Consolas ---- */

test("la consola de cada sala con sistema abre el puesto de ESE sistema", () => {
  const esperado = {
    reactor: "engineering",
    "armas-haz": "weapons",
    misiles: "weapons",
    maniobra: "navigation",
    impulso: "navigation",
  };
  for (const [id, puesto] of Object.entries(esperado)) {
    const consolas = CATALOGO_ANDAR.obtener(id).consolas;
    assert.equal(consolas.length, 1, `${id} debería tener una consola`);
    assert.equal(consolas[0].puesto, puesto);
  }
});

test("la zona de consola no pisa ninguna puerta de su sala", () => {
  // Si la consola cae sobre una puerta, acercarse a ella te cambiaría de sala en
  // vez de abrir el puesto.
  for (const [id, estancia] of todasLasEstancias()) {
    for (const consola of estancia.consolas) {
      const c = consola.rect;
      for (const puerta of estancia.puertas) {
        const p = puerta.rect;
        const solapa =
          c.x < p.x + p.ancho && p.x < c.x + c.ancho && c.z < p.z + p.profundidad && p.z < c.z + c.profundidad;
        assert.equal(solapa, false, `en ${id} la consola pisa una puerta`);
      }
    }
  }
});

test("el ancho de puerta deja pasar: no es un resquicio", () => {
  // Guarda de cordura sobre la constante: una puerta más estrecha que el propio
  // jugador es exactamente «te golpeas con el dintel».
  assert.ok(ANCHO_PUERTA >= 2, "una puerta de menos de dos metros no es una puerta");
});

test("ninguna consola cae encima del punto de entrada de su sala", () => {
  // Rescatado de `nave-catalogo-andar.test.mjs` al retirarlo con la geografía
  // inventada: acercarse a la consola tiene que ser un GESTO. Si la entrada ya
  // cae dentro de su zona, entrar en la sala abriría el puesto solo.
  for (const [id, estancia] of todasLasEstancias()) {
    for (const { rect } of estancia.consolas) {
      const dentro =
        estancia.entrada.x >= rect.x &&
        estancia.entrada.x <= rect.x + rect.ancho &&
        estancia.entrada.z >= rect.z &&
        estancia.entrada.z <= rect.z + rect.profundidad;
      assert.equal(dentro, false, `${id}: la entrada ya cae dentro de la zona de su consola`);
    }
  }
});

test("las salas de tránsito y la cantina no tienen consola: no son puesto", () => {
  for (const id of ["cantina", "acceso-cantina", "camarotes"]) {
    assert.deepEqual(CATALOGO_ANDAR.obtener(id).consolas, [], `${id} no debería tener consola`);
  }
});

test("toda sala del casco tiene ventana, y ninguna sala interior se la inventa", () => {
  // Generalización de #508: un muro sin vecino es casco, y el casco ve el
  // espacio. `reactor` está rodeado por los cuatro lados, así que es el control
  // negativo: si le saliera ventana, `ventanasAlExterior` estaría mirando mal.
  const conVentanaEsperada = ["maniobra", "impulso", "escudo-proa", "escudo-popa"];
  for (const id of conVentanaEsperada) {
    const sala = SALAS_PHOBOS.find((s) => s.id === id);
    assert.ok(sala, `${id} debería existir`);
  }
  assert.ok(true);
});
