import assert from "node:assert/strict";
import test from "node:test";

import { BANDAS } from "../scripts/asistencia/bandas.mjs";
import {
  PROPUESTA_ERRORES,
  TIERS,
  acotarPorTier,
  consumirPropuesta,
  crearPropuesta,
  propuestaVigente,
  puedeAsistir,
  tierDeBanda,
} from "../scripts/asistencia/propuesta.mjs";
import { buildStationOrder } from "../scripts/station-order-relay.mjs";

const T0 = 1_000_000;

const nueva = (extra = {}) =>
  crearPropuesta({
    tareaId: "estabilizar-sistema-caliente",
    puestoAsistido: "engineering",
    accion: "set_system_coolant",
    banda: BANDAS.EXITO,
    asistenteId: "ayudante-1",
    nonce: "n1",
    ahora: T0,
    ...extra,
  });

test("un éxito deja token; un fallo no deja nada (la ayuda es sal, no peaje)", () => {
  assert.equal(nueva().ok, true);
  assert.equal(nueva({ banda: BANDAS.FALLO }).error, PROPUESTA_ERRORES.BANDA_SIN_FRUTO);
  assert.equal(nueva({ banda: BANDAS.PIFIA }).error, PROPUESTA_ERRORES.BANDA_SIN_FRUTO);
});

test("ni el crítico puede proponer una orden fuera de STATION_ACTIONS", () => {
  // La línea roja de ADR-0002: el grado de éxito elige DÓNDE dentro de un rango
  // ya autorizado, nunca abre un rango nuevo.
  const fuera = nueva({ banda: BANDAS.CRITICO, accion: "set_shields" });
  assert.equal(fuera.error, PROPUESTA_ERRORES.ACCION_NO_AUTORIZADA);
});

test("el crítico sube de tier, no de rango", () => {
  assert.equal(tierDeBanda(BANDAS.EXITO), TIERS.BAJO);
  assert.equal(tierDeBanda(BANDAS.CRITICO), TIERS.ALTO);
  assert.equal(tierDeBanda(BANDAS.FALLO), null);

  const rango = [0, 10];
  const bajo = acotarPorTier({ base: 4, objetivo: 8, rango, tier: TIERS.BAJO });
  const alto = acotarPorTier({ base: 4, objetivo: 8, rango, tier: TIERS.ALTO });
  assert.equal(bajo, 6);
  assert.equal(alto, 8);
  // Y por mucho que se pida, el tope autorizado manda.
  assert.equal(acotarPorTier({ base: 4, objetivo: 99, rango, tier: TIERS.ALTO }), 10);
});

test("EL AYUDANTE NO EMITE: la orden solo sale si la gasta el titular", () => {
  // El corazón del issue. Un ayudante que pudiera emitir crearía una segunda
  // autoridad sobre la verdad de la nave.
  const { propuesta } = nueva();
  const intruso = consumirPropuesta({
    propuesta,
    emisorId: "ayudante-1",
    emisorPuesto: "weapons",
    ahora: T0,
  });
  assert.equal(intruso.ok, false);
  assert.equal(intruso.error, PROPUESTA_ERRORES.NO_ES_TITULAR);

  const titular = consumirPropuesta({
    propuesta,
    emisorId: "ingeniero-7",
    emisorPuesto: "engineering",
    params: { system: "reactor", level: 8 },
    base: 4,
    ahora: T0,
  });
  assert.equal(titular.ok, true);
  // Y sale por el mismo camino que cualquier orden suya.
  const orden = buildStationOrder({ ...titular.orden, nonce: "n2" });
  assert.equal(orden.action, "set_system_coolant");
  // Tier bajo (éxito): a mitad de camino entre la lectura actual y lo pedido.
  assert.equal(orden.params.level, 6);
  assert.equal(orden.params.system, "reactor");
});

test("el crédito distingue quién decidió de quién apoyó", () => {
  // Al cerrar una crisis debe seguir claro quién tomó la decisión: la ayuda
  // amplifica al especialista, no diluye su identidad.
  const { propuesta } = nueva({ banda: BANDAS.CRITICO });
  const { credito } = consumirPropuesta({
    propuesta,
    emisorId: "ingeniero-7",
    emisorPuesto: "engineering",
    params: { system: "reactor", level: 8 },
    base: 4,
    ahora: T0,
  });
  assert.equal(credito.asistenteId, "ayudante-1");
  assert.equal(credito.emisorId, "ingeniero-7");
  assert.equal(credito.tier, TIERS.ALTO);
});

test("el token es efímero: caduca y deja de gastarse", () => {
  const { propuesta } = nueva({ vigenciaMs: 60_000 });
  assert.equal(propuestaVigente(propuesta, T0 + 59_000), true);
  assert.equal(propuestaVigente(propuesta, T0 + 60_000), false);
  const tarde = consumirPropuesta({
    propuesta,
    emisorId: "ingeniero-7",
    emisorPuesto: "engineering",
    ahora: T0 + 120_000,
  });
  assert.equal(tarde.error, PROPUESTA_ERRORES.CADUCADA);
});

