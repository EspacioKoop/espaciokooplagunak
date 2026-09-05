// Las formas con las que se construye todo lo 3D del módulo (#589).
//
// Lo que estas pruebas defienden es UNA cosa, y es la que se rompió de verdad:
// el BOBINADO. Una cara con los vértices al revés no se dibuja mal, no se
// dibuja — el motor la descarta por dar la espalda. Pasó con la ladera de la
// duna: desapareció entera y solo quedaron sus rizos flotando sobre el cielo, y
// se tardó un playtest en verlo porque ninguna prueba miraba eso.

import assert from "node:assert/strict";
import test from "node:test";

import { cajaGirada, anillo, caja, disco, esfera, losa, prisma, rampa, trasladar } from "../scripts/escena-primitivas.mjs";

/** Normal de una cara por el método del área firmada (Newell), ya unitaria. */
function normalDe(malla, indice) {
  const cara = malla.caras[indice].map((i) => malla.vertices[i]);
  let [nx, ny, nz] = [0, 0, 0];
  for (let i = 0; i < cara.length; i += 1) {
    const a = cara[i];
    const b = cara[(i + 1) % cara.length];
    nx += (a[1] - b[1]) * (a[2] + b[2]);
    ny += (a[2] - b[2]) * (a[0] + b[0]);
    nz += (a[0] - b[0]) * (a[1] + b[1]);
  }
  const largo = Math.hypot(nx, ny, nz) || 1;
  return [nx / largo, ny / largo, nz / largo];
}

/* ---- que la malla sea una malla ------------------------------------------- */

test("toda primitiva devuelve vértices y caras que se refieren a ellos", () => {
  const mallas = {
    caja: caja([0, 0, 0], [1, 2, 3]),
    prisma: prisma([0, 0, 0], { radioAbajo: 1, alto: 2 }),
    esfera: esfera([0, 0, 0], 1),
    anillo: anillo([0, 0, 0], 1, 2),
    losa: losa([[0, 0], [1, 0], [1, 1], [0, 1]], 0),
    rampa: rampa([[0, 0, 0], [0, 0, 1], [1, 1, 1], [1, 1, 0]]),
  };
  for (const [nombre, malla] of Object.entries(mallas)) {
    assert.ok(malla.vertices.length >= 3, `${nombre} sin vértices`);
    assert.ok(malla.caras.length >= 1, `${nombre} sin caras`);
    for (const cara of malla.caras) {
      assert.ok(cara.length >= 3, `${nombre} tiene una cara degenerada`);
      for (const i of cara) {
        assert.ok(malla.vertices[i], `${nombre} apunta a un vértice que no existe`);
      }
    }
    for (const [x, y, z] of malla.vertices) {
      assert.ok(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z), `${nombre} tiene un vértice roto`);
    }
  }
});

/* ---- el bobinado, que es lo que se rompió --------------------------------- */

test("la cara de arriba de una caja mira hacia arriba", () => {
  const malla = caja([0, 0, 0], [2, 2, 2]);
  const techo = malla.caras.findIndex((cara) => cara.every((i) => malla.vertices[i][1] > 0));
  assert.ok(techo >= 0);
  assert.ok(normalDe(malla, techo)[1] > 0.9, "el techo de una caja da la espalda: se descartaría");
});

test("una rampa mira hacia ARRIBA, que es de donde se mira una ladera", () => {
  // El fallo exacto: con los vértices al revés, la duna entera desapareció.
  const subiendo = rampa([
    [0, 0, 0],
    [0, 0, 10],
    [2, 0.5, 10],
    [2, 0.5, 0],
  ]);
  assert.ok(normalDe(subiendo, 0)[1] > 0.8, "una rampa con el bobinado al revés no se dibuja");
});

test("una losa mira hacia arriba: va pegada al suelo y se ve desde arriba", () => {
  const malla = losa([[0, 0], [2, 0], [2, 2], [0, 2]], 0.01);
  assert.ok(Math.abs(normalDe(malla, 0)[1]) > 0.9);
  for (const [, y] of malla.vertices) assert.equal(y, 0.01);
});

