import assert from "node:assert/strict";
import test from "node:test";
import { CATALOGO_ANDAR } from "../scripts/nave-catalogo-andar.mjs";
import { resolverArranque } from "../scripts/nave-estancias.mjs";
import { interaccionAlAlcance } from "../scripts/nave-interaccion.mjs";
import { arrancarAndar, RADIO_ANDAR } from "../scripts/nave-movimiento-lienzo.mjs";
import { colisiona } from "../scripts/nave-movimiento.mjs";
import { construirHerramientasGM } from "../scripts/herramientas-gm-catalogo.mjs";
import { crearGrupo } from "../scripts/control-escena.mjs";
import { convocarYTransmitir, registrarConvocatoriaEstancia } from "../scripts/convocatoria-difusion.mjs";

const museo = CATALOGO_ANDAR.obtener("museo");

// Motor y catálogo reales; solo Canvas/Foundry son dobles. No es smoke GUI.
function abrirMotor(entrada, alAlcanzarInteraccion) {
  return arrancarAndar({ width: 100, height: 100, getContext: () => ({ putImageData() {} }) }, {
    ...museo,
    ...entrada,
    alAlcanzarInteraccion,
  });
}

for (const moderno of [false, true]) {
  test(`control Museo → convocatoria → arranque sin expulsión (${moderno ? "record" : "array"})`, async () => {
    const anterior = globalThis.game;
    const hooks = new Map();
    let recibida = null;
    globalThis.game = { user: { isGM: true } };
    registrarConvocatoriaEstancia("lagunak-test", {
      hooks: { on: (nombre, fn) => hooks.set(nombre, fn), off: (nombre) => hooks.delete(nombre) },
      abrir: (estancia) => { recibida = estancia; },
    });
    try {
      const controles = moderno ? {} : [];
      crearGrupo(controles, {
        tools: construirHerramientasGM({
          abrirPanelGM() {},
          abrirAndarNave() { assert.fail("Museo debe usar convocatoria"); },
          convocarEstancia: (estancia) => convocarYTransmitir(estancia, {
            ajustes: { set: async (namespace, key, value) => {
              hooks.get("createSetting")({ key: `${namespace}.${key}`, value, user: null });
            } },
          }),
        }),
        activeTool: "lagunak-museo",
      });
      const herramienta = moderno ? controles.lagunak.tools["lagunak-museo"]
        : controles[0].tools.find((t) => t.name === "lagunak-museo");
      assert.equal(await (moderno ? herramienta.onChange() : herramienta.onClick()), true);
      assert.equal(recibida, "museo");
      const arranque = resolverArranque(CATALOGO_ANDAR, {
        pedida: recibida, guardada: { estancia: "cantina", x: 1, z: 1 }, porDefecto: "cantina",
      });
      assert.equal(arranque.estancia, "museo");
      assert.equal(arranque.guardada, null);
      const destinos = [];
      const mando = abrirMotor(museo.entrada, ({ accion }) => {
        if (accion?.tipo === "estancia") destinos.push(accion.estancia);
      });
      try {
        for (let i = 0; i < 3; i += 1) mando.avanzar(16);
        assert.deepEqual(destinos, [], "la llegada no debe activar la salida automática a cantina");
      } finally { mando.detener(); }
    } finally { globalThis.game = anterior; }
  });
}

test("la salida sigue siendo alcanzable andando desde la entrada, sin cruzar muebles", () => {
  const destinos = [];
  const mando = abrirMotor(museo.entrada, ({ accion }) => {
    if (accion?.tipo === "estancia") destinos.push(accion.estancia);
  });
  try {
    assert.notEqual(interaccionAlAlcance(museo.entrada.x, museo.entrada.z, RADIO_ANDAR, museo.interacciones)?.id, "salida");
    mando.pulsar("atras");
    for (let i = 0; i < 30 && destinos.length === 0; i += 1) mando.avanzar(16);
    assert.deepEqual(destinos, ["cantina"]);
    const posicion = mando.posicion();
    assert.equal(colisiona(posicion.x, posicion.z, RADIO_ANDAR, museo.planta), false);
    assert.equal(interaccionAlAlcance(posicion.x, posicion.z, RADIO_ANDAR, museo.interacciones)?.id, "salida");
  } finally { mando.detener(); }
});
