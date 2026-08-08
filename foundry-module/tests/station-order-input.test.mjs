import assert from "node:assert/strict";
import test from "node:test";

import { ORDER_FORMS, parseOrderValue } from "../scripts/station-order-forms.mjs";

// Regresión del input vacío: Number("") === 0 hacía que un envío sin dato pasara
// como orden válida a cero (rumbo/impulso/warp/nivel). parseOrderValue comprueba
// la presencia ANTES de convertir, y los predicados de rango ya rechazan null.

// Root DOM falso: devuelve el valor indicado por id de input.
function fakeRoot(values = {}) {
  return {
    querySelector(sel) {
      const id = sel.replace(/^#/, "");
      return id in values ? { value: values[id] } : null;
    },
  };
}

test("parseOrderValue rechaza ausencia y vacío (nunca lo trata como 0)", () => {
  assert.equal(parseOrderValue(null), null);
  assert.equal(parseOrderValue(undefined), null);
  assert.equal(parseOrderValue(""), null);
  assert.equal(parseOrderValue("   "), null);
  assert.equal(parseOrderValue("abc"), null);
});

test("parseOrderValue convierte texto numérico válido, incluido el cero explícito", () => {
  assert.equal(parseOrderValue("0"), 0);
  assert.equal(parseOrderValue("270"), 270);
  assert.equal(parseOrderValue(" -1 "), -1);
  assert.equal(parseOrderValue("3.5"), 3.5);
});

test("read() con input vacío NO devuelve params en rumbo, impulso y warp", () => {
  const inputs = {
    "orden-rumbo": "lagunak-orden-rumbo",
    "orden-impulso": "lagunak-orden-impulso",
    "orden-warp": "lagunak-orden-warp",
  };
  for (const [form, inputId] of Object.entries(inputs)) {
    const spec = ORDER_FORMS[form];
    assert.equal(spec.read(fakeRoot({ [inputId]: "" })), null, `${form} vacío no debe emitir`);
    assert.equal(spec.read(fakeRoot({ [inputId]: "   " })), null, `${form} espacios no debe emitir`);
    assert.equal(spec.read(fakeRoot({})), null, `${form} sin input no debe emitir`);
  }
});

test("read() de potencia rechaza el nivel vacío aunque el sistema sea válido", () => {
  const spec = ORDER_FORMS["orden-potencia"];
  assert.equal(
    spec.read(fakeRoot({ "lagunak-orden-sistema": "reactor", "lagunak-orden-nivel": "" })),
    null,
    "nivel vacío no debe emitir",
  );
});

test("read() de refrigerante valida sistema y nivel 0..10 entero (#301)", () => {
  const spec = ORDER_FORMS["orden-refrigerante"];
  // Válido, incluido el cero explícito.
  assert.deepEqual(
    spec.read(fakeRoot({ "lagunak-orden-sistema-refrig": "impulse", "lagunak-orden-nivel-refrig": "0" })),
    { system: "impulse", level: 0 },
  );
  assert.deepEqual(
    spec.read(fakeRoot({ "lagunak-orden-sistema-refrig": "reactor", "lagunak-orden-nivel-refrig": "10" })),
    { system: "reactor", level: 10 },
  );
  // Nivel vacío, fuera de rango o no entero → no emite.
  assert.equal(spec.read(fakeRoot({ "lagunak-orden-sistema-refrig": "reactor", "lagunak-orden-nivel-refrig": "" })), null);
  assert.equal(spec.read(fakeRoot({ "lagunak-orden-sistema-refrig": "reactor", "lagunak-orden-nivel-refrig": "11" })), null);
  assert.equal(spec.read(fakeRoot({ "lagunak-orden-sistema-refrig": "reactor", "lagunak-orden-nivel-refrig": "5.5" })), null);
  // Sistema inválido con nivel válido → no emite.
  assert.equal(spec.read(fakeRoot({ "lagunak-orden-sistema-refrig": "inventado", "lagunak-orden-nivel-refrig": "3" })), null);
});

test("read() admite el cero explícito donde el rango lo permite", () => {
  assert.deepEqual(ORDER_FORMS["orden-rumbo"].read(fakeRoot({ "lagunak-orden-rumbo": "0" })), { heading: 0 });
  assert.deepEqual(ORDER_FORMS["orden-impulso"].read(fakeRoot({ "lagunak-orden-impulso": "0" })), { value: 0 });
  assert.deepEqual(ORDER_FORMS["orden-warp"].read(fakeRoot({ "lagunak-orden-warp": "0" })), { level: 0 });
});

test("read() rechaza valores fuera de rango de cada spec", () => {
  assert.equal(ORDER_FORMS["orden-rumbo"].read(fakeRoot({ "lagunak-orden-rumbo": "360" })), null);
  assert.equal(ORDER_FORMS["orden-impulso"].read(fakeRoot({ "lagunak-orden-impulso": "2" })), null);
  assert.equal(ORDER_FORMS["orden-warp"].read(fakeRoot({ "lagunak-orden-warp": "5" })), null);
  assert.equal(ORDER_FORMS["orden-warp"].read(fakeRoot({ "lagunak-orden-warp": "1.5" })), null);
});

test("auto-reparación: activar/desactivar son órdenes de valor fijo (#464)", () => {
  assert.deepEqual(ORDER_FORMS["orden-reparacion-auto-activar"].read(fakeRoot({})), { enabled: true });
  assert.deepEqual(ORDER_FORMS["orden-reparacion-auto-desactivar"].read(fakeRoot({})), { enabled: false });
});

test("read() de escaneo decodifica la lectura JSON del <select> (#462)", () => {
  const spec = ORDER_FORMS["orden-escanear"];
  const lectura = { distancia: 20000, rumboDeg: 90, precision: 1000, rumboPrecision: 15 };
  assert.deepEqual(
    spec.read(fakeRoot({ "lagunak-orden-objetivo-escaneo": JSON.stringify(lectura) })),
    lectura,
  );
});

test("read() de escaneo rellena precisión/rumboPrecision ausentes a 0", () => {
  const spec = ORDER_FORMS["orden-escanear"];
  const lectura = { distancia: 1230, rumboDeg: 90 };
  assert.deepEqual(
    spec.read(fakeRoot({ "lagunak-orden-objetivo-escaneo": JSON.stringify(lectura) })),
    { distancia: 1230, rumboDeg: 90, precision: 0, rumboPrecision: 0 },
  );
});

test("read() de escaneo no emite sin selección, con JSON roto, o sin distancia/rumbo", () => {
  const spec = ORDER_FORMS["orden-escanear"];
  assert.equal(spec.read(fakeRoot({})), null, "sin <select> no debe emitir");
  assert.equal(spec.read(fakeRoot({ "lagunak-orden-objetivo-escaneo": "" })), null, "vacío no debe emitir");
  assert.equal(
    spec.read(fakeRoot({ "lagunak-orden-objetivo-escaneo": "{no es json" })),
    null,
    "JSON roto no debe emitir",
  );
  assert.equal(
    spec.read(fakeRoot({ "lagunak-orden-objetivo-escaneo": JSON.stringify({ rumboDeg: 90 }) })),
    null,
    "sin distancia no debe emitir",
  );
  assert.equal(
    spec.read(fakeRoot({ "lagunak-orden-objetivo-escaneo": JSON.stringify({ distancia: 100 }) })),
    null,
    "sin rumbo no debe emitir",
  );
});

test("read() de fijar objetivo de armas decodifica la lectura JSON del <select> (#465)", () => {
  const spec = ORDER_FORMS["orden-fijar-objetivo-armas"];
  const lectura = { distancia: 20000, rumboDeg: 90, precision: 1000, rumboPrecision: 15 };
  assert.deepEqual(
    spec.read(fakeRoot({ "lagunak-orden-objetivo-armas": JSON.stringify(lectura) })),
    lectura,
  );
  assert.equal(spec.read(fakeRoot({})), null, "sin selección no debe emitir");
});

test("read() de disparar tubo exige objetivo Y tubo válido (#465)", () => {
  const spec = ORDER_FORMS["orden-disparar-tubo"];
  const lectura = { distancia: 20000, rumboDeg: 90 };
  const conObjetivo = (tubo) =>
    fakeRoot({ "lagunak-orden-objetivo-armas": JSON.stringify(lectura), "lagunak-orden-tubo": tubo });

  assert.deepEqual(spec.read(conObjetivo("2")), {
    distancia: 20000,
    rumboDeg: 90,
    precision: 0,
    rumboPrecision: 0,
    index: 2,
  });
  assert.equal(spec.read(conObjetivo("")), null, "tubo vacío no debe emitir");
  assert.equal(spec.read(conObjetivo("-1")), null, "tubo negativo no debe emitir");
  assert.equal(spec.read(conObjetivo("16")), null, "tubo fuera de la cota defensiva no debe emitir");
  assert.equal(spec.read(conObjetivo("1.5")), null, "tubo no entero no debe emitir");
  assert.equal(
    spec.read(fakeRoot({ "lagunak-orden-tubo": "0" })),
    null,
    "sin objetivo seleccionado no debe emitir aunque el tubo sea válido",
  );
});

test("comunicaciones: contestar/ignorar/cerrar son órdenes de valor fijo (#463)", () => {
  assert.deepEqual(ORDER_FORMS["orden-comms-contestar"].read(fakeRoot({})), { accept: true });
  assert.deepEqual(ORDER_FORMS["orden-comms-ignorar"].read(fakeRoot({})), { accept: false });
  assert.deepEqual(ORDER_FORMS["orden-comms-cerrar"].read(fakeRoot({})), {});
});

test("comunicaciones: orden-comms-opcion valida índice entero 0..15 (#463)", () => {
  const spec = ORDER_FORMS["orden-comms-opcion"];
  assert.deepEqual(spec.read(fakeRoot({ "lagunak-orden-comms-opcion": "0" })), { index: 0 });
  assert.deepEqual(spec.read(fakeRoot({ "lagunak-orden-comms-opcion": "15" })), { index: 15 });
  assert.equal(spec.read(fakeRoot({ "lagunak-orden-comms-opcion": "" })), null);
  assert.equal(spec.read(fakeRoot({ "lagunak-orden-comms-opcion": "16" })), null);
  assert.equal(spec.read(fakeRoot({ "lagunak-orden-comms-opcion": "-1" })), null);
  assert.equal(spec.read(fakeRoot({ "lagunak-orden-comms-opcion": "1.5" })), null);
});

test("comunicaciones: orden-comms-mensaje valida texto no vacío hasta 256 caracteres (#463)", () => {
  const spec = ORDER_FORMS["orden-comms-mensaje"];
  assert.deepEqual(
    spec.read(fakeRoot({ "lagunak-orden-comms-mensaje": "  Solicito atraque.  " })),
    { message: "Solicito atraque." },
  );
  assert.equal(spec.read(fakeRoot({ "lagunak-orden-comms-mensaje": "" })), null);
  assert.equal(spec.read(fakeRoot({ "lagunak-orden-comms-mensaje": "   " })), null);
  assert.equal(spec.read(fakeRoot({})), null);
  assert.equal(spec.read(fakeRoot({ "lagunak-orden-comms-mensaje": "x".repeat(257) })), null);
  assert.deepEqual(
    spec.read(fakeRoot({ "lagunak-orden-comms-mensaje": "x".repeat(256) })),
    { message: "x".repeat(256) },
  );
});

// --- Maniobra de combate y atraque (#519) -------------------------------------

test("los dos ejes de maniobra NO comparten rango", () => {
  // El empuje del control nativo va 0..1 y el lateral -1..1. Igualarlos por
  // simetría inventaría una marcha atrás que la nave no tiene.
  const empuje = ORDER_FORMS["orden-maniobra-empuje"];
  const lateral = ORDER_FORMS["orden-maniobra-lateral"];
  assert.deepEqual(empuje.read(fakeRoot({ "lagunak-orden-maniobra-empuje": "1" })), { amount: 1 });
  assert.equal(empuje.read(fakeRoot({ "lagunak-orden-maniobra-empuje": "-0.5" })), null);
  assert.deepEqual(lateral.read(fakeRoot({ "lagunak-orden-maniobra-lateral": "-1" })), { amount: -1 });
  assert.equal(lateral.read(fakeRoot({ "lagunak-orden-maniobra-lateral": "1.5" })), null);
});

test("el cero de maniobra sí es una orden (detener), no un campo vacío", () => {
  const empuje = ORDER_FORMS["orden-maniobra-empuje"];
  assert.deepEqual(empuje.read(fakeRoot({ "lagunak-orden-maniobra-empuje": "0" })), { amount: 0 });
  assert.equal(empuje.read(fakeRoot({ "lagunak-orden-maniobra-empuje": "" })), null);
});

test("atracar exige objetivo; soltar y cancelar no lo necesitan", () => {
  const atracar = ORDER_FORMS["orden-atracar"];
  assert.equal(atracar.read(fakeRoot({})), null, "sin objetivo no se emite");
  assert.deepEqual(
    atracar.read(
      fakeRoot({
        "lagunak-orden-objetivo-atraque": JSON.stringify({ distancia: 900, rumboDeg: 12 }),
      }),
    ),
    { distancia: 900, rumboDeg: 12, precision: 0, rumboPrecision: 0 },
  );
  assert.deepEqual(ORDER_FORMS["orden-soltar-amarras"].read(fakeRoot({})), {});
  assert.deepEqual(ORDER_FORMS["orden-cancelar-atraque"].read(fakeRoot({})), {});
});

test("soltar amarras y cancelar el acercamiento emiten acciones distintas", () => {
  assert.equal(ORDER_FORMS["orden-soltar-amarras"].action, "undock");
  assert.equal(ORDER_FORMS["orden-cancelar-atraque"].action, "abort_dock");
});

// --- Relay (#517) -------------------------------------------------------------

test("un punto de ruta se señala por marcación y distancia, no por coordenadas", () => {
  // Lo que sale del formulario NO es `x`/`y`: es la pareja que el relé del GM
  // convertirá con la posición real de la nave. Si esto emitiera coordenadas,
  // estaría pidiéndole al jugador un dato que su consola no publica.
  const spec = ORDER_FORMS["orden-waypoint-colocar"];
  assert.deepEqual(
    spec.read(fakeRoot({
      "lagunak-orden-waypoint-rumbo": "45",
      "lagunak-orden-waypoint-distancia": "1200",
    })),
    { rumboDeg: 45, distancia: 1200 },
  );
});

test("la marcación se rechaza fuera de 0..359 y la distancia si es negativa", () => {
  const spec = ORDER_FORMS["orden-sonda-lanzar"];
  const caso = (rumbo, distancia) =>
    spec.read(fakeRoot({
      "lagunak-orden-sonda-rumbo": rumbo,
      "lagunak-orden-sonda-distancia": distancia,
    }));
  assert.equal(caso("360", "100"), null, "360 es 0, no un rumbo aparte");
  assert.equal(caso("-1", "100"), null);
  assert.equal(caso("90", "-1"), null, "hacia atrás se dice con el rumbo");
  assert.deepEqual(caso("0", "0"), { rumboDeg: 0, distancia: 0 }, "marcar aquí es válido");
});

test("mover un punto de ruta exige índice Y posición; borrarlo solo el índice", () => {
  const mover = ORDER_FORMS["orden-waypoint-mover"];
  const campos = {
    "lagunak-orden-waypoint-rumbo": "90",
    "lagunak-orden-waypoint-distancia": "500",
  };
  assert.equal(mover.read(fakeRoot(campos)), null, "sin índice no se mueve nada");
  assert.deepEqual(
    mover.read(fakeRoot({ ...campos, "lagunak-orden-waypoint-indice": "3" })),
    { rumboDeg: 90, distancia: 500, index: 3 },
  );
  assert.deepEqual(
    ORDER_FORMS["orden-waypoint-borrar"].read(fakeRoot({ "lagunak-orden-waypoint-indice": "0" })),
    { index: 0 },
  );
});

test("la condición de alerta es un botón por nivel, con catálogo cerrado", () => {
  assert.deepEqual(ORDER_FORMS["orden-alerta-normal"].read(fakeRoot({})), { level: "normal" });
  assert.deepEqual(ORDER_FORMS["orden-alerta-amarilla"].read(fakeRoot({})), { level: "yellow" });
  assert.deepEqual(ORDER_FORMS["orden-alerta-roja"].read(fakeRoot({})), { level: "red" });
  for (const id of ["orden-alerta-normal", "orden-alerta-amarilla", "orden-alerta-roja"]) {
    assert.equal(ORDER_FORMS[id].action, "set_alert_level");
  }
});

// --- Control de daños (#522) --------------------------------------------------

test("mover un equipo exige elegir equipo Y destino", () => {
  const spec = ORDER_FORMS["orden-mover-equipo"];
  assert.equal(spec.read(fakeRoot({})), null);
  assert.equal(
    spec.read(fakeRoot({ "lagunak-orden-equipo": JSON.stringify({ x: 0, y: 0 }) })),
    null,
    "sin destino no se emite",
  );
  assert.deepEqual(
    spec.read(
      fakeRoot({
        "lagunak-orden-equipo": JSON.stringify({ x: 0, y: 0 }),
        "lagunak-orden-sala-destino": JSON.stringify({ x: 2, y: 1 }),
      }),
    ),
    { origin: { x: 0, y: 0 }, destination: { x: 2, y: 1 } },
  );
});

test("una casilla decimal no viene de donde creemos y se rechaza", () => {
  // Las plantas del motor son rejillas de enteros: un decimal significa que el
  // valor no salió del desplegable que lo puso ahí.
  const spec = ORDER_FORMS["orden-mover-equipo"];
  assert.equal(
    spec.read(
      fakeRoot({
        "lagunak-orden-equipo": JSON.stringify({ x: 0.5, y: 0 }),
        "lagunak-orden-sala-destino": JSON.stringify({ x: 2, y: 1 }),
      }),
    ),
    null,
  );
});

test("un valor que no es JSON no rompe el formulario", () => {
  const spec = ORDER_FORMS["orden-mover-equipo"];
  assert.equal(
    spec.read(
      fakeRoot({
        "lagunak-orden-equipo": "equipo-1",
        "lagunak-orden-sala-destino": JSON.stringify({ x: 2, y: 1 }),
      }),
    ),
    null,
  );
});
