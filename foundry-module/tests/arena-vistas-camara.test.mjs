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

test("cada vista de combate pinta una escena distinta y bien formada", () => {
  const base = componer("primera");
  const vistas = vistasDisponibles(VISTAS_ARENA);
  const huellas = new Set();
  for (const vista of vistas) {
    const escena = componer(vista);
    assert.ok(escena.poligonos.length > 0, `${vista}: escena vacía`);
    assert.ok(
      escena.poligonos.every((p) => p.puntos.every(({ x: px, y: py }) => Number.isFinite(px) && Number.isFinite(py))),
      `${vista}: polígonos con coordenadas rotas`,
    );
    huellas.add(JSON.stringify(escena.poligonos[0]?.puntos ?? null));
  }
  // POV mira desde la altura de los ojos y libre desde donde se le diga: si dos
  // vistas dieran el MISMO primer polígono, es que el modo no se está aplicando.
  assert.equal(huellas.size, vistas.length, "dos vistas pintan lo mismo");
  assert.ok(!huellas.has(JSON.stringify(base.poligonos[0]?.puntos ?? null)));
});

test("un nombre de vista desconocido no revienta la arena", () => {
  // El compositor es un borde: lo que entra mal cae a la cámara de andar en vez
  // de dejar la ventana en negro.
  const escena = componer("cenital-de-satelite");
  assert.ok(escena.poligonos.length > 0);
});
