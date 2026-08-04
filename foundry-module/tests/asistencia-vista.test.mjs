import assert from "node:assert/strict";
import test from "node:test";

import { BANDAS } from "../scripts/asistencia/bandas.mjs";
import { CATALOGO_BASE } from "../scripts/asistencia/catalogo.mjs";
import { crearSesion, abrir } from "../scripts/asistencia/sesion.mjs";
import { crearReto } from "../scripts/asistencia/temporizacion.mjs";
import { FASES, asistenciaVista, bandaDeTirada, tareasOfrecibles } from "../scripts/asistencia/asistencia-vista.mjs";

const TAREA_INGENIERIA = CATALOGO_BASE.buscar("estabilizar-sistema-caliente");

test("tareasOfrecibles marca la propia sin quitarla, y narrativa a sensores", () => {
  const modelo = tareasOfrecibles(CATALOGO_BASE.tareas, "engineering");
  const ingenieria = modelo.find((t) => t.id === "estabilizar-sistema-caliente");
  const sensores = modelo.find((t) => t.id === "afinar-contacto-dudoso");
  assert.equal(ingenieria.propia, true);
  assert.equal(sensores.narrativa, true);
  assert.equal(modelo.find((t) => t.id === "bordar-maniobra").propia, false);
});

test("fase lista: sin oferta ni reto, solo el catálogo", () => {
  const modelo = asistenciaVista({ tareas: CATALOGO_BASE.tareas, puestoPropio: "weapons" });
  assert.equal(modelo.fase, FASES.LISTA);
  assert.equal(modelo.tareas.length, CATALOGO_BASE.tareas.length);
  assert.equal(modelo.oferta, undefined);
});

test("fase oferta: la distribución trae las 4 bandas y la vía correcta", () => {
  const abierta = abrir({
    estado: crearSesion(),
    tarea: TAREA_INGENIERIA,
    asistenteId: "u1",
    nonce: "n1",
    tieneFicha: true,
    // Sin este ajuste el enfoque con coste ni se ofrece: gastar un recurso de
    // ficha lo abre el GM o no existe.
    gmPermiteRecursos: true,
    ahora: 0,
  });
  assert.equal(abierta.ok, true);
  const modelo = asistenciaVista({
    fase: FASES.OFERTA,
    tareaId: TAREA_INGENIERIA.id,
    oferta: abierta.oferta,
  });
  assert.equal(modelo.oferta.via, "habilidad");
  const pruebaHabilidad = modelo.oferta.enfoques.find((e) => e.id === "reparar-en-caliente");
  assert.equal(pruebaHabilidad.distribucion.length, 4);
  assert.ok(
    Math.abs(pruebaHabilidad.distribucion.reduce((s, b) => s + b.fraccion, 0) - 1) < 1e-9,
  );
  const sinTirada = modelo.oferta.enfoques.find((e) => e.id === "reparar-conjuro");
  assert.equal(sinTirada.via, "banda-fija");
  assert.equal(sinTirada.bandaFija, BANDAS.EXITO);
  assert.deepEqual(sinTirada.coste, { espacio: 1 });
});

test("sin ficha, la oferta degrada a destreza sin enfoques que ofrecer", () => {
  const abierta = abrir({
    estado: crearSesion(),
    tarea: TAREA_INGENIERIA,
    asistenteId: "u1",
    nonce: "n1",
    tieneFicha: false,
    ahora: 0,
  });
  const modelo = asistenciaVista({ fase: FASES.OFERTA, oferta: abierta.oferta });
  assert.equal(modelo.oferta.via, "destreza");
  assert.equal(modelo.oferta.enfoques.length, 0);
});

test("fase reto: pinta posición, zona de la banda y lectura por texto", () => {
  const reto = crearReto({ semilla: "asistencia-test", dificultad: "normal", inicioMs: 0 });
  const modelo = asistenciaVista({ fase: FASES.RETO, reto, tMs: 100 });
  assert.ok(modelo.reto.posicion >= 0 && modelo.reto.posicion <= 1);
  assert.ok(modelo.reto.zonaDesde < modelo.reto.zonaHasta);
  assert.equal(typeof modelo.reto.zona, "string");
  assert.equal(typeof modelo.reto.segundosRestantes, "number");
});

test("fase resultado: expone banda y tier de la propuesta lograda", () => {
  const modelo = asistenciaVista({
    fase: FASES.RESULTADO,
    resultado: { propuesta: { banda: BANDAS.CRITICO, tier: "alto" } },
  });
  assert.equal(modelo.resultado.banda, BANDAS.CRITICO);
  assert.equal(modelo.resultado.tier, "alto");
});

test("fase rechazo: expone el código para que la plantilla elija el texto", () => {
  const modelo = asistenciaVista({ fase: FASES.RECHAZO, rechazo: { codigo: "presupuesto-agotado" } });
  assert.equal(modelo.rechazo.codigo, "presupuesto-agotado");
});

test("bandaDeTirada: prueba de habilidad normal, margen contra CD", () => {
  const rango = { via: "probabilidad", salvacion: false, dificultad: 13, reglaCasaNatural: false };
  assert.equal(bandaDeTirada({ rango, total: 13 }), BANDAS.EXITO);
  assert.equal(bandaDeTirada({ rango, total: 12 }), BANDAS.FALLO);
  assert.equal(bandaDeTirada({ rango, total: 18 }), BANDAS.CRITICO);
});

test("bandaDeTirada: en salvación tira el objetivo y su éxito es el fallo del enfoque", () => {
  const rango = { via: "probabilidad", salvacion: true, dificultad: 14 };
  // El objetivo saca 14 justo: iguala la CD, y en salvación empatar es superarla.
  assert.equal(bandaDeTirada({ rango, total: 14 }), BANDAS.FALLO);
  // Margen 4 (14-10): por debajo del umbral de crítico, y positivo en salvación.
  assert.equal(bandaDeTirada({ rango, total: 10 }), BANDAS.EXITO);
});

test("bandaDeTirada: banda fija no tira, ignora el total", () => {
  const rango = { via: "banda-fija", bandaFija: BANDAS.EXITO };
  assert.equal(bandaDeTirada({ rango, total: 1 }), BANDAS.EXITO);
});

test("bandaDeTirada: regla de la casa solo aplica fuera de salvación", () => {
  const rango = { via: "probabilidad", salvacion: false, dificultad: 25, reglaCasaNatural: true };
  assert.equal(bandaDeTirada({ rango, total: 20, natural: 20 }), BANDAS.CRITICO);
  const rangoSalvacion = { via: "probabilidad", salvacion: true, dificultad: 14, reglaCasaNatural: true };
  // Aunque el "natural" coincida con 20, en salvación no es SU tirada y no cuenta:
  // sin la regla se quedaría en fallo (margen 4, no llega a crítico) en vez de
  // subir a crítico como pasaría fuera de salvación.
  assert.equal(bandaDeTirada({ rango: rangoSalvacion, total: 10, natural: 20 }), BANDAS.EXITO);
});
