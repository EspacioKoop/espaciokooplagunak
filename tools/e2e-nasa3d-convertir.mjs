#!/usr/bin/env node
// e2e real del puente NASA 3D Resources -> convertir-estatua -> retro3d.
//
// NO es un test de `node --test`: necesita red y no debe colgar de la suite
// (sería flaky en CI). Se ejecuta a mano para cerrar el bucle con un modelo
// de verdad, sin mocks:
//
//   node tools/e2e-nasa3d-convertir.mjs            # Base Station (conforme)
//   node tools/e2e-nasa3d-convertir.mjs "1999 RQ36 asteroid"
//
// Decide solo modelos CONFORMES a glTF 2.0 (los accessors POSITION traen
// bufferView). Los no conformes de NASA (Argo, Ares 1, CubeSat…) los rechaza
// convertir-estatua.mjs con error claro; este script los detecta y avisa.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const execFileP = promisify(execFile);
const AQUI = path.dirname(fileURLToPath(import.meta.url));

async function urlModelo(id) {
  const { stdout } = await execFileP("python3", [
    path.join(AQUI, "nasa3d.py"),
    "--buscar", id, "--formato", "glb",
  ], { cwd: AQUI });
  const d = JSON.parse(stdout);
  if (!d.piezas.length) throw new Error(`nasa3d.py no encontró "${id}"`);
  return d.piezas[0].mallas[0].url_fichero;
}

async function main() {
  const id = process.argv[2] || "Base Station";
  const url = await urlModelo(id);
  console.log(`modelo: ${id}\nurl:    ${url}`);

  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`descarga ${resp.status}`);
  const bin = Buffer.from(await resp.arrayBuffer());
  const tmp = path.join(tmpdir(), `e2e-nasa-${Date.now()}.glb`);
  await writeFile(tmp, bin);
  console.log(`descargado: ${bin.length} bytes -> ${tmp}`);

  const nombre = "e2e-" + id.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const destino = path.join(AQUI, "..", "foundry-module", "data", "mallas", `${nombre}.mjs`);
  await mkdir(path.dirname(destino), { recursive: true });
  try {
    const { stdout } = await execFileP("node", [
      path.join(AQUI, "convertir-estatua.mjs"), tmp, nombre,
      "--fuente", "nasa/NASA-3D-Resources",
      "--licencia", "NASA no declara licencia; ver condiciones de uso de medios",
      "--obra", id, "--autoria", "NASA", "--modelo", `3D Models/${id}`,
      "--caras", "900", "--alto", "2.2",
    ], { cwd: AQUI });
    console.log(stdout.trim());

    const { componerEscena } = await import(path.join(AQUI, "..", "foundry-module", "scripts", "retro3d.mjs"));
    const mod = await import(destino);
    const malla = Object.values(mod)[0];
    const escena = componerEscena(malla, { epoca: "gamecube" });
    const finitos = escena.poligonos.every((p) => p.puntos.every((pt) => Number.isFinite(pt.x) && Number.isFinite(pt.y)));
    if (!finitos || !escena.poligonos.length) throw new Error("el render no dio polígonos finitos");
    console.log(`render: ${escena.poligonos.length} polígonos, todos finitos -> LOOP OK`);
  } finally {
    await rm(destino, { force: true });
  }
}

main().catch((e) => { console.error("E2E FALLÓ:", e.message); process.exit(1); });
