// Los materiales de los props (#584): textura en vez de color plano.

import assert from "node:assert/strict";
import test from "node:test";

import { LADO, MATERIALES, texturaMaterial } from "../scripts/props-materiales.mjs";
import { METROS_POR_TEXTURA, caja, prisma } from "../scripts/escena-primitivas.mjs";
import { colocarProp, definirVocabulario } from "../scripts/nave-props.mjs";
import { VOCABULARIO_URBANO, VOCABULARIO_COSTA } from "../scripts/props-exteriores.mjs";
import { texturaUtilizable } from "../scripts/retro3d-lienzo.mjs";
import { componerPlaya } from "../scripts/playa-escena.mjs";

/* ---- el grano se mide en metros -------------------------------------------- */

test("una cara grande enseña más textura, no la misma estirada", () => {
  // Es LA razón de medir las UV en metros. Con UV de 0 a 1 por cara, la veta de
  // un tablón de tres metros saldría con las mismas rayas que la de un listón de
  // diez centímetros, o sea treinta veces más gorda — y el tamaño del grano es
  // como se estima el tamaño de un objeto cuando no hay nada al lado.
  const pequena = caja([0, 0, 0], [0.5, 0.5, 0.5]);
  const grande = caja([0, 0, 0], [4, 0.5, 0.5]);
  const anchoUV = (m) => Math.max(...m.uvs[0].map(([u]) => u));
  assert.ok(anchoUV(grande) > anchoUV(pequena) * 7);
});

test("las UV valen exactamente los metros partidos por la medida de la textura", () => {
  const { uvs } = caja([0, 0, 0], [2, 1, 0.5]);
  assert.equal(Math.max(...uvs[0].map(([u]) => u)), 2 / METROS_POR_TEXTURA);
  assert.equal(Math.max(...uvs[0].map(([, v]) => v)), 1 / METROS_POR_TEXTURA);
});

test("cada cara de la caja se mide por sus dos dimensiones de verdad", () => {
  // Si el lateral usara el ancho en vez del fondo, la textura saldría deformada
  // en las caras estrechas — y una caja larga es casi toda caras estrechas.
  const { uvs } = caja([0, 0, 0], [2, 1, 0.5]);
  const ancho = (cara) => Math.max(...uvs[cara].map(([u]) => u));
  assert.equal(ancho(2), 0.5 / METROS_POR_TEXTURA, "el lateral se mide por el fondo");
  assert.equal(ancho(4), 2 / METROS_POR_TEXTURA, "el techo, por el ancho");
});

test("el prisma envuelve la textura por su perímetro", () => {
  const p = prisma([0, 0, 0], { radioAbajo: 0.5, alto: 2, lados: 8 });
  assert.equal(p.uvs.length, p.caras.length, "las UV van paralelas a las caras");
  const vuelta = Math.max(...p.uvs[7].map(([u]) => u));
  const perimetro = 2 * Math.PI * 0.5;
  assert.ok(Math.abs(vuelta - perimetro / METROS_POR_TEXTURA) < 1e-9);
});

test("una malla sin textura sigue saliendo igual que siempre", () => {
  // Las UV son un campo MÁS: nada de lo que ya existe cambia por llevarlas.
  const { vertices, caras } = caja([1, 2, 3], [1, 1, 1]);
  assert.equal(vertices.length, 8);
  assert.equal(caras.length, 6);
});

/* ---- los materiales -------------------------------------------------------- */

test("un material saca sus tonos DEL COLOR de la pieza", () => {
  // Es lo que permite que no haya una imagen por tono: la veta de un tablón gris
  // sale gris y la de un casco rojo sale roja, con el mismo generador.
  const gris = texturaMaterial("veta", "#8b8375");
  const rojo = texturaMaterial("veta", "#9a5f4a");
  assert.notDeepEqual(gris.paleta, rojo.paleta);
  assert.ok(gris.paleta.includes("#8b8375"), "el color de la pieza está en su paleta");
  assert.ok(rojo.paleta.includes("#9a5f4a"));
});

test("mismo material y mismo color dan siempre el mismo dibujo", () => {
  // La semilla sale de la clave, no de un contador: dos máquinas de la mesa
  // tienen que ver la misma caja.
  const a = texturaMaterial("chapa", "#4a4f55");
  const b = texturaMaterial("chapa", "#4a4f55");
  assert.deepEqual([...a.indices], [...b.indices]);
});

