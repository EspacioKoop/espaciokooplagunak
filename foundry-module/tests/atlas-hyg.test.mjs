// El adaptador de HYG al formato de atlas (#568, sobre el formato de #213).
//
// La prueba que de verdad importa es la última: que lo que sale de aquí lo
// acepta `validateCosmography` sin tocarlo. Todo lo demás son las formas en que
// unos datos reales rompen un importador escrito contra un ejemplo bonito.

import assert from "node:assert/strict";
import test from "node:test";

import { atlasDesdeHyg, idDesdeNombre, partirLineaCsv } from "../scripts/atlas-hyg.mjs";
import { validateCosmography } from "../scripts/catalogo-cosmografico.mjs";

/** Un CSV mínimo con la forma real de HYG: cabecera por nombre y filas sueltas
 * sin nombre propio, que son la inmensa mayoría del catálogo. */
const CSV = [
  "id,hip,proper,ra,dec,dist,mag,absmag,spect,ci",
  "0,,Sol,0,0,0.0000,-26.7,4.85,G2V,0.656",
  "70666,71683,Rigil Kentaurus,14.66,-60.83,1.3248,-0.01,4.38,G2V,0.71",
  "32263,32349,Sirius,6.75,-16.71,2.6371,-1.44,1.45,A1Vm,0.009",
  "24378,24436,Rigel,5.24,-8.20,236.9668,0.18,-6.69,B8Ia,-0.03",
  "1,,,0.1,0.2,10.0,9.1,5.0,K0,0.5",
  "2,,,0.3,0.4,100000.0000,11.0,6.0,M0,1.5",
].join("\n");

test("solo entran las estrellas con nombre propio de la IAU", () => {
  const atlas = atlasDesdeHyg(CSV);
  const sistemas = atlas.entries.filter((e) => e.type === "star_system");
  assert.equal(sistemas.length, 4, "las filas sin nombre propio no son un sistema nombrable");
  assert.deepEqual(
    sistemas.map((e) => e.name.es),
    ["Sol", "Sirius", "Rigil Kentaurus", "Rigel"],
    // El Sol sale primero y no es un fallo de orden: HYG lo trae como fila 0 y
    // su magnitud aparente es -26,7. Visto desde aquí, claro que es la estrella
    // más brillante del catálogo.
    "el orden es por brillo: la magnitud menor es la más brillante",
  );
});

test("hay un plano raíz y todo sistema cuelga de él", () => {
  // El formato exige que un `star_system` tenga un padre de tipo `plane`, y el
  // cielo real no viene con uno puesto: lo pone el adaptador.
  const atlas = atlasDesdeHyg(CSV);
  const planos = atlas.entries.filter((e) => e.type === "plane");
  assert.equal(planos.length, 1);
  for (const sistema of atlas.entries.filter((e) => e.type === "star_system")) {
    assert.equal(sistema.parent_id, planos[0].id);
  }
});

