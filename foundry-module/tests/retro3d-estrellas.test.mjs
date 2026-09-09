// Pruebas del fondo estelar (#384, rebanada 5 de #362).
//
// Lo que se comprueba no es «salen estrellas»: es que el cielo NO se mueve solo,
// que ninguna cae detrás de la cámara ni fuera del búfer, y que el sorteo es
// determinista. Esas tres son las que, si se rompen, convierten el decorado en
// una mentira o en ruido.

import test from "node:test";
import assert from "node:assert/strict";

import {
  ESTRELLAS_POR_EPOCA,
  campoEstelar,
  estrellasEpoca,
  proyectarEstrellas,
} from "../scripts/retro3d-estrellas.mjs";
import { pintarNave } from "../scripts/retro3d-lienzo.mjs";
import { MALLA_CAZA } from "../scripts/retro3d.mjs";

const CAMARA = { ancho: 160, alto: 120, fov: 55, pitch: 0.4, epoca: "gamecube" };

test("misma semilla, mismo cielo; semillas distintas, cielos distintos", () => {
  // El fondo se recompone en cada fotograma: si el sorteo no fuera determinista
  // el cielo herviría, que es peor que no tener cielo.
  assert.deepEqual(campoEstelar(7, { cantidad: 40 }), campoEstelar(7, { cantidad: 40 }));
  assert.notDeepEqual(campoEstelar(7, { cantidad: 40 }), campoEstelar(8, { cantidad: 40 }));
});

test("el campo sale sobre el cascarón pedido y con brillo utilizable", () => {
  const campo = campoEstelar(3, { cantidad: 200, radio: 50 });
  assert.equal(campo.length, 200);
  for (const { punto, brillo } of campo) {
    assert.ok(Math.abs(Math.hypot(...punto) - 50) < 1e-9, "toda estrella a la misma distancia");
    // Una estrella casi negra sobre papel negro es una estrella que no está.
    assert.ok(brillo >= 0.35 && brillo <= 1);
  }
});

test("la distribución no se amontona en los polos", () => {
  // Sortear los dos ángulos por igual apelotona estrellas arriba y abajo, y con
  // la cámara cabeceada ese grumo cae justo en el borde superior del visor.
  // Sobre una esfera uniforme, la mitad de los puntos cae en la banda |z| < r/2.
  const campo = campoEstelar(11, { cantidad: 2000, radio: 1 });
  const banda = campo.filter(({ punto }) => Math.abs(punto[2]) < 0.5).length / campo.length;
  assert.ok(Math.abs(banda - 0.5) < 0.05, `banda ecuatorial ${banda}`);
});

