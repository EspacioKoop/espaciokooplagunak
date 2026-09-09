// Luminarias del techo (#555).
//
// El fallo que cierra este módulo es de ESCA, así que casi todo lo que se
// prueba aquí es que una pieza de mobiliario no crezca con la habitación que la
// contiene — que es el error que #540 corrigió en la planta y que había
// sobrevivido en el techo.

import test from "node:test";
import assert from "node:assert/strict";

import {
  ANCHO, CAIDA, CAIDA_DIFUSOR, LARGO, PASO,
  piezasLuminarias, mallaDifusorLuminarias, colorDifusorLuminaria,
  reparto, focosLuminarias, tonoLuminaria,
} from "../scripts/nave-luminaria.mjs";
import { LUZ_CALIDA, MURAL, SECCION, ALERTA } from "../scripts/paleta.mjs";
import { ALTURA, crearSalaCaja } from "../scripts/nave-sala-caja.mjs";
import { componerEscena } from "../scripts/retro3d.mjs";

const caras = (piezas) => piezas.reduce((n, p) => n + p.malla.caras.length, 0);

/** La caja envolvente de una malla, para medir la pieza de verdad. */
function medidas({ vertices }) {
  const eje = (i) => vertices.map((v) => v[i]);
  return [0, 1, 2].map((i) => Math.max(...eje(i)) - Math.min(...eje(i)));
}

test("una luminaria mide lo mismo en una sala grande que en una pequeña", () => {
  // EL fallo de #555: `lamparaTecho` medía `min(ancho, profundidad) * 0.22`, o
  // sea 4,84 m de lado en el reactor. Una luminaria es una pieza de catálogo.
  // La envolvente de la malla FUNDIDA crece con la sala porque contiene más
  // luminarias; lo que no puede crecer es cada una. Se mide la primera caja de
  // la malla —sus ocho primeros vértices— en las dos salas.
  const primeraCaja = (piezas) => medidas({ vertices: piezas[0].malla.vertices.slice(0, 8) });
  const pequena = primeraCaja(piezasLuminarias({ ancho: 6, profundidad: 6, altura: ALTURA }));
  const grande = primeraCaja(piezasLuminarias({ ancho: 22, profundidad: 22, altura: ALTURA }));
  // Con tolerancia y no `deepEqual`: las dos salas colocan sus luminarias en
  // coordenadas distintas, así que las medidas salen iguales hasta el último bit
  // flotante y no más. Exigir igualdad exacta sería probar la aritmética.
  grande.forEach((lado, i) => assert.ok(Math.abs(lado - pequena[i]) < 1e-9, "la misma pieza en una sala de 6 m y en una de 22"));
  assert.ok(Math.max(pequena[0], pequena[2]) <= LARGO + 1e-9, "y del tamaño de catálogo");
  assert.ok(Math.min(pequena[0], pequena[2]) <= ANCHO + 1e-9);
});

test("las luminarias se reparten centradas, sin banda oscura a un lado", () => {
  // Con el reparto desde una esquina, una sala cuyo ancho no es múltiplo del
  // paso se queda con las luminarias pegadas a un lado y un vacío en el otro.
  const puntos = reparto(10, 4);
  const xs = puntos.map((p) => p.x);
  const margenIzquierdo = Math.min(...xs);
  const margenDerecho = 10 - Math.max(...xs);
  assert.ok(Math.abs(margenIzquierdo - margenDerecho) < 1e-9, "los dos márgenes iguales");
});

test("una sala diminuta lleva una, no ninguna", () => {
  // Redondear a cero dejaría a oscuras cualquier sala menor que el paso.
  assert.equal(reparto(1.5, 1.5).length, 1);
});

test("cuelgan del techo y no lo atraviesan", () => {
  for (const { malla } of piezasLuminarias({ ancho: 8, profundidad: 6, altura: ALTURA })) {
    for (const [, y] of malla.vertices) {
      assert.ok(y < ALTURA, "por debajo del techo");
      assert.ok(y > ALTURA - CAIDA - 0.2, "y colgando poco: no es una lámpara de mesa");
    }
  }
});

