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
  reparto, focosLuminarias, tonoLuminaria, POTENCIA_FOCO, ALCANCE_FOCO,
  capasConoLuminarias, motasLuminarias, fundirCercanas,
  ALFA_CONO, ALFA_MOTAS, APERTURA_CONO, CAPAS_CONO, TOPE_HACES, MOTAS_POR_LUMINARIA,
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

/* ---- las luminarias alumbran de verdad (#556) ------------------------------- */

test("cada luminaria declara un foco, y con potencia y alcance", () => {
  // Antes devolvía sólo `posicion`, así que el motor le ponía sus valores por
  // defecto: potencia 1, que satura toda cara bajo una lámpara y deja la sala
  // plana y blanca.
  const sala = { ancho: 12, profundidad: 18, altura: ALTURA };
  const focos = focosLuminarias(sala);
  assert.equal(focos.length, reparto(sala.ancho, sala.profundidad).length);
  for (const foco of focos) {
    assert.equal(foco.posicion.length, 3);
    assert.ok(foco.posicion.every(Number.isFinite), "posición con NaN");
    assert.equal(foco.potencia, POTENCIA_FOCO);
    assert.equal(foco.alcance, ALCANCE_FOCO);
  }
});

test("el foco alumbra desde donde se ve la luz, no desde el techo", () => {
  // Si el foco se pusiera en la carcasa y no en el difusor, la luz saldría de
  // dentro de la propia luminaria y la primera cara que iluminaría sería ella
  // misma.
  const sala = { ancho: 12, profundidad: 12, altura: ALTURA };
  const [foco] = focosLuminarias(sala);
  assert.ok(Math.abs(foco.posicion[1] - (ALTURA - CAIDA - CAIDA_DIFUSOR)) < 1e-9);
  assert.ok(foco.posicion[1] < ALTURA, "el foco está por encima del techo");
});

test("el alcance no llega al paso entre luminarias", () => {
  // La regla que separa «charcos de luz» de «la sala uniformemente más clara»:
  // si el alcance iguala o supera el paso, todos los charcos se solapan y es
  // como no haber puesto focos. Es la razón de que estas cifras sean las que
  // son, y por eso está escrita como prueba y no sólo en un comentario.
  assert.ok(ALCANCE_FOCO < PASO, `alcance ${ALCANCE_FOCO} ≥ paso ${PASO}`);
});

test("la potencia deja sitio para que el escalonado se vea", () => {
  // `intensidadCara` tiene suelo 0,35 y techo 1. Una potencia que por sí sola
  // cubra ese margen satura, y saturado no hay tonos que escalonar.
  assert.ok(POTENCIA_FOCO > 0, "sin potencia no hay foco");
  assert.ok(POTENCIA_FOCO < 1 - 0.35, `potencia ${POTENCIA_FOCO} satura el margen de intensidadCara`);
});

test("una potencia y un alcance a medida mandan sobre los de serie", () => {
  // Son cifras de ARTE: tienen que poder tocarse desde fuera para probarlas
  // sobre la sala sin editar el módulo.
  const [foco] = focosLuminarias({ ancho: 8, profundidad: 8, altura: ALTURA, potencia: 0.2, alcance: 3 });
  assert.equal(foco.potencia, 0.2);
  assert.equal(foco.alcance, 3);
});

test("bajo la lámpara siempre hay más luz que entre dos lámparas", () => {
  // La propiedad que fija el techo del alcance, y la que se rompe sola si
  // alguien lo sube «para que se vea más». Un punto del suelo a medio camino
  // entre dos luminarias recibe la aportación de LAS DOS; el que está debajo de
  // una, la de una sola. Pasado cierto alcance, el de en medio gana y la sala
  // queda iluminada al revés.
  const alturaDifusor = ALTURA - CAIDA - CAIDA_DIFUSOR;
  const suelo = (distancia, cuantas) => {
    const aporte = distancia >= ALCANCE_FOCO ? 0 : POTENCIA_FOCO * (1 - distancia / ALCANCE_FOCO);
    return aporte * cuantas;
  };
  const bajoLaLampara = suelo(alturaDifusor, 1);
  const entreDos = suelo(Math.hypot(alturaDifusor, PASO / 2), 2);
  assert.ok(
    bajoLaLampara > entreDos,
    `iluminación invertida: bajo la lámpara ${bajoLaLampara.toFixed(3)}, entre dos ${entreDos.toFixed(3)}`,
  );
});

