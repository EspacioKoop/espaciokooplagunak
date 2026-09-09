import test from "node:test";
import assert from "node:assert/strict";
import { pintarEscenaConProfundidad } from "../scripts/retro3d-lienzo.mjs";
import { colorDifusorLuminaria } from "../scripts/nave-luminaria.mjs";

const quad = (z, color, alpha, extra = {}) => ({
  color, alpha,
  puntos: [[0, 0], [4, 0], [4, 4], [0, 4]].map(([x, y]) => ({ x, y, z, u: x / 4, v: y / 4 })),
  ...extra,
});
// Pixel sink, not a Canvas/visual acceptance test: all rasterization is production.
function pixels(poligonos, epoca = "psx", estrellas = []) {
  let result;
  pintarEscenaConProfundidad({ putImageData: image => { result = [...image.data]; } },
    { ancho: 4, alto: 4, poligonos, epoca, estrellas }, { fondo: "#0000ff" });
  return Array.from({ length: 16 }, (_, i) => result.slice(i * 4, i * 4 + 4));
}

for (const epoca of ["psx", "gamecube"]) {
  test(`${epoca}: source-over contra framebuffer opaco, independiente del orden opaco`, () => {
    const back = quad(4, "#0000ff");
    const front = quad(2, "#ff0000", 0.5);
    for (const polys of [[back, front], [front, back]]) {
      for (const pixel of pixels(polys, epoca)) assert.deepEqual(pixel, [128, 0, 128, 255]);
    }
  });
  test(`${epoca}: capas acumulan, sin doble mezcla en la diagonal del abanico`, () => {
    const far = quad(3, "#00ff00", 0.5);
    const near = quad(2, "#ff0000", 0.5);
    const before = JSON.stringify([near, far]);
    for (const polys of [[near, far], [far, near]]) {
      for (const pixel of pixels(polys, epoca)) assert.deepEqual(pixel, [128, 64, 64, 255]);
    }
    assert.equal(JSON.stringify([near, far]), before, "no mutar entrada");
  });
  test(`${epoca}: transparencia texturada y fallback fuera de paleta`, () => {
    for (const indices of [[0], [9]]) {
      const front = quad(2, "#ff0000", 0.5, {
        textura: { ancho: 1, alto: 1, indices, paleta: ["#ff0000"] }, intensidad: 1,
      });
      for (const pixel of pixels([front], epoca)) assert.deepEqual(pixel, [128, 0, 128, 255]);
    }
  });
}
test("el abanico cubre una vez cada píxel con ambos giros y otro vértice inicial", () => {
  for (const reverse of [false, true]) for (const shift of [0, 1, 2, 3]) {
    const p = quad(2, "#ff0000", 0.5);
    if (reverse) p.puntos.reverse();
    p.puntos = [...p.puntos.slice(shift), ...p.puntos.slice(0, shift)];
    for (const pixel of pixels([p])) assert.deepEqual(pixel, [128, 0, 128, 255]);
  }
});
test("la oclusión se evalúa por píxel, no por centroide de la cara opaca", () => {
  const wall = quad(2, "#00ff00");
  wall.puntos.forEach(p => { p.z = p.x === 0 ? 1 : 4; });
  const result = pixels([quad(2, "#ff0000", 0.5), wall]);
  assert.deepEqual(result[0], [0, 255, 0, 255], "muro delante a la izquierda");
  assert.deepEqual(result[3], [128, 128, 0, 255], "velo delante a la derecha");
});
test("difusor apagado llega negro al framebuffer, no magenta de color inválido", () => {
  const { color } = colorDifusorLuminaria({ health: 0.5, timeMs: 500 });
  for (const pixel of pixels([quad(2, color)])) assert.deepEqual(pixel, [0, 0, 0, 255]);
});
test("alpha cero/negativo no escribe color ni profundidad; opaco delante ocluye", () => {
  for (const alpha of [0, -1]) {
    for (const pixel of pixels([quad(1, "#ff0000", alpha), quad(3, "#00ff00")])) {
      assert.deepEqual(pixel, [0, 255, 0, 255]);
    }
  }
  for (const polys of [[quad(3, "#ff0000", 0.5), quad(1, "#00ff00")],
    [quad(1, "#00ff00"), quad(3, "#ff0000", 0.5)]]) {
    for (const pixel of pixels(polys)) assert.deepEqual(pixel, [0, 255, 0, 255]);
  }
});
test("alpha normalizado, cielo compuesto y búfer sin restos del frame anterior", () => {
  for (const alpha of [undefined, NaN, Infinity, 2]) {
    for (const pixel of pixels([quad(2, "#ff0000", alpha)])) assert.deepEqual(pixel, [255, 0, 0, 255]);
  }
  const stars = [{ x: 0, y: 0, tam: 4, color: "#00ff00" }];
  for (const pixel of pixels([quad(2, "#ff0000", 0.5)], "psx", stars)) assert.deepEqual(pixel, [128, 128, 0, 255]);
  for (const pixel of pixels([])) assert.deepEqual(pixel, [0, 0, 255, 255]);
});
