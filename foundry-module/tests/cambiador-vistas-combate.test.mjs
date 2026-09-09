import assert from "node:assert/strict";
import test from "node:test";

import {
  VISTAS_COMBATE,
  resolverVistaCombate,
  atajoVista,
  siguienteVista,
  normalizarVista,
  vistasDisponibles,
} from "../scripts/cambiador-vistas-combate.mjs";

test("normalizarVista y siguienteVista usan el ciclo táctico completo", () => {
  assert.deepEqual(VISTAS_COMBATE, ["tactica", "pov", "tercera", "libre"]);
  assert.equal(normalizarVista("inexistente"), "tactica");
  assert.equal(siguienteVista("tactica"), "pov");
  assert.equal(siguienteVista("libre"), "tactica");
});

test("atajoVista traduce teclas de combate y deja pasar teclas ajenas", () => {
  assert.equal(atajoVista("1"), "tactica");
  assert.equal(atajoVista("2"), "pov");
  assert.equal(atajoVista("3"), "tercera");
  assert.equal(atajoVista("4"), "libre");
  assert.equal(atajoVista("v"), null);
  assert.equal(atajoVista("V"), null);
  assert.equal(atajoVista("x"), null);
});

test("el ciclo no muta la vista recibida", () => {
  const view = "tercera";
  assert.equal(siguienteVista(view), "libre");
  assert.equal(view, "tercera");
});

test("atajoVista rechaza claves heredadas del prototipo (prototype pollution)", () => {
  assert.equal(atajoVista("constructor"), null);
  assert.equal(atajoVista("__proto__"), null);
  assert.equal(atajoVista("toString"), null);
});

test("las cuatro vistas despachan módulos reales y devuelven la misma forma", () => {
  const entrada = Object.freeze({ x: 5, z: 7, yaw: 0.2, origenCasilla: { x: 4.572, z: 6.096 },
    centro: { x: 12, y: -3 }, posicion: { x: 8, y: 3, z: 2 }, zoom: 2,
    orbita: { yaw: 0.4, pitch: -0.2 }, esGM: true });
  const original = structuredClone(entrada);
  const vistas = VISTAS_COMBATE.map((modo) => resolverVistaCombate(modo, entrada));
  const campos = ["modo", "camara", "yaw", "pitch", "zoom", "proyeccion", "dibujarPropio"].sort();
  for (const vista of vistas) {
    assert.deepEqual(Object.keys(vista).sort(), campos);
    assert.ok(vista.camara.every(Number.isFinite));
    assert.ok(Object.isFrozen(vista) && Object.isFrozen(vista.camara));
    assert.equal(typeof vista.dibujarPropio, "boolean");
  }
  assert.deepEqual(vistas[0].camara, [12, 10, -3]);
  assert.equal(vistas[0].proyeccion, "ortografica");
  assert.equal(vistas[0].zoom, 2);
  assert.deepEqual(vistas[1].camara, [5, 1.45, 7]);
  assert.equal(vistas[1].dibujarPropio, false);
  assert.notDeepEqual(vistas[2].camara, vistas[1].camara);
  assert.deepEqual(vistas[3].camara, [8, 3, 2]);
  assert.equal(vistas[3].pitch, -0.2);
  assert.deepEqual(entrada, original);
});

test("nombres ajenos caen al catálogo táctico sin acceder a prototipos", () => {
  for (const nombre of ["constructor", "__proto__", null, "ausente"]) {
    assert.deepEqual(resolverVistaCombate(nombre), resolverVistaCombate("tactica"));
  }
});

test("una superficie sin proyección ortográfica no ofrece la vista táctica", () => {
  // No es una preferencia de arte: `retro3d.mjs` proyecta en perspectiva, así
  // que una cenital suya haría las casillas del fondo más pequeñas que las de
  // delante — una rejilla de 5 ft que miente sobre la medida que existe para
  // dar. Mientras falte el adaptador de #1020, la vista no se ofrece.
  assert.deepEqual(vistasDisponibles({ ortografica: false }), ["pov", "tercera", "libre"]);
  assert.deepEqual(vistasDisponibles(), ["pov", "tercera", "libre"]);
  assert.deepEqual(vistasDisponibles({ ortografica: true }), VISTAS_COMBATE);
});

test("pedir una vista que la superficie no puede pintar cae a una que sí", () => {
  const disponibles = vistasDisponibles({ ortografica: false });
  assert.equal(normalizarVista("tactica", disponibles), "pov");
  assert.equal(normalizarVista("inexistente", disponibles), "pov");
  assert.equal(normalizarVista("libre", disponibles), "libre");
  // Y el ciclo se salta la que falta en vez de detenerse en ella.
  assert.equal(siguienteVista("libre", disponibles), "pov");
  assert.equal(siguienteVista("pov", disponibles), "tercera");
});

test("resolver una vista no exige entidades, permisos ni estado de combate", () => {
  // La regla de seguridad del issue, como prueba y no como comentario: la
  // cámara es presentación. Se resuelve con números y nada más, así que no hay
  // por dónde colar «lo que el GM ve» — si algún día esto necesitara una
  // entidad, la frontera se habría roto y esta prueba dejaría de compilar.
  for (const modo of VISTAS_COMBATE) {
    const vista = resolverVistaCombate(modo, { x: 3, z: 4, y: 0, yaw: 1 });
    assert.equal(vista.modo, modo);
    assert.ok(vista.camara.every(Number.isFinite), `${modo}: cámara no finita`);
    assert.ok(Object.isFrozen(vista), `${modo}: la vista tiene que ser inmutable`);
    // Ni una llave que hable de quién mira o de qué existe.
    for (const clave of Object.keys(vista)) {
      assert.ok(
        !/actor|entidad|token|permiso|oculto|visible|esGM/i.test(clave),
        `${modo}: "${clave}" mezcla autoridad con presentación`,
      );
    }
  }
});

test("una entrada con números rotos da una cámara finita igualmente", () => {
  // Lo mismo que hace `componerEscena` en su borde: lo que entra mal se
  // sustituye, no sigue hacia dentro. Una cámara en NaN es geometría con la
  // forma correcta y los números rotos, que el pintor acepta sin rechistar.
  for (const modo of VISTAS_COMBATE) {
    const vista = resolverVistaCombate(modo, { x: NaN, z: undefined, yaw: "norte" });
    assert.ok(vista.camara.every(Number.isFinite), `${modo}: cámara no finita`);
    assert.ok(Number.isFinite(vista.yaw) && Number.isFinite(vista.pitch), `${modo}: ángulos rotos`);
  }
});
