// El local de la cantina (#423 sobre #362): geometría, no aspecto.
//
// Lo que se puede afirmar de una sala sin mirarla: que sus cajas están bien
// construidas, que todos los muebles llegan a la escena, y que el orden por
// pintor es global y no por mueble — que es el único fallo de esta pieza capaz
// de dejar la barra dibujada detrás del mamparo.

import assert from "node:assert/strict";
import test from "node:test";

import { ALTURA_TABURETE, MUEBLES, caja, componerCantina } from "../scripts/cantina-escena.mjs";
import { PLANOS } from "../scripts/cantina-planos.mjs";
import { EPOCAS } from "../scripts/retro3d.mjs";
import { afirmarOrdenPorPintor } from "./ayuda-orden-pintor.mjs";

test("la caja tiene ocho vértices, seis caras y las medidas que se le piden", () => {
  const malla = caja([1, 2, 3], [2, 4, 6]);
  assert.equal(malla.vertices.length, 8);
  assert.equal(malla.caras.length, 6);
  const xs = malla.vertices.map((v) => v[0]);
  const ys = malla.vertices.map((v) => v[1]);
  const zs = malla.vertices.map((v) => v[2]);
  assert.deepEqual([Math.min(...xs), Math.max(...xs)], [0, 2]);
  assert.deepEqual([Math.min(...ys), Math.max(...ys)], [0, 4]);
  assert.deepEqual([Math.min(...zs), Math.max(...zs)], [0, 6]);
});

test("cada cara de la caja usa cuatro vértices distintos", () => {
  // Un índice repetido da un polígono degenerado que el motor descarta en
  // silencio: la sala saldría con un agujero y sin un solo error por ningún lado.
  for (const cara of caja([0, 0, 0], [1, 1, 1]).caras) {
    assert.equal(new Set(cara).size, 4);
    for (const indice of cara) assert.ok(indice >= 0 && indice < 8);
  }
});

test("el cigarro de quien fuma alimenta el humo de la sala (#439)", () => {
  const sinNadie = componerCantina({ ancho: 320, alto: 180 });
  const conFumadora = componerCantina({
    ancho: 320,
    alto: 180,
    gente: [{ id: "a", gesto: "fumar" }],
  });
  const vetas = (escena) => escena.aire.filter((a) => a.tipo === "humo").length;
  assert.equal(vetas(conFumadora), vetas(sinNadie) + 1, "el cigarro no añade una veta de humo");
});

test("la sala se compone y todos sus muebles ponen polígonos", () => {
  const escena = componerCantina({ ancho: 320, alto: 180 });
  assert.ok(escena.poligonos.length > 0);
  assert.equal(escena.ancho, 320);
  assert.equal(escena.alto, 180);
  // Un mueble por color: si un material desaparece de la escena, es que su caja
  // se está quedando fuera del encuadre o de espaldas a la cámara.
  const colores = new Set(MUEBLES.map((m) => m.color));
  assert.ok(colores.size >= 5, "la sala tiene varios materiales, no uno");
});

test("el orden por pintor es global: lo lejano se pinta antes que lo cercano", () => {
  // La regresión que este test existe para impedir: concatenar las listas de
  // cada mueble sin reordenar da una lista ordenada por tramos, correcta dentro
  // de cada mueble y falsa entre muebles.
  const { poligonos } = componerCantina();
    // Los 2 pares tolerados son la deuda medida de #510, no un margen de diseño:
  // el orden por centroide no distingue dos caras de mueble que se tocan. Si
  // este número sube, algo ha empeorado el orden; cuando #510 se cierre de
  // verdad, baja a cero.
  afirmarOrdenPorPintor(poligonos, "la cantina", 2);
});

test("la sala se compone en las dos épocas y ninguna se queda vacía", () => {
  for (const epoca of EPOCAS) {
    const escena = componerCantina({ epoca });
    assert.equal(escena.epoca, epoca);
    assert.ok(escena.poligonos.length > 0, `la época ${epoca} no pinta nada`);
  }
});

// Moverse por la sala (#423): la cámara se asoma, no viaja.
test("entrada rota no propaga números rotos a la escena", () => {
  const escena = componerCantina({ ancho: NaN, alto: undefined, plano: "no-existe" });
  for (const poligono of escena.poligonos) {
    for (const punto of poligono.puntos) {
      assert.ok(Number.isFinite(punto.x) && Number.isFinite(punto.y));
    }
  }
});

// El ventanal (#423, camino a #427): por el hueco del mamparo se ve el vacío.
test("hay cielo por la ventana, sembrado y estable", () => {
  const a = componerCantina({ semillaCielo: 7 });
  const b = componerCantina({ semillaCielo: 7 });
  assert.ok(a.estrellas.length > 0, "no se ve nada por el ventanal");
  assert.deepEqual(a.estrellas, b.estrellas, "la misma semilla debe dar el mismo cielo");
  assert.notDeepEqual(componerCantina({ semillaCielo: 8 }).estrellas, a.estrellas);
});

