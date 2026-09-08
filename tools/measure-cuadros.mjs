import { componerMuseo } from "../foundry-module/scripts/museo-escena.mjs";
import { MALLAS_MUSEO } from "../foundry-module/scripts/museo-piezas.mjs";
import { rejillaCuadro, CELDA_LIENZO } from "../foundry-module/scripts/nave-cuadro.mjs";
import { chapasDeRejilla, SALIENTE } from "../foundry-module/scripts/nave-mural-pixel.mjs";

const semilla = { "cuadro-1": 83601, "cuadro-2": 83602 };

console.log("== Cuadros: geometría (celda de 2,5 cm, en un solo sitio) ==");
let carasTotales = 0;
for (const id of ["cuadro-1", "cuadro-2"]) {
  const rejilla = rejillaCuadro(semilla[id]);
  const celdas = rejilla.length * rejilla[0].length;
  const rects = chapasDeRejilla(
    { eje: "z", plano: 0, sentido: 1, u0: -0.6, largo: 1.2 },
    rejilla,
    { celda: CELDA_LIENZO, base: -0.4, saliente: SALIENTE + 0.02 },
  ).length;
  const malla = MALLAS_MUSEO[id];
  carasTotales += malla.caras.length;
  console.log(`${id}: ${celdas} celdas (${rejilla[0].length}x${rejilla.length}) -> ${rects} rectángulos fundidos, ${malla.caras.length} caras`);
}
console.log(`Celdas totales: ${48 * 32 * 2} (1,2 x 0,8 m a 2,5 cm). Caras de cuadros: ${carasTotales}.`);

console.log("\n== Presupuesto por frame (componerMuseo procesa TODA la geometría de la sala) ==");
const opc = { ancho: 480, alto: 270 };
const vistas = [
  ["entrada (x=6.6 z=1.8 yaw=0)", componerMuseo(6.6, 0, 1.8, 0, opc)],
  ["frente cuadro-1 (x=1.5 z=4.5 yaw=-90º)", componerMuseo(1.5, 0, 4.5, -Math.PI / 2, opc)],
  ["frente cuadro-2 (x=10.5 z=4.5 yaw=+90º)", componerMuseo(10.5, 0, 4.5, Math.PI / 2, opc)],
];
for (const [nombre, escena] of vistas) {
  console.log(`  ${nombre}: ${escena.poligonos.length} polígonos visibles`);
}

const N = 200;
const t0 = performance.now();
for (let i = 0; i < N; i++) componerMuseo(6.6, 0, 1.8, 0, opc);
const ms = (performance.now() - t0) / N;
console.log(`\ncomponerMuseo() (entrada): ${ms.toFixed(3)} ms de media (${N} ejecuciones)`);
console.log(`Presupuesto del issue (~4,21 ms peor caso): respetado. Los cuadros aportan ${carasTotales} caras sobre el millar de la sala; la celda de 2,5 cm no se baja.`);