test("y se cachea: son pocas y se comparten entre todas las piezas iguales", () => {
  assert.equal(texturaMaterial("piedra", "#7d7566"), texturaMaterial("piedra", "#7d7566"));
});

test("todos los materiales dan texturas que el rasterizador puede consumir", () => {
  for (const material of MATERIALES) {
    const textura = texturaMaterial(material, "#8b8375");
    assert.ok(texturaUtilizable(textura), material);
    assert.equal(textura.ancho, LADO);
    assert.ok(textura.paleta.length >= 2, `${material} tendría que tener algo que ver`);
  }
});

test("un material no tiene huecos: es la cara de algo opaco", () => {
  // Un téxel transparente en mitad de una caja sería un agujero por el que se ve
  // el fondo, que se lee como un fallo de geometría.
  for (const material of MATERIALES) {
    const { indices, paleta } = texturaMaterial(material, "#8b8375");
    assert.ok([...indices].every((i) => i < paleta.length));
  }
});

test("un material mal escrito sale liso, no tumba la escena", () => {
  assert.equal(texturaMaterial("marmol", "#ffffff"), null);
  assert.equal(texturaMaterial("veta", "no-es-un-color"), null);
});

/* ---- de qué está hecho cada prop ------------------------------------------- */

test("las piezas de un prop con material llevan su textura puesta", () => {
  const { piezas } = colocarProp("roca", { x: 0, z: 0, vocabulario: VOCABULARIO_COSTA });
  assert.ok(piezas.length > 0);
  assert.ok(piezas.every((p) => p.textura), "una roca es piedra entera");
});

test("`material: null` en una parte significa LISO, no «no dicho»", () => {
  // Es la distinción que el cristal de la cabina necesita: la cabina entera es
  // chapa y sus vidrios no. Con `??` no se podía expresar.
  const { piezas } = colocarProp("cabina", { x: 0, z: 0, vocabulario: VOCABULARIO_URBANO });
  assert.ok(piezas.some((p) => p.textura), "la carpintería va texturada");
  assert.ok(piezas.some((p) => !p.textura), "y el vidrio, liso");
});

test("una parte hereda el material del prop si no dice el suyo", () => {
  const vocabulario = definirVocabulario({
    prueba: {
      color: "#8b8375",
      material: "veta",
      partes: [{ medidas: [1, 1, 1] }, { medidas: [1, 1, 1], material: "chapa" }],
    },
  });
  assert.equal(vocabulario.prueba.partes[0].material, "veta");
  assert.equal(vocabulario.prueba.partes[1].material, "chapa");
});

test("un prop sin material sigue siendo de color plano", () => {
  const vocabulario = definirVocabulario({
    prueba: { color: "#8b8375", partes: [{ medidas: [1, 1, 1] }] },
  });
  const { piezas } = colocarProp("prueba", { x: 0, z: 0, vocabulario });
  assert.equal(piezas[0].textura, null);
});

/* ---- en la escena ---------------------------------------------------------- */

test("la playa dibuja la malla del prop, no una caja rehecha", () => {
  // Estaba reconstruyendo `caja(centro, medidas)` y con eso un mástil de ocho
  // lados salía como un tablón cuadrado: la conicidad y las facetas se tiraban
  // en la última línea, y ahora además se llevaría por delante las UV.
  const { piezas } = colocarProp("poste", { x: 0, z: 0, vocabulario: VOCABULARIO_URBANO });
  assert.ok(piezas[0].malla.vertices.length > 8, "el mástil es un prisma, no una caja");
});

test("los props llegan texturados al cuadro", () => {
  const escena = componerPlaya(13.2, 0, 37, 0, { tiempo: 0 });
  const texturados = escena.poligonos.filter((p) => p.textura);
  assert.ok(texturados.length > 20, `solo llegaron ${texturados.length} polígonos texturados`);
  assert.ok(
    texturados.every((p) => p.puntos.every((punto) => Number.isFinite(punto.u))),
    "todo polígono texturado tiene que llevar UV finitas en todos sus puntos",
  );
});