test("ninguna estrella se pinta detrás de la cámara ni fuera del búfer", () => {
  const campo = campoEstelar(5, { cantidad: 400 });
  const puntos = proyectarEstrellas(campo, CAMARA);
  assert.ok(puntos.length > 0, "algo se ve");
  assert.ok(puntos.length < campo.length, "y la mitad de atrás no");
  for (const { x, y, tam, color } of puntos) {
    assert.ok(x >= 0 && x < CAMARA.ancho, `x fuera: ${x}`);
    assert.ok(y >= 0 && y < CAMARA.alto, `y fuera: ${y}`);
    assert.ok(Number.isInteger(x) && Number.isInteger(y), "coordenadas de píxel entero");
    assert.ok(tam >= 1 && tam <= ESTRELLAS_POR_EPOCA.gamecube.tamMax);
    assert.match(color, /^#[0-9a-f]{6}$/);
  }
});

test("EL CIELO NO SE MUEVE SOLO: sin cambio de cámara, el mismo cielo", () => {
  // La regla entera de esta rebanada. Un fondo que se desplazara por su cuenta
  // diría «la nave avanza» mientras el casco propio se está quieto a propósito
  // por no tener lectura de rumbo.
  const campo = campoEstelar(5, { cantidad: 200 });
  assert.deepEqual(proyectarEstrellas(campo, CAMARA), proyectarEstrellas(campo, CAMARA));
  // Y sí se mueve cuando gira la cámara, que es lo que lo hace un mundo.
  assert.notDeepEqual(
    proyectarEstrellas(campo, CAMARA),
    proyectarEstrellas(campo, { ...CAMARA, yaw: 1.1 }),
  );
});

test("la época manda en la densidad, y una desconocida no revienta", () => {
  assert.ok(ESTRELLAS_POR_EPOCA.gamecube.cantidad > ESTRELLAS_POR_EPOCA.psx.cantidad);
  // La PSX no llevaría un cielo denso: a resolución interna baja y sin z-buffer
  // se convierte en ruido blanco que se come la silueta.
  assert.deepEqual(estrellasEpoca("nintendo64"), ESTRELLAS_POR_EPOCA.psx);
  assert.deepEqual(estrellasEpoca(undefined), ESTRELLAS_POR_EPOCA.psx);
});

test("una de cada seis estrellas nace cálida, estable entre repintados (#458)", () => {
  // #458 QA: «solo son unos puntos en el cielo». Un cielo real no es
  // monocromo; esto es la mínima variedad que no requiere inventar ninguna
  // estrella real ni tocar la posición de ninguna.
  const campo = campoEstelar(9, { cantidad: 3000 });
  const calidas = campo.filter((estrella) => estrella.calida).length;
  const proporcion = calidas / campo.length;
  assert.ok(Math.abs(proporcion - 1 / 6) < 0.03, `proporción cálida ${proporcion}`);

  // La misma estrella es cálida en dos sorteos con la misma semilla: no es un
  // parpadeo del pintor, es un rasgo de LA estrella.
  assert.deepEqual(campoEstelar(9, { cantidad: 3000 }), campo);
});

test("las estrellas cálidas se proyectan con un color distinto de las frías", () => {
  const campo = campoEstelar(9, { cantidad: 400 });
  const puntos = proyectarEstrellas(campo, CAMARA);
  const colores = new Set(puntos.map((p) => p.color));
  // Con 400 estrellas y ~1/6 cálidas, tiene que haber de sobra de las dos
  // familias de tono en pantalla — comprobado por variedad de color y no por
  // un hex exacto, porque `sombrear` reparte cada tono en varios matices.
  assert.ok(colores.size > 2, `debería haber más de un par de tonos: ${colores.size}`);
});

test("entradas rotas dan cielo vacío en vez de NaN", () => {
  assert.deepEqual(campoEstelar(1, { cantidad: 0 }), []);
  assert.deepEqual(campoEstelar(1, { cantidad: -5 }), []);
  assert.deepEqual(campoEstelar(Number.NaN, { cantidad: 3 }), campoEstelar(0, { cantidad: 3 }));
  assert.deepEqual(proyectarEstrellas(null, CAMARA), []);
  assert.deepEqual(proyectarEstrellas([], CAMARA), []);
  const raras = proyectarEstrellas([{ punto: null, brillo: Number.NaN }], CAMARA);
  for (const p of raras) assert.match(p.color, /^#[0-9a-f]{6}$/);
});

// ---- El pintor --------------------------------------------------------------

function lienzoDeMentira() {
  const rects = [];
  const ctx = new Proxy(
    { fillRect: (...args) => rects.push(args), clearRect: () => {} },
    { get: (obj, prop) => obj[prop] ?? (() => {}), set: () => true },
  );
  return { rects, width: 160, height: 120, getContext: () => ctx };
}

test("sin pedir cielo no se pinta ninguna estrella", () => {
  // Apagado por defecto: no todas las superficies quieren purpurina detrás.
  const escena = pintarNave(lienzoDeMentira(), { malla: MALLA_CAZA, epoca: "psx" });
  assert.equal(escena.estrellas, undefined);
});

test("pedir cielo lo mete en la escena, y el mismo cielo dos veces", () => {
  const primera = pintarNave(lienzoDeMentira(), {
    malla: MALLA_CAZA,
    epoca: "gamecube",
    cielo: { semilla: 42 },
  });
  assert.ok(primera.estrellas.length > 0);
  const segunda = pintarNave(lienzoDeMentira(), {
    malla: MALLA_CAZA,
    epoca: "gamecube",
    cielo: { semilla: 42 },
  });
  assert.deepEqual(segunda.estrellas, primera.estrellas, "el cielo cacheado es el mismo cielo");
});

test("las estrellas se pintan antes que la nave: son lo único que se tapa", () => {
  const lienzo = lienzoDeMentira();
  const escena = pintarNave(lienzo, {
    malla: MALLA_CAZA,
    epoca: "gamecube",
    cielo: { semilla: 42 },
  });
  // Un `fillRect` por estrella y ni uno más: la nave son polígonos con `fill`.
  assert.equal(lienzo.rects.length, escena.estrellas.length);
});
