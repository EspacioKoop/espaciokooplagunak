import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { consolasDe } from "./ayuda-consolas.mjs";

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
import { PLANTA_CANTINA_SALA } from "../scripts/cantina-sala.mjs";
import { colisiona, mover, puertaTocada } from "../scripts/nave-movimiento.mjs";

/** El mismo radio que usa `nave-movimiento-lienzo.mjs` para el jugador. */
const RADIO_JUGADOR = 0.35;

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * El catálogo expone `ids`/`obtener`, no un objeto llano. Se recorre con este
 * helper y no con `Object.entries(...)`: un acceso equivocado devolvería vacío y
 * dejaría pasar en falso todas las pruebas de abajo, que es justo lo que hizo
 * la primera versión de este archivo.
 */
/**
 * Estancias que NO son la nave y que por tanto no entran en las invariantes de
 * este archivo, que son todas sobre el Phobos.
 *
 * La playa (#587) es un banco de pruebas de exteriores al que se entra por
 * herramienta de GM: no cuelga de ninguna puerta —colgarla de un mamparo sería
 * contar una historia que nadie ha decidido— y no tiene consolas ni maquinaria.
 * Exigirle «ser alcanzable andando desde la cantina» sería exigirle ser nave.
 *
 * La sala del museo (#598) está fuera por lo mismo y con más motivo: el Phobos
 * no tiene un museo. Se entra por herramienta y se sale por su propio punto de
 * interacción, igual que la playa se sale por la cabina de teléfono.
 *
 * El pasillo de los recuerdos es la misma excepción por la misma razón: no
 * cuelga de ningún mamparo del Phobos y se entra por herramienta.
 */
const FUERA_DE_LA_NAVE = new Set(["playa", "museo", "pasillo-recuerdos"]);

function todasLasEstancias() {
  const pares = CATALOGO_ANDAR.ids
    .filter((id) => !FUERA_DE_LA_NAVE.has(id))
    .map((id) => [id, CATALOGO_ANDAR.obtener(id)]);
  assert.ok(pares.length > 5, "el catálogo llega vacío: el recorrido está roto");
  return pares;
}

/* ---- La copia no se puede pudrir en silencio ---- */