test("cada estrella viaja con su licencia y su fuente, que es cómo se atribuye", () => {
  // CC BY-SA obliga a atribuir. El formato guarda procedencia POR ENTRADA, así
  // que la atribución viaja con el dato en vez de en un README que se pierde.
  const atlas = atlasDesdeHyg(CSV);
  for (const sistema of atlas.entries.filter((e) => e.type === "star_system")) {
    assert.equal(sistema.provenance.kind, "cc");
    assert.equal(sistema.provenance.license, "CC BY-SA-4.0");
    assert.match(sistema.provenance.source_url, /^https:\/\//u);
  }
  // El plano raíz NO es de HYG y no puede decir que lo sea.
  const plano = atlas.entries.find((e) => e.type === "plane");
  assert.equal(plano.provenance.kind, "original");
});

test("el resumen sale de los datos, y lo que falta no se inventa", () => {
  const atlas = atlasDesdeHyg(CSV);
  const rigel = atlas.entries.find((e) => e.name.es === "Rigel");
  assert.match(rigel.summary.es, /Tipo espectral B8Ia/u);
  assert.match(rigel.summary.es, /años luz/u);
  assert.match(rigel.summary.en, /Spectral type B8Ia/u);

  // Distancia desconocida (el 100000 de HYG) y sin nombre: ni se menciona ni se
  // convierte en «a 326156 años luz», que es lo que pasa si se toma tal cual.
  const soloSinDistancia = atlasDesdeHyg(
    ["id,proper,dist,mag,spect", "9,Lejana,100000.0000,4.0,K0"].join("\n"),
  );
  const lejana = soloSinDistancia.entries.find((e) => e.name.es === "Lejana");
  assert.doesNotMatch(lejana.summary.es, /años luz/u);
  assert.match(lejana.summary.es, /Tipo espectral K0/u);
});

test("las columnas se leen por nombre, no por posición", () => {
  // HYG ha cambiado de orden de columnas entre versiones. Leer por índice es
  // cómo un importador se rompe en silencio con la versión siguiente.
  const revuelto = ["spect,mag,proper,dist,id", "G2V,-1.44,Sirius,2.6371,32263"].join("\n");
  const atlas = atlasDesdeHyg(revuelto);
  const sirius = atlas.entries.find((e) => e.name.es === "Sirius");
  assert.match(sirius.summary.es, /Tipo espectral G2V/u);
  assert.match(sirius.summary.es, /magnitud aparente -1\.44/u);
});

test("el CSV se parte respetando las comillas", () => {
  assert.deepEqual(partirLineaCsv('1,"Alfa, la primera",3'), ["1", "Alfa, la primera", "3"]);
  assert.deepEqual(partirLineaCsv('1,"dice ""hola""",3'), ["1", 'dice "hola"', "3"]);
  // Sin esto, una coma dentro de un campo desplaza TODAS las columnas
  // siguientes: no falla, solo mete cada dato en la casilla de al lado.
  const conComa = ['id,proper,dist,mag,spect', '1,"Alfa, la primera",1.0,2.0,G2V'].join("\n");
  const atlas = atlasDesdeHyg(conComa);
  assert.match(atlas.entries.at(-1).summary.es, /Tipo espectral G2V/u);
});

test("los nombres se vuelven IDs portables, y los choques se desempatan", () => {
  assert.equal(idDesdeNombre("Rigil Kentaurus"), "rigil-kentaurus");
  assert.equal(idDesdeNombre("Beid"), "beid");
  assert.equal(idDesdeNombre("Zubeneschamali"), "zubeneschamali");
  // Acentos: se normalizan en vez de desaparecer con el resto del nombre.
  assert.equal(idDesdeNombre("Ánimo"), "animo");
  assert.equal(idDesdeNombre("!!!"), null, "un nombre sin nada utilizable no da ID");

  const choque = [
    "id,proper,dist,mag,spect",
    "1,Alpha Centauri,1.0,1.0,G2V",
    "2,alpha-centauri,1.0,2.0,K0",
  ].join("\n");
  const atlas = atlasDesdeHyg(choque);
  const ids = atlas.entries.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length, "un ID duplicado invalida el catálogo entero");
});

test("entrada rota o vacía devuelve un catálogo válido, no una excepción", () => {
  for (const entrada of [null, undefined, "", "solo-cabecera,sin,filas", "sin,columna,de,nombre"]) {
    const atlas = atlasDesdeHyg(entrada);
    assert.equal(atlas.entries.length, 1, "queda el plano raíz y nada más");
    assert.equal(validateCosmography(atlas), true);
  }
});

test("el tope respeta el límite del formato y se puede bajar", () => {
  const atlas = atlasDesdeHyg(CSV, { maximo: 2 });
  assert.equal(atlas.entries.filter((e) => e.type === "star_system").length, 2);
  // Y son las dos más brillantes, no las dos primeras del fichero.
  assert.deepEqual(
    atlas.entries.filter((e) => e.type === "star_system").map((e) => e.name.es),
    ["Sol", "Sirius"],
  );
});

test("lo que sale del adaptador lo acepta el validador del formato", () => {
  // LA PRUEBA QUE IMPORTA. El adaptador no importa el validador a propósito
  // —acoplarlos obligaría a pagar la validación en cada importación—, así que el
  // contrato entre los dos se comprueba aquí o no se comprueba en ninguna parte.
  assert.equal(validateCosmography(atlasDesdeHyg(CSV)), true);
  assert.equal(validateCosmography(atlasDesdeHyg(CSV, { maximo: 1 })), true);
});
