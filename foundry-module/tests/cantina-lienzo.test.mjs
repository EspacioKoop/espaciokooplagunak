// El bucle y el asomo de la cantina (#423 sobre #362).
//
// `cantina-lienzo.mjs` no importa Foundry: recibe lienzos y funciones de reloj,
// así que se puede ejercitar entero con lienzos de mentira. Lo que se afirma
// aquí es lo que no se puede ver mirando la sala: que el bucle se para cuando
// se le dice, que bajo `prefers-reduced-motion` NO hay bucle, y que asomarse
// repinta aunque no lo haya.

import assert from "node:assert/strict";
import test from "node:test";

import {
  PASO_TECLADO,
  arrancarCantina,
  miradaDesdePunto,
  miradaTrasTecla,
} from "../scripts/cantina-lienzo.mjs";

/** Lienzo de mentira que cuenta los volcados que recibe. */
function lienzoFalso(ancho = 320, alto = 180) {
  const ctx = {
    pintadas: 0,
    fillStyle: null,
    strokeStyle: null,
    lineWidth: 0,
    fillRect() {},
    clearRect() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    closePath() {},
    fill() {
      this.pintadas += 1;
    },
    stroke() {},
  };
  return { width: ancho, height: alto, ctx, getContext: () => ctx };
}

/** Reloj y fotogramas de mentira: los fotogramas se disparan a mano. */
function relojFalso() {
  const pendientes = new Map();
  let siguiente = 1;
  let t = 0;
  return {
    ahora: () => t,
    avanzar: (ms) => {
      t += ms;
    },
    pedirFotograma: (cb) => {
      const id = siguiente++;
      pendientes.set(id, cb);
      return id;
    },
    cancelarFotograma: (id) => pendientes.delete(id),
    /** Ejecuta los fotogramas pendientes una vez. */
    tic() {
      const cbs = [...pendientes.values()];
      pendientes.clear();
      for (const cb of cbs) cb();
      return cbs.length;
    },
    get pendientes() {
      return pendientes.size;
    },
  };
}

test("miradaDesdePunto normaliza a −1..1 con la Y invertida", () => {
  const rect = { left: 0, top: 0, width: 200, height: 100 };
  assert.deepEqual(miradaDesdePunto({ x: 100, y: 50 }, rect), { x: 0, y: 0 });
  assert.deepEqual(miradaDesdePunto({ x: 200, y: 0 }, rect), { x: 1, y: 1 });
  assert.deepEqual(miradaDesdePunto({ x: 0, y: 100 }, rect), { x: -1, y: -1 });
});

test("miradaDesdePunto no revienta con un rectángulo degenerado", () => {
  const mirada = miradaDesdePunto({ x: 5, y: 5 }, { left: 0, top: 0, width: 0, height: 0 });
  assert.ok(Number.isFinite(mirada.x) && Number.isFinite(mirada.y));
});

test("WASD mueve igual que las flechas, en minúscula y en mayúscula", () => {
  // Quien viene de un juego usa las teclas de un juego; y con el bloqueo de
  // mayúsculas puesto la sala no puede dejar de responder sin explicación.
  for (const [tecla, flecha] of [["a", "ArrowLeft"], ["d", "ArrowRight"], ["w", "ArrowUp"], ["s", "ArrowDown"]]) {
    assert.deepEqual(miradaTrasTecla({ x: 0, y: 0 }, tecla), miradaTrasTecla({ x: 0, y: 0 }, flecha));
    assert.deepEqual(
      miradaTrasTecla({ x: 0, y: 0 }, tecla.toUpperCase()),
      miradaTrasTecla({ x: 0, y: 0 }, flecha),
    );
  }
});

test("las flechas mueven la mirada y se quedan dentro del rango", () => {
  assert.deepEqual(miradaTrasTecla({ x: 0, y: 0 }, "ArrowRight"), { x: PASO_TECLADO, y: 0 });
  assert.deepEqual(miradaTrasTecla({ x: 0, y: 0 }, "ArrowUp"), { x: 0, y: PASO_TECLADO });
  assert.deepEqual(miradaTrasTecla({ x: 1, y: 0 }, "ArrowRight"), { x: 1, y: 0 }, "se acota");
  assert.deepEqual(miradaTrasTecla({ x: -1, y: 0 }, "ArrowLeft"), { x: -1, y: 0 });
});