test("la carcasa no lleva emisivo: solo el difusor se pinta encendido", () => {
  // #765 separó el difusor de `piezasLuminarias` para poder repintarlo cada
  // fotograma sin rehacer la carcasa. La carcasa (bajos + costados) no debe
  // llevar `emisivo` — si lo llevara, toda la luminaria sería una caja de luz.
  const piezas = piezasLuminarias({ ancho: 8, profundidad: 6, altura: ALTURA });
  assert.equal(piezas.length, 2, "solo bajos y costados: el difusor vive aparte");
  assert.ok(piezas.every((p) => p.emisivo !== true), "la carcasa no es emisiva");
});

test("el difusor mira hacia abajo, y su geometría no depende del estado", () => {
  // En este motor toda cara que mira hacia abajo está en el suelo de luz
  // ambiente (0,35): sin `emisivo`, un difusor ámbar llega al ojo como un marrón
  // sucio y la luminaria parece fundida.
  const malla = mallaDifusorLuminarias({ ancho: 8, profundidad: 6, altura: ALTURA });
  assert.ok(malla, "hay difusor con puntos de reparto");
  for (const cara of malla.caras) {
    const ys = cara.map((i) => malla.vertices[i][1]);
    assert.ok(Math.max(...ys) - Math.min(...ys) < 1e-9, "una cara horizontal, mirando abajo");
  }
});

test("emisivo llega a pantalla con su color entero; sin él, sombreado", () => {
  // El contrato del motor que hace posible una lámpara encendida (#555), probado
  // donde vive y no a través de una sala: qué cámara ve el techo de qué
  // habitación es otra pregunta, y mezclarlas hace un test que falla por el
  // motivo equivocado.
  const quad = {
    vertices: [
      [-1, 0, 4],
      [1, 0, 4],
      [1, 2, 4],
      [-1, 2, 4],
    ],
    // Giro antihorario visto desde la cámara (en el origen), o el motor la
    // descarta por estar de espaldas y no hay polígono que mirar.
    caras: [[0, 3, 2, 1]],
  };
  const ajustes = { ancho: 320, alto: 180, epoca: "psx", color: LUZ_CALIDA, posicion: [0, 0, 0] };
  const conLuz = componerEscena(quad, { ...ajustes, emisivo: true });
  const sinLuz = componerEscena(quad, ajustes);
  assert.equal(conLuz.poligonos[0].color, LUZ_CALIDA, "emisivo: el color entero");
  assert.notEqual(sinLuz.poligonos[0].color, LUZ_CALIDA, "sin emisivo: el motor lo sombrea");
});

test("emisivo NO es una luz: no se contagia a la pieza de al lado", () => {
  // La distinción que hay que sostener. `emisivo` solo exceptúa a ESA malla del
  // sombreado; no alumbra a nadie. Poner luces de verdad es #556 y cambiaría el
  // aspecto de todas las superficies — no puede colarse por aquí.
  const sala = crearSalaCaja({ ancho: 8, profundidad: 6, muralPixel: false, pielSuelo: false });
  const escena = sala.componer(4, 0, 3, 0, { ancho: 320, alto: 180, epoca: "psx" });
  const crudos = new Set(Object.values(MURAL));
  for (const poligono of escena.poligonos) {
    assert.ok(!crudos.has(poligono.color), `${poligono.color} llegó sin sombrear: el emisivo se contagió`);
  }
});

test("la luz NO usa el acento de señalización", () => {
  // Lo que hacía la lámpara vieja: `SECCION.entrable` marca ventanas, consolas y
  // salas entrables. Gastarlo en un adorno del techo deja a la tripulación sin
  // la única señal que tiene para encontrar lo accionable.
  const colores = piezasLuminarias({ ancho: 8, profundidad: 6, altura: ALTURA }).map((p) => p.color);
  assert.ok(!colores.includes(SECCION.entrable), "el turquesa no es una luz");
  const permitidos = new Set(Object.values(MURAL));
  for (const color of colores) assert.ok(permitidos.has(color), `${color} fuera de paleta (#351)`);
});

