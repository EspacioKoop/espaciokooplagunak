export const COLORES_TARJETA = Object.freeze({
  aliado: Object.freeze({ marco: "#3fc1b0", fondo: "#123c4a", retrato: "#8bd8c7" }),
  enemigo: Object.freeze({ marco: "#d95d5d", fondo: "#4a1f2a", retrato: "#ed9b7a" }),
  neutral: Object.freeze({ marco: "#b7a56b", fondo: "#373b43", retrato: "#d8c79b" }),
  shiny: Object.freeze({ marco: "#f2c14e" }),
  overlays: Object.freeze({
    herido: "#e66a4e",
    "concentracion-rota": "#8b73c7",
    ventaja: "#62c370",
    muerto: "#22252b",
  }),
});

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
  const frame = combatiente.shiny ? COLORES_TARJETA.shiny.marco : palette.marco;
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
      shiny: combatiente.shiny === true,
      overlays,
    },
  };
}
