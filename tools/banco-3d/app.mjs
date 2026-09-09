// Aplicación real del banco de pruebas (#976): importa los módulos de
// PRODUCCIÓN por ESM y los pinta en un <canvas> de verdad con el mismo
// `pintarEscena` que usa el juego. Nada se simula aquí — si la proyección
// está mal, se ve mal aquí también, que es la condición que puso #976.
//
// `capturar.mjs` maneja estos mismos controles vía DOM (sin ningún atajo por
// JS interno) para que la captura ejercite exactamente lo que vería una
// persona.
import { componerEscena, fundirEscenas } from "../../foundry-module/scripts/retro3d.mjs";
import { pintarEscena } from "../../foundry-module/scripts/retro3d-lienzo.mjs";
import { ALTO_BASE } from "../../foundry-module/scripts/cantina-avatar.mjs";
import { piezasFigura, girar } from "../banco-figura.mjs";
import { piezasEspada } from "../banco-espada.mjs";
import { OBJETOS, sostener } from "../banco-objetos.mjs";

const ANCHO = 320;
const ALTO = 240;
// Balanceo máximo de una pierna en el ciclo de marcha, en radianes.
const SWING_MAXIMO = 0.5;

const lienzo = document.getElementById("lienzo");
const ctx = lienzo.getContext("2d");
const selMalla = document.getElementById("malla");
const selEpoca = document.getElementById("epoca");
const inputYaw = document.getElementById("yaw");
const inputFase = document.getElementById("fase");
const salidaYaw = document.getElementById("yaw-valor");
const salidaFase = document.getElementById("fase-valor");
const estado = document.getElementById("estado");

/**
 * Aplica el ciclo de marcha a las piezas de la figura. `piezasFigura` devuelve
 * las piernas y botas en posiciones fijas de `piezas`
 * (0-1 piernas, 2-3 botas, en orden izquierda/derecha): se rotan alrededor de
 * la cadera sobre el eje X, en contrafase entre ambas piernas.
 */
function conMarcha(piezas, altoPiernas, fase) {
  const angulo = Math.sin(fase * Math.PI * 2) * SWING_MAXIMO;
  const cadera = [0, altoPiernas, 0];
  return piezas.map((pieza, indice) => {
    if (indice > 3) return pieza;
    const esIzquierda = indice === 0 || indice === 2;
    return girar(pieza, cadera, esIzquierda ? angulo : -angulo, "x");
  });
}

function escenaFigura({ conEspada, fase }) {
  const alto = ALTO_BASE;
  const altoPiernas = alto - alto * 0.26 - alto * 0.36;
  const { piezas, brazoDerecho, manoDerecha } = piezasFigura({});
  const piezasAnimadas = conMarcha(piezas, altoPiernas, fase);
  let todas = [...piezasAnimadas, ...brazoDerecho];
  if (conEspada) {
    const espada = sostener("espada", manoDerecha);
    const espadaGirada = espada.map((p) => girar(p, manoDerecha, Math.PI / 2, "x"));
    todas = [...todas, ...espadaGirada];
  }
  return todas;
}

function piezasMalla(nombre, fase) {
  if (nombre === "figura") return escenaFigura({ conEspada: false, fase });
  if (nombre === "figura-espada") return escenaFigura({ conEspada: true, fase });
  if (nombre === "espada") return piezasEspada(0);
  if (OBJETOS[nombre]) return OBJETOS[nombre]().piezas;
  return [];
}

function renderizar() {
  const nombreMalla = selMalla.value;
  const epoca = selEpoca.value;
  const yaw = Number(inputYaw.value);
  const fase = Number(inputFase.value);
  salidaYaw.textContent = yaw.toFixed(2);
  salidaFase.textContent = fase.toFixed(2);

  const piezas = piezasMalla(nombreMalla, fase);
  const compuestas = piezas.map(({ color, ...malla }) =>
    componerEscena(malla, {
      ancho: ANCHO,
      alto: ALTO,
      epoca,
      color,
      fov: 45,
      yaw,
      posicion: [0, -0.9, 3.2],
      fondo: "#0b0f14",
    }),
  );
  const escena = fundirEscenas(compuestas);
  const dibujados = pintarEscena(ctx, escena, { fondo: "#0b0f14" });
  estado.textContent = `${nombreMalla} · ${epoca} · yaw=${yaw.toFixed(2)} · fase=${fase.toFixed(2)} · ${dibujados} caras`;
  // Marca de sincronización para quien capture con Playwright: sin esto, un
  // guion externo no tiene forma de saber si ya se repintó tras cambiar un
  // control.
  lienzo.dataset.render = String(Date.now());
}

for (const el of [selMalla, selEpoca, inputYaw, inputFase]) {
  el.addEventListener("input", renderizar);
  el.addEventListener("change", renderizar);
}

renderizar();
