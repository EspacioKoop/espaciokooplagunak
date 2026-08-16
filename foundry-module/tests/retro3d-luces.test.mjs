/**
 * Luces de punto por cara (#556).
 *
 * Lo que estas pruebas defienden no es «se ve bonito», sino las tres reglas que
 * hacen que la iluminación sea una EXTENSIÓN y no una regresión estética:
 *
 *   1. sin focos declarados, el render es idéntico al de antes;
 *   2. las luces se suman y el escalonado ocurre DESPUÉS, no por foco;
 *   3. ninguna cara llega a negro absoluto, ni dentro ni fuera de un charco.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  AJUSTES_EPOCA,
  MALLA_CAZA,
  TOPE_FOCOS,
  componerEscena,
  contribucionFoco,
  focosCercanos,
  intensidadCara,
} from "../scripts/retro3d.mjs";

/** Cuadrado vertical mirando a +z, partido en dos caras a distinta altura. */
const pared = {
  vertices: [
    [-1, -1, 5], [1, -1, 5], [1, 0, 5], [-1, 0, 5],
    [-1, 0, 5], [1, 0, 5], [1, 1, 5], [-1, 1, 5],
  ],
  // Giro antihorario visto desde la cámara: con el otro sentido las dos caras
  // son de espaldas y `areaFirmada` las descarta antes de sombrear nada.
  caras: [[3, 2, 1, 0], [7, 6, 5, 4]],
};

// ---- 1. Foco apagado: nada cambia ------------------------------------------

test("sin focos declarados, la escena se compone exactamente igual que antes", () => {
  // La condición que la revisión de #556 puso como requisito: una escena sin
  // focos tiene que conservar el resultado visual anterior al píxel, o esto
  // sería un cambio de aspecto global disfrazado de funcionalidad nueva.
  const sinOpcion = componerEscena(MALLA_CAZA, { posicion: [0, 0, 8] });
  const listaVacia = componerEscena(MALLA_CAZA, { posicion: [0, 0, 8], focos: [] });
  assert.deepEqual(listaVacia.poligonos, sinOpcion.poligonos);
});

test("intensidadCara sin opciones da lo mismo que con una lista de focos vacía", () => {
  const normal = [0, 0, -1];
  const tonos = AJUSTES_EPOCA.psx.tonos;
  assert.equal(intensidadCara(normal, tonos), intensidadCara(normal, tonos, { focos: [] }));
  assert.equal(
    intensidadCara(normal, tonos),
    intensidadCara(normal, tonos, { centroide: [0, 0, 0], focos: [] }),
  );
});

// ---- 2. Sumar primero, escalonar después ------------------------------------

test("dos focos débiles dan lo mismo que un foco equivalente más fuerte", () => {
  // Si se escalonara cada foco por separado, dos aportaciones de 0,2 se
  // redondearían dos veces y no coincidirían con una sola de 0,4. Es la razón
  // por la que el escalonado va después de la suma y no dentro del bucle.
  const normal = [0, 0, -1];
  const centroide = [0, 0, 0];
  const cerca = { posicion: [0, 0, -2], alcance: 10 };
  const dosDebiles = intensidadCara(normal, 16, {
    centroide,
    focos: [{ ...cerca, potencia: 0.2 }, { ...cerca, potencia: 0.2 }],
  });
  const unoFuerte = intensidadCara(normal, 16, {
    centroide,
    focos: [{ ...cerca, potencia: 0.4 }],
  });
  assert.equal(dosDebiles, unoFuerte);
});

test("con focos el sombreado sigue escalonado: la época manda", () => {
  // Una luz suave sin escalonar sería un cambio de época encubierto: el
  // escalonado es lo que impide que esto delate un render moderno.
  const focos = [{ posicion: [0, 0, -3], potencia: 1, alcance: 20 }];
  const valores = new Set();
  for (let i = 0; i <= 40; i += 1) {
    valores.add(intensidadCara([0, 0, -1], AJUSTES_EPOCA.psx.tonos, {
      centroide: [0, i / 8, 0],
      focos,
    }));
  }
  assert.ok(
    valores.size <= AJUSTES_EPOCA.psx.tonos,
    `${valores.size} tonos distintos, demasiados para PSX`,
  );
});

test("la intensidad nunca pasa de 1, por muchos focos que le den", () => {
  const focos = Array.from({ length: 8 }, () => ({ posicion: [0, 0, -1], potencia: 4, alcance: 50 }));
  assert.equal(intensidadCara([0, 0, -1], 0, { centroide: [0, 0, 0], focos }), 1);
});

// ---- 3. Ninguna cara se apaga del todo --------------------------------------

