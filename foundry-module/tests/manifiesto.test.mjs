import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const moduleRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function manifiesto() {
  return JSON.parse(await readFile(path.join(moduleRoot, "module.json"), "utf8"));
}

test("REGRESIÓN: el manifiesto declara que el módulo usa socket", async () => {
  // Sin `"socket": true`, el servidor de Foundry NO retransmite los eventos
  // `module.<id>`: el `emit` sale del cliente y muere ahí, sin error ni aviso
  // en ninguno de los dos extremos. Costó una sesión entera de pruebas
  // encontrarlo, porque desde dentro es idéntico a un mensaje que se pierde.
  // Es de lo que hace el reparto dirigido de la mesa de minijuegos (#308) y
  // cualquier otra entrega privada que venga después.
  assert.equal((await manifiesto()).socket, true);
});

test("el id del manifiesto es el que usan los scripts y los canales", async () => {
  // El canal de socket se construye como `module.${MODULE_ID}`: si el id del
  // manifiesto y la constante se separan, el canal deja de existir.
  const { MODULE_ID } = await import("../scripts/lagunak-constantes.mjs");
  assert.equal((await manifiesto()).id, MODULE_ID);
});
