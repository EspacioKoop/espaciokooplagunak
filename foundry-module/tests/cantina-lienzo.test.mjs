// El bucle y el asomo de la cantina (#423 sobre #362).
//
// `cantina-lienzo.mjs` no importa Foundry: recibe lienzos y funciones de reloj,
// así que se puede ejercitar entero con lienzos de mentira. Lo que se afirma
// aquí es lo que no se puede ver mirando la sala: que el bucle se para cuando
// se le dice, que bajo `prefers-reduced-motion` NO hay bucle, y que asomarse
// repinta aunque no lo haya.

import assert from "node:assert/strict";
import test from "node:test";

import { arrancarCantina } from "../scripts/cantina-lienzo.mjs";
import { PLANOS } from "../scripts/cantina-planos.mjs";

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

test("sin bucle, cambiar de plano repinta igualmente", () => {
  // Es lo que hace que la sala siga siendo interactiva con el movimiento
  // apagado: mover la cámara es una respuesta a un gesto, no una animación.
  const reloj = relojFalso();
  const sala = lienzoFalso();
  const mando = arrancarCantina({ sala, objetos: [] }, { ...reloj, reducirMovimiento: true });
  const antes = sala.ctx.pintadas;
  mando.cortarA("barra");
  assert.ok(sala.ctx.pintadas > antes, "cortar a otro plano no ha repintado");
});

test("enfocar un objeto no exige que exista un lienzo de sala", () => {
  // La ventana puede renderizarse sin lienzo (arnés, host raro): eso apaga el
  // dibujo, no la ventana.
  const mando = arrancarCantina({ sala: null, objetos: [] });
  assert.doesNotThrow(() => {
    mando.enfocar("poker");
    mando.cortarA("barra");
    mando.detener();
  });
});

// Girar sobre uno mismo (#423): en una sala uno se da la vuelta entera.



// Los planos (#423): cámara autorada, opciones señaladas.
test("cortar lleva a un plano del catálogo, y uno inventado no cuela", () => {
  const sala = lienzoFalso();
  const mando = arrancarCantina({ sala, objetos: [] });
  assert.equal(mando.cortarA("barra"), true);
  assert.equal(mando.donde(), "barra");
  assert.equal(mando.cortarA("la-cocina"), false, "un destino inventado ha colado");
  assert.equal(mando.donde(), "barra", "el plano ha cambiado a un sitio que no existe");
});

test("desde cualquier plano se ve SIEMPRE alguna opción", () => {
  // Es la regla del modelo GTA/RDR2: lo que se puede hacer se ve. Un plano sin
  // salidas visibles es un callejón, y en una cantina eso es un fallo.
  const sala = lienzoFalso();
  const mando = arrancarCantina({ sala, objetos: [] });
  for (const plano of PLANOS) {
    mando.cortarA(plano.id);
    assert.ok(mando.opciones().length > 0, `el plano ${plano.id} no ofrece nada`);
  }
});
