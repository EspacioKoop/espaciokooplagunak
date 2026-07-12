import { BridgeError } from "./bridge-client.mjs";

/** Ejecuta una orden de pausa solo para GM y con booleano estricto. */
export async function setSimulationPaused({ paused, isGM, client }) {
  if (!isGM) return false;
  if (typeof paused !== "boolean") {
    throw new BridgeError("El estado de pausa debe ser booleano", { kind: "parse" });
  }
  await client.setPause(paused);
  return true;
}
