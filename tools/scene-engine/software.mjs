// OTACON Astra — legacy comparison, importing the real projection AND z-buffer.
import { componerEscena } from "../../foundry-module/scripts/retro3d.mjs";
import { pintarEscenaConProfundidad } from "../../foundry-module/scripts/retro3d-lienzo.mjs";
import {
  validateScene,
  validateCamera,
  worldMatrices,
  point,
  cameraPoint,
  cameraDirection,
} from "./contract.mjs";
import { spriteRect, presentationEntities } from "./contract.mjs";
export class SoftwareBackend {
  constructor(canvas, scene) {
    validateScene(scene);
    this.canvas = canvas;
    this.scene = scene;
    this.disposed = false;
    this.ctx = canvas.getContext("2d");
    if (!this.ctx) throw new Error("Canvas 2D unavailable");
    [canvas.width, canvas.height] = scene.logicalSize;
    this.atlases = new Map(
      Object.entries(scene.atlases).map(([id, a]) => {
        const c = document.createElement("canvas");
        c.width = a.width;
        c.height = a.height;
        c.getContext("2d").putImageData(
          new ImageData(new Uint8ClampedArray(a.rgba), a.width, a.height),
          0,
          0,
        );
        return [id, c];
      }),
    );
  }
  render(camera = this.scene.camera, poses = {}) {
    if (this.disposed) throw new Error("disposed");
    validateCamera(camera);
    const start = performance.now(),
      s = this.scene,
      matrices = worldMatrices(presentationEntities(s.entities, poses)),
      polygons = [];
    const options = {
      ancho: s.logicalSize[0],
      alto: s.logicalSize[1],
      fov: camera.fov,
      cerca: camera.near,
      lejos: camera.far,
      epoca: "gamecube",
      posicion: [0, 0, 0],
      recorteLateral: true,
      luz: cameraDirection(s.light.direction, camera),
      ambiente: s.light.ambient,
    };
    const append = (e, vertices, faces, color, unlit = false) => {
      const m = matrices.get(e.id);
      const mesh = {
        vertices: vertices.map((p) => cameraPoint(point(m, p), camera)),
        caras: faces,
      };
      polygons.push(
        ...componerEscena(mesh, { ...options, color, emisivo: unlit })
          .poligonos,
      );
    };
    for (const e of s.entities) {
      if (e.layer !== "world") continue;
      if (e.kind === "mesh") {
        const m = s.meshes[e.mesh],
          material = s.materials[e.material];
        append(
          e,
          m.positions,
          m.triangles,
          material.color,
          material.shading === "unlit",
        );
      } else if (e.kind === "sprite") {
        // Legacy rasterizer has no alpha discard. Opaque texel quads preserve holes
        // without modifying it. This extra CPU cost is disclosed in the comparison.
        const a = s.atlases[e.atlas],
          [fx, fy, w, h] = e.frame,
          r = spriteRect(e),
          k = e.pixelSize;
        for (let y = 0; y < h; y++)
          for (let x = 0; x < w; x++) {
            const o = ((fy + y) * a.width + fx + x) * 4;
            if (!a.rgba[o + 3]) continue;
            const color =
              "#" +
              a.rgba
                .slice(o, o + 3)
                .map((n) => n.toString(16).padStart(2, "0"))
                .join("");
            const left = r.left + x * k,
              top = r.top - y * k;
            append(
              e,
              [
                [left, top, 0],
                [left + k, top, 0],
                [left + k, top - k, 0],
                [left, top - k, 0],
              ],
              [
                [0, 1, 2],
                [0, 2, 3],
              ],
              color,
              true,
            );
          }
      }
    }
    const composed = performance.now();
    pintarEscenaConProfundidad(
      this.ctx,
      {
        ancho: s.logicalSize[0],
        alto: s.logicalSize[1],
        poligonos: polygons,
        epoca: "gamecube",
      },
      { fondo: s.background },
    );
    this.ctx.fillStyle = s.background;
    this.ctx.fillRect(
      0,
      s.logicalSize[1] - s.screenBand,
      s.logicalSize[0],
      s.screenBand,
    );
    this.ctx.imageSmoothingEnabled = false;
    for (const e of s.entities.filter(
      (e) => e.kind === "sprite" && e.layer === "screen",
    )) {
      const [x, y] = e.transform.position,
        [fx, fy, w, h] = e.frame,
        k = e.pixelSize * e.transform.scale;
      this.ctx.drawImage(
        this.atlases.get(e.atlas),
        fx,
        fy,
        w,
        h,
        Math.round(x - e.pivot[0] * w * k),
        Math.round(y - e.pivot[1] * h * k),
        w * k,
        h * k,
      );
    }
    return {
      cpuMs: performance.now() - start,
      composeMs: composed - start,
      polygons: polygons.length,
      gpuMs: null,
    };
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.atlases.clear();
    this.canvas.width = 1;
    this.canvas.height = 1;
  }
}