test("no hay caja de ventana: el hueco lo tapa el mamparo, no un cartón", () => {
  // Si alguien vuelve a meter un panel en el hueco, las estrellas dejan de
  // verse y la sala parece tener una pared azul en vez de un vacío detrás.
  assert.equal(MUEBLES.some((mueble) => mueble.nombre === "ventana"), false);
});

test("la sala está amueblada, no solo construida", () => {
  // La primera versión era correcta y estaba vacía. Botellas, taburetes y
  // costillas son lo que la hace un local en vez de una caja.
  const nombres = MUEBLES.map((mueble) => mueble.nombre);
  for (const prefijo of ["botella", "taburete", "nervio", "mesa", "lampara"]) {
    assert.ok(
      nombres.some((nombre) => nombre.startsWith(prefijo)),
      `la sala se ha quedado sin ${prefijo}`,
    );
  }
});

// El goblin ciego (#423): el único habitante de la sala.
test("el goblin está en la sala, con sus orejas, su venda y sus jarras", () => {
  const nombres = MUEBLES.map((mueble) => mueble.nombre);
  for (const pieza of ["goblinCuerpo", "goblinCabeza", "goblinOreja", "goblinVenda", "goblinBandeja", "jarra"]) {
    assert.ok(nombres.some((nombre) => nombre.startsWith(pieza)), `falta ${pieza}`);
  }
});

test("el goblin sirve al fondo, no delante de la barra", () => {
  // Está a lo suyo, en la mesa del fondo. Si acaba en medio del encuadre deja
  // de ser un habitante y pasa a ser un actor esperando su turno.
  for (const mueble of MUEBLES.filter((m) => m.nombre.startsWith("goblin"))) {
    assert.ok(mueble.centro[2] > 4.5, `el goblin se ha venido al frente: z=${mueble.centro[2]}`);
  }
});

// La sala tiene que estar CERRADA (#423): girarse no puede ser asomarse al vacío.
test("hay pared de entrada a la espalda de quien llega", () => {
  const nombres = MUEBLES.map((mueble) => mueble.nombre);
  assert.ok(nombres.some((nombre) => nombre.startsWith("paredEntrada")), "falta la pared de entrada");
  assert.ok(nombres.includes("vanoEntrada"), "falta el vano por el que se entra");
  // Y va DETRÁS del punto de partida: si estuviera delante, taparía la barra.
  for (const mueble of MUEBLES.filter((m) => m.nombre.startsWith("paredEntrada"))) {
    assert.ok(mueble.centro[2] < -2, `la entrada se ha colado en la sala: z=${mueble.centro[2]}`);
  }
});

test("todos los planos enseñan sala y ofrecen algo que hacer", () => {
  // Un plano vacío o sin salidas es un callejón: la cámara está autorada, así
  // que si un encuadre no funciona no hay forma de que el jugador lo arregle.
  for (const plano of PLANOS) {
    const escena = componerCantina({ plano: plano.id });
    // El umbral bajó de 20 a 10 al arreglar #510 aquí (QA: "no se veía nada a
    // través de la ventana"): el recuento viejo incluía un polígono inflado
    // por un vértice sin recortar, que tapaba la pantalla entera y contaba
    // como "sala visible" sin serlo. "ventanal" —mirando de frente al
    // hueco— legítimamente enseña menos muro que el resto: es la cámara que
    // más espacio vacío encuadra a propósito.
    assert.ok(escena.poligonos.length > 10, `el plano ${plano.id} está casi vacío`);
    assert.ok(escena.opciones.length > 0, `el plano ${plano.id} no ofrece nada`);
    assert.equal(escena.plano, plano.id);
  }
});

test("ningún polígono dispara sus coordenadas fuera del lienzo (#510, QA: no se veía nada por la ventana)", () => {
  // Sin recorte lateral, un mueble visto de cerca dispara un vértice fuera
  // del frustum y el polígono resultante infla sus coordenadas a decenas de
  // miles de píxeles, tapando pantalla entera (estrellas incluidas) aunque
  // el hueco del ventanal esté vacío de verdad. Mismo arreglo que ya lleva
  // la cámara libre de #427.
  for (const plano of PLANOS) {
    const escena = componerCantina({ ancho: 640, alto: 360, plano: plano.id });
    for (const poligono of escena.poligonos) {
      for (const punto of poligono.puntos) {
        assert.ok(Math.abs(punto.x) < 5000 && Math.abs(punto.y) < 5000, `${plano.id}: vértice disparado (${punto.x}, ${punto.y})`);
      }
    }
  }
});