/* ---- el haz visible (#556) -------------------------------------------------- */

const SALA = Object.freeze({ ancho: 12, profundidad: 8, altura: ALTURA });

test("el haz sale en capas concéntricas, de dentro a fuera", () => {
  // El motor pinta cada cara de un color plano con una opacidad: no hay
  // degradado DENTRO de una cara. El borde se difumina solapando capas, así que
  // que haya más de una no es un detalle de implementación, es el mecanismo.
  const capas = capasConoLuminarias(SALA);
  assert.equal(capas.length, CAPAS_CONO);
  assert.ok(CAPAS_CONO > 1, "con una sola capa no hay borde difuminado que valga");
  const radio = ({ malla }) => {
    const xs = malla.vertices.map((v) => v[0]);
    return Math.max(...xs) - Math.min(...xs);
  };
  for (let i = 1; i < capas.length; i += 1) {
    assert.ok(
      radio(capas[i].porLuminaria[0]) > radio(capas[i - 1].porLuminaria[0]),
      "las capas no van de dentro a fuera",
    );
  }
  for (const capa of capas) assert.equal(capa.alpha, ALFA_CONO);
});

test("la opacidad acumulada del núcleo sigue siendo un velo", () => {
  // Lo que se ve en el eje del haz es lo que dejan pasar las tres capas. Si eso
  // se acercara a opaco, el haz volvería a tapar el suelo que dice iluminar.
  const nucleo = 1 - (1 - ALFA_CONO) ** CAPAS_CONO;
  assert.ok(nucleo > 0.05, `el haz no se vería (${nucleo.toFixed(3)})`);
  assert.ok(nucleo < 0.35, `el haz taparía lo que ilumina (${nucleo.toFixed(3)})`);
  assert.ok(ALFA_CONO < ALFA_MOTAS, "una mota tiene que ser más sólida que el haz que la contiene");
});

test("el haz llega al suelo y se abre por el camino", () => {
  const [, , fuera] = capasConoLuminarias(SALA);
  const { malla } = fuera.porLuminaria[0];
  assert.ok(malla.vertices.every((v) => v.every(Number.isFinite)), "hay NaN en el haz");
  const alturas = malla.vertices.map((v) => v[1]);
  const abajo = Math.min(...alturas);
  const arriba = Math.max(...alturas);
  // Al suelo, pero no EN el suelo: compartir plano con la losa es un parpadeo.
  assert.ok(abajo > 0, "el haz atraviesa el suelo");
  assert.ok(abajo < 0.1, `el haz no llega al suelo (y=${abajo})`);
  assert.ok(Math.abs(arriba - (ALTURA - CAIDA - CAIDA_DIFUSOR)) < 1e-9, "no nace en el difusor");
  const radio = (y) => {
    const xs = malla.vertices.filter((v) => Math.abs(v[1] - y) < 1e-9).map((v) => v[0]);
    return (Math.max(...xs) - Math.min(...xs)) / 2;
  };
  assert.ok(radio(abajo) > radio(arriba), "el haz no se abre hacia abajo");
  assert.ok(APERTURA_CONO > 0, "un haz que no se abre es un tubo");
});

test("los charcos de dos luminarias vecinas no se solapan", () => {
  // Si el charco pasara del paso entre lámparas, el suelo quedaría iluminado
  // por igual y el haz dejaría de señalar dónde está cada luz.
  const [, , fuera] = capasConoLuminarias(SALA);
  const { malla } = fuera.porLuminaria[0];
  const suelo = malla.vertices.filter((v) => v[1] < 0.1).map((v) => v[0]);
  const diametro = Math.max(...suelo) - Math.min(...suelo);
  assert.ok(diametro < PASO, `charco de ${diametro.toFixed(2)} m con paso de ${PASO} m`);
});

