import assert from "node:assert/strict";
import test from "node:test";

import { declararInteracciones } from "../scripts/nave-interaccion.mjs";
import { arrancarAndar } from "../scripts/nave-movimiento-lienzo.mjs";
import { crearPlanta } from "../scripts/nave-movimiento.mjs";
import {
  activarLibro,
  cerrarLibro,
  estadoLibroAhora,
  reiniciarLibroParaPruebas,
} from "../scripts/libro-sesion.mjs";
import { FASE_ABIERTO, FASE_CERRADO } from "../scripts/libro-estado.mjs";

// Regresión del review de VaroTv7 sobre PR #914 (libro interactuable del
// museo, #853 vertical 2): dos bloqueos funcionales que la suite anterior no
// veía porque solo ejercitaba la máquina de estados PURA
// (`libro-estado.test.mjs`) o la sesión aislada (`libro-sesion.test.mjs`),
// nunca el cableado real con `arrancarAndar` — que es donde vivían los dos
// bugs: uno en qué reloj se pasa, otro en qué flanco del motor dispara el
// gesto.

function contextoFalso() {
  return {
    fillStyle: null,
    strokeStyle: null,
    lineWidth: null,
    beginPath() {},
    closePath() {},
    moveTo() {},
    lineTo() {},
    fill() {},
    stroke() {},
    fillRect() {},
    clearRect() {},
    putImageData() {},
  };
}

const lienzoFalso = () => {
  const ctx = contextoFalso();
  return { width: 100, height: 100, getContext: () => ctx };
};

const PLANTA = crearPlanta({ ancho: 10, profundidad: 10 });
// Misma zona/posición que ya usan las pruebas de `nave-movimiento-lienzo.
// test.mjs` para "ya dentro de la zona al arrancar".
const ZONA_LIBRO = { x: 4, z: 4, ancho: 2, profundidad: 2 };
const INTERACCIONES_LIBRO = declararInteracciones([
  { id: "libro", zona: ZONA_LIBRO, accion: { tipo: "libro" } },
]);

test.beforeEach(() => reiniciarLibroParaPruebas());

// ---- Bug 1: relojes mezclados congelan la apertura --------------------

test(
  "activarLibro con un reloj de PARED distinto del reloj del bucle deja la apertura " +
    "congelada en 0 (reproduce el bug de relojes mezclados de #914)",
  () => {
    // Dos fuentes de tiempo DISTINTAS a propósito: el bucle usa un reloj
    // monotónico que arranca en 5 000 (podría ser cualquier valor lejos de
    // la época Unix, como `performance.now()` de verdad), y el gesto abre
    // el libro con un reloj de PARED que arranca en la época Unix real —
    // exactamente la mezcla que reportó VaroTv7 (`performance.now()` en
    // `arrancarAndar` contra `Date.now()` en la interacción).
    let relojBucle = 5_000;
    const relojPared = () => 1_700_000_000_000 + relojBucle; // wall clock de mentira

    const mando = arrancarAndar(lienzoFalso(), {
      componer: () => ({ ancho: 100, alto: 100, poligonos: [] }),
      planta: PLANTA,
      interacciones: INTERACCIONES_LIBRO,
      // El bug: el gesto NO usa el reloj del bucle.
      alAlcanzarInteraccion: () => {
        activarLibro({ totalPaginas: 5, ahoraMs: relojPared() });
      },
      x: 5,
      z: 5, // ya dentro de ZONA_LIBRO
      yaw: 0,
      ahora: () => relojBucle,
    });

    // El flanco de entrada dispara el gesto en este primer avance.
    relojBucle += 16;
    mando.avanzar(16);
    assert.equal(
      estadoLibroAhora(relojBucle).fase,
      "abriendo",
      "el gesto abrió con el reloj de pared",
    );

    // Pasa de sobra la duración de apertura (700ms) según CUALQUIERA de los
    // dos relojes.
    relojBucle += 2000;
    mando.avanzar(2000);

    // `libro-sesion` se evalúa con el reloj del BUCLE (es lo que hace
    // `libro-museo.mjs` con `opciones.tiempo`): con la transición anclada al
    // reloj de pared, `ahoraMs - desde` sale muy negativo, se limita a 0 y el
    // libro se queda para siempre en "abriendo" con apertura 0.
    const estado = estadoLibroAhora(relojBucle);
    assert.equal(estado.fase, "abriendo", "sigue congelado: los relojes nunca convergen");
    assert.equal(estado.apertura, 0);
    mando.detener();
  },
);

