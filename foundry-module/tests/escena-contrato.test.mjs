import assert from "node:assert/strict";
import test from "node:test";

import {
  SCENE_CONTRACT_VERSION,
  normalizarEscena,
  serializarEscena,
  validarEscena,
} from "../scripts/escena-contrato.mjs";

test("normalizarEscena crea una escena versión 1.0.0 sin mutar la entrada", () => {
  const input = {
    version: "1.0.0",
    revision: 7,
    state: {
      authoritative: true,
      entities: [
        { id: "ship-1", kind: "mesh", parentId: null, transform: { position: { x: 1, y: 2, z: 3 } } },
      ],
    },
    presentation: {
      camera: { position: { x: 0, y: 0, z: 10 }, projection: "perspective" },
      entities: [
        {
          id: "ship-1",
          kind: "mesh",
          material: { type: "color", color: "#ff99cc" },
          transform: { rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
          interaction: { id: "interaction/ship-1" },
          visibility: { render: true },
        },
      ],
    },
    resources: [{ id: "tex-ship", type: "texture", url: "/assets/ship.png" }],
    selection: { id: "ship-1", source: "client" },
  };

  const original = structuredClone(input);
  const escena = normalizarEscena(input);

  assert.equal(escena.version, SCENE_CONTRACT_VERSION);
  assert.deepEqual(input, original);
  assert.equal(escena.state.authoritative, true);
  assert.equal(escena.presentation.camera.position.z, 10);
  assert.equal(escena.presentation.entities[0].interaction.id, "interaction/ship-1");
  assert.equal(escena.selection.source, "client");
  assert.equal(escena.permissions, undefined);
});

test("validarEscena acepta una escena válida y rechaza una inválida sin inventar permisos", () => {
  const valid = normalizarEscena({
    version: "1.0.0",
    revision: 1,
    state: { authoritative: true },
    presentation: {
      camera: { position: { x: 0, y: 0, z: 5 }, projection: "perspective" },
      entities: [],
    },
    resources: [],
  });

  assert.deepEqual(validarEscena(valid), { ok: true, errors: [] });

  const invalid = normalizarEscena({
    version: "2.0.0",
    revision: -1,
    state: { authoritative: "yes" },
    presentation: {
      camera: { position: { x: 0 }, projection: "other" },
      entities: [{ id: "" }],
    },
    resources: [{ id: "", type: "texture" }],
  });

  const result = validarEscena(invalid);
  assert.equal(result.ok, false);
  assert.ok(Array.isArray(result.errors));
  assert.ok(result.errors.length > 0);
  assert.equal(invalid.permissions, undefined);
  assert.equal(invalid.selection, undefined);
});

test("validarEscena valida la entrada CRUDA, antes de que se apliquen los defaults", () => {
  // Repro exacto de la review: normalizarEscena sustituía cada valor
  // inválido por uno válido ANTES de validar, así que la rama de error
  // nunca se alcanzaba. Aquí se pasa la entrada cruda directamente (sin
  // normalizar primero) a validarEscena.
  const raw = {
    version: "999",
    revision: -1,
    state: { authoritative: "false" },
    presentation: { camera: { projection: "bogus" }, entities: [] },
  };

  const result = validarEscena(raw);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.startsWith("version:")), "version inválida debe reportarse");
  assert.ok(result.errors.some((e) => e.startsWith("revision:")), "revision negativa debe reportarse");
  assert.ok(
    result.errors.some((e) => e.startsWith("state.authoritative:")),
    "authoritative no booleano debe reportarse",
  );
  assert.ok(
    result.errors.some((e) => e.startsWith("presentation.camera.projection:")),
    "proyección desconocida debe reportarse",
  );
});

test("normalizarEscena conserva parentId/resourceId y usa escala 1 por defecto", () => {
  const escena = normalizarEscena({
    version: "1.0.0",
    revision: 0,
    state: { authoritative: true },
    presentation: {
      camera: { position: { x: 0, y: 0, z: 0 }, projection: "perspective" },
      entities: [
        {
          id: "hijo-1",
          parentId: "padre-1",
          resourceId: "malla-nave",
          transform: { position: { x: 1, y: 1, z: 1 } },
        },
      ],
    },
    resources: [],
  });

  const entidad = escena.presentation.entities[0];
  assert.equal(entidad.parentId, "padre-1");
  assert.equal(entidad.resourceId, "malla-nave");
  assert.deepEqual(entidad.transform.scale, { x: 1, y: 1, z: 1 });
});

test("serializarEscena produce JSON estable y segura para un adapter software", () => {
  const escena = normalizarEscena({
    version: "1.0.0",
    revision: 2,
    state: { authoritative: true },
    presentation: {
      camera: { position: { x: 1, y: 2, z: 3 }, projection: "orthographic" },
      entities: [{ id: "actor-1", kind: "sprite", transform: { position: { x: 0, y: 0, z: 0 } } }],
    },
    resources: [{ id: "sprite-actor", type: "sprite", url: "/ui/actor.png" }],
  });

  const text = serializarEscena(escena);
  const parsed = JSON.parse(text);

  assert.equal(parsed.version, SCENE_CONTRACT_VERSION);
  assert.equal(parsed.revision, 2);
  assert.equal(parsed.presentation.camera.projection, "orthographic");
  assert.equal(parsed.resources[0].url, "/ui/actor.png");
  assert.equal(parsed.selection, undefined);
});
