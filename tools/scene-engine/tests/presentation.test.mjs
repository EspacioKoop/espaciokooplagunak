import test from "node:test";
import assert from "node:assert/strict";
import { cantinaScene } from "../content.mjs";
import { identityTransform, presentationEntities } from "../contract.mjs";

test("ephemeral poses preserve scene data and reject unknown or invalid entities", () => {
  const scene = cantinaScene();
  const before = JSON.stringify(scene);
  const transform = { ...identityTransform(), position: [1, 2, 3] };
  const entities = presentationEntities(scene.entities, { suelo0: transform });
  assert.equal(entities.find((e) => e.id === "suelo0").transform, transform);
  assert.equal(JSON.stringify(scene), before);
  assert.throws(() =>
    presentationEntities(scene.entities, { missing: transform }),
  );
  assert.throws(() =>
    presentationEntities(scene.entities, {
      suelo0: { ...transform, scale: -1 },
    }),
  );
  assert.throws(() =>
    presentationEntities(scene.entities, { "sample-caza": transform }),
  );
});
