import assert from "node:assert/strict";
import test from "node:test";

import { MUSEO } from "../scripts/paleta.mjs";
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
import { FICHAS } from "../../tools/convertir-estatua.mjs";
import { colisiona } from "../scripts/nave-movimiento.mjs";
import { interaccionAlAlcance } from "../scripts/nave-interaccion.mjs";

test("una pieza real del museo con rig atraviesa colocarPieza y sale deformada (#603 fase 4)", () => {
  // Ninguna pieza del catálogo declara rig todavía (nada real que doblar), así
  // que la única forma de probar el camino completo
  // CATALOGO_MUSEO -> museo-escena -> estatua-rig -> componerEscena
  // es una pieza sintética con la MISMA malla real (venus-de-milo) y un rig
  // trivial: un solo hueso raíz que carga el 100% del peso de cada vértice.
  const malla = MALLAS_MUSEO["venus-de-milo"];
  const rig = [{ id: "raiz", cabeza: [0, 0, 0] }];
  const pesos = malla.vertices.map(() => [{ hueso: "raiz", peso: 1 }]);

  const piezaSinRig = { ...CATALOGO_MUSEO.piezas[0], malla: "venus-de-milo" };
  const piezaConRig = {
    ...piezaSinRig,
    rig: { rig, pesos, pose: { raiz: { eje: [0, 0, 1], angulo: Math.PI / 4 } } },
  };

  const sinRig = colocarPieza(piezaSinRig, 0);
  const conRig = colocarPieza(piezaConRig, 0);

  // Mismo número de vértices y misma topología: deformar no puede tocar la
  // malla en sí, solo su pose.
  assert.equal(conRig.malla.vertices.length, sinRig.malla.vertices.length);
  assert.deepEqual(conRig.malla.caras, sinRig.malla.caras);

  // Con un giro de verdad en el hueso raíz, al menos un vértice tiene que
  // haberse movido respecto a la pieza sin rig — si no, colocarPieza no llegó
  // a llamar a deformarPieza de verdad, o la llamó con una pose vacía.
  const algunoSeMovio = conRig.malla.vertices.some((v, i) => {
    const original = sinRig.malla.vertices[i];
    return v.some((coord, eje) => Math.abs(coord - original[eje]) > 1e-6);
  });
  assert.ok(algunoSeMovio, "la pieza con rig salió idéntica a la pieza sin rig");
  assert.ok(
    conRig.malla.vertices.every((v) => v.every(Number.isFinite)),
    "la pieza deformada tiene coordenadas no finitas",
  );
});

test("el catálogo del museo es válido y todas sus fichas apuntan a una malla que existe", () => {
  assert.equal(
    validarCatalogoPiezas(CATALOGO_MUSEO, { mallasDisponibles: new Set(Object.keys(MALLAS_MUSEO)) }),
    true,
  );
  assert.equal(CATALOGO_MUSEO.piezas.length, 18, "dieciocho piezas, la capacidad de la sala");
  for (const pieza of CATALOGO_MUSEO.piezas) {
    assert.ok(MALLAS_MUSEO[pieza.malla]?.vertices?.length, `${pieza.malla} sin geometría`);
  }
});

test("LA GUARDA DE PROCEDENCIA: lo que declara el museo no se separa de la ficha del conversor", () => {
  for (const pieza of CATALOGO_MUSEO.piezas) {
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
    // ESTA GARANTÍA NO SE QUITA (#757). `interaccionAlAlcance` responde
    // igual desde dentro de un obstáculo, así que sin comprobar antes que el
    // mirador es PISABLE la prueba da falso verde: la cartela «se alcanza»
    // desde un punto donde nadie puede ponerse. Con 18 piezas fallaba en 12.
    assert.equal(colisiona(x, z, 0.35, PLANTA_MUSEO), false,
      `no se puede llegar al mirador de ${colocada.pieza.id}`);
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

test("el mirador de una pieza queda libre también de la propia pieza, no solo del pedestal", () => {
  // El caballo ecuestre mide 2,64 m de fondo sobre una base de 1,15: vuela más
  // de un metro por delante y por detrás. Las mallas no se reescalan en la
  // escena a propósito, así que la sala tiene que contar con ellas. Sin esto,
  // quien mirase el caballo quedaba dentro del caballo.
  const hondas = PIEZAS_COLOCADAS.filter((c) => c.medidas[2] > 1.15);
  assert.ok(hondas.length > 0, "el catálogo debe tener alguna pieza más honda que su pedestal");
  for (const colocada of hondas) {
    const [x, z] = colocada.mirador;
    assert.equal(colisiona(x, z, 0.35, PLANTA_MUSEO), false, `${colocada.pieza.id}`);
  }
});

test("las piezas más hondas van a la fila de delante, que es la única con suelo libre delante", () => {
  // Regla, no excepción con un nombre dentro. Lo que hay delante de cualquier
  // otra fila es el pedestal de la siguiente.
  const porZ = [...PIEZAS_COLOCADAS].sort((a, b) => a.centro[2] - b.centro[2]);
  const filaDelantera = porZ.filter((c) => Math.abs(c.centro[2] - porZ[0].centro[2]) < 0.01);
  const masHonda = [...PIEZAS_COLOCADAS].sort((a, b) => b.medidas[2] - a.medidas[2])[0];
  assert.ok(
    filaDelantera.some((c) => c.pieza.id === masHonda.pieza.id),
    `${masHonda.pieza.id} es la más honda y debería ir en la fila de delante`,
  );
});

test("las 18 piezas se alcanzan ANDANDO desde la entrada, no solo por tener el mirador libre", () => {
  // Un mirador pisable puede seguir estando en una bolsa cerrada por pedestales.
  // Esto es lo que de verdad significa «la escena es jugable»: inundación por
  // la rejilla desde ENTRADA, con el mismo radio de cuerpo y el mismo
  // `colisiona` que usa el motor.
  const paso = 0.05;
  const clave = (x, z) => `${Math.round(x / paso)},${Math.round(z / paso)}`;
  const inicio = [ENTRADA.x, ENTRADA.z];
  assert.equal(colisiona(inicio[0], inicio[1], 0.35, PLANTA_MUSEO), false, "la entrada es pisable");

  const vistos = new Set([clave(...inicio)]);
  const cola = [inicio];
  while (cola.length) {
    const [cx, cz] = cola.pop();
    for (const [dx, dz] of [[paso, 0], [-paso, 0], [0, paso], [0, -paso]]) {
      const nx = cx + dx;
      const nz = cz + dz;
      const k = clave(nx, nz);
      if (vistos.has(k)) continue;
      if (colisiona(nx, nz, 0.35, PLANTA_MUSEO)) continue;
      vistos.add(k);
      cola.push([nx, nz]);
    }
  }

  const inalcanzables = PIEZAS_COLOCADAS
    .filter((c) => !vistos.has(clave(c.mirador[0], c.mirador[1])))
    .map((c) => c.pieza.id);
  assert.deepEqual(inalcanzables, [], "hay piezas a las que no se puede llegar andando");
});
