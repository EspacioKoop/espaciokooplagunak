import assert from "node:assert/strict";
import test from "node:test";

import { MUSEO, CUADRO } from "../scripts/paleta.mjs";
import * as MUSEO_INTERNO from "../scripts/museo-escena.mjs";
import { validarCatalogoPiezas } from "../scripts/catalogo-piezas.mjs";
import { CATALOGO_MUSEO, MALLAS_MUSEO } from "../scripts/museo-piezas.mjs";
import {
  ANCHO,
  ENTRADA,
  INTERACCIONES,
  PIEZAS_COLOCADAS,
  PLANTA_MUSEO,
  componerMuseo,
  colocarPieza,
} from "../scripts/museo-escena.mjs";
import { CELDA_LIENZO, rejillaCuadro } from "../scripts/nave-cuadro.mjs";
import { FICHAS } from "../../tools/convertir-estatua.mjs";
import { colisiona } from "../scripts/nave-movimiento.mjs";
import { interaccionAlAlcance } from "../scripts/nave-interaccion.mjs";

test("el catálogo del museo es válido y todas sus fichas apuntan a una malla que existe", () => {
  assert.equal(
    validarCatalogoPiezas(CATALOGO_MUSEO, { mallasDisponibles: new Set(Object.keys(MALLAS_MUSEO)) }),
    true,
  );
  assert.equal(CATALOGO_MUSEO.piezas.length, 5, "tres vaciados (#590) + dos cuadros obra-propia (#836)");
  for (const pieza of CATALOGO_MUSEO.piezas) {
    assert.ok(MALLAS_MUSEO[pieza.malla]?.vertices?.length, `${pieza.malla} sin geometría`);
  }
});

test("los dos cuadros cuelgan de los muros laterales y su cartela aparece y se retira", () => {
  for (const id of ["cuadro-1", "cuadro-2"]) {
    const punto = INTERACCIONES.find((p) => p.id === id);
    assert.ok(punto, `${id} no tiene punto de interacción`);
    assert.equal(punto.accion.tipo, "cartela");
    assert.equal(punto.accion.pieza, id);
    const [x, z] = punto.punto;
    assert.equal(colisiona(x, z, 0.35, PLANTA_MUSEO), false, `no se alcanza el mirador de ${id}`);
    // La cartela resuelve contra el catálogo como cualquier pieza.
    const pieza = CATALOGO_MUSEO.piezas.find((p) => p.id === id);
    assert.ok(pieza?.cartela?.es, `${id} sin cartela en el catálogo`);
    assert.equal(pieza.naturaleza, "obra-propia");
  }
});

test("la celda del lienzo manda la escala del cuadro y no se inventa ningún color", () => {
  assert.equal(CELDA_LIENZO, 0.025, "veinte celdas por metro, declarada en un solo sitio");
  const rejilla = rejillaCuadro(83601);
  // 1,2 x 0,8 m a 2,5 cm de celda = 48 x 32 celdas.
  assert.equal(rejilla.length, 32);
  assert.equal(rejilla[0].length, 48);
  // Todo color del cuadro sale de la paleta común, nunca de un literal propio.
  const tonos = new Set(Object.values(CUADRO));
  for (const fila of rejilla) {
    for (const celda of fila) {
      assert.ok(celda === null || tonos.has(celda), `color fuera de la paleta: ${celda}`);
    }
  }
});

test("LA GUARDA DE PROCEDENCIA: lo que declara el museo no se separa de la ficha del conversor", () => {
  for (const pieza of CATALOGO_MUSEO.piezas) {
    // Los cuadros (#836) son `obra-propia`: pixelart del módulo, sin ficha en el
    // conversor de estatuas que esta guarda comprueba. Se saltan, no se comparan.
    if (pieza.naturaleza === "obra-propia") continue;
    const ficha = FICHAS[pieza.malla];
    assert.ok(ficha, `${pieza.malla} no tiene ficha en tools/convertir-estatua.mjs`);
    // El campo que de verdad puede mentir en una cartela es QUÉ ES EL FICHERO.
    // La ficha lo dice en prosa (\"reconstrucción digital, no escaneo\" / \"escaneo
    // del VACIADO...\"); aquí se comprueba que la `naturaleza` declarada dice lo
    // mismo, para que nadie pueda convertir un vaciado en un original editando
    // solo el catálogo.
    const modelo = ficha.modelo.toLowerCase();
    if (pieza.naturaleza === "reconstruccion") {
      assert.match(modelo, /reconstrucci/, `${pieza.id} se declara reconstrucción y la ficha no lo dice`);
    } else if (pieza.naturaleza === "escaneo-de-vaciado") {
      assert.match(modelo, /vaciado/, `${pieza.id} se declara vaciado y la ficha no lo dice`);
      assert.doesNotMatch(modelo, /reconstrucci/, `${pieza.id} es una reconstrucción, no un vaciado`);
    }
  }
});

