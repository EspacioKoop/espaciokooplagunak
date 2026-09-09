import { TARJETA_COMBATIENTE } from "./paleta.mjs";

export const COLORES_TARJETA = TARJETA_COMBATIENTE;

// El contrato de campaña para "shiny" (progresion-campana.mjs) admite un
// booleano simple o un objeto {tier, accent} donde tier "plain" significa
// "sin insignia" — no basta con la veracidad de JS (una cadena "false" o un
// objeto {tier:"plain"} son ambos truthy). Se normaliza una sola vez y ese
// valor único se usa tanto para pintar el marco como para describir capas.
function shinyActivo(shiny) {
  if (shiny === true) return true;
  if (shiny && typeof shiny === "object" && Object.hasOwn(shiny, "tier")) {
    return shiny.tier !== "plain";
  }
  return false;
}

const ALINEACIONES = new Set(["aliado", "enemigo", "neutral"]);
const OVERLAYS = new Set(Object.keys(COLORES_TARJETA.overlays));
const WIDTH = 32;
const HEIGHT = 40;

function paintRect(pixels, x, y, width, height, color) {
  for (let row = y; row < y + height; row += 1) {
    for (let column = x; column < x + width; column += 1) {
      if (column >= 0 && column < WIDTH && row >= 0 && row < HEIGHT) {
        pixels[column + row * WIDTH] = color;
      }
    }
  }
}

export function renderizarTarjetaCombatiente(combatiente = {}) {
  const alineacion = ALINEACIONES.has(combatiente.alineacion)
    ? combatiente.alineacion
    : "neutral";
  const palette = COLORES_TARJETA[alineacion];
  const overlays = Array.isArray(combatiente.overlays)
    ? [...new Set(combatiente.overlays.filter((overlay) => OVERLAYS.has(overlay)))]
    : [];
  const shiny = shinyActivo(combatiente.shiny);
  const frame = shiny ? COLORES_TARJETA.shiny.marco : palette.marco;
  const pixels = Array(WIDTH * HEIGHT).fill(palette.fondo);

  paintRect(pixels, 0, 0, WIDTH, HEIGHT, frame);
  paintRect(pixels, 2, 2, WIDTH - 4, HEIGHT - 4, palette.fondo);
  paintRect(pixels, 8, 10, 16, 18, palette.retrato);
  paintRect(pixels, 10, 12, 12, 14, palette.fondo);
  paintRect(pixels, 4, 31, WIDTH - 8, 2, frame);

  overlays.forEach((overlay, index) => {
    paintRect(pixels, 4 + index * 6, 35, 5, 3, COLORES_TARJETA.overlays[overlay]);
  });

  return {
    width: WIDTH,
    height: HEIGHT,
    alineacion,
    pixels,
    layers: {
      shiny,
      overlays,
    },
  };
}
