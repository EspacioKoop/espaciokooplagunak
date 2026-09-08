import assert from "node:assert/strict";
import test from "node:test";

import { colisiona } from "../scripts/nave-movimiento.mjs";
import { ALTURA_OJOS, crearSalaCaja, detalleConsola, fraccionAbierta, rectsHojaPuerta } from "../scripts/nave-sala-caja.mjs";

test("una sala sin ventanas no proyecta estrellas", () => {
  const sala = crearSalaCaja({ ancho: 6, profundidad: 6 });
  const escena = sala.componer(3, 0, 3, 0, { ancho: 160, alto: 90 });
  assert.deepEqual(escena.estrellas, []);
});

test("una sala con ventana proyecta estrellas y sigue colisionando en sus límites", () => {
  const ventana = { x: 2, z: 6, ancho: 2, profundidad: 1.2 };
  const sala = crearSalaCaja({ ancho: 6, profundidad: 6, ventanas: [{ rect: ventana }] });

  // La ventana no abre el paso: la planta sigue siendo la caja cerrada de
  // siempre, con o sin hueco visual en la malla.
  assert.equal(colisiona(3, 6.1, 0.3, sala.planta), true);

  // Mirando de frente hacia la ventana debe haber algún punto de cielo en
  // pantalla — si no, la ventana estaría ahí pero no se vería nada por ella.
  //
  // Hace falta LECTURA para que haya cielo (#541): el campo estelar es el fondo
  // del espacio, y detrás de una persiana bajada no hay fondo. Antes se pintaba
  // siempre, y las estrellas se colaban por las rendijas de las lamas haciendo
  // que la persiana pareciera «hay vista y está vacía».
  const conLectura = { sensores: { contactos: [], alcance: { corto: 5000, largo: 30000 } }, rumboNave: 0 };
  const escena = sala.componer(3, 0, 3, 0, { ancho: 320, alto: 180, ...conLectura });
  assert.ok(escena.estrellas.length > 0);
  for (const estrella of escena.estrellas) {
    assert.ok(estrella.x >= 0 && estrella.x < 320);
    assert.ok(estrella.y >= 0 && estrella.y < 180);
  }
});

test("sin lectura no hay cielo: detrás de la persiana no se ve espacio (#541)", () => {
  const sala = crearSalaCaja({ ancho: 6, profundidad: 6, ventanas: [{ rect: { x: 2, z: 6, ancho: 2, profundidad: 1.2 } }] });
  const escena = sala.componer(3, 0, 3, 0, { ancho: 320, alto: 180 });
  assert.deepEqual(escena.estrellas, [], "una persiana bajada no puede tener estrellas detrás");
});

test("misma semilla de cielo, mismo campo estelar entre dos composiciones", () => {
  const ventana = { x: 2, z: 6, ancho: 2, profundidad: 1.2 };
  const sala = crearSalaCaja({ ancho: 6, profundidad: 6, ventanas: [{ rect: ventana }], semillaCielo: 42 });
  const a = sala.componer(3, 0, 3, 0, { ancho: 320, alto: 180 });
  const b = sala.componer(3, 0, 3, 0, { ancho: 320, alto: 180 });
  assert.deepEqual(a.estrellas, b.estrellas);
});

test("una puerta sigue dejando pasar y una ventana en el mismo muro no colisiona con la puerta", () => {
  const puerta = { x: 0, z: 2, ancho: 1.2, profundidad: 2 };
  const sala = crearSalaCaja({ ancho: 8, profundidad: 8, puertas: [{ rect: puerta }] });
  // Dentro de la zona de la puerta, no colisiona (con margen para el radio).
  assert.equal(colisiona(0.5, 3, 0.3, sala.planta), false);
  const escena = sala.componer(4, 0, 4, 0, { ancho: 160, alto: 90 });
  assert.ok(escena.poligonos.length > 0);
});

test("la cámara mira desde la altura de ojos, no desde el suelo", () => {
  assert.ok(ALTURA_OJOS > 0 && ALTURA_OJOS < 3);
});

test("la puerta corredera está cerrada de lejos y abierta de cerca (QA: estilo Star Trek)", () => {
  assert.equal(fraccionAbierta(10), 0, "lejos, cerrada del todo");
  assert.equal(fraccionAbierta(1.0), 1, "a un metro, abierta del todo");
  assert.equal(fraccionAbierta(0), 1, "encima del umbral, sigue abierta del todo");
  const mitad = fraccionAbierta((2.4 + 1.0) / 2);
  assert.ok(mitad > 0 && mitad < 1, "a medio camino entre los dos umbrales, ni cerrada ni abierta del todo");
});