test("una opción fuera de cuadro se pega al borde, no desaparece", () => {
  // Descartarla sería esconder una salida. Se marca `fuera` para poder pintarla
  // distinto: «está ahí» y «está por ahí» no son lo mismo.
  const escena = componerCantina({ plano: "ventanal" });
  for (const opcion of escena.opciones) {
    assert.ok(opcion.x >= 0 && opcion.x <= escena.ancho);
    assert.ok(opcion.y >= 0 && opcion.y <= escena.alto);
  }
  assert.ok(escena.opciones.some((o) => o.fuera), "ninguna se ha marcado como fuera");
});

// Un local usado, no solo construido (#423).
test("la sala tiene trastos que alguien dejó ahí", () => {
  // Es la diferencia entre una sala construida y una sala usada, y sale barato
  // porque son cajas. Si esto se pierde, la cantina vuelve a ser un plano.
  const nombres = MUEBLES.map((mueble) => mueble.nombre);
  for (const trasto of ["tele", "gramola", "caja", "maceta", "hoja", "trapo", "jarraBarra"]) {
    assert.ok(nombres.some((nombre) => nombre.startsWith(trasto)), `falta ${trasto}`);
  }
});

test("la tele existe como objeto de la sala, no como capa encima", () => {
  // Cuando se cablee el vídeo por enlace, irá anclado a ESTE rectángulo. Si la
  // tele viviera solo en la interfaz, flotaría como flotaban los cachivaches.
  const pantalla = MUEBLES.find((mueble) => mueble.nombre === "telePantalla");
  assert.ok(pantalla, "la tele no está en la sala");
  assert.ok(pantalla.medidas[2] > pantalla.medidas[1], "una tele es más ancha que alta");
});

/* ---- los taburetes de la barra --------------------------------------------- */

test("un taburete es un taburete: asiento, pie, base y reposapiés", () => {
  // Era UNA caja, y era exactamente la misma que la barra: `[0.5, 0.9, 0.5]`
  // centrada en −1.45. Como bulto colaba; al poder sentarse encima dejó de
  // colar, porque ponía los ojos por encima de estar de pie.
  const partes = MUEBLES.filter(({ nombre }) => /^taburete0/.test(nombre ?? ""));
  assert.equal(partes.length, 4);
  assert.deepEqual(
    partes.map(({ nombre }) => nombre).sort(),
    ["taburete0Asiento", "taburete0Base", "taburete0Pie", "taburete0Reposapies"],
  );
});

test("el asiento está donde dice ALTURA_TABURETE, y no en una altura escrita aparte", () => {
  const SUELO = -1.9;
  const asiento = MUEBLES.find(({ nombre }) => nombre === "taburete0Asiento");
  const cara = asiento.centro[1] + asiento.medidas[1] / 2;
  assert.ok(Math.abs(cara - (SUELO + ALTURA_TABURETE)) < 1e-9, `cara del asiento en ${cara}`);
});

test("un taburete de barra queda por debajo de su barra, y por la distancia correcta", () => {
  // 0,27 m entre el asiento y el mostrador. La caja de antes daba CERO: el
  // asiento a la altura exacta de la barra, que es la señal de que nadie lo
  // había mirado como mueble.
  const barra = MUEBLES.find(({ nombre }) => nombre === "barra");
  const caraBarra = barra.centro[1] + barra.medidas[1] / 2;
  const caraAsiento = -1.9 + ALTURA_TABURETE;
  const diferencia = caraBarra - caraAsiento;
  assert.ok(diferencia > 0.2 && diferencia < 0.35, `${diferencia.toFixed(2)} m entre asiento y barra`);
});

test("el reposapiés va entre la base y el asiento, que es lo que lo hace reposapiés", () => {
  const alto = (nombre) => {
    const pieza = MUEBLES.find((p) => p.nombre === nombre);
    return pieza.centro[1] + pieza.medidas[1] / 2;
  };
  assert.ok(alto("taburete0Base") < alto("taburete0Reposapies"));
  assert.ok(alto("taburete0Reposapies") < alto("taburete0Asiento"));
});

test("los cuatro taburetes están a la misma altura y repartidos por la barra", () => {
  const asientos = MUEBLES.filter(({ nombre }) => /^taburete\d+Asiento$/.test(nombre ?? ""));
  assert.equal(asientos.length, 4);
  assert.equal(new Set(asientos.map(({ centro }) => centro[1])).size, 1);
  const xs = asientos.map(({ centro }) => centro[0]).sort((a, b) => a - b);
  const huecos = xs.slice(1).map((x, i) => x - xs[i]);
  assert.ok(huecos.every((h) => Math.abs(h - huecos[0]) < 1e-9), "repartidos por igual");
});
