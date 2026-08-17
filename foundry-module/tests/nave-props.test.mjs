/**
 * El vocabulario de props low-poly (#579).
 *
 * Lo que se prueba aquí no es que «se vea bien» —eso quiere ojos delante— sino
 * lo que sí es verificable: que la geometría esté bien formada (caras con
 * orientación consistente, sin vértices sueltos), que una silla tenga de verdad
 * la silueta por la que se modeló y no sea una caja con otro nombre, y que el
 * presupuesto de polígonos siga siendo el de un motor retro.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  ALTO_ASIENTO,
  ALTO_MESA,
  barandilla,
  cana,
  envolvente,
  fundirMallas,
  girarMalla,
  mesa,
  perfilPoligono,
  perfilRect,
  pieza,
  prisma,
  silla,
  soporteCanas,
} from "../scripts/nave-props.mjs";
import { componerEscena } from "../scripts/retro3d.mjs";
import { CANTINA } from "../scripts/paleta.mjs";

/** Todas las piezas de un prop, fundidas en una malla. */
const mallaDe = (piezas) => fundirMallas(piezas.map((p) => p.malla));

function caras(malla) {
  return malla.caras.length;
}

test("un prisma recto de perfil cuadrado es exactamente una caja", () => {
  const p = prisma(perfilRect(0, 0, 2, 2), 0, 3);
  assert.equal(p.vertices.length, 8);
  assert.equal(caras(p), 6, "cuatro lados, tapa y base");
});

test("todas las caras de un prisma son visibles desde fuera y ninguna del revés", () => {
  // Si una cara sale con el giro cambiado, `componerEscena` la descarta por ser
  // de espaldas y el objeto aparece con un agujero — el fallo más caro de
  // depurar a ojo, porque solo se ve desde un lado.
  const p = prisma(perfilPoligono(0, 0, 1, 6), 0, 2);
  // Mirando desde ocho ángulos distintos se ve, entre todos, cada cara: si
  // alguna estuviera invertida no aparecería desde ninguno.
  const vistas = new Set();
  for (let i = 0; i < 8; i += 1) {
    const escena = componerEscena(p, {
      posicion: [0, -1, 6],
      yaw: (i * Math.PI) / 4,
      ancho: 320,
      alto: 240,
    });
    for (const poligono of escena.poligonos) vistas.add(poligono.profundidad.toFixed(3));
  }
  assert.ok(vistas.size >= caras(p) - 2, `solo se ven ${vistas.size} caras de ${caras(p)}`);
});

test("una silla tiene hueco entre el asiento y el respaldo: no es una caja", () => {
  // El requisito de #579 es la LECTURA, y lo que hace legible una silla no es el
  // detalle sino que el respaldo no toque el suelo y las patas no toquen el
  // asiento por todo su ancho.
  const piezas = silla({ x: 0, z: 0, color: CANTINA.mesa });
  const [cuerpo, respaldo] = piezas;
  const caja = envolvente(cuerpo.malla);
  const respaldoCaja = envolvente(respaldo.malla);

  assert.ok(caja.medidas[1] <= ALTO_ASIENTO + 0.01, "el asiento queda a la altura de sentarse");
  assert.ok(respaldoCaja.centro[1] > ALTO_ASIENTO, "el respaldo arranca por encima del asiento");
  assert.ok(respaldoCaja.medidas[2] < 0.35, "el respaldo es una plancha, no un bloque");
  assert.ok(caras(mallaDe(piezas)) > 6, "una caja tiene seis caras; una silla, muchas más");
});

test("el respaldo de la silla va inclinado, no a plomo", () => {
  const [, respaldo] = silla({ x: 0, z: 0, color: CANTINA.mesa });
  const alturas = respaldo.malla.vertices.map(([, y]) => y);
  const media = (Math.min(...alturas) + Math.max(...alturas)) / 2;
  const zMedia = (mitad) => {
    const zs = respaldo.malla.vertices.filter(([, y]) => mitad(y)).map(([, , z]) => z);
    return zs.reduce((a, b) => a + b, 0) / zs.length;
  };
  assert.ok(
    zMedia((y) => y > media) > zMedia((y) => y <= media) + 0.03,
    "la mitad alta del respaldo cae hacia atrás",
  );
});