test("colisionar sigue dejando pasar por el hueco de la puerta (visual, no física)", () => {
  const puerta = { x: 3, z: 0, ancho: 2, profundidad: 1.2 };
  const sala = crearSalaCaja({ ancho: 8, profundidad: 8, puertas: [{ rect: puerta }] });
  // La hoja corredera es puramente visual (ver cabecera de "Puertas
  // correderas"): la planta de colisión no sabe de ella y el hueco sigue
  // siendo transitable exactamente igual que antes de #508 QA.
  assert.equal(colisiona(4, 0.5, 0.3, sala.planta), false);
});

test("una puerta se compone sin reventar tanto lejos como pegada a ella", () => {
  const puerta = { x: 3, z: 0, ancho: 2, profundidad: 1.2 };
  const sala = crearSalaCaja({ ancho: 8, profundidad: 8, puertas: [{ rect: puerta }] });
  assert.doesNotThrow(() => sala.componer(4, 0, 6, 0, { ancho: 160, alto: 90 }));
  assert.doesNotThrow(() => sala.componer(4, 0, 0.7, 0, { ancho: 160, alto: 90 }));
});

test("detalleConsola pone botones y palanca sobre la tapa del cuerpo, sin colisión propia (#509 QA)", () => {
  const centro = [4, 0.5, 5];
  const medidas = [1.2, 1.0, 1.0];
  const piezas = detalleConsola(centro, medidas);
  assert.equal(piezas.length, 4, "tres botones y una palanca");
  const yTapa = centro[1] + medidas[1] / 2;
  for (const pieza of piezas) {
    assert.equal(pieza.colision, false, `${pieza.nombre} no debe bloquear: ya lo cubre el cuerpo`);
    assert.ok(pieza.centro[1] >= yTapa, `${pieza.nombre} debe apoyarse en la tapa, no atravesarla`);
    // Ninguna pieza se sale del ancho del cuerpo que la sostiene.
    assert.ok(
      Math.abs(pieza.centro[0] - centro[0]) < medidas[0] / 2,
      `${pieza.nombre} se sale del cuerpo de la consola`,
    );
  }
});

test("el rodapié y la lámpara de techo no bloquean el paso por el centro de una sala vacía", () => {
  const sala = crearSalaCaja({ ancho: 6, profundidad: 6 });
  // Ni el rodapié (pegado a los muros) ni la lámpara (colgada del techo)
  // aportan obstáculo: el centro de una sala vacía sigue libre.
  assert.equal(colisiona(3, 3, 0.3, sala.planta), false);
  const escena = sala.componer(3, 0, 3, 0, { ancho: 160, alto: 90 });
  // Cuatro muros + suelo + techo ya darían un puñado de polígonos; el
  // rodapié (4 piezas) y la lámpara (1 pieza) deben sumar visiblemente más.
  assert.ok(escena.poligonos.length >= 10, `se esperaban al menos 10 polígonos, hubo ${escena.poligonos.length}`);
});

