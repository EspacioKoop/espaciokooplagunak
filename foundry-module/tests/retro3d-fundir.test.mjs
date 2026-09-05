// La primitiva de fundido de escenas y la pregunta que hace medible el orden
// por pintor (#510).

import test from "node:test";
import assert from "node:assert/strict";

import {
  componerEscena,
  fundirEscenas,
  seSolapanEnPantalla,
  MALLA_CAZA,
} from "../scripts/retro3d.mjs";
import { componerCantina } from "../scripts/cantina-escena.mjs";
import { componerCantinaSala } from "../scripts/cantina-sala.mjs";
import { paresMalOrdenados } from "./ayuda-orden-pintor.mjs";

const COMUN = { ancho: 160, alto: 120 };

test("fundir dos escenas da UN orden global, no dos listas pegadas", () => {
  // La regresión concreta: cada escena viene ordenada por su cuenta, así que
  // concatenarlas deja una lista ordenada por tramos —correcta dentro de cada
  // pieza y falsa entre piezas—, y una ficha acaba dibujada encima del tapete
  // que la tapa.
  const cerca = componerEscena(MALLA_CAZA, { ...COMUN, posicion: [0, 0, 4] });
  const lejos = componerEscena(MALLA_CAZA, { ...COMUN, posicion: [0, 0, 12] });

  const pegadas = [...cerca.poligonos, ...lejos.poligonos].map((p) => p.profundidad);
  const fundidas = fundirEscenas([cerca, lejos]).poligonos.map((p) => p.profundidad);

  assert.equal(fundidas.length, pegadas.length, "no se pierde ni se inventa geometría");
  assert.notDeepEqual(fundidas, pegadas, "pegar las listas no es fundirlas");
  assert.deepEqual(fundidas, [...fundidas].sort((a, b) => b - a), "una sola pasada de orden");
});

test("fundir acepta listas sueltas de polígonos, no solo escenas", () => {
  // Los avatares de otros jugadores llegan así desde `nave-avatares-render.mjs`.
  const sala = componerEscena(MALLA_CAZA, { ...COMUN, posicion: [0, 0, 10] });
  const suelto = componerEscena(MALLA_CAZA, { ...COMUN, posicion: [0, 0, 3] }).poligonos;

  const fundida = fundirEscenas([sala, suelto]);
  assert.equal(fundida.poligonos.length, sala.poligonos.length + suelto.length);
  assert.equal(fundida.epoca, sala.epoca, "los metadatos salen de la primera escena");
  assert.equal(fundida.ancho, sala.ancho);
});

test("fundir con nada que pintar no revienta ni inventa una escena", () => {
  // Pasa de verdad: sin telemetría no hay contactos que componer, y el visor
  // del piloto funde de todas formas.
  assert.deepEqual(fundirEscenas([]).poligonos, []);
  assert.deepEqual(fundirEscenas(null).poligonos, []);
  assert.deepEqual(fundirEscenas([null, undefined, {}, []]).poligonos, []);
  assert.equal(fundirEscenas([]).epoca, undefined, "sin escena base no se inventa época");
});

test("fundir no modifica las escenas que entran", () => {
  const a = componerEscena(MALLA_CAZA, { ...COMUN, posicion: [0, 0, 4] });
  const b = componerEscena(MALLA_CAZA, { ...COMUN, posicion: [0, 0, 9] });
  const copiaA = a.poligonos.slice();
  fundirEscenas([a, b]);
  assert.deepEqual(a.poligonos, copiaA, "la escena de origen se puede seguir usando");
});

test("cada polígono lleva su geometría de cámara, que es lo que permite decidir", () => {
  // Sin `camara` no se puede saber si una cara está entera detrás de otra: la
  // profundidad media es un resumen y los resúmenes empatan.
  const escena = componerEscena(MALLA_CAZA, { ...COMUN, yaw: 0.7, pitch: 0.3 });
  for (const poligono of escena.poligonos) {
    assert.equal(poligono.camara.length, poligono.puntos.length, "un vértice de cámara por punto");
    for (const v of poligono.camara) {
      assert.ok(v.every(Number.isFinite), "geometría de cámara utilizable");
      assert.ok(v[2] > 0, "todo lo que se pinta está delante de la cámara");
    }
  }
});

