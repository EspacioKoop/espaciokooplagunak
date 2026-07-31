// Integración del vertical de dados (#413) con el motor de sesión común (#308).
//
// No repite las reglas —de eso va `minijuegos-dados-motor.test.mjs`— sino que
// comprueba lo que justifica que exista un segundo vertical: que la sesión aloja
// el juego POR SU INTERFAZ, sin una sola rama que hable de dados, y que las
// garantías comunes (identidad autenticada, vista privada, resultado) siguen en
// pie con otro juego dentro. Si un cambio en la sesión se atara al póker, esta
// prueba es la que se rompe.

import assert from "node:assert/strict";
import test from "node:test";

import {
  aplicar,
  crearSesion,
  vistaPrivadaSesion,
  vistaPublicaSesion,
} from "../scripts/minijuegos/sesion-motor.mjs";
import * as dados from "../scripts/minijuegos/dados-motor.mjs";

let contadorNonce = 0;
function sobre(tipo, sesion, extra = {}) {
  contadorNonce += 1;
  return {
    sessionId: sesion.publico.id,
    epocaCoordinador: sesion.publico.epocaCoordinador,
    revisionEsperada: sesion.publico.revision,
    tipo,
    nonce: `d${contadorNonce}`,
    ...extra,
  };
}

function ok(sesion, tipo, actorId, extra = {}, opciones = {}) {
  const res = aplicar(sesion, { sobre: sobre(tipo, sesion, extra), actorId, juego: dados, ...opciones });
  assert.equal(res.ok, true, `esperaba ok en ${tipo}: ${res.codigo}`);
  return res.sesion;
}

function mesaEnCurso() {
  let s = crearSesion({ id: "cubilete-1", juego: "dados", anfitrionId: "gm", coordinadorId: "gm" });
  s = ok(s, "join", "u1");
  s = ok(s, "join", "u2");
  return ok(s, "start", "gm", {}, { semilla: 4242 });
}

test("la sesión aloja el vertical de dados sin conocer sus reglas", () => {
  const s = mesaEnCurso();
  const pub = vistaPublicaSesion(s);
  assert.equal(pub.fase, "en_curso");
  assert.equal(pub.manoEnCurso, true);
  assert.equal(pub.juegoPublico.dadosEnJuego, dados.DADOS_POR_JUGADOR * 2);
  assert.ok(["u1", "u2"].includes(pub.juegoPublico.turno));
});

test("el cubilete es privado: no viaja en el estado compartido", () => {
  const s = mesaEnCurso();
  assert.equal(JSON.stringify(vistaPublicaSesion(s)).includes("Cubilete"), false);
  const deU1 = vistaPrivadaSesion(s, "u1", dados);
  assert.equal(deU1.juegoPrivado.tuCubilete.length, dados.DADOS_POR_JUGADOR);
  assert.deepEqual(
    vistaPrivadaSesion(s, "u2", dados).juegoPrivado.tuCubilete.length,
    dados.DADOS_POR_JUGADOR,
  );
});

test("un act de dados fuera de turno lo rechaza el juego, no la sesión", () => {
  const s = mesaEnCurso();
  const turno = vistaPublicaSesion(s).juegoPublico.turno;
  const otro = turno === "u1" ? "u2" : "u1";
  const res = aplicar(s, {
    sobre: sobre("act", s, { parametros: { tipo: "apostar", parametros: { cantidad: 1, cara: 3 } } }),
    actorId: otro,
    juego: dados,
  });
  assert.equal(res.ok, false);
  assert.equal(res.codigo, dados.ERRORES.FUERA_DE_TURNO);
  // Una acción rechazada no gasta revisión.
  assert.equal(vistaPublicaSesion(res.sesion ?? s).revision, vistaPublicaSesion(s).revision);
});

test("una ronda completa —apostar y dudar— termina y publica resultado", () => {
  let s = mesaEnCurso();
  const primero = vistaPublicaSesion(s).juegoPublico.turno;
  const segundo = primero === "u1" ? "u2" : "u1";

  // Apuesta imposible de sostener con diez dados: el destape la tumba seguro,
  // así que la prueba no depende de la tirada de la semilla.
  s = ok(s, "act", primero, { parametros: { tipo: "apostar", parametros: { cantidad: 10, cara: 6 } } });
  assert.deepEqual(vistaPublicaSesion(s).juegoPublico.apuesta, {
    cantidad: 10,
    cara: 6,
    userId: primero,
  });

  s = ok(s, "act", segundo, { parametros: { tipo: "dudar" } });
  const pub = vistaPublicaSesion(s);
  assert.equal(pub.manoEnCurso, false);
  assert.equal(pub.resultado.perdedorId, primero);
  // El destape es público: la mesa puede comprobar el recuento por su cuenta.
  assert.equal(pub.juegoPublico.destape.apuestaSostenida, false);
  assert.equal(Object.keys(pub.juegoPublico.destape.cubiletes).length, 2);
});