test("las caras laterales de un prisma miran hacia AFUERA", () => {
  const malla = prisma([0, 0, 0], { radioAbajo: 1, alto: 2, lados: 8 });
  // Las ocho primeras son los lados; la última, la tapa.
  for (let i = 0; i < 8; i += 1) {
    const cara = malla.caras[i].map((j) => malla.vertices[j]);
    const centro = cara.reduce((a, v) => [a[0] + v[0] / 4, 0, a[2] + v[2] / 4], [0, 0, 0]);
    const normal = normalDe(malla, i);
    const haciaFuera = normal[0] * centro[0] + normal[2] * centro[2];
    assert.ok(haciaFuera > 0, `el lado ${i} del prisma da la espalda`);
  }
  assert.ok(normalDe(malla, 8)[1] > 0.9, "la tapa del prisma da la espalda");
});

/* ---- la forma es la que dice ser ------------------------------------------ */

test("un prisma se apoya en su base, no en su centro", () => {
  // Colocar algo que se planta en el suelo es decir dónde TOCA el suelo.
  const malla = prisma([5, 0, 7], { radioAbajo: 0.3, alto: 3 });
  const alturas = malla.vertices.map(([, y]) => y);
  assert.equal(Math.min(...alturas), 0);
  assert.equal(Math.max(...alturas), 3);
});

test("con radio distinto arriba y abajo, el prisma se afila", () => {
  const cono = prisma([0, 0, 0], { radioAbajo: 1, radioArriba: 0, alto: 2, lados: 6 });
  const arriba = cono.vertices.filter(([, y]) => y === 2);
  for (const [x, , z] of arriba) assert.ok(Math.hypot(x, z) < 1e-9, "la punta del cono no cierra");
});

test("ocho lados: bastantes para no leerse como caja, pocos para seguir facetado", () => {
  // El criterio del inventario: cuatro lados es el único número que no puede
  // parecer redondo. La cuenta de caras se fija aquí para que subirla sea una
  // decisión y no un descuido.
  const malla = prisma([0, 0, 0], { radioAbajo: 1, alto: 1 });
  assert.equal(malla.caras.length, 9, "ocho lados más la tapa");
});

test("una esfera tiene facetas de sobra para girar y no tantas como para ser un disco", () => {
  const malla = esfera([0, 0, 0], 1);
  assert.ok(malla.caras.length >= 40 && malla.caras.length <= 60);
  for (const v of malla.vertices) {
    assert.ok(Math.abs(Math.hypot(...v) - 1) < 1e-9, "un vértice de la esfera no está en la esfera");
  }
});

test("trasladar mueve los vértices y no toca las caras", () => {
  const original = caja([0, 0, 0], [1, 1, 1]);
  const movida = trasladar(original, [3, 4, 5]);
  assert.deepEqual(movida.caras, original.caras);
  assert.deepEqual(movida.vertices[0], [-0.5 + 3, -0.5 + 4, -0.5 + 5]);
});

test("un prisma puede tumbarse: no todo lo que es redondo crece hacia arriba", () => {
  // La manga de viento salía de pie como un farol y dejaba de decir hacia dónde
  // sopla, que era su único trabajo. Un tronco de deriva, lo mismo.
  const tumbado = prisma([0, 0, 0], { radioAbajo: 0.2, alto: 3, lados: 6, eje: "x" });
  const equis = tumbado.vertices.map(([x]) => x);
  assert.equal(Math.min(...equis), 0);
  assert.equal(Math.max(...equis), 3);
  // Y su sección está en el plano perpendicular, no aplastada contra el suelo.
  const alturas = tumbado.vertices.map(([, y]) => y);
  assert.ok(Math.max(...alturas) - Math.min(...alturas) > 0.3, "el prisma tumbado se ha quedado plano");
});

