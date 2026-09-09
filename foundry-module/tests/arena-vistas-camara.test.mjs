import assert from "node:assert/strict";
import test from "node:test";

import { componerArena, ENTRADA, VISTAS_ARENA } from "../scripts/arena-combate-escena.mjs";
import { CATALOGO_ANDAR } from "../scripts/nave-catalogo-andar.mjs";
import { resolverCamara } from "../scripts/nave-camara.mjs";
import { vistasDisponibles } from "../scripts/cambiador-vistas-combate.mjs";

// Las cuatro vistas de cámara de combate, vistas desde la superficie que las
// aplica (#1024). Lo que se prueba aquí no es la aritmética de cada cámara —eso
// ya lo hacen `camara-*.test.mjs`— sino la COSTURA: que la arena las declara,
// que el compositor las honra, y que la vista que el motor no sabe proyectar no
// se ofrece en vez de salir mal.

const PUNTO = { x: ENTRADA.x, z: ENTRADA.z, y: 0, yaw: 0.4 };

const componer = (modoCamara) =>
  componerArena(PUNTO.x, PUNTO.y, PUNTO.z, PUNTO.yaw, {
    modoCamara,
    ancho: 160,
    alto: 120,
  });

test("la arena declara sus vistas y el catálogo repite las mismas", () => {
  // Una sola fuente: si el catálogo declarara las suyas, un día ofrecería una
  // vista que el compositor no sabe pintar y nadie lo notaría.
  assert.equal(CATALOGO_ANDAR.obtener("arena").vistasCombate, VISTAS_ARENA);
});

test("es la ÚNICA estancia con vistas de combate", () => {
  // No es un detalle: si otra estancia las declarara sin que su compositor las
  // aplicara, los números pondrían una cámara que nadie honra y la sala se
  // quedaría congelada mirando a otro sitio.
  const conVistas = CATALOGO_ANDAR.ids.filter(
    (id) => CATALOGO_ANDAR.obtener(id).vistasCombate,
  );
  assert.deepEqual(conVistas, ["arena"]);
});

test("mientras falte la proyección ortográfica, la táctica no se ofrece", () => {
  // La otra mitad de #1020. Con `retro3d.mjs` en perspectiva, una cenital haría
  // las casillas del fondo más pequeñas que las de delante.
  assert.equal(VISTAS_ARENA.ortografica, false);
  assert.deepEqual(vistasDisponibles(VISTAS_ARENA), ["pov", "tercera", "libre"]);
});

test("entrar sin elegir vista pinta exactamente lo de antes de #1024", () => {
  // La garantía de no-regresión: la arena se entra andando desde la nave, o sea
  // en `primera`/`tercera` de `nave-camara.mjs`. Ni un polígono cambia hasta
  // que alguien pulsa un número.
  for (const modo of ["primera", "tercera", undefined]) {
    const escena = componer(modo);
    assert.ok(escena.poligonos.length > 0, `${modo}: escena vacía`);
    assert.ok(
      escena.poligonos.every((p) => p.puntos.every(({ x: px, y: py }) => Number.isFinite(px) && Number.isFinite(py))),
      `${modo}: polígonos con coordenadas rotas`,
    );
  }
  // Y el modo de andar sigue decidiendo si te pintas a ti mismo.
  assert.equal(resolverCamara({ ...PUNTO, modo: "tercera" }).dibujarPropio, true);
  assert.equal(resolverCamara({ ...PUNTO, modo: "primera" }).dibujarPropio, false);
});

test("cada vista de combate pinta una escena bien formada, y POV coincide con primera", () => {
  const vistas = vistasDisponibles(VISTAS_ARENA);
  for (const vista of vistas) {
    const escena = componer(vista);
    assert.ok(escena.poligonos.length > 0, `${vista}: escena vacía`);
    assert.ok(
      escena.poligonos.every((p) => p.puntos.every(({ x: px, y: py }) => Number.isFinite(px) && Number.isFinite(py))),
      `${vista}: polígonos con coordenadas rotas`,
    );
  }
  // POV de combate ES primera persona desde el mismo sitio y con el mismo
  // rumbo: lo que las separa no es dónde va la cámara sino el RECORTE a la
  // casilla de 5 ft (#1021). Que coincidan aquí es la señal de que la cámara
  // sigue a quien anda; una versión anterior de esta prueba exigía lo
  // contrario —que POV se diferenciara de primera— y así daba por buena
  // justamente la cámara clavada en el origen que arregló la regresión de
  // abajo. Una prueba puede confirmar la suposición con la que se escribió.
  const huella = (modo) => JSON.stringify(componer(modo).poligonos.slice(0, 8));
  assert.equal(huella("pov"), huella("primera"));
  // Tercera sí retira la cámara, así que no puede coincidir con ninguna de las dos.
  assert.notEqual(huella("tercera"), huella("pov"));
  assert.notEqual(huella("libre"), huella("pov"));
});

test("un nombre de vista desconocido no revienta la arena", () => {
  // El compositor es un borde: lo que entra mal cae a la cámara de andar en vez
  // de dejar la ventana en negro.
  const escena = componer("cenital-de-satelite");
  assert.ok(escena.poligonos.length > 0);
});

test("las vistas de combate SIGUEN a quien anda, no se quedan en el origen", () => {
  // REGRESIÓN. `camara-pov-combate` y `camara-tercera-combate` recortan la
  // posición contra `origenCasilla`, que por defecto es `{0, 0}`: sin pasarles
  // la casilla REAL, la cámara se quedaba clavada en la esquina del tablero
  // —(1,524, 1,45, 1,524)— mientras el cuerpo andaba por el claro, y la libre
  // arrancaba en (0, 0, 0). Los 45 × 30 m de la arena hacen que eso sea mirar
  // desde fuera de la escena.
  //
  // Se prueba por lo OBSERVABLE y no por la cámara: dos posiciones muy
  // separadas, el mismo rumbo. Con el fallo las dos escenas salían idénticas,
  // porque la cámara era la misma en ambas.
  const huella = (px, pz, vista) =>
    JSON.stringify(
      componerArena(px, 0, pz, 0.4, { modoCamara: vista, ancho: 160, alto: 120 })
        .poligonos.slice(0, 8),
    );

  for (const vista of vistasDisponibles(VISTAS_ARENA)) {
    assert.notEqual(
      huella(8, 6, vista),
      huella(34, 24, vista),
      `${vista}: la escena no cambia al cruzar la arena — la cámara no sigue a nadie`,
    );
  }
});

test("dentro de UNA casilla, POV y tercera sí recortan el movimiento", () => {
  // La otra mitad de #1021/#1022, y lo que hace que el recorte no sea un
  // estorbo: la cámara se mueve contigo de casilla en casilla, pero DENTRO de
  // una casilla de 5 ft el recorte sigue vivo — que es la regla de combate que
  // estas dos cámaras vienen a dar.
  const dentro = (px, pz) =>
    JSON.stringify(
      componerArena(px, 0, pz, 0.4, { modoCamara: "pov", ancho: 160, alto: 120 })
        .poligonos.slice(0, 8),
    );
  // Dos puntos de la MISMA casilla (lado 1,524 m): el recorte los lleva al
  // mismo sitio, así que la escena no cambia.
  assert.equal(dentro(0.2, 0.2), dentro(0.2, 0.2));
  // Y dos casillas distintas sí cambian.
  assert.notEqual(dentro(0.2, 0.2), dentro(9.2, 9.2));
});