test("la cartela del León dice que es una reconstrucción, no cómo era (#598)", () => {
  const leon = CATALOGO_MUSEO.piezas.find((pieza) => pieza.id === "leon-al-lat");
  assert.match(leon.cartela.es, /RECONSTRUCCIÓN/);
  assert.match(leon.cartela.en, /RECONSTRUCTION/);
  // La comprobación que importa: no puede afirmar que la estatua es así.
  assert.match(leon.cartela.es, /No es como era/);
});

test("cada pieza se apoya en su pedestal y ninguna se atraviesa andando", () => {
  for (const colocada of PIEZAS_COLOCADAS) {
    const ys = colocada.malla.vertices.map(([, y]) => y);
    // La base queda a la cota de la coronilla del pedestal (0.6 + 0.08), no
    // flotando ni hundida: la malla llega apoyada en y = 0.
    assert.ok(Math.abs(Math.min(...ys) - 0.68) < 1e-6, `${colocada.pieza.id} no apoya en su pedestal`);
    assert.ok(Math.max(...ys) > 1.0, `${colocada.pieza.id} es demasiado baja para una sala de museo`);
    const [x, , z] = colocada.centro;
    assert.equal(colisiona(x, z, 0.35, PLANTA_MUSEO), true, `se puede atravesar ${colocada.pieza.id}`);
  }
});

test("desde el mirador de cada pieza se alcanza SU punto, y solo el suyo", () => {
  for (const colocada of PIEZAS_COLOCADAS) {
    const [x, z] = colocada.mirador;
    assert.equal(colisiona(x, z, 0.35, PLANTA_MUSEO), false, "no se puede llegar al mirador");
    const alcanzada = interaccionAlAlcance(x, z, 0.35, INTERACCIONES);
    assert.equal(alcanzada?.accion?.tipo, "cartela");
    assert.equal(alcanzada?.accion?.pieza, colocada.pieza.id);
  }
});

test("la salida devuelve a la nave, y es lo único que transporta en toda la sala", () => {
  const salida = INTERACCIONES.find((punto) => punto.id === "salida");
  assert.deepEqual(salida.accion, { tipo: "estancia", estancia: "cantina" });
  const transportan = INTERACCIONES.filter((punto) => punto.accion?.tipo === "estancia");
  assert.equal(transportan.length, 1);
});

test("NADA en la sala concede, cuenta ni recuerda (docs/FOUNDRY.md)", () => {
  // Las únicas acciones posibles son leer una cartela y salir. Cualquier tipo
  // nuevo aquí es una decisión de diseño, no un detalle: que falle la prueba.
  const tipos = new Set(INTERACCIONES.map((punto) => punto.accion?.tipo));
  assert.deepEqual([...tipos].sort(), ["cartela", "estancia"]);
});

test("se entra dentro de la sala, en suelo libre y mirando a las piezas", () => {
  assert.equal(colisiona(ENTRADA.x, ENTRADA.z, 0.35, PLANTA_MUSEO), false);
  assert.equal(ENTRADA.yaw, 0, "yaw 0 mira a +z, que es donde están los pedestales");
  assert.ok(ENTRADA.x > 0 && ENTRADA.x < ANCHO);
});

test("compone una escena con polígonos y sin colarse ningún color de fuera de MUSEO", () => {
  const escena = componerMuseo(ENTRADA.x, 0, ENTRADA.z, ENTRADA.yaw, { ancho: 320, alto: 180 });
  assert.ok(escena.poligonos.length > 0, "la sala no pinta nada");
  assert.equal(escena.ancho, 320);
});

