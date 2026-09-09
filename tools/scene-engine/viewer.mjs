// OTACON Astra — standalone consumer; no network state or Foundry globals.
import { cantinaScene } from "./content.mjs";
import { pixelViewport } from "./contract.mjs";
import { SoftwareBackend } from "./software.mjs";
import { GPUBackend } from "./gpu.mjs";
const scene = cantinaScene(),
  camera = structuredClone(scene.camera),
  status = document.querySelector("#status");
let backends = {},
  frame = null,
  closed = true,
  metrics = {},
  layouts = {};
function resize() {
  for (const [key, b] of Object.entries(backends)) {
    const el = document.querySelector(`#${key}-surface`),
      v = pixelViewport(el.clientWidth, el.clientHeight, scene.logicalSize);
    layouts[key] = v;
    Object.assign(b.canvas.style, {
      width: v.width + "px",
      height: v.height + "px",
      left: v.x + "px",
      top: v.y + "px",
    });
    el.dataset.pixelPolicy = v.cropped ? "cropped" : "integer";
  }
  if (!closed) requestRender();
}
function render() {
  frame = null;
  if (closed || document.hidden) return;
  for (const [key, b] of Object.entries(backends)) {
    metrics[key] = b.render(camera);
    b.firstRenderMs ??= metrics[key].cpuMs;
    const m = metrics[key];
    document.querySelector(`#${key}-cost`).textContent =
      `CPU llamada: ${m.cpuMs.toFixed(2)} ms | GPU: ${m.gpuMs == null ? "no disponible" : m.gpuMs.toFixed(2) + " ms (última consulta)"}
${m.drawCalls == null ? "Polígonos: " + m.polygons : "Draw calls: " + m.drawCalls + " | Triángulos: " + m.triangles} | escala ${layouts[key]?.scale ?? 1}×${layouts[key]?.cropped ? " · RECORTADO" : ""}`;
  }
}
function requestRender() {
  if (!closed && frame === null) frame = requestAnimationFrame(render);
}
function close() {
  if (frame !== null) cancelAnimationFrame(frame);
  frame = null;
  closed = true;
  metrics = {};
  Object.values(backends).forEach((b) => {
    b.dispose();
    b.canvas.remove();
  });
  backends = {};
  status.textContent =
    "Render cerrado; recursos liberados. La presentación puede reabrirse.";
}
function open() {
  if (!closed) return;
  closed = false;
  let gpuError = false;
  for (const [key, Backend] of [
    ["software", SoftwareBackend],
    ["gpu", GPUBackend],
  ]) {
    const canvas = document.createElement("canvas");
    canvas.setAttribute(
      "aria-label",
      key === "gpu" ? "Cantina GPU" : "Cantina software",
    );
    document.querySelector(`#${key}-surface`).append(canvas);
    try {
      const started = performance.now();
      backends[key] = new Backend(canvas, scene, (state) => {
        status.textContent =
          state === "ready"
            ? "Contexto recuperado."
            : "Contexto GPU perdido; comparador software disponible.";
        requestRender();
      });
      backends[key].initializationMs = performance.now() - started;
    } catch (error) {
      canvas.remove();
      gpuError = true;
      document.querySelector(`#${key}-cost`).textContent =
        `No disponible: ${error.message}`;
    }
  }
  status.textContent = gpuError
    ? "GPU no disponible: el comparador software sigue utilizable."
    : "Cámara compartida · contenido existente · profundidad independiente del orden de dibujo";
  resize();
}
for (const id of ["yaw", "pitch", "advance"])
  document.getElementById(id).addEventListener("input", () => {
    camera.yaw = (+document.querySelector("#yaw").value * Math.PI) / 180;
    camera.pitch = (+document.querySelector("#pitch").value * Math.PI) / 180;
    camera.position[2] = +document.querySelector("#advance").value;
    requestRender();
  });
document.querySelector("#reset").onclick = () => {
  Object.assign(camera, structuredClone(scene.camera));
  for (const [id, v] of [
    ["yaw", 0],
    ["pitch", 0],
    ["advance", -0.4],
  ])
    document.getElementById(id).value = v;
  requestRender();
};
document.querySelector("#close").onclick = close;
document.querySelector("#open").onclick = open;
const observer = new ResizeObserver(resize);
document.querySelectorAll(".surface").forEach((el) => observer.observe(el));
const visible = () => {
  if (document.hidden && frame !== null) {
    cancelAnimationFrame(frame);
    frame = null;
  } else requestRender();
};
document.addEventListener("visibilitychange", visible);
window.addEventListener(
  "pagehide",
  () => {
    close();
    observer.disconnect();
    document.removeEventListener("visibilitychange", visible);
  },
  { once: true },
);
// Deliberately public diagnostic surface for the standalone capture harness only.
window.sceneExperiment = {
  scene,
  camera,
  open,
  close,
  render,
  resize,
  get backends() {
    return backends;
  },
  get metrics() {
    return metrics;
  },
  get layouts() {
    return layouts;
  },
};
open();
