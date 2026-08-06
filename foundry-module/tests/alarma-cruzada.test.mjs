import assert from "node:assert/strict";
import test from "node:test";

import {
  CLAVE_ALARMA_CRUZADA,
  PUESTOS_ALARMA_CRUZADA,
  UMBRAL_CALOR_REACTOR,
  UMBRAL_POTENCIA_ESCUDO,
  alarmaCruzadaActiva,
  datosAlarmaCruzada,
  textoAlarmaCruzada,
} from "../scripts/alarma-cruzada.mjs";

function nave({ calorReactor = 0, potenciaFrontshield = 1, potenciaRearshield = 1 } = {}) {
  return {
    systems: {
      reactor: { heat: calorReactor },
      frontshield: { power: potenciaFrontshield },
      rearshield: { power: potenciaRearshield },
    },
  };
}

// ---- alarmaCruzadaActiva: la dependencia cruzada -----------------------

test("sin correlación no hay alarma: reactor caliente con escudos a potencia nominal", () => {
  assert.equal(alarmaCruzadaActiva(nave({ calorReactor: 0.95 })), false);
});

test("sin correlación no hay alarma: escudos reducidos con reactor frío", () => {
  assert.equal(alarmaCruzadaActiva(nave({ potenciaFrontshield: 0.4 })), false);
});

test("la correlación activa la alarma: reactor crítico y un escudo reducido", () => {
  assert.equal(
    alarmaCruzadaActiva(nave({ calorReactor: 0.85, potenciaFrontshield: 0.6 })),
    true,
  );
});

test("basta con que UN escudo esté reducido, no hace falta que ambos lo estén", () => {
  const soloRear = nave({ calorReactor: 0.85, potenciaFrontshield: 1, potenciaRearshield: 0.5 });
  assert.equal(alarmaCruzadaActiva(soloRear), true);
});

test("umbral exacto: calor por debajo de 0.8 no activa aunque los escudos estén bajos", () => {
  assert.equal(
    alarmaCruzadaActiva(nave({ calorReactor: 0.79, potenciaFrontshield: 0.5 })),
    false,
  );
});

test("umbral exacto: potencia de escudo en 1.0 (nominal) no cuenta como reducida", () => {
  assert.equal(
    alarmaCruzadaActiva(nave({ calorReactor: 0.9, potenciaFrontshield: 1.0 })),
    false,
  );
});

test("histéresis del calor: una vez activa, no se apaga hasta bajar de 0.7", () => {
  const enBanda = nave({ calorReactor: 0.75, potenciaFrontshield: 0.5 });
  assert.equal(alarmaCruzadaActiva(enBanda, false), false, "sin estar activa, 0.75 no basta para entrar");
  assert.equal(alarmaCruzadaActiva(enBanda, true), true, "ya activa, 0.75 no basta para salir");
  const fria = nave({ calorReactor: 0.65, potenciaFrontshield: 0.5 });
  assert.equal(alarmaCruzadaActiva(fria, true), false, "por debajo de salir, se apaga");
});

test("sin datos utilizables en cualquiera de los dos sistemas no se inventa una alarma", () => {
  assert.equal(alarmaCruzadaActiva(null), false);
  assert.equal(alarmaCruzadaActiva({}), false);
  assert.equal(alarmaCruzadaActiva({ systems: { reactor: { heat: 0.9 } } }), false, "sin lectura de escudos");
  assert.equal(
    alarmaCruzadaActiva({ systems: { frontshield: { power: 0.4 } } }),
    false,
    "sin lectura de reactor",
  );
});

// ---- datosAlarmaCruzada: qué señala como más afectado -------------------

test("datosAlarmaCruzada redondea a porcentaje y señala el escudo más reducido", () => {
  const datos = datosAlarmaCruzada(
    nave({ calorReactor: 0.873, potenciaFrontshield: 0.61, potenciaRearshield: 0.4 }),
  );
  assert.equal(datos.calorReactorPct, 87);
  assert.equal(datos.potenciaEscudoPct, 40);
  assert.equal(datos.sistemaEscudo, "rearshield");
});

test("datosAlarmaCruzada sin lecturas devuelve null, no cero", () => {
  const datos = datosAlarmaCruzada({});
  assert.equal(datos.calorReactorPct, null);
  assert.equal(datos.potenciaEscudoPct, null);
  assert.equal(datos.sistemaEscudo, null);
});

// ---- textoAlarmaCruzada: causa para ingeniería, efecto para armas -------

test("ingeniería recibe la variante de causa", () => {
  const texto = textoAlarmaCruzada({ calorReactorPct: 90 }, "engineering");
  assert.equal(texto.tituloKey, "LAGUNAK.AlarmaCruzada.ReactorEscudos.Causa.Titulo");
  assert.equal(texto.resumenKey, "LAGUNAK.AlarmaCruzada.ReactorEscudos.Causa.Resumen");
});

test("armas recibe la variante de efecto", () => {
  const texto = textoAlarmaCruzada({ potenciaEscudoPct: 40 }, "weapons");
  assert.equal(texto.tituloKey, "LAGUNAK.AlarmaCruzada.ReactorEscudos.Efecto.Titulo");
  assert.equal(texto.resumenKey, "LAGUNAK.AlarmaCruzada.ReactorEscudos.Efecto.Resumen");
});

test("un puesto ajeno a la alarma no recibe ninguna variante", () => {
  assert.equal(textoAlarmaCruzada({}, "navigation"), null);
  assert.equal(textoAlarmaCruzada({}, null), null);
});

test("PUESTOS_ALARMA_CRUZADA y CLAVE_ALARMA_CRUZADA son el contrato estable que consume la capa de difusión", () => {
  assert.deepEqual([...PUESTOS_ALARMA_CRUZADA].sort(), ["engineering", "weapons"]);
  assert.equal(CLAVE_ALARMA_CRUZADA, "reactor-escudos");
  assert.equal(UMBRAL_POTENCIA_ESCUDO, 1.0);
  assert.equal(UMBRAL_CALOR_REACTOR.entrar > UMBRAL_CALOR_REACTOR.salir, true);
});