test("el disco de las fichas cierra sus DOS tapas y enseña el canto", () => {
  // El canto de una ficha llevaba meses descartándose: sus costados estaban
  // bobinados hacia dentro. La cuenta de caras se conserva —diez lados y dos
  // tapas— y ahora además se ven.
  const malla = disco({ lados: 10 });
  assert.equal(malla.vertices.length, 20);
  assert.equal(malla.caras.length, 12);
  const cara = malla.caras[0].map((i) => malla.vertices[i]);
  const centro = cara.reduce((a, v) => [a[0] + v[0] / 4, 0, a[2] + v[2] / 4], [0, 0, 0]);
  const normal = normalDe(malla, 0);
  assert.ok(normal[0] * centro[0] + normal[2] * centro[2] > 0, "el canto de la ficha da la espalda");
});

/* ---- caja girada (#897) ---------------------------------------------------- */

test("una caja sin rumbo es exactamente la caja de siempre", () => {
  // La garantía que hace seguro cambiar `caja` por `cajaGirada` en un consumidor
  // existente: sin rumbo declarado no se mueve ni un vértice.
  const plana = caja([1, 2, 3], [0.4, 1.2, 0.6]);
  for (const yaw of [0, undefined, Number.NaN]) {
    const girada = cajaGirada([1, 2, 3], [0.4, 1.2, 0.6], yaw);
    assert.deepEqual(girada.caras, plana.caras, `caras distintas con yaw=${yaw}`);
    assert.deepEqual(girada.uvs, plana.uvs, `uvs distintas con yaw=${yaw}`);
    for (let v = 0; v < plana.vertices.length; v += 1) {
      for (let e = 0; e < 3; e += 1) {
        assert.ok(
          Math.abs(girada.vertices[v][e] - plana.vertices[v][e]) < 1e-12,
          `vértice ${v} movido con yaw=${yaw}`,
        );
      }
    }
  }
});

test("un cuarto de vuelta intercambia la huella de la caja", () => {
  // Una caja estrecha y profunda, girada 90°, tiene que quedar ancha y poco
  // profunda: es la comprobación que distingue un giro de verdad de haber
  // movido el centro y dejado la caja mirando a donde miraba.
  const girada = cajaGirada([0, 0, 0], [0.4, 1, 1.6], Math.PI / 2);
  const rango = (eje) => {
    const vs = girada.vertices.map((v) => v[eje]);
    return Math.max(...vs) - Math.min(...vs);
  };
  assert.ok(Math.abs(rango(0) - 1.6) < 1e-9, `ancho tras girar: ${rango(0)}`);
  assert.ok(Math.abs(rango(1) - 1) < 1e-9, "la altura no debe cambiar al girar sobre el eje vertical");
  assert.ok(Math.abs(rango(2) - 0.4) < 1e-9, `fondo tras girar: ${rango(2)}`);
});

test("gira sobre su propio centro, no sobre el origen de la sala", () => {
  // El error clásico —y el que `cantina-escena.mjs` documenta para la cámara—
  // es girar primero y trasladar después, que convierte una caja lejana en una
  // caja orbitando el centro de la sala.
  const centro = [5, 0, -3];
  const girada = cajaGirada(centro, [0.4, 1, 1.6], Math.PI / 3);
  const medio = [0, 1, 2].map((e) => {
    const vs = girada.vertices.map((v) => v[e]);
    return (Math.max(...vs) + Math.min(...vs)) / 2;
  });
  for (let e = 0; e < 3; e += 1) {
    assert.ok(Math.abs(medio[e] - centro[e]) < 1e-9, `el centro se fue: ${JSON.stringify(medio)}`);
  }
});

test("el convenio de rumbo es el mismo que el del movimiento", () => {
  // `moverXZ` avanza hacia (sen yaw, cos yaw) con yaw=0 mirando a +z. Si esta
  // caja usara el signo contrario, la gente andaría de espaldas a donde mira, y
  // eso se ve pero no se lee en el diff.
  const girada = cajaGirada([0, 0, 0], [0.2, 0.2, 2], Math.PI / 2);
  // La cara que estaba en +z queda ahora en +x.
  const maxX = Math.max(...girada.vertices.map((v) => v[0]));
  const maxZ = Math.max(...girada.vertices.map((v) => v[2]));
  assert.ok(maxX > 0.9, `el frente no fue a +x (maxX=${maxX})`);
  assert.ok(maxZ < 0.2, `algo se quedó en +z (maxZ=${maxZ})`);
});