test(
  "activarLibro con mando.ahora() (el MISMO reloj que arrancarAndar) abre con normalidad",
  () => {
    let relojBucle = 5_000;
    let mando;

    mando = arrancarAndar(lienzoFalso(), {
      componer: () => ({ ancho: 100, alto: 100, poligonos: [] }),
      planta: PLANTA,
      interacciones: INTERACCIONES_LIBRO,
      // La corrección: una única fuente de tiempo para todo el cableado, la
      // que ya expone `mando.ahora()`.
      alAlcanzarInteraccion: () => {
        activarLibro({ totalPaginas: 5, ahoraMs: mando.ahora() });
      },
      x: 5,
      z: 5,
      yaw: 0,
      ahora: () => relojBucle,
    });

    relojBucle += 16;
    mando.avanzar(16);
    assert.equal(estadoLibroAhora(relojBucle).fase, "abriendo");

    relojBucle += 800; // pasada la duración de apertura (700ms)
    mando.avanzar(800);
    const estado = estadoLibroAhora(relojBucle);
    assert.equal(estado.fase, FASE_ABIERTO, "con un solo reloj, la apertura sí termina");
    assert.equal(estado.apertura > 0, true);
    mando.detener();
  },
);

// ---- Bug 2: no había gesto alcanzable para pasar página ----------------

test(
  "entrada→abrir→pasar→página 1→salir→cerrado, con el gesto repetible mientras se " +
    "permanece ante el libro (#914)",
  () => {
    let relojBucle = 0;
    let mando;
    // El mismo gesto que `andar-nave-app.mjs` cablea a la llegada Y a la
    // tecla repetible (F): un único camino, llamado dos veces mientras se
    // sigue de pie en la zona — el motor solo avisa por el flanco de
    // ENTRADA (`alAlcanzarInteraccion`), así que la segunda llamada NO pasa
    // por él, reproduciendo exactamente cómo se cablea la tecla.
    const gestoLibro = () =>
      activarLibro({ totalPaginas: 5, reducirMovimiento: true, ahoraMs: mando.ahora() });

    mando = arrancarAndar(lienzoFalso(), {
      componer: () => ({ ancho: 100, alto: 100, poligonos: [] }),
      planta: PLANTA,
      interacciones: INTERACCIONES_LIBRO,
      alAlcanzarInteraccion: gestoLibro,
      alSalirDeInteraccion: () => cerrarLibro(),
      x: 5,
      z: 5, // ya dentro de ZONA_LIBRO al arrancar
      yaw: 0,
      ahora: () => relojBucle,
    });

    // Entrada: el flanco de entrada del motor abre el libro (movimiento
    // reducido ⇒ transición instantánea, como ya prueba `libro-sesion.
    // test.mjs`).
    mando.avanzar(16);
    assert.equal(estadoLibroAhora(relojBucle).fase, FASE_ABIERTO, "la entrada abre el libro");
    assert.equal(estadoLibroAhora(relojBucle).paginaActual, 0);

    // Seguir de pie dentro de la zona NO vuelve a disparar el flanco de
    // entrada (ver `nave-movimiento-lienzo.test.mjs`): sin un gesto
    // repetible aparte, `paginaActual > 0` sería inalcanzable.
    mando.avanzar(16);
    assert.equal(estadoLibroAhora(relojBucle).paginaActual, 0, "quedarse quieto no pasa página solo");

    // El gesto repetible (la tecla F en `andar-nave-app.mjs`, simulada aquí
    // llamando al mismo `gestoLibro`) SÍ pasa página sin salir del punto.
    gestoLibro();
    assert.equal(
      estadoLibroAhora(relojBucle).paginaActual,
      1,
      "el gesto repetible alcanza paginaActual > 0",
    );
    assert.equal(estadoLibroAhora(relojBucle).fase, FASE_ABIERTO);

    // Alejarse de verdad (no un segundo gesto): el flanco de SALIDA cierra
    // sin animar, tal como ya hacía la cartela de una pieza (#598).
    mando.pulsar("atras");
    relojBucle += 2000;
    mando.avanzar(2000);
    mando.soltar("atras");

    const estadoFinal = estadoLibroAhora(relojBucle);
    assert.equal(estadoFinal.fase, FASE_CERRADO, "alejarse cierra el libro");
    assert.equal(estadoFinal.paginaActual, 0, "cerrar resetea la página, no la recuerda");
    mando.detener();
  },
);
