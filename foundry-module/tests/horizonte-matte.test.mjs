// El matte painting del horizonte, por capas y prerenderizado (#584).

import assert from "node:assert/strict";
import test from "node:test";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  CAPAS,
  HUECO,
  centroDeCapa,
  derivaEn,
  mallaHorizonte,
  piezasHorizonte,
  pngDeTextura,
  rejillaHorizonte,
  texturaDePng,
  texturaDeRejilla,
  texturasHorizonte,
} from "../scripts/horizonte-matte.mjs";
import { ficherosHorizonte } from "../scripts/horizonte-preset.mjs";
import { codificarPngIndexado, decodificarPngIndexado } from "../scripts/png-indexado.mjs";
import { texturaUtilizable, muestrearTextura } from "../scripts/retro3d-lienzo.mjs";
import { componerPlaya } from "../scripts/playa-escena.mjs";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(AQUI, "..", "data", "horizonte");

/* ---- el multiplano --------------------------------------------------------- */

test("las capas van de lejos a cerca, y siguen menos a la cámara cuanto más cerca", () => {
  // Es LA invariante del multiplano: lo cercano se queda más atrás al andar, y
  // esa diferencia es la que el ojo lee como distancia. Si una capa cercana
  // siguiera más que una lejana, el horizonte se leería del revés.
  for (let i = 1; i < CAPAS.length; i += 1) {
    assert.ok(CAPAS[i].distancia < CAPAS[i - 1].distancia, "ordenadas de lejos a cerca");
    assert.ok(CAPAS[i].seguimiento <= CAPAS[i - 1].seguimiento, "lo cercano sigue menos");
    assert.ok(CAPAS[i].velocidad > CAPAS[i - 1].velocidad, "y cruza más rápido");
  }
});

test("la capa del fondo va clavada a la cámara: andar no la mueve", () => {
  const fondo = CAPAS[0];
  assert.equal(fondo.seguimiento, 1);
  assert.deepEqual(centroDeCapa([50, 0, 90], fondo.seguimiento), [50, 0, 90]);
});

test("una capa cercana se queda atrás al andar, y ahí está el relieve", () => {
  const cerca = CAPAS[CAPAS.length - 1];
  const centro = centroDeCapa([100, 0, 0], cerca.seguimiento);
  assert.ok(centro[0] < 100, "la capa cercana no acompaña del todo");
  assert.ok(centro[0] > 90, "pero tampoco se queda plantada: sigue siendo fondo");
});

test("el movimiento es LEVE: una vuelta entera tarda minutos", () => {
  // Un horizonte que se ve moverse se lee como un fondo que gira, no como
  // distancia. Es el único número de este módulo que si se sube, rompe el efecto.
  assert.ok(derivaEn(60) < 0.1, "en un minuto no debería haber cruzado ni un décimo");
  assert.equal(derivaEn(0), 0);
});

test("la deriva da la vuelta en vez de crecer sin fin", () => {
  assert.ok(derivaEn(100000) >= 0 && derivaEn(100000) < 1);
});

/* ---- la banda -------------------------------------------------------------- */

test("la banda cierra sobre sí misma y se mira desde dentro", () => {
  const { vertices, caras, uvs } = mallaHorizonte({ lados: 8 });
  assert.equal(caras.length, 8);
  assert.equal(uvs.length, caras.length, "las UV van paralelas a las caras, no a los vértices");
  // La primera y la última columna tienen que coincidir en el mundo, o el
  // horizonte tiene una costura.
  const primera = vertices[0];
  const ultima = vertices[vertices.length - 3];
  assert.ok(Math.abs(primera[0] - ultima[0]) < 1e-9);
  assert.ok(Math.abs(primera[2] - ultima[2]) < 1e-9);
});

test("la deriva mueve las UV y no la geometría", () => {
  const quieta = mallaHorizonte({ lados: 4, deriva: 0 });
  const movida = mallaHorizonte({ lados: 4, deriva: 0.25 });
  assert.deepEqual(quieta.vertices, movida.vertices, "no cuesta un vértice");
  assert.notDeepEqual(quieta.uvs, movida.uvs);
});

/* ---- la textura ------------------------------------------------------------ */

test("lo que no se pinta queda transparente, o no habría multiplano", () => {
  // Si las nubes de delante taparan con cielo opaco, las capas de detrás no se
  // verían y esto sería un telón con pasos extra.
  const texturas = texturasHorizonte();
  for (const nombre of ["nubes-altas", "nubes-bajas"]) {
    const huecos = [...texturas[nombre].indices].filter((i) => i === HUECO).length;
    const total = texturas[nombre].indices.length;
    assert.ok(huecos / total > 0.8, `${nombre} tapa demasiado: ${Math.round((huecos / total) * 100)}%`);
  }
});

test("el fondo del todo sí es opaco: detrás de él no hay nada", () => {
  const costa = texturaDeRejilla(rejillaHorizonte({ contenido: "costa" }));
  assert.ok(![...costa.indices].includes(HUECO));
});

