// OTACON Astra — imports production authorship/content, not a reconstruction.
import { MUEBLES, caja } from "../../foundry-module/scripts/cantina-escena.mjs";
import {
  construirSpriteNave,
  SILUETAS,
} from "../../foundry-module/scripts/nave-sprite.mjs";
import { CANTINA, PIXEL } from "../../foundry-module/scripts/paleta.mjs";
import { identityTransform, validateScene } from "./contract.mjs";
export function adaptMesh(mesh) {
  // Existing convex face convention; arbitrary concave polygons are not admitted here.
  return {
    positions: mesh.vertices.map((v) => [...v]),
    triangles: mesh.caras.flatMap((face) =>
      face.slice(2).map((_, i) => [face[0], face[i + 1], face[i + 2]]),
    ),
  };
}
export function productionAtlas() {
  const keys = Object.keys(SILUETAS),
    width = keys.length * 12,
    height = 12;
  const rgba = Array(width * height * 4).fill(0),
    frames = {};
  keys.forEach((key, index) => {
    const rows = SILUETAS[key],
      w = Math.max(...rows.map((r) => r.length)),
      h = rows.length;
    frames[key] = [index * 12, 0, w, h];
    for (const c of construirSpriteNave({
      clave: key,
      color: PIXEL.naveJugador,
    })) {
      const x = index * 12 + c.dx + (w - 1) / 2,
        y = c.dy + (h - 1) / 2,
        n = parseInt(c.color.slice(1), 16),
        o = (y * width + x) * 4;
      rgba.splice(o, 4, (n >> 16) & 255, (n >> 8) & 255, n & 255, 255);
    }
  });
  return {
    atlas: { width, height, rgba, sampling: "nearest", alpha: "cutout" },
    frames,
  };
}
export function cantinaScene() {
  const meshes = {},
    materials = {},
    entities = [];
  for (const p of MUEBLES) {
    meshes[p.nombre] = adaptMesh(caja([0, 0, 0], p.medidas));
    materials[p.nombre] = { color: p.color, shading: "flat", alpha: "opaque" };
    entities.push({
      id: p.nombre,
      kind: "mesh",
      mesh: p.nombre,
      material: p.nombre,
      layer: "world",
      transform: { ...identityTransform(), position: [...p.centro] },
    });
  }
  const { atlas, frames } = productionAtlas();
  // Placements below are an explicitly labelled presentation fixture, not contacts.
  Object.entries(frames).forEach(([key, frame], i) =>
    entities.push({
      id: `sample-${key}`,
      kind: "sprite",
      atlas: "ships",
      frame,
      pivot: [0.5, 0.5],
      pixelSize: 3,
      layer: "screen",
      transform: { ...identityTransform(), position: [26 + i * 50, 158, 0] },
    }),
  );
  entities.push({
    id: "world-sprite-fixture",
    kind: "sprite",
    atlas: "ships",
    frame: frames.jugador,
    pivot: [0.5, 1],
    pixelSize: 0.13,
    layer: "world",
    transform: { ...identityTransform(), position: [0, -1, 4] },
  });
  return validateScene({
    version: 1,
    depth: "test-write",
    pixelPolicy: "integer-or-crop",
    logicalSize: [320, 180],
    screenBand: 40,
    background: CANTINA.ventana,
    camera: {
      position: [0, 0, -0.4],
      yaw: 0,
      pitch: 0,
      fov: 65,
      near: 0.1,
      far: 40,
    },
    light: { direction: [-0.4, 0.8, -0.45], ambient: 0.35, steps: 16 },
    meshes,
    materials,
    atlases: { ships: atlas },
    entities,
  });
}
