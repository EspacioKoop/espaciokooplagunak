import assert from "node:assert/strict";
import test from "node:test";

// Registro de ajustes con un doble que apunta lo que se le pide, para poder
// afirmar cosas sobre la FORMA de los ajustes sin levantar Foundry.
async function registrar() {
  const registrados = [];
  globalThis.game = {
    settings: {
      register(modulo, clave, opciones) {
        registrados.push({ modulo, clave, ...opciones });
      },
      get: () => null,
      set: () => {},
    },
    user: { id: "gm", isGM: true },
    users: { contents: [], activeGM: null },
    socket: null,
  };
  globalThis.Hooks = { on() {}, off() {}, callAll() {}, once() {} };
  const { registrarAjustesMinijuegos } = await import(
    "../scripts/minijuegos-wiring.mjs"
  );
  registrarAjustesMinijuegos("espaciokoop-lagunak");
  return registrados;
}

test("REGRESIÓN: ningún ajuste visible es de tipo Object", async () => {
  // Foundry v11 no sabe editarlos: los pinta como «[object Object]» y, al
  // guardar, `SettingsConfig._updateObject` hace `flattenObject(formData)`. El
  // valor vuelve del formulario como objeto, se aplana en claves que no existen
  // en el registro (`…minijuegoMesaConfig.fichasIniciales`) y el guardado
  // revienta entero con «Cannot read properties of undefined (reading
  // 'namespace')» — tumbando de paso TODOS los demás ajustes del panel, no solo
  // el culpable. Una cifra por ajuste, o un menú propio.
  const registrados = await registrar();
  const sospechosos = registrados
    .filter((ajuste) => ajuste.config && ajuste.type === Object)
    .map((ajuste) => ajuste.clave);
  assert.deepEqual(sospechosos, []);
});

test("la entrada y las ciegas son tres cifras editables", async () => {
  const registrados = await registrar();
  const cifras = registrados.filter((ajuste) => ajuste.config && ajuste.type === Number);
  assert.deepEqual(
    cifras.map((ajuste) => ajuste.clave).sort(),
    ["minijuegoCiegaGrande", "minijuegoCiegaPequena", "minijuegoFichasIniciales"],
  );
  for (const cifra of cifras) {
    assert.equal(cifra.scope, "world", "la mesa es de la partida, no de cada cliente");
    assert.ok(Number.isInteger(cifra.default), `${cifra.clave} necesita un valor de partida`);
  }
});

test("el estado público de la sesión no se edita a mano", async () => {
  const registrados = await registrar();
  const sesion = registrados.find((ajuste) => ajuste.clave === "minijuegoSesionPublica");
  assert.ok(sesion);
  assert.equal(sesion.config, false);
  assert.equal(sesion.scope, "world");
});
