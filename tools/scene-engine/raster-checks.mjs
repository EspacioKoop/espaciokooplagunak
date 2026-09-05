// OTACON Astra — explicitly synthetic fixtures for adversarial raster checks.
import { GPUBackend } from "./gpu.mjs";
import { SoftwareBackend } from "./software.mjs";
import { cantinaScene } from "./content.mjs";
import { identityTransform } from "./contract.mjs";
import { PIXEL } from "../../foundry-module/scripts/paleta.mjs";
const assert = (ok, message) => {
  if (!ok) throw new Error(message);
};
function pixels(b, camera, poses) {
  b.render(camera, poses);
  const c = document.createElement("canvas");
  c.width = b.canvas.width;
  c.height = b.canvas.height;
  const ctx = c.getContext("2d");
  ctx.drawImage(b.canvas, 0, 0);
  return ctx.getImageData(0, 0, c.width, c.height).data;
}
const at = (p, x, y, w = 64) =>
  Array.from(p.slice((y * w + x) * 4, (y * w + x) * 4 + 3));
const rgb = (s) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
const equal = (a, b) => a.length === b.length && a.every((n, i) => n === b[i]);
export function rasterChecks() {
  const results = [];
  for (const Backend of [SoftwareBackend, GPUBackend]) {
    const s = cantinaScene();
    s.logicalSize = [64, 64];
    s.screenBand = 0;
    s.camera = {
      position: [0, 0, 0],
      yaw: 0,
      pitch: 0,
      fov: 60,
      near: 0.1,
      far: 20,
    };
    s.meshes = {
      triangle: {
        positions: [
          [-2, -2, 0],
          [0, 2, 0],
          [2, -2, 0],
        ],
        triangles: [[0, 1, 2]],
      },
    };
    s.materials = {
      near: { color: PIXEL.naveJugador, shading: "unlit", alpha: "opaque" },
      far: { color: PIXEL.rojo, shading: "unlit", alpha: "opaque" },
    };
    s.entities = ["near", "far"].map((id, i) => ({
      id,
      kind: "mesh",
      mesh: "triangle",
      material: id,
      layer: "world",
      transform: { ...identityTransform(), position: [0, 0, 2 + i * 2] },
    }));
    const canvas = document.createElement("canvas"),
      b = new Backend(canvas, s);
    try {
      const first = pixels(b);
      assert(
        equal(at(first, 32, 32), rgb(PIXEL.naveJugador)),
        Backend.name + " nearest surface",
      );
      s.entities.reverse();
      if (b.world) {
        b.renderer.sortObjects = false;
        b.world.children.reverse();
      }
      const reverse = pixels(b);
      assert(equal(first, reverse), Backend.name + " order independent");
      const clipped = pixels(b, { ...s.camera, far: 1 });
      assert(
        equal(at(clipped, 32, 32), rgb(s.background)),
        Backend.name + " far clipping",
      );
      const near = pixels(b, { ...s.camera, near: 3 });
      assert(
        equal(at(near, 32, 32), rgb(PIXEL.rojo)),
        Backend.name + " near clipping",
      );
      const turned = pixels(b, { ...s.camera, yaw: Math.PI });
      assert(
        equal(at(turned, 32, 32), rgb(s.background)),
        Backend.name + " camera yaw",
      );
      const poseBefore = JSON.stringify(s.entities);
      const moved = pixels(b, s.camera, {
        near: { ...identityTransform(), position: [20, 0, 2] },
      });
      assert(
        equal(at(moved, 32, 32), rgb(PIXEL.rojo)),
        Backend.name + " presentation pose",
      );
      assert(
        JSON.stringify(s.entities) === poseBefore,
        "presentation must not mutate scene",
      );
      results.push(
        Backend.name + ": pose overrides rendered without scene mutation",
      );
      results.push(
        Backend.name +
          ": nearest surface, reversed order, near/far clipping, camera",
      );
    } finally {
      b.dispose();
      b.dispose();
      assert(b.disposed, Backend.name + " disposed");
      if (b.resources) {
        assert(
          b.resources.size === 0 && b.objects.size === 0,
          "GPU ownership released",
        );
        assert(
          b.renderer.info.memory.geometries === 0 &&
            b.renderer.info.memory.textures === 0,
          "GPU resources disposed",
        );
      }
      let rejected = false;
      try {
        b.render();
      } catch {
        rejected = true;
      }
      assert(rejected, "render after disposal must fail");
    }
  }
  // Intersecting planes cannot be resolved by sorting entire faces: the winner
  // must change across the image. These are fixtures, not production assets.
  for (const Backend of [SoftwareBackend, GPUBackend]) {
    const s = cantinaScene();
    s.logicalSize = [64, 64];
    s.screenBand = 0;
    s.camera = {
      position: [0, 0, 0],
      yaw: 0,
      pitch: 0,
      fov: 60,
      near: 0.1,
      far: 20,
    };
    const positions = [
      [-3, 3, 1.5],
      [3, 3, 4.5],
      [3, -3, 4.5],
      [-3, -3, 1.5],
    ];
    s.meshes = {
      a: {
        positions,
        triangles: [
          [0, 1, 2],
          [0, 2, 3],
        ],
      },
      b: {
        positions: positions.map(([x, y, z]) => [x, y, 6 - z]),
        triangles: [
          [0, 1, 2],
          [0, 2, 3],
        ],
      },
    };
    s.materials = {
      a: { color: PIXEL.naveJugador, shading: "unlit", alpha: "opaque" },
      b: { color: PIXEL.rojo, shading: "unlit", alpha: "opaque" },
    };
    s.entities = ["a", "b"].map((id) => ({
      id,
      kind: "mesh",
      mesh: id,
      material: id,
      layer: "world",
      transform: identityTransform(),
    }));
    const b = new Backend(document.createElement("canvas"), s);
    try {
      const p = pixels(b);
      assert(
        equal(at(p, 16, 32), rgb(PIXEL.naveJugador)) &&
          equal(at(p, 48, 32), rgb(PIXEL.rojo)),
        Backend.name + " intersecting planes",
      );
      results.push(
        Backend.name +
          ": intersecting planes change nearest surface across image",
      );
    } finally {
      b.dispose();
    }
  }
  // Screen sprite palette and layout must match byte-for-byte, including alpha
  // holes, atlas subframes, odd-sized pivots and integer 3x texel blocks.
  const s = cantinaScene();
  s.entities = s.entities.filter((e) => e.layer === "screen");
  const a = new SoftwareBackend(document.createElement("canvas"), s),
    b = new GPUBackend(document.createElement("canvas"), s);
  try {
    const pa = pixels(a),
      pb = pixels(b);
    let changed = 0;
    for (let i = 0; i < pa.length; i++) if (pa[i] !== pb[i]) changed++;
    assert(changed === 0, `screen atlas differs in ${changed} channels`);
    results.push("screen atlas: exact GPU/software RGBA parity");
  } finally {
    a.dispose();
    b.dispose();
  }
  // A production sprite is a world plane: hidden by a nearer opaque wall,
  // visible through its own transparent texels only when moved in front.
  for (const Backend of [SoftwareBackend, GPUBackend]) {
    const s = cantinaScene(),
      sprite = s.entities.find((e) => e.id === "world-sprite-fixture");
    s.screenBand = 0;
    s.logicalSize = [64, 64];
    s.camera = {
      position: [0, 0, 0],
      yaw: 0,
      pitch: 0,
      fov: 60,
      near: 0.1,
      far: 20,
    };
    sprite.pivot = [0.5, 0.5];
    sprite.pixelSize = 0.06;
    sprite.transform.position = [0, 0, 4];
    s.meshes = {
      wall: {
        positions: [
          [-2, 2, 0],
          [2, 2, 0],
          [2, -2, 0],
          [-2, -2, 0],
        ],
        triangles: [
          [0, 1, 2],
          [0, 2, 3],
        ],
      },
    };
    s.materials = {
      wall: { color: PIXEL.rojo, shading: "unlit", alpha: "opaque" },
    };
    s.entities = [
      sprite,
      {
        id: "wall",
        kind: "mesh",
        mesh: "wall",
        material: "wall",
        layer: "world",
        transform: { ...identityTransform(), position: [0, 0, 2] },
      },
    ];
    const b = new Backend(document.createElement("canvas"), s);
    try {
      assert(
        equal(at(pixels(b), 32, 32), rgb(PIXEL.rojo)),
        Backend.name + " sprite occlusion",
      );
      sprite.transform.position[2] = 1;
      const p = pixels(b);
      assert(
        !equal(at(p, 32, 32), rgb(PIXEL.rojo)),
        Backend.name + " foreground sprite",
      );
      assert(
        equal(at(p, 18, 18), rgb(PIXEL.rojo)),
        Backend.name + " alpha holes preserve wall",
      );
      results.push(Backend.name + ": world sprite depth and alpha holes");
    } finally {
      b.dispose();
    }
  }
  return results;
}
