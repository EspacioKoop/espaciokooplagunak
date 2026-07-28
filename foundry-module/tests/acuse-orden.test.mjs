import assert from "node:assert/strict";
import test from "node:test";

import {
  ACUSE_ESTADOS,
  LECTURA_REAL,
  TIPO_ACUSE,
  aceptarAcuse,
  estadoOrden,
  lecturaReal,
  sobreAcuse,
  valorOrdenado,
} from "../scripts/acuse-orden.mjs";

const nave = {
  heading: 73.4,
  shields_active: false,
  systems: { impulse: { power: 0.8, coolant: 0.25 }, warp: { power: 1 } },
};

test("el acuse vuelve a quien emitió la orden, y a nadie más", () => {
  // La orden de Navegación no es asunto de Armas. Es la misma privacidad de
  // interfaz que las manos del póker, y por el mismo canal.
  const sobre = sobreAcuse({ userId: "p1", order: { action: "set_target_heading", params: { heading: 90 } }, ok: true });
  assert.equal(sobre.tipo, TIPO_ACUSE);
  assert.equal(sobre.destinatarioId, "p1");
  assert.deepEqual(aceptarAcuse(sobre, "p1"), sobre);
  assert.equal(aceptarAcuse(sobre, "p2"), null, "otro puesto lo descarta");
  assert.equal(aceptarAcuse(sobre, null), null);
  // Y no se confunde con lo demás que viaja por ese canal.
  assert.equal(aceptarAcuse({ tipo: "lagunak:telemetria-nave", ship: {} }, "p1"), null);
  assert.equal(aceptarAcuse({ tipo: "minijuego:vista-privada" }, "p1"), null);
});

test("una orden sin emisor o sin acción no genera acuse", () => {
  assert.equal(sobreAcuse({ userId: null, order: { action: "set_impulse" }, ok: true }), null);
  assert.equal(sobreAcuse({ userId: "p1", order: {}, ok: true }), null);
});

test("el rechazo lleva su motivo; la aceptación no lleva ninguno", () => {
  const malo = sobreAcuse({ userId: "p1", order: { action: "set_warp" }, ok: false, codigo: "warp fuera de rango" });
  assert.equal(malo.estado, "rechazada");
  assert.equal(malo.codigo, "warp fuera de rango");
  const bueno = sobreAcuse({ userId: "p1", order: { action: "set_warp" }, ok: true, codigo: "ignórame" });
  assert.equal(bueno.estado, "aceptada");
  assert.equal(bueno.codigo, null);
  for (const estado of [malo.estado, bueno.estado]) assert.ok(ACUSE_ESTADOS.includes(estado));
});

test("impulso y warp NO tienen lectura real, y eso se dice en vez de inventarse", () => {
  // El puente publica rumbo, energía, casco, escudos y el detalle por sistema,
  // pero no el impulso ni el warp vigentes. Enseñar como «real» el mismo número
  // que se acaba de pedir sería justo la mentira que este paso viene a quitar.
  assert.equal(LECTURA_REAL.set_impulse, null);
  assert.equal(LECTURA_REAL.set_warp, null);
  for (const accion of ["set_impulse", "set_warp"]) {
    const { disponible, valor } = lecturaReal(accion, {}, nave);
    assert.equal(disponible, false);
    assert.equal(valor, null);
  }
  const orden = estadoOrden({ acuse: { accion: "set_impulse", params: { impulse: 0.5 }, estado: "aceptada" }, ship: nave });
  assert.equal(orden.ordenado, 0.5, "lo pedido sí se enseña");
  assert.equal(orden.hayLecturaReal, false);
  assert.equal(orden.convergido, null, "sin lectura no se afirma ni se niega");
});

test("el rumbo compara por el arco corto: 359 y 001 distan dos grados", () => {
  // A lo bruto, la diferencia sería 358 y una nave ya en rumbo se marcaría como
  // desobediente justo al cruzar el norte.
  const enRumbo = estadoOrden({
    acuse: { accion: "set_target_heading", params: { heading: 359 }, estado: "aceptada" },
    ship: { heading: 1 },
  });
  assert.equal(enRumbo.convergido, true, `359 vs 1 debería converger`);

  const maniobrando = estadoOrden({
    acuse: { accion: "set_target_heading", params: { heading: 90 }, estado: "aceptada" },
    ship: { heading: 73.4 },
  });
  assert.equal(maniobrando.convergido, false);
  assert.equal(maniobrando.ordenado, 90);
  assert.equal(maniobrando.real, 73.4, "el delta que hace sentir la masa de la nave");
});

test("las órdenes por sistema leen el sistema que nombran", () => {
  const potencia = estadoOrden({
    acuse: { accion: "set_system_power", params: { system: "impulse", value: 0.8 }, estado: "aceptada" },
    ship: nave,
  });
  assert.equal(potencia.hayLecturaReal, true);
  assert.equal(potencia.real, 0.8);
  assert.equal(potencia.convergido, true);
  assert.equal(potencia.sistema, "impulse");

  // Un sistema que la nave no publica no se inventa.
  const fantasma = estadoOrden({
    acuse: { accion: "set_system_coolant", params: { system: "no-existe", value: 1 }, estado: "aceptada" },
    ship: nave,
  });
  assert.equal(fantasma.hayLecturaReal, false);
});

test("los escudos se comparan como lo que son: encendido o apagado", () => {
  const encender = estadoOrden({
    acuse: { accion: "set_shields", params: { active: true }, estado: "aceptada" },
    ship: { shields_active: false },
  });
  assert.equal(encender.ordenado, true);
  assert.equal(encender.real, false);
  assert.equal(encender.convergido, false);

  const ya = estadoOrden({
    acuse: { accion: "set_shields", params: { active: true }, estado: "aceptada" },
    ship: { shields_active: true },
  });
  assert.equal(ya.convergido, true);
});

test("«enviada» es un estado real: entre emitir y que el GM conteste hay un viaje", () => {
  // Una consola que no dice nada en ese hueco parece rota.
  const orden = estadoOrden({
    acuse: { accion: "set_target_heading", params: { heading: 90 }, estado: "enviada" },
    ship: null,
  });
  assert.equal(orden.estado, "enviada");
  assert.equal(orden.ordenado, 90);
  assert.equal(orden.hayLecturaReal, false, "sin telemetría todavía no hay con qué comparar");
});

test("sin acuse no hay panel, y un estado desconocido no se cuela", () => {
  assert.equal(estadoOrden({}), null);
  assert.equal(estadoOrden({ acuse: null }), null);
  assert.equal(estadoOrden({ acuse: {} }), null);
  const raro = estadoOrden({ acuse: { accion: "set_warp", estado: "inventado" }, ship: nave });
  assert.equal(raro.estado, "enviada", "lo desconocido cae en el estado más prudente");
});

test("valorOrdenado sabe el nombre del parámetro de cada orden", () => {
  assert.equal(valorOrdenado("set_target_heading", { heading: 90 }), 90);
  assert.equal(valorOrdenado("set_impulse", { impulse: 0.5 }), 0.5);
  assert.equal(valorOrdenado("set_warp", { warp: 2 }), 2);
  assert.equal(valorOrdenado("set_system_power", { value: 0.7 }), 0.7);
  assert.equal(valorOrdenado("set_shields", { active: true }), true);
  assert.equal(valorOrdenado("accion-que-no-existe", {}), null);
  assert.equal(valorOrdenado("set_target_heading", {}), null, "un parámetro ausente no es cero");
});