test("solo se emiten las caras que pueden verse", () => {
  // Una luminaria se mira desde abajo: su tapa superior está contra el mamparo y
  // no se ve nunca, pero costaría transformarse y proyectarse igual. En el
  // reactor son 36 luminarias, así que la diferencia no es teórica.
  const reactor = piezasLuminarias({ ancho: 22, profundidad: 22, altura: ALTURA });
  const difusor = mallaDifusorLuminarias({ ancho: 22, profundidad: 22, altura: ALTURA });
  const totalCaras = caras(reactor) + difusor.caras.length;
  const porLuminaria = totalCaras / reparto(22, 22).length;
  assert.ok(porLuminaria <= 6, `${porLuminaria} caras por luminaria: sobra algo que no se ve`);
});

test("no tocan la colisión: se anda por debajo", () => {
  const con = crearSalaCaja({ ancho: 8, profundidad: 6 });
  // El centro de la sala, justo debajo de una luminaria, sigue libre.
  assert.equal(con.planta.obstaculos.some((o) => o.x < 4 && o.x + o.ancho > 4), false);
});

test("la sala las emite y se ven al mirar al techo", () => {
  const sala = crearSalaCaja({ ancho: 8, profundidad: 6, muralPixel: false, pielSuelo: false });
  const escena = sala.componer(4, 0, 3, 0, { ancho: 320, alto: 180 });
  assert.ok(escena.poligonos.length > 0);
});

test("focosLuminarias devuelve un foco por difusor en la misma x/z", () => {
  const ancho = 8, profundidad = 6, altura = ALTURA;
  const puntos = reparto(ancho, profundidad);
  const focos = focosLuminarias({ ancho, profundidad, altura });
  assert.equal(focos.length, puntos.length);
  const yEsperado = altura - CAIDA - CAIDA_DIFUSOR;
  for (let i = 0; i < puntos.length; i++) {
    const { x, z } = puntos[i];
    const foco = focos[i];
    assert.equal(foco.posicion[0], x, `foco ${i} x`);
    assert.equal(foco.posicion[1], yEsperado, `foco ${i} y`);
    assert.equal(foco.posicion[2], z, `foco ${i} z`);
  }
});

// Este es el invariante que de verdad importa, y el que faltaba: el foco tiene
// que estar DONDE ESTA EL DIFUSOR, no donde diga un numero copiado. Se lee la y
// de la malla emisiva que devuelve `piezasLuminarias` y se exige que coincida.
// Asi, si alguien mueve el difusor, esto falla — que es justo lo que un
// comentario pidiendo «la misma y» no conseguia.
test("el foco cuelga exactamente del difusor que se ve encendido", () => {
  const sala = { ancho: 8, profundidad: 6, altura: ALTURA };
  const malla = mallaDifusorLuminarias(sala);
  assert.ok(malla, "tiene que haber malla de difusor");

  const alturasDifusor = new Set(malla.vertices.map((v) => v[1]));
  assert.equal(alturasDifusor.size, 1, "el difusor es plano: una sola y");
  const yDifusor = [...alturasDifusor][0];

  const focos = focosLuminarias(sala);
  assert.ok(focos.length > 0);
  for (const [i, foco] of focos.entries()) {
    assert.equal(foco.posicion[1], yDifusor, `foco ${i} no cuelga del difusor`);
  }
});

// Tests for tonoLuminaria(nivelAlerta) function

test("tonoLuminaria: sin lectura de alerta, la luz calida de siempre", () => {
  // Un dato que no ha llegado no puede pintar la nave de rojo.
  for (const vacio of [null, undefined, "", {}]) {
    assert.equal(tonoLuminaria(vacio), LUZ_CALIDA, `${JSON.stringify(vacio)} no es una alerta`);
  }
});