test("las texturas son consumibles por el rasterizador tal cual", () => {
  for (const textura of Object.values(texturasHorizonte())) {
    assert.ok(texturaUtilizable(textura));
    // Y se pueden muestrear en los bordes sin salirse: la envoltura es lo que
    // permite que la banda dé la vuelta.
    assert.ok(Number.isInteger(muestrearTextura(textura, -0.3, 1.7)));
  }
});

test("la costa cierra la vuelta sin costura visible", () => {
  // Los armónicos son de la vuelta ENTERA, así que la última columna tiene que
  // empalmar con la primera. Una junta en el horizonte delata el truco de golpe.
  const rejilla = rejillaHorizonte({ contenido: "costa" });
  const altoDe = (u) => rejilla.filter((fila) => fila[u] !== null).length;
  assert.ok(Math.abs(altoDe(0) - altoDe(rejilla[0].length - 1)) <= 1);
});

/* ---- el prerenderizado ----------------------------------------------------- */

test("el PNG y la textura de runtime numeran distinto, y la conversión lo casa", () => {
  // Es el desajuste que muerde en silencio: el PNG reserva su entrada 0 para el
  // hueco y el rasterizador indexa la paleta desde 0.
  const textura = texturaDeRejilla(rejillaHorizonte({ contenido: "jirones" }));
  const vuelta = texturaDePng(decodificarPngIndexado(codificarPngIndexado(pngDeTextura(textura))));
  assert.equal(vuelta.ancho, textura.ancho);
  assert.equal(vuelta.alto, textura.alto);
  assert.deepEqual(vuelta.paleta, textura.paleta);
  assert.deepEqual([...vuelta.indices], [...textura.indices]);
});

test("el decodificador rechaza lo que no escribe este módulo", () => {
  assert.throws(() => decodificarPngIndexado(Uint8Array.from([1, 2, 3])), /firma/);
});

test("los PNG del árbol corresponden al generador de ahora (#584)", async () => {
  // La puerta de reproducibilidad: mismo generador, mismo byte. Un binario que
  // nadie puede regenerar es una deuda; uno verificado en cada CI, no.
  const ficheros = ficherosHorizonte();
  const enDisco = await readdir(DATA);
  assert.deepEqual(enDisco.sort(), [...ficheros.keys()].sort(), "ejecuta tools/prerender-horizonte.mjs");
  for (const [nombre, bytes] of ficheros) {
    const guardado = await readFile(path.join(DATA, nombre));
    assert.deepEqual(
      [...guardado],
      [...bytes],
      `${nombre} está desfasado: ejecuta tools/prerender-horizonte.mjs`,
    );
  }
});

test("el asset del árbol se lee de vuelta a la misma textura que se pinta", async () => {
  // Si esto se rompiera, el PNG versionado y lo que ve la mesa serían dos cosas
  // distintas — y el asset estaría documentando una escena que no existe.
  const capa = CAPAS[0];
  const guardado = await readFile(path.join(DATA, `${capa.nombre}.png`));
  const leida = texturaDePng(decodificarPngIndexado(new Uint8Array(guardado)));
  const generada = texturasHorizonte()[capa.nombre];
  assert.deepEqual([...leida.indices], [...generada.indices]);
  assert.deepEqual(leida.paleta, generada.paleta);
});

/* ---- en la escena ---------------------------------------------------------- */

test("la playa pinta el horizonte, y texturado", () => {
  const escena = componerPlaya(11.5, 0, 6, 0, { tiempo: 0 });
  const texturados = escena.poligonos.filter((p) => p.textura);
  assert.ok(texturados.length > 0, "el matte tiene que llegar al cuadro");
  assert.ok(texturados.every((p) => p.puntos.every((punto) => Number.isFinite(punto.u))));
});

test("el horizonte se pinta el primero: es el fondo del todo", () => {
  const piezas = piezasHorizonte({ camara: [0, 0, 0], segundos: 0 });
  assert.deepEqual(
    piezas.map((p) => p.nombre),
    CAPAS.map((c) => c.nombre),
  );
});

test("andar despega unas capas de otras (#584)", () => {
  // La prueba del multiplano: desde dos sitios distintos, las capas NO se
  // desplazan lo mismo. Si se desplazaran igual, sería una lámina.
  const desde = piezasHorizonte({ camara: [0, 0, 0], segundos: 0 });
  const hasta = piezasHorizonte({ camara: [200, 0, 0], segundos: 0 });
  const corrimiento = (a, b) => b.malla.vertices[0][0] - a.malla.vertices[0][0];
  const fondo = corrimiento(desde[0], hasta[0]);
  const cerca = corrimiento(desde[desde.length - 1], hasta[hasta.length - 1]);
  assert.ok(fondo > cerca, "la capa cercana tiene que quedarse atrás respecto a la lejana");
});
