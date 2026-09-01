// Vertical de prueba del contrato de interacción (#868): un terminal
// deteriorado, resoluble de principio a fin sin ninguna regla de D&D.
//
// Tres aproximaciones con su propio compromiso riesgo/dificultad — no son tres
// habilidades de ficha, son tres formas de intentarlo que cualquier mesa
// entiende sin abrir un manual: ir con cuidado (más lento, más fiable),
// forzarlo (término medio) o el golpe seco (rápido, poco fiable). El efecto
// por banda demuestra el contrato entero: `critico` deja el terminal
// reparado, `exito` lo dice a medias, `fallo` no cambia nada observable (por
// eso no declara efecto: `null` es la respuesta correcta), y `pifia` lo deja
// peor de lo que estaba — la complicación que el motor de #868 existe para
// poder expresar.

import { BANDAS } from "./resolucion.mjs";
import { declararObjetoInteractivo } from "./contrato.mjs";

export const TERMINAL_DETERIORADO = declararObjetoInteractivo({
  id: "terminal-deteriorado",
  aproximaciones: [
    { id: "recablear-con-cuidado", dificultad: 0.75, etiqueta: "Recablear con cuidado" },
    { id: "forzar-el-panel", dificultad: 0.5, etiqueta: "Forzar el panel" },
    { id: "golpe-seco", dificultad: 0.25, etiqueta: "Darle un golpe seco" },
  ],
  efectosPorBanda: {
    [BANDAS.CRITICO]: { tipo: "reparado", detalle: "El terminal vuelve a funcionar con normalidad." },
    [BANDAS.EXITO]: { tipo: "reparado-parcial", detalle: "El terminal responde, pero de forma inestable." },
    [BANDAS.PIFIA]: { tipo: "empeorado", detalle: "El terminal echa chispas y deja de responder del todo." },
    // `fallo` no declara efecto a propósito: intentarlo y no bastar no cambia
    // nada observable en la sala, y eso también es un resultado legítimo.
  },
});