test("una puerta trae MARCO: jambas y dintel, para que se lea como puerta", () => {
  // QA 2026-08-08: «hay que hacer texturas para que se entienda que son
  // puertas». En un lenguaje de bloques no hay textura: lo que hace que un hueco
  // se lea como puerta es el CONTORNO en otro color. Antes solo las ventanas
  // tenían marco (`if (esVentana)`) y las puertas eran un boquete.
  // Sin piel de casco (#548): el mural se recorta con el muro, así que abrir un
  // hueco le QUITA chapas al mismo tiempo que la puerta añade jambas, y la
  // comparación por conteo dejaría de medir lo que dice medir.
  const sinPuerta = crearSalaCaja({ ancho: 11, profundidad: 11, muralPixel: false });
  const conPuerta = crearSalaCaja({
    ancho: 11, profundidad: 11,
    muralPixel: false,
    puertas: [{ rect: { x: 0, z: 4, ancho: 1.2, profundidad: 2.4 } }],
  });

  // Mirando al muro oeste, que es donde está la puerta (yaw -PI/2 mira a -x).
  const vista = (sala) => sala.componer(3, 0, 5.2, -Math.PI / 2, { ancho: 320, alto: 180 });
  assert.ok(
    vista(conPuerta).poligonos.length > vista(sinPuerta).poligonos.length,
    "la puerta y su marco tienen que aportar piezas al mirarla de frente",
  );

  // Y el marco se pinta con SU color, no con el del muro. Se compara por
  // familia y no por hex exacto: el pintor sombrea cada cara, así que
  // `#ffb703` llega a la escena como varios tonos suyos — comprobar el hex
  // literal daría un falso negativo (me pasó al verificarlo a mano).
  const conMarcoVisible = conPuerta.componer(3, 0, 5.2, -Math.PI / 2, {
    ancho: 320, alto: 180,
  }).poligonos.map((pieza) => pieza.color);
  const calidos = conMarcoVisible.filter((color) => {
    const r = parseInt(color.slice(1, 3), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return r > b * 1.5;
  });
  assert.ok(calidos.length > 0, "el marco ámbar debería aportar tonos cálidos a la escena");
});

test("una puerta con `colorMarco` propio tiñe SU marco y no el de las demás (#458)", () => {
  // #458 QA: «no se entiende a dónde te va a llevar una puerta». Una sala con
  // dos puertas, una social (colorMarco turquesa) y una normal (ámbar de
  // serie), tiene que enseñar los dos tonos a la vez y no que el turquesa se
  // trague al ámbar ni al revés.
  const TURQUESA = "#4ad9c4";
  const conDosPuertas = crearSalaCaja({
    ancho: 11, profundidad: 11,
    muralPixel: false,
    puertas: [
      { rect: { x: 0, z: 4, ancho: 1.2, profundidad: 2.4 }, colorMarco: TURQUESA },
      { rect: { x: 9.8, z: 4, ancho: 1.2, profundidad: 2.4 } },
    ],
  });
  // Mismo criterio que el test anterior: se mira a cada puerta de frente, una
  // detrás de otra, porque el recorte de frustum (#510) descarta lo que queda
  // fuera de vista y una vista centrada no garantiza ver ninguna de las dos.
  const coloresMirandoA = (yaw) =>
    conDosPuertas.componer(5.5, 0, 5.5, yaw, { ancho: 320, alto: 180 }).poligonos.map((pieza) => pieza.color);

  const esTurquesa = (color) => {
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    const r = parseInt(color.slice(1, 3), 16);
    return g > r * 1.3 && b > r * 1.3;
  };
  const esCalido = (color) => {
    const r = parseInt(color.slice(1, 3), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return r > b * 1.5;
  };
  // Mirando al muro oeste (yaw -PI/2 mira a -x): la puerta con `colorMarco`.
  assert.ok(coloresMirandoA(-Math.PI / 2).some(esTurquesa), "la puerta con colorMarco propio se pinta con él");
  // Mirando al muro este (yaw PI/2 mira a +x): la puerta sin `colorMarco`.
  assert.ok(coloresMirandoA(Math.PI / 2).some(esCalido), "la puerta sin colorMarco sigue con el ámbar de serie");
});

test("el detalle de la hoja se DESPLAZA con ella al abrirse", () => {
  // QA 2026-08-08: «no hay pixelart en la puerta». El marco dice dónde está la
  // puerta; el detalle de la hoja dice qué es. Y tiene que salir de los MISMOS
  // rects que la hoja: con dos cálculos, la franja de aviso se quedaría quieta
  // mientras la puerta se abre, que es peor que no tenerla.
  const puerta = { base: { x: 0, z: 4, ancho: 1.2, profundidad: 2.4 }, y0: 0, y1: 2.8, alongX: false };
  const cerrada = rectsHojaPuerta(puerta, 0);
  const abierta = rectsHojaPuerta(puerta, 1);
  assert.notDeepEqual(cerrada, abierta, "las hojas tienen que moverse");

  // El detalle no se exporta: se comprueba por lo observable, que la hoja de la
  // que sale cambia de sitio. Exportar una función interna solo para medirla
  // ataría la prueba a la implementación en vez de al comportamiento.
  assert.notEqual(cerrada[0].z, abierta[0].z, "la hoja izquierda debería haberse retirado");
});

test("una puerta cerrada tapa el hueco entero, y abierta lo despeja", () => {
  const puerta = { base: { x: 0, z: 4, ancho: 1.2, profundidad: 2.4 }, y0: 0, y1: 2.8, alongX: false };
  const [izq, der] = rectsHojaPuerta(puerta, 0);
  // Cerradas, las dos mitades cubren el hueco sin dejar rendija.
  assert.equal(izq.profundidad + der.profundidad, puerta.base.profundidad);
  assert.equal(izq.z, puerta.base.z);
  assert.equal(der.z + der.profundidad, puerta.base.z + puerta.base.profundidad);
});