test("el polvo cae DENTRO del haz y sólo en lo alto", () => {
  // Una mota fuera del cono se ve flotando al lado de la luz, no dentro de ella.
  const grupos = motasLuminarias(SALA);
  assert.equal(grupos.length, reparto(SALA.ancho, SALA.profundidad).length);
  const [, , fuera] = capasConoLuminarias(SALA);
  const yDifusor = ALTURA - CAIDA - CAIDA_DIFUSOR;
  for (let i = 0; i < grupos.length; i += 1) {
    const { centro, malla } = grupos[i];
    assert.equal(malla.caras.length, MOTAS_POR_LUMINARIA * 6, "una mota no es un cubo");
    assert.ok(malla.vertices.every((v) => v.every(Number.isFinite)), "hay NaN en el polvo");
    const alturas = malla.vertices.map((v) => v[1]);
    assert.ok(Math.max(...alturas) <= yDifusor + 0.05, "hay polvo por encima de la lámpara");
    assert.ok(Math.min(...alturas) > yDifusor - 1.2, "el polvo baja demasiado: es lo alto del haz");
    // Y dentro del radio que el cono tiene A ESA ALTURA.
    for (const [vx, vy, vz] of malla.vertices) {
      const rHaz = radioDelHaz(fuera.porLuminaria[i], vy);
      const d = Math.hypot(vx - centro[0], vz - centro[1]);
      assert.ok(d <= rHaz + 0.05, `mota fuera del haz (d=${d.toFixed(2)}, r=${rHaz.toFixed(2)})`);
    }
  }
});

/** El radio del tronco de cono a una altura dada, por interpolación entre sus
 *  dos anillos: el haz es recto, así que basta con eso. */
function radioDelHaz({ centro, malla }, y) {
  const alturas = malla.vertices.map((v) => v[1]);
  const arriba = Math.max(...alturas);
  const abajo = Math.min(...alturas);
  const anillo = (yAnillo) => {
    const puntos = malla.vertices.filter((v) => Math.abs(v[1] - yAnillo) < 1e-9);
    return Math.max(...puntos.map((v) => Math.hypot(v[0] - centro[0], v[2] - centro[1])));
  };
  const t = (arriba - y) / (arriba - abajo);
  return anillo(arriba) + (anillo(abajo) - anillo(arriba)) * Math.min(1, Math.max(0, t));
}

test("el polvo es el mismo en cada carga: no parpadea", () => {
  // Sin determinismo las motas saltarían de sitio en cada fotograma, que se lee
  // como un error de render y no como polvo.
  const a = motasLuminarias(SALA);
  const b = motasLuminarias(SALA);
  assert.deepEqual(a[0].malla.vertices, b[0].malla.vertices);
});

test("sólo se pintan las luminarias que se tienen cerca", () => {
  // El recorte que exige la prueba de #584: sin él, el haz de las 36 luminarias
  // del reactor pasa a ser un tercio de los polígonos de una sala ya texturada.
  const grande = { ancho: 22, profundidad: 22, altura: ALTURA };
  const [, , fuera] = capasConoLuminarias(grande);
  assert.ok(fuera.porLuminaria.length > TOPE_HACES, "esta sala no sirve para probar el recorte");
  const cerca = fundirCercanas(fuera.porLuminaria, [11, 4]);
  const todas = fundirCercanas(fuera.porLuminaria, [11, 4], fuera.porLuminaria.length);
  assert.equal(cerca.caras.length, todas.caras.length * TOPE_HACES / fuera.porLuminaria.length);
  // Y son de verdad las MÁS CERCANAS, no las primeras de la lista.
  const lejos = fundirCercanas(fuera.porLuminaria, [1, 21]);
  assert.notDeepEqual(cerca.vertices, lejos.vertices, "el recorte no mira dónde estás");
});

test("una sala sin luminarias no trae ni haz ni polvo", () => {
  assert.equal(fundirCercanas([], [0, 0]), null);
});