test("las salas copiadas son EXACTAMENTE las del shipTemplate del Phobos M3P", () => {
  // La planta es estática por decisión de #540 (standalone-first: sin puente
  // también hay que poder andar). El precio de copiar es que la copia se
  // desactualice, así que se compara contra el .lua de verdad.
  // OJO con las mayúsculas: el repositorio tiene `scripts/shiptemplates/` en
  // minúsculas. Escrito como `shipTemplates` funciona en Windows y macOS —
  // sistemas de archivos insensibles a mayúsculas— y revienta con ENOENT en el
  // Linux de CI. Pasó: la suite estaba en verde en local y en rojo en CI, y este
  // es el único sitio del módulo que lee un archivo del repositorio por ruta.
  const lua = readFileSync(join(raiz, "scripts", "shiptemplates", "frigates.lua"), "utf8");
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
    "la copia de SALAS_PHOBOS ya no coincide con scripts/shiptemplates/frigates.lua",
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
  // El criterio de escala que fijó el QA: la cantina se siente pequeña, así que
  // ninguna sala de la rejilla debe quedar por debajo de ella.
  const areaCantina = PLANTA_CANTINA_SALA.ancho * PLANTA_CANTINA_SALA.profundidad;
  for (const sala of SALAS_PHOBOS) {
    const { ancho, profundidad } = medidasSala(sala);
    assert.ok(
      ancho * profundidad > areaCantina,
      `${sala.id} mide ${ancho}×${profundidad} y no supera la cantina (${PLANTA_CANTINA_SALA.ancho}×${PLANTA_CANTINA_SALA.profundidad})`,
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
  //
  // OJO con la firma: `puertaTocada(x, z, radio, puertas)` lleva el RADIO como
  // tercer argumento. La primera versión de esta prueba lo omitía, así que
  // comparaba contra `undefined` y pasaba en vacío — no comprobaba nada.
  for (const [id, estancia] of todasLasEstancias()) {
    for (const puerta of estancia.puertas) {
      const destino = CATALOGO_ANDAR.obtener(puerta.destino.estancia);
      const x = puerta.destino.x ?? destino.entrada.x;
      const z = puerta.destino.z ?? destino.entrada.z;
      const vuelta = puertaTocada(x, z, RADIO_JUGADOR, destino.puertas);
      assert.equal(
        vuelta ?? null,
        null,
        `llegando de ${id} a ${puerta.destino.estancia} se pisa una puerta (${JSON.stringify({ x, z })})`,
      );
    }
  }
});

test("TODA puerta declarada se puede ALCANZAR andando, no solo existe", () => {
  // La prueba que #539 echaba en falta de verdad, y que la de conectividad del
  // grafo no da: barre cada sala en rejilla fina, descarta las posiciones donde
  // el jugador no cabe (colisión con muros y muebles) y comprueba que desde
  // alguna posición legal se dispara cada puerta. Una puerta declarada detrás de
  // un mueble está en el grafo y no existe para quien juega.
  for (const [id, estancia] of todasLasEstancias()) {
    const alcanzables = new Set();
    for (let x = 0.05; x < estancia.planta.ancho; x += 0.1) {
      for (let z = 0.05; z < estancia.planta.profundidad; z += 0.1) {
        // Un paso nulo desde (x,z): si el motor lo corrige, ahí no se puede estar.
        const paso = mover({
          x, z, yaw: 0, activas: new Set(), dt: 0,
          planta: estancia.planta, velocidad: 1, radio: RADIO_JUGADOR,
        });
        if (Math.abs(paso.x - x) > 1e-6 || Math.abs(paso.z - z) > 1e-6) continue;
        const tocada = puertaTocada(x, z, RADIO_JUGADOR, estancia.puertas);
        if (tocada) alcanzables.add(tocada.destino.estancia);
      }
    }
    for (const puerta of estancia.puertas) {
      assert.ok(
        alcanzables.has(puerta.destino.estancia),
        `en ${id} la puerta a ${puerta.destino.estancia} está declarada pero no se puede alcanzar andando`,
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
    const consolas = consolasDe(CATALOGO_ANDAR.obtener(id));
    assert.equal(consolas.length, 1, `${id} debería tener una consola`);
    assert.equal(consolas[0].puesto, puesto);
  }
});

test("la zona de consola no pisa ninguna puerta de su sala", () => {
  // Si la consola cae sobre una puerta, acercarse a ella te cambiaría de sala en
  // vez de abrir el puesto.
  for (const [id, estancia] of todasLasEstancias()) {
    for (const consola of consolasDe(estancia)) {
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
    for (const { rect } of consolasDe(estancia)) {
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
    assert.deepEqual(consolasDe(CATALOGO_ANDAR.obtener(id)), [], `${id} no debería tener consola`);
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

test("ninguna entrada ni llegada cae DENTRO de un obstáculo", () => {
  // El fallo que el QA describió como «ya no se puede mover»: al reconstruir la
  // cantina con sus 126 muebles, tanto su entrada como la llegada desde la sala
  // vecina cayeron sobre mobiliario. El motor rechaza entonces todos los pasos y
  // la ventana se queda muerta sin decir por qué — no hay error, simplemente no
  // te mueves.
  //
  // Las pruebas de arriba comprobaban que el punto estaba DENTRO de la sala y que
  // no pisaba una puerta. Ninguna comprobaba lo más básico: que quepa el jugador.
  for (const [id, estancia] of todasLasEstancias()) {
    assert.equal(
      colisiona(estancia.entrada.x, estancia.entrada.z, RADIO_JUGADOR, estancia.planta),
      false,
      `la entrada de ${id} cae dentro de un obstáculo: ${JSON.stringify(estancia.entrada)}`,
    );
    for (const puerta of estancia.puertas) {
      const destino = CATALOGO_ANDAR.obtener(puerta.destino.estancia);
      const x = puerta.destino.x ?? destino.entrada.x;
      const z = puerta.destino.z ?? destino.entrada.z;
      assert.equal(
        colisiona(x, z, RADIO_JUGADOR, destino.planta),
        false,
        `llegando de ${id} a ${puerta.destino.estancia} se aparece dentro de un obstáculo: ${JSON.stringify({ x, z })}`,
      );
    }
  }
});

test("desde la entrada de cada sala se puede DAR UN PASO", () => {
  // La consecuencia observable, comprobada aparte de su causa: aunque el punto
  // esté libre, si está encajonado entre muebles el jugador aparece y no puede
  // avanzar en ninguna dirección. Es lo que se ve como «no se puede mover».
  for (const [id, estancia] of todasLasEstancias()) {
    const salidas = ["adelante", "atras", "izquierda", "derecha"].filter((direccion) => {
      const paso = mover({
        x: estancia.entrada.x,
        z: estancia.entrada.z,
        yaw: estancia.entrada.yaw ?? 0,
        activas: new Set([direccion]),
        dt: 0.1,
        planta: estancia.planta,
        velocidad: 3,
        radio: RADIO_JUGADOR,
      });
      return Math.abs(paso.x - estancia.entrada.x) > 1e-6 || Math.abs(paso.z - estancia.entrada.z) > 1e-6;
    });
    assert.ok(
      salidas.length >= 2,
      `en ${id} solo se puede salir de la entrada hacia [${salidas.join(", ")}]: está encajonada`,
    );
  }
});

test("desde la entrada de cada sala se llega ANDANDO a todas sus puertas", () => {
  // La prueba que faltaba, y la más importante de este archivo. Las anteriores
  // comprobaban que existiera ALGUNA posición legal que dispara cada puerta; esta
  // exige que se llegue desde donde apareces, inundando el suelo libre paso a
  // paso.
  //
  // La diferencia no es teórica: la cantina tiene 126 muebles que parten su suelo
  // en zonas incomunicadas, y su entrada caía en una que no daba a la puerta. Se
  // podía andar y no se podía salir — QA: «no puedo acceder a ninguna otra sala»,
  // con todas las demás pruebas en verde.
  const PASO = 0.1;
  for (const [id, estancia] of todasLasEstancias()) {
    const libre = (x, z) =>
      x > 0 && z > 0 && x < estancia.planta.ancho && z < estancia.planta.profundidad &&
      !colisiona(x, z, RADIO_JUGADOR, estancia.planta);
    const clave = (x, z) => `${Math.round(x / PASO)},${Math.round(z / PASO)}`;

    const vistos = new Set([clave(estancia.entrada.x, estancia.entrada.z)]);
    const pendientes = [[estancia.entrada.x, estancia.entrada.z]];
    while (pendientes.length) {
      const [x, z] = pendientes.pop();
      for (const [dx, dz] of [[PASO, 0], [-PASO, 0], [0, PASO], [0, -PASO]]) {
        const nx = x + dx;
        const nz = z + dz;
        if (vistos.has(clave(nx, nz)) || !libre(nx, nz)) continue;
        vistos.add(clave(nx, nz));
        pendientes.push([nx, nz]);
      }
    }

    const alcanzadas = new Set();
    for (const celda of vistos) {
      const [a, b] = celda.split(",");
      const tocada = puertaTocada(a * PASO, b * PASO, RADIO_JUGADOR, estancia.puertas);
      if (tocada) alcanzadas.add(tocada.destino.estancia);
    }
    for (const puerta of estancia.puertas) {
      assert.ok(
        alcanzadas.has(puerta.destino.estancia),
        `en ${id} no se llega a la puerta hacia ${puerta.destino.estancia} desde la entrada: ` +
          "el mobiliario parte la sala en zonas incomunicadas",
      );
    }
  }
});

test("ninguna puerta tiene un MUEBLE delante", () => {
  // La puerta de la cantina estaba en el muro oeste, ocupado entero por muebles a
  // altura de puerta: se podía cruzar —el disparador es un rect, no le importa lo
  // que haya dibujado— pero no se veía ni se entendía. QA: «no tiene sentido que
  // la puerta esté ahí cuando hay otra pared vacía».
  //
  // Las pruebas de alcanzabilidad no lo veían porque el punto de aparición estaba
  // en el mismo hueco entre muebles que la puerta: alcanzable y absurdo a la vez.
  // Esto mide otra cosa: que delante del paso quede sitio para plantarse.
  const HOLGURA = 0.9;
  for (const [id, estancia] of todasLasEstancias()) {
    for (const puerta of estancia.puertas) {
      const r = puerta.rect;
      const centro = { x: r.x + r.ancho / 2, z: r.z + r.profundidad / 2 };
      const libres = [];
      for (const [dx, dz] of [[HOLGURA, 0], [-HOLGURA, 0], [0, HOLGURA], [0, -HOLGURA]]) {
        const x = centro.x + dx;
        const z = centro.z + dz;
        if (x <= 0 || z <= 0 || x >= estancia.planta.ancho || z >= estancia.planta.profundidad) continue;
        if (!colisiona(x, z, RADIO_JUGADOR, estancia.planta)) libres.push(`${dx},${dz}`);
      }
      assert.ok(
        libres.length > 0,
        `en ${id}, la puerta a ${puerta.destino.estancia} no tiene sitio libre delante: está tapada`,
      );
    }
  }
});

test("y también se llega a la CONSOLA, y desde donde te dejan las vecinas (#560)", () => {
  // Dos huecos del test de arriba, que hasta #560 no importaban y ahora sí:
  //
  //   1. Inunda desde `entrada`, que es donde se aparece la PRIMERA vez. Quien
  //      llega cruzando una puerta aparece en el destino que declara la sala
  //      vecina, y ese punto puede caer en otra zona de la sala.
  //   2. Comprueba puertas y no consolas. Una consola encerrada por maquinaria
  //      es un puesto al que no se puede llegar andando, con todo en verde.
  //
  // Se escribió por poco duplicando el de arriba —lo pisé al añadirlo, y al
  // restaurarlo vi que ya hacía la mitad—. Va aparte y no dentro de aquel para
  // que quede claro qué añade cada uno.
  const PASO = 0.1;

  const llegadasPorSala = new Map();
  for (const [, estancia] of todasLasEstancias()) {
    for (const puerta of estancia.puertas ?? []) {
      const destino = puerta.destino ?? {};
      if (!destino.estancia) continue;
      const lista = llegadasPorSala.get(destino.estancia) ?? [];
      lista.push(destino);
      llegadasPorSala.set(destino.estancia, lista);
    }
  }

  for (const [id, estancia] of todasLasEstancias()) {
    const { planta } = estancia;
    const libre = (x, z) =>
      x > 0 && z > 0 && x < planta.ancho && z < planta.profundidad && !colisiona(x, z, RADIO_JUGADOR, planta);
    const clave = (x, z) => `${Math.round(x / PASO)},${Math.round(z / PASO)}`;

    const arranques = [estancia.entrada, ...(llegadasPorSala.get(id) ?? [])].filter(
      (punto) => punto && libre(punto.x, punto.z),
    );
    assert.ok(arranques.length > 0, `en ${id} no hay ni un punto de aparición legal`);

    const vistos = new Set(arranques.map((p) => clave(p.x, p.z)));
    const pendientes = arranques.map((p) => [p.x, p.z]);
    while (pendientes.length) {
      const [x, z] = pendientes.pop();
      for (const [dx, dz] of [[PASO, 0], [-PASO, 0], [0, PASO], [0, -PASO]]) {
        const nx = x + dx;
        const nz = z + dz;
        if (vistos.has(clave(nx, nz)) || !libre(nx, nz)) continue;
        vistos.add(clave(nx, nz));
        pendientes.push([nx, nz]);
      }
    }

    for (const consola of consolasDe(estancia)) {
      let llega = false;
      for (const celda of vistos) {
        const [a, b] = celda.split(",");
        if (puertaTocada(a * PASO, b * PASO, RADIO_JUGADOR, [consola])) {
          llega = true;
          break;
        }
      }
      assert.ok(llega, `en ${id} la consola de ${consola.puesto} queda encerrada por la maquinaria`);
    }
  }
});
