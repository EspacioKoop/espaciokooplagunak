#!/usr/bin/env node
/**
 * Driver del banco de pruebas (#976): la única pieza que faltaba para que las
 * sondas (`banco-figura.mjs`, `banco-objetos.mjs`) produjeran algo que se
 * pueda MIRAR. Sin esto, ninguna de las dos hacía nada al ejecutarse: eran
 * geometría y catálogo sin quien las compusiera y llamara a `renderizar`.
 *
 * Monta la figura, le cuelga la espada del anclaje que la propia figura
 * declara (`manoDerecha`) y la gira un poco para que se lea en 3/4 y no de
 * frente — el resto es composición mínima, sin más decisión de arte que esa.
 *
 * Uso: node tools/banco-avatar-armado.mjs [ruta-destino.png]
 */
import { piezasFigura, girar } from "./banco-figura.mjs";
import { sostener } from "./banco-objetos.mjs";
import { componerEscena, fundirEscenas } from "../foundry-module/scripts/retro3d.mjs";
import { renderizar } from "./banco-retro3d.mjs";

const ANCHO = 320;
const ALTO = 240;
const EPOCA = "psx";
// Gira sujeto y arma juntos, como si la cámara diera la vuelta a una vitrina:
// el mismo truco de `girarNave`, aplicado a mano porque este no es un bucle.
const GIRO = 0.6;

function escenaAvatarArmado() {
  const { piezas, brazoDerecho, manoDerecha } = piezasFigura({});
  const espada = sostener("espada", manoDerecha);
  // La espada nace vertical (hoja hacia +y); para que la empuñe en vez de
  // llevarla clavada en el suelo, se gira 90° sobre el eje x, pieza a pieza
  // para no perder los índices de cara de cada una.
  const espadaGirada = espada.map((p) => girar(p, manoDerecha, Math.PI / 2, "x"));

  const todas = [...piezas, ...brazoDerecho, ...espadaGirada].map((p) =>
    girar(p, manoDerecha, GIRO, "y"),
  );

  const escenas = todas.map(({ color, ...malla }) =>
    componerEscena(malla, {
      ancho: ANCHO,
      alto: ALTO,
      epoca: EPOCA,
      color,
      fov: 45,
      // La figura mide algo menos de dos metros; a 3,2 m de la cámara entra
      // entera con margen arriba y abajo.
      posicion: [0, -0.9, 3.2],
      fondo: "#0b0f14",
    }),
  );
  return fundirEscenas(escenas);
}

const destino = process.argv[2] ?? new URL("../banco-avatar-armado.png", import.meta.url).pathname;
const { dibujados, colores } = renderizar(escenaAvatarArmado(), destino);
console.log(`${destino}: ${dibujados} polígonos, ${colores} colores`);