test("una cara fuera de todos los focos conserva la luz ambiente", () => {
  // Sin este suelo, una cara de una sala interior que quede fuera de cada
  // charco desaparecería contra el fondo, y eso se lee como un agujero.
  const lejos = intensidadCara([0.4, -0.8, 0.45], 0, {
    centroide: [0, 0, 0],
    focos: [{ posicion: [100, 100, 100], potencia: 2, alcance: 5 }],
  });
  assert.ok(lejos > 0, "queda luz ambiente");
});

// ---- Caída y orientación ----------------------------------------------------

test("el foco cae con la distancia y se corta en su alcance", () => {
  const normal = [0, 0, -1];
  const alcance = 10;
  const foco = (z) => contribucionFoco({ posicion: [0, 0, z], potencia: 1, alcance }, [0, 0, 0], normal);
  assert.ok(foco(-1) > foco(-5), "más cerca alumbra más");
  assert.equal(foco(-alcance), 0, "en el borde del alcance ya no aporta");
  assert.equal(foco(-alcance - 1), 0, "y más allá tampoco");
});

test("un foco a espaldas de la cara no la ilumina", () => {
  // La cara mira a -z; el foco está en +z, detrás. Sin el término lambertiano
  // una lámpara alumbraría a través de la pared.
  const aporte = contribucionFoco({ posicion: [0, 0, 3], potencia: 1, alcance: 10 }, [0, 0, 0], [0, 0, -1]);
  assert.equal(aporte, 0);
});

test("un foco con datos basura no envenena la escena", () => {
  const normal = [0, 0, -1];
  assert.equal(contribucionFoco(null, [0, 0, 0], normal), 0);
  const raro = contribucionFoco(
    { posicion: [NaN, 0, -2], potencia: "mucha", alcance: undefined },
    [0, 0, 0],
    normal,
  );
  assert.ok(Number.isFinite(raro), `aporte no finito: ${raro}`);
});

// ---- Presupuesto ------------------------------------------------------------

test("solo se evalúan los TOPE_FOCOS más cercanos al observador", () => {
  // El coste es por cara: una sala son ~800 caras, así que el número de focos
  // se acota antes de que crezca solo.
  const focos = Array.from({ length: 12 }, (_, i) => ({ posicion: [0, 0, -(i + 1)], potencia: 1 }));
  const elegidos = focosCercanos(focos, [0, 0, 0]);
  assert.equal(elegidos.length, TOPE_FOCOS);
  assert.deepEqual(elegidos.map((f) => f.posicion[2]), [-1, -2, -3, -4]);
});

test("focosCercanos descarta lo que no es un foco y aguanta la lista vacía", () => {
  assert.deepEqual(focosCercanos(undefined, [0, 0, 0]), []);
  assert.deepEqual(focosCercanos([null, {}, { posicion: "aquí" }], [0, 0, 0]), []);
});

// ---- La escena completa -----------------------------------------------------

test("un foco cerca de una cara la deja más clara que a su vecina lejana", () => {
  // La prueba de que esto se lee como un charco de luz y no como un muro que
  // cambia de tono de golpe: dos caras de la misma pared, misma normal y mismo
  // color base, salen con tonos distintos según su distancia al foco.
  const opciones = { posicion: [0, 0, 0], epoca: "gamecube", ancho: 320, alto: 240 };
  const aOscuras = componerEscena(pared, opciones);
  const alumbrada = componerEscena(pared, {
    ...opciones,
    // A un metro del centroide de la cara de abajo y a 1,41 del de la de
    // arriba: el alcance de 1,2 deja a la segunda fuera del charco.
    focos: [{ posicion: [0, -0.5, 4], potencia: 0.6, alcance: 1.2 }],
  });

  assert.equal(alumbrada.poligonos.length, aOscuras.poligonos.length);
  const [abajo, arriba] = alumbrada.poligonos;
  assert.notEqual(abajo.color, arriba.color, "la luz distingue una cara de la otra");
  assert.notEqual(abajo.color, aOscuras.poligonos[0].color, "la cara cercana se aclara");
  assert.equal(arriba.color, aOscuras.poligonos[1].color, "la lejana, fuera del alcance, no cambia");
});

test("una malla emisiva no la modifica ningún foco", () => {
  // `emisivo` (#555) dice cómo se ve la propia luminaria; un foco dice cómo
  // ilumina a las demás. Un difusor no puede iluminarse a sí mismo dos veces.
  const opciones = { posicion: [0, 0, 0], emisivo: true, ancho: 320, alto: 240 };
  const sinFoco = componerEscena(pared, opciones);
  const conFoco = componerEscena(pared, {
    ...opciones,
    focos: [{ posicion: [0, 0, 4.5], potencia: 4, alcance: 20 }],
  });
  assert.deepEqual(conFoco.poligonos.map((p) => p.color), sinFoco.poligonos.map((p) => p.color));
});