test("presupuesto de concurrencia: no todos ayudan siempre al ingeniero", () => {
  const { propuesta } = nueva();
  const vivas = [propuesta];
  assert.equal(
    puedeAsistir({ puestoAsistido: "engineering", asistenteId: "otro", propuestas: vivas, ahora: T0 })
      .error,
    PROPUESTA_ERRORES.PRESUPUESTO_AGOTADO,
  );
  // El mismo ayudante tampoco apila ayudas sobre el mismo puesto.
  assert.equal(
    puedeAsistir({
      puestoAsistido: "engineering",
      asistenteId: "ayudante-1",
      propuestas: vivas,
      ahora: T0,
    }).error,
    PROPUESTA_ERRORES.YA_ASISTE,
  );
  // Otro puesto sí está libre, y el presupuesto se libera al caducar.
  assert.equal(
    puedeAsistir({ puestoAsistido: "navigation", asistenteId: "otro", propuestas: vivas, ahora: T0 })
      .ok,
    true,
  );
  assert.equal(
    puedeAsistir({
      puestoAsistido: "engineering",
      asistenteId: "otro",
      propuestas: vivas,
      ahora: T0 + 999_999,
    }).ok,
    true,
  );
});

test("una propuesta se gasta UNA vez: el segundo consumo se rechaza", () => {
  // Sin esto, un único éxito autorizaría órdenes ilimitadas durante los 120 s
  // de vigencia y «token consumible» no querría decir nada.
  const { propuesta } = nueva();
  const gasto = consumirPropuesta({
    propuesta,
    emisorId: "ingeniero-7",
    emisorPuesto: "engineering",
    params: { system: "reactor", level: 8 },
    base: 4,
    ahora: T0,
  });
  assert.equal(gasto.ok, true);
  assert.deepEqual([...gasto.consumidos], ["n1"]);

  const replay = consumirPropuesta({
    propuesta,
    emisorId: "ingeniero-7",
    emisorPuesto: "engineering",
    params: { system: "reactor", level: 8 },
    base: 4,
    consumidos: gasto.consumidos,
    // Todavía dentro de la ventana: lo que lo rechaza es el gasto, no el reloj.
    ahora: T0 + 1_000,
  });
  assert.equal(replay.ok, false);
  assert.equal(replay.error, PROPUESTA_ERRORES.YA_CONSUMIDA);
  assert.equal(propuestaVigente(propuesta, T0 + 1_000), true);
});

test("el tier no es decorado: bajo y alto emiten parámetros distintos", () => {
  const consumo = (banda) => {
    const { propuesta } = nueva({ banda, nonce: `n-${banda}` });
    return consumirPropuesta({
      propuesta,
      emisorId: "ingeniero-7",
      emisorPuesto: "engineering",
      params: { system: "reactor", level: 8 },
      base: 4,
      ahora: T0,
    });
  };
  const bajo = consumo(BANDAS.EXITO);
  const alto = consumo(BANDAS.CRITICO);
  assert.notEqual(bajo.orden.params.level, alto.orden.params.level);
  assert.equal(bajo.orden.params.level, 6);
  assert.equal(alto.orden.params.level, 8);
  // Y ninguno sale del rango que la orden ya permitía (0..10 en el puente).
  for (const r of [bajo, alto]) {
    assert.ok(r.orden.params.level >= 0 && r.orden.params.level <= 10);
  }
});

test("ni el crítico pasa del tope autorizado por pedir de más", () => {
  const { propuesta } = nueva({ banda: BANDAS.CRITICO });
  const r = consumirPropuesta({
    propuesta,
    emisorId: "ingeniero-7",
    emisorPuesto: "engineering",
    params: { system: "reactor", level: 999 },
    base: 4,
    ahora: T0,
  });
  assert.equal(r.orden.params.level, 10);
});

test("una acción sin parámetro donde colocar el tier no produce propuesta", () => {
  // Preferimos no ofrecer la ayuda a ofrecerla mintiendo: en una orden booleana
  // o circular, éxito y crítico darían exactamente la misma orden.
  const rumbo = nueva({ puestoAsistido: "navigation", accion: "set_target_heading" });
  assert.equal(rumbo.error, PROPUESTA_ERRORES.ACCION_SIN_MARGEN);
  const escudos = nueva({ puestoAsistido: "weapons", accion: "set_shields" });
  assert.equal(escudos.error, PROPUESTA_ERRORES.ACCION_SIN_MARGEN);
});

test("sin lectura actual del puesto no se emite nada", () => {
  // El tier se mide DESDE algún sitio. Sin base no hay trayecto que partir, y
  // adivinarla sería inventarse el efecto de la ayuda.
  const { propuesta } = nueva();
  const r = consumirPropuesta({
    propuesta,
    emisorId: "ingeniero-7",
    emisorPuesto: "engineering",
    params: { system: "reactor", level: 8 },
    ahora: T0,
  });
  assert.equal(r.ok, false);
  assert.equal(r.error, PROPUESTA_ERRORES.PARAMETRO_INVALIDO);
});

test("warp: el tier respeta que el rango sea entero y nunca supera al alto", () => {
  const consumo = (banda) => {
    const { propuesta } = crearPropuesta({
      tareaId: "salto-limpio",
      puestoAsistido: "navigation",
      accion: "set_warp",
      banda,
      asistenteId: "ayudante-1",
      nonce: `w-${banda}`,
      ahora: T0,
    });
    return consumirPropuesta({
      propuesta,
      emisorId: "piloto-3",
      emisorPuesto: "navigation",
      params: { level: 3 },
      base: 0,
      ahora: T0,
    });
  };
  const bajo = consumo(BANDAS.EXITO).orden.params.level;
  const alto = consumo(BANDAS.CRITICO).orden.params.level;
  assert.equal(Number.isInteger(bajo), true);
  assert.equal(Number.isInteger(alto), true);
  assert.ok(bajo < alto);
  assert.ok(alto <= 4);
});