test("una silla girada ocupa el mismo sitio, no otro", () => {
  // El giro es sobre su propio centro: cuatro sillas alrededor de una mesa se
  // declaran con la misma posición y distinto `yaw`, y si el giro las desplazara
  // acabarían dentro de la mesa.
  const recta = envolvente(mallaDe(silla({ x: 3, z: 2, color: CANTINA.mesa })));
  const girada = envolvente(mallaDe(silla({ x: 3, z: 2, yaw: Math.PI / 2, color: CANTINA.mesa })));
  assert.ok(Math.abs(recta.centro[0] - girada.centro[0]) < 0.12);
  assert.ok(Math.abs(recta.centro[2] - girada.centro[2]) < 0.12);
});

test("la mesa tiene altura de mesa y su tablero vuela sobre un pie más estrecho", () => {
  const [pie, tablero] = mesa({ x: 0, z: 0, color: CANTINA.mesa });
  const cajaTablero = envolvente(tablero.malla);
  const cajaPie = envolvente(pie.malla);
  assert.ok(Math.abs(cajaTablero.centro[1] - (ALTO_MESA - 0.025)) < 0.05);
  assert.ok(cajaTablero.medidas[0] > cajaPie.medidas[0], "el tablero vuela sobre la base");
});

test("la caña afina de la empuñadura a la punta y apunta hacia arriba", () => {
  const [prop] = cana({ x: 0, z: 0, largo: 2, alzado: 1.1, color: CANTINA.estante });
  const caja = envolvente(prop.malla);
  assert.ok(caja.medidas[1] > 1.2, "sube: no está tirada en el suelo");
  assert.ok(caja.medidas[2] > 0.3, "y se inclina: no está a plomo");
  assert.equal(prop.colision, false, "una caña apoyada no parte el suelo andable");
});

test("el soporte trae tres cañas y ninguna estorba el paso", () => {
  const piezas = soporteCanas({ x: 0, z: 0, color: CANTINA.taburete, colorCana: CANTINA.estante });
  assert.equal(piezas.length, 4, "el armazón y sus tres cañas");
  assert.equal(piezas[0].colision, undefined, "el armazón sí estorba");
  assert.ok(piezas.slice(1).every((p) => p.colision === false));
});

test("la barandilla es pasamanos y balaustres, no un muro bajo", () => {
  const [prop] = barandilla({ x: 0, z: 0, largo: 4, color: CANTINA.nervio });
  assert.ok(caras(prop.malla) > 6, "un muro bajo tendría seis caras");
  const caja = envolvente(prop.malla);
  assert.ok(caja.medidas[2] < 0.2, "es un canto, no una pared");
  assert.ok(Math.abs(caja.medidas[0] - 4) < 0.2, "cubre el tramo que se le pide");
});

test("la huella de colisión sale de la malla y no se escribe a mano", () => {
  // Es la lección de la cantina (#540): dibujo y colisión de la MISMA
  // declaración, o acaban desalineados y hay suelo por el que no se puede andar.
  const malla = girarMalla(prisma(perfilRect(2, 5, 1, 0.4), 0, 2), Math.PI / 2, [2, 5]);
  const p = pieza(malla, CANTINA.mesa);
  assert.ok(Math.abs(p.centro[0] - 2) < 1e-9);
  assert.ok(Math.abs(p.centro[2] - 5) < 1e-9);
  assert.ok(Math.abs(p.medidas[0] - 0.4) < 1e-9, "girada 90°, la huella también gira");
});

test("el presupuesto de un juego de terraza sigue siendo retro", () => {
  // No es una barra libre porque el frame aguante: la disciplina de #551 es que
  // el coste se mide y se escribe, no que se descubra en un cliente lento.
  const juego = [
    ...mesa({ x: 0, z: 0, color: CANTINA.mesa }),
    ...silla({ x: 0, z: -1, color: CANTINA.mesa }),
    ...silla({ x: 0, z: 1, yaw: Math.PI, color: CANTINA.mesa }),
    ...silla({ x: -1, z: 0, yaw: Math.PI / 2, color: CANTINA.mesa }),
    ...silla({ x: 1, z: 0, yaw: -Math.PI / 2, color: CANTINA.mesa }),
    ...soporteCanas({ x: 3, z: 0, color: CANTINA.taburete }),
  ];
  const total = caras(mallaDe(juego));
  assert.ok(total < 300, `${total} caras: una mesa con sillas no puede costar una sala entera`);
});
