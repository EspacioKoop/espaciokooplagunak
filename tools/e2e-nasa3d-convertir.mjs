#!/usr/bin/env node
// e2e real del puente NASA 3D Resources -> convertir-estatua -> retro3d.
//
// NO es un test de `node --test`: necesita red y no debe colgar de la suite
// (sería flaky en CI). Se ejecuta a mano para cerrar el bucle con un modelo
// de verdad, sin mocks:
//
//   node tools/e2e-nasa3d-convertir.mjs            # Argo (Draco comprimido)
//   node tools/e2e-nasa3d-convertir.mjs "Base Station"
//   node tools/e2e-nasa3d-convertir.mjs "1999 RQ36 asteroid"
//
// NASA 3D Resources publica muchos modelos COMPRIMIDOS con Draco
// (KHR_draco_mesh_compression): convertir-estatua.mjs los decodifica sobre la
// marcha vía normalizar-glb.mjs, así que el bucle cierra también con ellos.
// Este script usa Argo (Draco) por defecto precisamente para ejercitar esa ruta.
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
  const id = process.argv[2] || "Argo";
  const url = await urlModelo(id);
  console.log(`modelo: ${id}\nurl:    ${url}`);

  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`descarga ${resp.status}`);
  const bin = Buffer.from(await resp.arrayBuffer());
  const tmp = path.join(tmpdir(), `e2e-nasa-${Date.now()}.glb`);
  await writeFile(tmp, bin);
  console.log(`descargado: ${bin.length} bytes -> ${tmp}`);

  // Nombre ÚNICO por ejecución: con uno predecible, el `rm` del `finally`
  // borraba lo que hubiera en ese destino aunque no lo hubiera escrito este
  // e2e. Y como el convertidor ya crea en exclusiva (sin `--force`), un choque
  // de nombres falla en vez de pisar nada.
  const nombre = ("e2e-" + id.toLowerCase() + "-" + process.pid)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const destino = path.join(AQUI, "..", "foundry-module", "data", "mallas", `${nombre}.mjs`);
  await mkdir(path.dirname(destino), { recursive: true });
  let escrito = false;
  try {
    const { stdout } = await execFileP("node", [
      path.join(AQUI, "convertir-estatua.mjs"), tmp, nombre,
      "--fuente", "nasa/NASA-3D-Resources",
      "--licencia", "NASA no declara licencia; ver condiciones de uso de medios",
      "--obra", id, "--autoria", "NASA", "--modelo", `3D Models/${id}`,
      "--caras", "900", "--alto", "2.2",
    ], { cwd: AQUI });
    escrito = true;
    console.log(stdout.trim());

    const { componerEscena } = await import(path.join(AQUI, "..", "foundry-module", "scripts", "retro3d.mjs"));
    const mod = await import(destino);
    const malla = Object.values(mod)[0];
    if (!malla || !malla.vertices || !malla.vertices.length || !malla.caras || !malla.caras.length) {
      throw new Error("la malla generada está vacía");
    }
    // La cámara por defecto no siempre enmarca el modelo; probamos varios ángulos
    // y exigimos que desde alguno se vea y que todos los polígonos sean finitos.
    let vistos = 0;
    for (const yaw of [0, 0.5, 1, 1.5, 2, 2.5, 3]) {
      const escena = componerEscena(malla, { epoca: "gamecube", yaw });
      vistos = Math.max(vistos, escena.poligonos.length);
      const finitos = escena.poligonos.every((p) => p.puntos.every((pt) => Number.isFinite(pt.x) && Number.isFinite(pt.y)));
      if (!finitos) throw new Error("el render produjo polígonos no finitos");
    }
    if (vistos === 0) throw new Error("el render no mostró la malla desde ningún ángulo");
    console.log(`render: hasta ${vistos} polígonos finitos desde algún ángulo -> LOOP OK`);
  } finally {
    // Solo se borra lo que ESTA ejecución escribió.
    if (escrito) await rm(destino, { force: true });
  }
}

main().catch((e) => { console.error("E2E FALLÓ:", e.message); process.exit(1); });
