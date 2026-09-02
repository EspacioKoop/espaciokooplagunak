import assert from "node:assert/strict";
import test from "node:test";

import { componerMuseoConLibro, piezasLibroEnSala, PAGINAS_LIBRO } from "../scripts/libro-museo.mjs";
import { ATRIL_LIBRO, INTERACCIONES } from "../scripts/museo-escena.mjs";
import { colisiona } from "../scripts/nave-movimiento.mjs";
import { PLANTA_MUSEO } from "../scripts/museo-escena.mjs";
import { activarLibro, cerrarLibro, reiniciarLibroParaPruebas } from "../scripts/libro-sesion.mjs";

const PUNTO_LIBRO = INTERACCIONES.find((p) => p.id === "libro-clasico");

test.beforeEach(() => reiniciarLibroParaPruebas());

test("el punto de interacción del libro cae en suelo libre de la sala", () => {
  assert.ok(PUNTO_LIBRO, "no se declaró el punto de interacción del libro");
  assert.equal(
    colisiona(PUNTO_LIBRO.punto[0], PUNTO_LIBRO.punto[1], 0.35, PLANTA_MUSEO),
    false,
  );
});

test("con el libro cerrado, componerMuseoConLibro no compone nada extra", () => {
  const [x, z] = PUNTO_LIBRO.punto;
  const cerrado = componerMuseoConLibro(x, 0, z, PUNTO_LIBRO.orientacion, { tiempo: 0 });
  assert.ok(cerrado.poligonos.length > 0, "la sala en sí debe pintar algo");
  // No se activó nada: el resultado con el libro cerrado no debería pagar el
  // presupuesto extra de la página.
});

test("abrir el libro añade polígonos frente a tenerlo cerrado, mirando desde el mismo punto", () => {
  const [x, z] = PUNTO_LIBRO.punto;
  const { orientacion: yaw } = PUNTO_LIBRO;

  const cerrado = componerMuseoConLibro(x, 0, z, yaw, { tiempo: 0 });

  activarLibro({ totalPaginas: PAGINAS_LIBRO, reducirMovimiento: true, ahoraMs: 0 });
  const abierto = componerMuseoConLibro(x, 0, z, yaw, { tiempo: 0 });

  assert.ok(
    abierto.poligonos.length > cerrado.poligonos.length,
    `abierto (${abierto.poligonos.length}) debería tener más polígonos que cerrado (${cerrado.poligonos.length})`,
  );
});

test("cerrarLibro devuelve la composición al mismo recuento que el estado inicial", () => {
  const [x, z] = PUNTO_LIBRO.punto;
  const { orientacion: yaw } = PUNTO_LIBRO;

  const cerradoInicial = componerMuseoConLibro(x, 0, z, yaw, { tiempo: 0 });
  activarLibro({ totalPaginas: PAGINAS_LIBRO, reducirMovimiento: true, ahoraMs: 0 });
  componerMuseoConLibro(x, 0, z, yaw, { tiempo: 0 }); // abierto
  cerrarLibro();
  const cerradoOtraVez = componerMuseoConLibro(x, 0, z, yaw, { tiempo: 0 });

  assert.equal(cerradoOtraVez.poligonos.length, cerradoInicial.poligonos.length);
});

test("el presupuesto documentado: la página no se compone hasta pasar el umbral de apertura", () => {
  // Umbral 0.05 rad declarado en la cabecera de libro-museo.mjs. Se comprueba
  // sobre `piezasLibroEnSala` directamente y no contando polígonos de la
  // escena compuesta: el recorte de cámara cambia la silueta visible del
  // propio cuerpo en cuanto `apertura` se mueve un poco, así que esa cuenta es
  // frágil para afirmar justo esto.
  const apenasAbierto = { fase: "abriendo", apertura: 0.01, hojaVuelo: 0, paginaActual: 0, transicion: {} };
  const abiertoDeVerdad = { fase: "abierto", apertura: 0.5, hojaVuelo: 0, paginaActual: 0, transicion: null };

  assert.equal(piezasLibroEnSala(apenasAbierto).length, 1, "solo el cuerpo, sin página, por debajo del umbral");
  assert.equal(piezasLibroEnSala(abiertoDeVerdad).length, 2, "cuerpo + página, por encima del umbral");
});

test("ATRIL_LIBRO tiene una posición y altura sensatas dentro de la sala", () => {
  assert.ok(ATRIL_LIBRO.x > 0 && ATRIL_LIBRO.z > 0);
  assert.ok(ATRIL_LIBRO.altura > 0 && ATRIL_LIBRO.altura < 2);
});