test("solaparse en pantalla es compartir píxeles, no compartir caja", () => {
  const cuadrado = (x, y, lado) => ({
    puntos: [
      { x, y },
      { x: x + lado, y },
      { x: x + lado, y: y + lado },
      { x, y: y + lado },
    ],
  });
  assert.equal(seSolapanEnPantalla(cuadrado(0, 0, 10), cuadrado(5, 5, 10)), true);
  assert.equal(seSolapanEnPantalla(cuadrado(0, 0, 10), cuadrado(40, 40, 10)), false);
  // Dos caras que comparten arista —dos muros en una esquina, el lomo y el
  // costado de un casco— NO se tapan: es el caso más común de todos y contarlo
  // como solape haría creer que su orden importa.
  assert.equal(seSolapanEnPantalla(cuadrado(0, 0, 10), cuadrado(10, 0, 10)), false);
  // Dos triángulos cruzados en aspa: ninguna caja los separa y ninguna arista
  // tampoco, porque de verdad comparten píxeles.
  const aspa = { puntos: [{ x: 5, y: -5 }, { x: 7, y: -5 }, { x: 6, y: 15 }] };
  assert.equal(seSolapanEnPantalla(cuadrado(0, 0, 10), aspa), true);
  assert.equal(seSolapanEnPantalla({}, cuadrado(0, 0, 10)), false, "sin puntos no hay solape");
});

test("captura del presupuesto de polígonos por escena conocida", () => {
  // Pedido en #510 (punto 4): no había ninguna medida de cuánta geometría mueve
  // de verdad una escena, así que cualquier discusión sobre si el motor aguanta
  // varias salas a la vez era a ojo. Estos números son una CAPTURA del estado de
  // hoy, no un límite de diseño: si cambian, que sea a propósito y en un PR que
  // lo diga. La cota superior es lo que vigila el crecimiento silencioso.
  const conteos = {
    entrada: componerCantina({ plano: "entrada" }).poligonos.length,
    barra: componerCantina({ plano: "barra" }).poligonos.length,
    mesaPoker: componerCantina({ plano: "mesaPoker" }).poligonos.length,
    mesaDados: componerCantina({ plano: "mesaDados" }).poligonos.length,
    ventanal: componerCantina({ plano: "ventanal" }).poligonos.length,
  };
  // Los cuatro taburetes de barra pasaron de una caja a cuatro (asiento, pie,
  // base y reposapiés) al hacerlos taburetes de verdad: doce cajas más en la
  // sala, +24 polígonos en el plano de entrada, que es el único que los ve
  // enteros. `barra` y `mesaDados` BAJAN uno cada uno, y eso no es ruido: un
  // taburete de pie fino tapa menos que una columna de medio metro, así que el
  // fundido de caras coplanares al que llegaban recorta distinto.
  assert.deepEqual(conteos, {
    entrada: 193,
    barra: 76,
    mesaPoker: 121,
    mesaDados: 84,
    ventanal: 18,
  });

  // La cantina CAMINABLE es la escena más cargada del módulo (sus 126 muebles
  // hechos a mano más la sala) y la que QA señaló en #510. Se acota en vez de
  // fijarse porque depende de dónde esté el jugador mirando.
  //
  // La cota subió de 400 a 1000 al entrar la piel pixelart (#548/#551/#552):
  // el relieve, las bandas y los greebles de muros, suelo y techo SON
  // polígonos, así que el pico medido pasó de <400 a 823. Es crecimiento a
  // propósito y por eso se mueve el número aquí y no en silencio; sigue siendo
  // una cota, no un objetivo, y lo que vigila es el siguiente crecimiento.
  for (let yaw = 0; yaw < Math.PI * 2; yaw += Math.PI / 4) {
    const escena = componerCantinaSala(5, 1.6, 6, yaw, { ancho: 480, alto: 320 });
    assert.ok(escena.poligonos.length > 0, `mirando a ${yaw.toFixed(2)} no se ve nada`);
    assert.ok(
      escena.poligonos.length < 1000,
      `mirando a ${yaw.toFixed(2)} salen ${escena.poligonos.length} polígonos`,
    );
  }
});

test("deuda conocida: el orden por centroide deja pares mal en escenas cargadas", () => {
  // Esto NO es una prueba de que algo funcione: es la medida de lo que #510
  // sigue debiendo, escrita para que se note cuando cambie. Un par «mal» es una
  // cara enteramente detrás de otra, que la tapa en pantalla, y que se pinta
  // después — el defecto que QA ve como texturas que se glitchean.
  const caminable = componerCantinaSala(5, 1.6, 6, 0.4, { ancho: 480, alto: 320 });
  assert.ok(
    paresMalOrdenados(caminable.poligonos) <= 8,
    "la deuda de orden de la cantina caminable ha crecido",
  );
});