test("una tecla que no mueve devuelve null, para poder no consumirla", () => {
  // Si esto devolviera la mirada actual, la ventana llamaría a preventDefault
  // con cualquier tecla y no se podría ni tabular fuera de la sala.
  assert.equal(miradaTrasTecla({ x: 0, y: 0 }, "Tab"), null);
  assert.equal(miradaTrasTecla({ x: 0, y: 0 }, "Enter"), null);
  assert.equal(miradaTrasTecla({ x: 0, y: 0 }, "q"), null);
});

test("arrancar pinta la sala y sus objetos de una", () => {
  const sala = lienzoFalso();
  const ficha = lienzoFalso(48, 48);
  arrancarCantina({ sala, objetos: [{ lienzo: ficha, objeto: "poker" }] });
  assert.ok(sala.ctx.pintadas > 0, "la sala no se ha pintado");
  assert.ok(ficha.ctx.pintadas > 0, "el objeto de la puerta no se ha pintado");
});

test("detener corta el bucle: no quedan fotogramas pedidos", () => {
  const reloj = relojFalso();
  const sala = lienzoFalso();
  const mando = arrancarCantina({ sala, objetos: [] }, { ...reloj });
  assert.equal(reloj.pendientes, 1, "el bucle no ha arrancado");

  reloj.avanzar(16);
  reloj.tic();
  assert.equal(reloj.pendientes, 1, "el bucle no se encadena");

  mando.detener();
  assert.equal(reloj.pendientes, 0, "queda un fotograma vivo tras cerrar");
});

test("un fotograma que llega tarde tras detener no vuelve a pintar", () => {
  // Cerrar la ventana y que el navegador dispare el fotograma ya pedido es lo
  // normal, no un caso raro: pintar ahí es pintar contra un lienzo huérfano.
  const reloj = relojFalso();
  const sala = lienzoFalso();
  const mando = arrancarCantina({ sala, objetos: [] }, { ...reloj });
  const antes = sala.ctx.pintadas;
  mando.detener();
  reloj.tic();
  assert.equal(sala.ctx.pintadas, antes);
});

test("bajo prefers-reduced-motion no hay bucle, pero sí hay sala", () => {
  const reloj = relojFalso();
  const sala = lienzoFalso();
  const ficha = lienzoFalso(48, 48);
  arrancarCantina(
    { sala, objetos: [{ lienzo: ficha, objeto: "poker" }] },
    { ...reloj, reducirMovimiento: true },
  );
  assert.equal(reloj.pendientes, 0, "se ha pedido un fotograma con el movimiento apagado");
  assert.ok(sala.ctx.pintadas > 0, "la sala tiene que verse igual, solo que quieta");
  assert.ok(ficha.ctx.pintadas > 0, "el objeto tiene que verse, aunque no gire");
});

test("sin bucle, asomarse repinta igualmente", () => {
  // Es lo que hace que la sala siga siendo interactiva con el movimiento
  // apagado: mover la cámara es una respuesta a un gesto, no una animación.
  const reloj = relojFalso();
  const sala = lienzoFalso();
  const mando = arrancarCantina({ sala, objetos: [] }, { ...reloj, reducirMovimiento: true });
  const antes = sala.ctx.pintadas;
  mando.mirar({ x: 1, y: 0 });
  assert.ok(sala.ctx.pintadas > antes, "asomarse no ha repintado");
});

test("enfocar un objeto no exige que exista un lienzo de sala", () => {
  // La ventana puede renderizarse sin lienzo (arnés, host raro): eso apaga el
  // dibujo, no la ventana.
  const mando = arrancarCantina({ sala: null, objetos: [] });
  assert.doesNotThrow(() => {
    mando.enfocar("poker");
    mando.mirar({ x: 0.5, y: 0.5 });
    mando.detener();
  });
});
