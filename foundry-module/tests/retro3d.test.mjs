import assert from "node:assert/strict";
import test from "node:test";

import {
  AJUSTES_EPOCA,
  EPOCAS,
  EPOCA_POR_DEFECTO,
  MALLA_CAZA,
  ajustesEpoca,
  areaFirmada,
  componerEscena,
  focal,
  intensidadCara,
  proyectar,
  recortarCercano,
  sombrear,
  transformar,
} from "../scripts/retro3d.mjs";
import { FACCIONES, canales } from "../scripts/paleta.mjs";

test("lo lejano se ve más pequeño: hay perspectiva, no una proyección plana", () => {
  // La diferencia con el parallax de `ventana-nave.mjs`, que finge la
  // profundidad: aquí un mismo tamaño a distinta distancia mide distinto.
  const comun = { ancho: 160, alto: 120, f: focal(120), rejilla: 0 };
  const cerca = proyectar([1, 0, 2], comun);
  const lejos = proyectar([1, 0, 8], comun);
  assert.ok(cerca.x - 80 > lejos.x - 80, "el mismo punto se acerca al centro al alejarse");
  assert.equal(proyectar([0, 0, 5], comun).x, 80, "el eje de la cámara cae en el centro");
});

test("la pantalla crece hacia abajo y el mundo hacia arriba", () => {
  // Si el signo se pierde, la nave sale del revés y la tentación es arreglarlo
  // rotando la malla, que esconde el fallo en los datos.
  const comun = { ancho: 160, alto: 120, f: focal(120), rejilla: 0 };
  assert.ok(proyectar([0, 1, 5], comun).y < 60, "arriba en el mundo es arriba en pantalla");
});

test("PSX ajusta los vértices a la rejilla; GameCube no", () => {
  // Es la firma visible de cada consola: el temblor de la PSX sale de rasterizar
  // con enteros, no de un efecto añadido por encima.
  const comun = { ancho: 160, alto: 120, f: focal(120) };
  const conRejilla = proyectar([0.317, 0.211, 3], { ...comun, rejilla: 1 });
  assert.equal(conRejilla.x, Math.round(conRejilla.x), "sin decimales");
  assert.equal(conRejilla.y, Math.round(conRejilla.y));

  const sinRejilla = proyectar([0.317, 0.211, 3], { ...comun, rejilla: 0 });
  assert.notEqual(sinRejilla.x, Math.round(sinRejilla.x), "la GameCube conserva el subpíxel");

  assert.equal(AJUSTES_EPOCA.psx.rejilla, 1);
  assert.equal(AJUSTES_EPOCA.gamecube.rejilla, 0);
  assert.equal(AJUSTES_EPOCA.gamecube.profundidadPorPixel, true, "sí tenía z-buffer");
  assert.equal(AJUSTES_EPOCA.psx.profundidadPorPixel, false, "y la PSX no");
});

test("una época desconocida cae en la de por defecto en vez de romper", () => {
  for (const basura of [null, undefined, "n64", 7, {}]) {
    assert.equal(ajustesEpoca(basura), AJUSTES_EPOCA[EPOCA_POR_DEFECTO]);
  }
  assert.ok(EPOCAS.includes(EPOCA_POR_DEFECTO));
  assert.equal(componerEscena(MALLA_CAZA, { epoca: "n64" }).epoca, EPOCA_POR_DEFECTO);
});

test("un vértice detrás de la cámara se recorta, no sale disparado", () => {
  // EL fallo clásico del rasterizador casero: dividir por un z diminuto o
  // negativo manda el triángulo al infinito. A la PSX le pasaba de verdad, pero
  // un artefacto ilegible no es estética.
  const triangulo = [
    [-1, 0, 2],
    [1, 0, 2],
    [0, 1, -3],
  ];
  const recortado = recortarCercano(triangulo, 0.1);
  assert.ok(recortado.length >= 3);
  for (const v of recortado) {
    assert.ok(v[2] >= 0.1 - 1e-9, `un vértice quedó a z=${v[2]}, delante del plano cercano`);
  }
  // Y entero detrás no queda nada que pintar.
  assert.deepEqual(recortarCercano([[0, 0, -1], [1, 0, -2], [0, 1, -3]], 0.1), []);
});

test("una escena entera detrás de la cámara no produce polígonos", () => {
  const escena = componerEscena(MALLA_CAZA, { posicion: [0, 0, -20] });
  assert.deepEqual(escena.poligonos, []);
});

test("se pinta de lejos a cerca: el orden por pintor", () => {
  // Sin z-buffer el orden ES el algoritmo de visibilidad, no una optimización.
  const escena = componerEscena(MALLA_CAZA, { yaw: 0.7, pitch: 0.3 });
  assert.ok(escena.poligonos.length > 0, "algo se ve");
  const profundidades = escena.poligonos.map((p) => p.profundidad);
  const ordenadas = [...profundidades].sort((a, b) => b - a);
  assert.deepEqual(profundidades, ordenadas, "los polígonos salen de lejos a cerca");
});

test("las caras de espaldas no se pintan", () => {
  // Una malla cerrada nunca puede enseñar todas sus caras a la vez; si lo hace,
  // el sentido de los índices está mal y el sombreado saldría al revés.
  const escena = componerEscena(MALLA_CAZA, { yaw: 0.4 });
  assert.ok(
    escena.poligonos.length < MALLA_CAZA.caras.length,
    "una malla cerrada oculta parte de sus caras",
  );
  for (const poligono of escena.poligonos) {
    assert.ok(areaFirmada(poligono.puntos) > 0, "todo lo pintado mira a la cámara");
  }
});