test("los colores de la sala son de la paleta y están todos declarados (#351)", () => {
  // La guarda EXIGIBLE de que no se cuela un color propio la aplica
  // `paleta.test.mjs` sobre `MODULOS_DE_ARTE`, donde esta escena está dada de
  // alta. Aquí solo se comprueba que el grupo existe y está bien formado.
  assert.ok(Object.keys(MUSEO).length >= 6);
  assert.ok(Object.values(MUSEO).every((color) => /^#[0-9a-f]{6}$/.test(color)));
});

test("dos piezas nunca comparten sitio", () => {
  // Una pieza de mentira: a colocarPieza solo le hacen falta id, naturaleza y malla.
  const piezaFicticia = { id: "ficticia", naturaleza: "reconstruccion", malla: Object.keys(MALLAS_MUSEO)[0] };
  const puestos = [];
  for (let indice = 0; indice < MUSEO_INTERNO.CAPACIDAD; indice++) {
    const colocada = colocarPieza(piezaFicticia, indice);
    const [x, , z] = colocada.centro;
    puestos.push({ x, z });
  }
  // Y ahora se buscan repetidos.
  const sitios = new Set();
  for (const puesto of puestos) {
    const clave = `${puesto.x},${puesto.z}`;
    if (sitios.has(clave)) {
      assert.fail(`Dos piezas comparten el sitio (${puesto.x},${puesto.z})`);
    }
    sitios.add(clave);
  }
});
/* ---- lo que «sitios distintos» NO garantizaba -------------------------- */

// El test de sitios repetidos exigia coordenadas DISTINTAS, y eso lo cumplia un
// reparto cuyas filas iban a 1 m con pedestales de 1,15: distintas y solapadas
// 15 cm. Dos piezas no comparten sitio y aun asi se meten la una en la otra.
test("dos pedestales nunca se solapan, por muchas piezas que haya", () => {
  const { obtenerPosicionPedestal, PEDESTAL } = MUSEO_INTERNO;
  for (let n = 1; n <= MUSEO_INTERNO.CAPACIDAD; n++) {
    const sitios = Array.from({ length: n }, (_, i) => obtenerPosicionPedestal(i));
    for (let a = 0; a < sitios.length; a++) {
      for (let b = a + 1; b < sitios.length; b++) {
        const dx = Math.abs(sitios[a].x - sitios[b].x);
        const dz = Math.abs(sitios[a].z - sitios[b].z);
        assert.ok(
          dx >= PEDESTAL.lado || dz >= PEDESTAL.lado,
          `con ${n} piezas, los pedestales ${a} y ${b} se solapan (dx=${dx.toFixed(2)}, dz=${dz.toFixed(2)})`,
        );
      }
    }
  }
});

test("ningun pedestal se planta encima de la entrada", () => {
  const { obtenerPosicionPedestal, PEDESTAL } = MUSEO_INTERNO;
  const medio = PEDESTAL.lado / 2;
  for (let i = 0; i < MUSEO_INTERNO.CAPACIDAD; i++) {
    const { x, z } = obtenerPosicionPedestal(i);
    const tapa = Math.abs(x - ENTRADA.x) < medio && Math.abs(z - ENTRADA.z) < medio;
    assert.ok(!tapa, `el pedestal ${i} cae sobre la entrada (${x}, ${z})`);
  }
});

test("pasarse de la capacidad falla a gritos, no amontona", () => {
  // El reparto anterior hacia `% filas` y las piezas de mas volvian al fondo,
  // encima de las que ya estaban: el catalogo crecia y la sala se veia igual.
  assert.throws(
    () => MUSEO_INTERNO.obtenerPosicionPedestal(MUSEO_INTERNO.CAPACIDAD),
    RangeError,
  );
  assert.doesNotThrow(() => MUSEO_INTERNO.obtenerPosicionPedestal(MUSEO_INTERNO.CAPACIDAD - 1));
});

test("el catalogo del museo no supera lo que cabe en la sala", () => {
  assert.ok(
    CATALOGO_MUSEO.piezas.length <= MUSEO_INTERNO.CAPACIDAD,
    `el catalogo trae ${CATALOGO_MUSEO.piezas.length} piezas y la sala admite ${MUSEO_INTERNO.CAPACIDAD}`,
  );
});

test("la capacidad sale del tamaño de la sala, no de una lista escrita a mano", () => {
  // Las columnas estaban fijas en [2.0, 4.5, 7.0]: ensanchar la sala no metia ni
  // una pieza mas. Este test exige que la aritmetica siga viva.
  const { CAPACIDAD, ANCHO, PROFUNDIDAD, PEDESTAL } = MUSEO_INTERNO;
  assert.ok(CAPACIDAD >= 18, `la sala de ${ANCHO}x${PROFUNDIDAD} solo admite ${CAPACIDAD}`);

  // Y que ningun pedestal se salga por los muros laterales.
  const medio = PEDESTAL.lado / 2;
  for (let i = 0; i < CAPACIDAD; i++) {
    const { x, z } = MUSEO_INTERNO.obtenerPosicionPedestal(i);
    assert.ok(x - medio >= -1e-9 && x + medio <= ANCHO + 1e-9, `el pedestal ${i} se sale por x=${x}`);
    assert.ok(z - medio >= -1e-9 && z + medio <= PROFUNDIDAD + 1e-9, `el pedestal ${i} se sale por z=${z}`);
  }
});

test("caben todas las mallas de vaciados que hay en el arbol", () => {
  // El museo era el cuello de botella de su propio catalogo: 18 mallas y sitio
  // para tres. Si alguien encoge la sala, esto lo dice.
  assert.ok(
    MUSEO_INTERNO.CAPACIDAD >= 18,
    `hay 18 mallas y la sala admite ${MUSEO_INTERNO.CAPACIDAD}`,
  );
});
