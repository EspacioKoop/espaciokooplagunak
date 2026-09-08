import test from "node:test";
import assert from "node:assert/strict";
import { cantinaScene, productionAtlas } from "../content.mjs";
import {
  validateScene,
  validateCamera,
  pixelViewport,
  logicalPoint,
  identityTransform,
  transformMatrix,
  point,
  worldMatrices,
  cameraPoint,
} from "../contract.mjs";
import { transformar } from "../../../foundry-module/scripts/retro3d.mjs";
import { MUEBLES } from "../../../foundry-module/scripts/cantina-escena.mjs";
const near = (a, b) =>
  a.forEach((n, i) => assert.ok(Math.abs(n - b[i]) < 1e-9));
test("production room is imported completely, in object space", () => {
  const s = cantinaScene();
  assert.equal(
    s.entities.filter((e) => e.kind === "mesh").length,
    MUEBLES.length,
  );
  for (const p of MUEBLES) {
    const e = s.entities.find((e) => e.id === p.nombre);
    assert.deepEqual(e.transform.position, p.centro);
    assert.equal(s.materials[e.material].color, p.color);
  }
  assert.deepEqual(validateScene(JSON.parse(JSON.stringify(s))), s);
});
test("reject incompatible version, NaN, invalid mesh, parent cycles and unsupported transparency", () => {
  const edits = [
    (s) => (s.version = 2),
    (s) => (s.camera.position[0] = NaN),
    (s) => (s.camera.near = -1),
    (s) => (s.meshes.suelo0.triangles[0][0] = 999),
    (s) => (s.entities[0].parent = s.entities[0].id),
    (s) => (s.entities[0].parent = "missing"),
    (s) => (s.materials.suelo0.alpha = "blend"),
    (s) => (s.atlases.ships.rgba[3] = 128),
    (s) => (s.depth = "painter"),
    (s) => s.entities.push(structuredClone(s.entities[0])),
  ];
  for (const edit of edits) {
    const s = cantinaScene();
    edit(s);
    assert.throws(() => validateScene(s), TypeError);
  }
});
test("Y-X-Z transform agrees with production algebra; uniform scale and hierarchy", () => {
  const t = { position: [4, 2, 6], rotation: [0.8, -0.3, 0.4], scale: 2 },
    p = [1, 2, -3];
  near(
    point(transformMatrix(t), p),
    transformar(
      p.map((n) => n * 2),
      { posicion: t.position, yaw: 0.8, pitch: -0.3, roll: 0.4 },
    ),
  );
  const parent = { id: "p", transform: t },
    child = {
      id: "c",
      parent: "p",
      transform: { ...identityTransform(), position: [1, 0, 0] },
    };
  near(
    point(worldMatrices([child, parent]).get("c"), [0, 0, 0]),
    point(transformMatrix(t), [1, 0, 0]),
  );
});
test("camera +Z forward, yaw and pitch, no projection in contract", () => {
  const c = {
    position: [1, 2, 3],
    yaw: Math.PI / 2,
    pitch: 0,
    fov: 60,
    near: 0.1,
    far: 100,
  };
  validateCamera(c);
  near(cameraPoint([2, 2, 3], c), [0, 0, 1]);
  assert.throws(() => validateCamera({ ...c, far: 0.01 }));
  assert.throws(() => validateCamera({ ...c, pitch: Math.PI / 2 }));
});
test("integer scaling, compact crop, pointer mapping and right/bottom edge exclusion", () => {
  const v = pixelViewport(1000, 600, [320, 180]);
  assert.equal(v.scale, 3);
  assert.deepEqual(logicalPoint(v.x, v.y, v, [320, 180]), [0, 0]);
  assert.equal(logicalPoint(v.x + v.width, v.y, v, [320, 180]), null);
  const small = pixelViewport(240, 140, [320, 180]);
  assert.equal(small.scale, 1);
  assert.equal(small.cropped, true);
  assert.equal(small.x, -40);
});
test("atlas has binary alpha, distinct production frames and nearest policy", () => {
  const { atlas, frames } = productionAtlas();
  assert.equal(Object.keys(frames).length, 6);
  assert.equal(atlas.rgba.length, atlas.width * atlas.height * 4);
  assert.equal(atlas.sampling, "nearest");
  assert.ok(atlas.rgba.some((v, i) => i % 4 === 3 && v === 255));
  const s = cantinaScene();
  s.entities.find((e) => e.kind === "sprite").frame = [70, 0, 9, 9];
  assert.throws(() => validateScene(s));
});