test("el sombreado es escalonado, no un degradado", () => {
  // Un degradado suave delata el render moderno y rompe la frontera de arte
  // (#351): paleta corta y ni un degradado.
  const tonosPsx = new Set();
  const tonosGc = new Set();
  for (let i = 0; i <= 40; i += 1) {
    const normal = [0, Math.cos(i / 20), Math.sin(i / 20)];
    tonosPsx.add(intensidadCara(normal, AJUSTES_EPOCA.psx.tonos));
    tonosGc.add(intensidadCara(normal, AJUSTES_EPOCA.gamecube.tonos));
  }
  assert.ok(tonosPsx.size <= AJUSTES_EPOCA.psx.tonos, `${tonosPsx.size} tonos, demasiados para PSX`);
  assert.ok(tonosGc.size > tonosPsx.size, "la GameCube admite más escalones");
});

test("ninguna cara se apaga del todo: la silueta no se rompe", () => {
  // A oscuras total una cara se funde con el fondo y en un visor pequeño eso se
  // lee como un agujero en la nave, no como sombra.
  const alReves = intensidadCara([0.4, -0.8, 0.45], 4);
  assert.ok(alReves > 0, "hay luz ambiente");
});

test("este módulo no inventa colores: los oscurece", () => {
  // El color entra de `paleta.mjs` y aquí solo se sombrea. Es lo que permite que
  // la guardia de colores propios no tenga nada que encontrar.
  const base = FACCIONES[0];
  const oscuro = sombrear(base, 0.25);
  assert.match(oscuro, /^#[0-9a-f]{6}$/);
  const [r] = canales(oscuro);
  const [rBase] = canales(base);
  assert.ok(r < rBase, "sombrear oscurece");
  assert.equal(sombrear(base, 1), base.toLowerCase(), "a plena luz es el color de partida");
  // Intensidades imposibles se acotan en vez de producir un color inválido.
  for (const rara of [-5, 2, NaN]) {
    assert.match(sombrear(base, rara), /^#[0-9a-f]{6}$/);
  }
  // Y un color que no se puede leer se devuelve tal cual, no en negro: un negro
  // silencioso parecería un fallo de luz y se buscaría donde no está.
  assert.equal(sombrear("no-es-un-color", 0.5), "no-es-un-color");
});

test("una malla degenerada no produce NaN en el lienzo", () => {
  // Dos vértices iguales dan normal cero. Preferimos una cara sin luz a un
  // color «#NaNNaNNaN», que ensucia el lienzo entero sin decir por qué.
  const degenerada = { vertices: [[0, 0, 1], [0, 0, 1], [1, 0, 1]], caras: [[0, 1, 2]] };
  const escena = componerEscena(degenerada, { color: FACCIONES[1] });
  for (const poligono of escena.poligonos) {
    assert.doesNotMatch(poligono.color, /NaN/);
  }
});

test("basura por malla u opciones no rompe la escena", () => {
  for (const malla of [null, undefined, {}, { vertices: [], caras: [] }, { caras: [[0, 1, 2]] }]) {
    const escena = componerEscena(malla);
    assert.deepEqual(escena.poligonos, []);
  }
  // Una cara con índices que no existen se ignora en vez de tumbar la escena.
  assert.deepEqual(
    componerEscena({ vertices: [[0, 0, 1]], caras: [[0, 9, 12]] }).poligonos,
    [],
  );
});

test("la rotación es determinista y el orden yaw→pitch→roll no es conmutativo", () => {
  // Se fija porque cambiarlo movería todas las mallas a la vez sin que nadie lo
  // pidiera, y el síntoma (una nave torcida) llegaría muy lejos de la causa.
  const v = [1, 2, 3];
  assert.deepEqual(transformar(v, { yaw: 0.3 }), transformar(v, { yaw: 0.3 }));
  assert.notDeepEqual(
    transformar(v, { yaw: 0.3, pitch: 0.7 }),
    transformar(v, { yaw: 0.7, pitch: 0.3 }),
  );
  assert.deepEqual(transformar(v, {}), v, "sin rotación ni traslación, el vértice no se mueve");
  assert.deepEqual(transformar([0, 0, 0], { posicion: [1, 2, 3] }), [1, 2, 3]);
});

test("girar la nave cambia lo que se ve, y una vuelta entera la deja igual", () => {
  const firma = (yaw) =>
    componerEscena(MALLA_CAZA, { yaw, ancho: 160, alto: 120 })
      .poligonos.map((p) => `${p.color}:${p.puntos.map((q) => `${q.x},${q.y}`).join(" ")}`)
      .join("|");
  assert.notEqual(firma(0), firma(1.2), "gira de verdad");
  assert.equal(firma(0), firma(Math.PI * 2), "una vuelta completa vuelve al mismo sitio");
});

test("el campo de visión se calcula desde el alto, no se configura a mano", () => {
  // Así cambiar el tamaño del visor no cambia además cuánto se ve, que es un
  // acoplamiento silencioso muy fácil de introducir.
  assert.ok(focal(120, 30) > focal(120, 90), "menos campo de visión es más zoom");
  assert.ok(focal(240, 60) > focal(120, 60), "un visor el doble de alto, el doble de focal");
  // Valores imposibles se acotan en vez de dar infinito o negativo.
  for (const fov of [0, -20, 400, NaN]) {
    assert.ok(Number.isFinite(focal(120, fov)) && focal(120, fov) > 0, `fov ${fov}`);
  }
});