test("tonoLuminaria: en verde tampoco se tiñe", () => {
  // `verde` no tiene entrada en ALERTA a proposito: la nave sin alerta no se
  // tiñe de nada. Si algun dia se le diera color, este test lo cazaria.
  assert.equal(tonoLuminaria("verde"), LUZ_CALIDA);
  assert.equal(ALERTA.niveles.verde, undefined, "verde sigue sin color, como manda paleta.mjs");
});

test("tonoLuminaria usa el tono del BORDE, no el del texto", () => {
  // La razon esta en filtros-escena.mjs: el rojo del texto esta ACLARADO para
  // leerse pequeño, y una luminaria es una superficie ancha. Con el aclarado, la
  // nave en alerta roja se lava a rosa.
  //
  // En AMARILLA los dos tonos coinciden, asi que ese nivel NO distingue: es roja
  // la que protege esta decision. Se comprueba la premisa para que el dia que la
  // paleta cambie, este test diga por que dejo de valer.
  assert.notEqual(ALERTA.niveles.roja.borde, ALERTA.niveles.roja.texto, "premisa: en roja difieren");
  assert.equal(tonoLuminaria("roja"), ALERTA.niveles.roja.borde);
  assert.notEqual(tonoLuminaria("roja"), ALERTA.niveles.roja.texto);

  assert.equal(ALERTA.niveles.amarilla.borde, ALERTA.niveles.amarilla.texto, "premisa: en amarilla coinciden");
  assert.equal(tonoLuminaria("amarilla"), ALERTA.niveles.amarilla.borde);
});

test("tonoLuminaria acepta el aviso entero, no solo la cadena", () => {
  // Es lo que devuelve normalizarAviso y lo que circula por alerta-escena.
  assert.equal(tonoLuminaria({ nivel: "roja", motivos: ["casco"] }), ALERTA.niveles.roja.borde);
});

// Tests for colorDifusorLuminaria(estado) (#765)

test("colorDifusorLuminaria: sin salud, se queda con el tono de la alerta y no parpadea", () => {
  for (const timeMs of [0, 500, 1000]) {
    const { color, emisivo } = colorDifusorLuminaria({ aviso: "roja", health: null, timeMs });
    assert.equal(color, ALERTA.niveles.roja.borde, `timeMs=${timeMs} no debe parpadear`);
    assert.equal(emisivo, true);
  }
});

test("colorDifusorLuminaria: con salud plena (1), tampoco parpadea", () => {
  for (const timeMs of [0, 500, 1000]) {
    const { color } = colorDifusorLuminaria({ aviso: null, health: 1, timeMs });
    assert.equal(color, LUZ_CALIDA, `timeMs=${timeMs} salud plena, sin parpadeo`);
  }
});

test("colorDifusorLuminaria: dañado (health < 1), parpadea a 500ms", () => {
  const health = 0.5;
  // En tiempo 0, encendida con el tono base.
  let estado = colorDifusorLuminaria({ aviso: null, health, timeMs: 0 });
  assert.equal(estado.color, LUZ_CALIDA);
  assert.equal(estado.emisivo, true);

  // En tiempo 500 ms, apagada (negro), pero sigue emisiva.
  estado = colorDifusorLuminaria({ aviso: null, health, timeMs: 500 });
  assert.equal(estado.color, 0x000000);
  assert.equal(estado.emisivo, true);

  // En tiempo 1000 ms, encendida de nuevo.
  estado = colorDifusorLuminaria({ aviso: null, health, timeMs: 1000 });
  assert.equal(estado.color, LUZ_CALIDA);
});

test("colorDifusorLuminaria: dañado y en alerta, el parpadeo usa el tono de la alerta", () => {
  const estado = colorDifusorLuminaria({ aviso: "roja", health: 0.2, timeMs: 0 });
  assert.equal(estado.color, ALERTA.niveles.roja.borde, "encendido: el tono de la alerta, no el cálido de siempre");
});

test("colorDifusorLuminaria: sin lectura de estado, comportamiento de siempre (luz cálida fija)", () => {
  const estado = colorDifusorLuminaria();
  assert.equal(estado.color, LUZ_CALIDA);
  assert.equal(estado.emisivo, true);
});
