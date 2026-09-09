// Entrada standalone del importador (#634): stdin → catálogo validado → stdout.
// No requiere Foundry, DOM, red ni escribe archivos. Conserva la procedencia.
import { importarAtlas } from "../foundry-module/scripts/importador-atlas.mjs";

if (process.argv.includes("--help")) {
  console.log("Uso: node tools/importar-atlas.mjs < atlas.csv\nAcepta CSV HYG o JSON cosmográfico. Devuelve JSON validado con procedencia. Límite: 8 MiB.");
} else if (process.argv.length !== 2) {
  console.error("Argumento desconocido. Usa --help.");
  process.exitCode = 2;
} else {
  try {
    const chunks = [];
    let bytes = 0;
    for await (const chunk of process.stdin) {
      bytes += chunk.length;
      if (bytes > 8 * 1024 * 1024) throw new Error("input_too_large");
      chunks.push(chunk);
    }
    const catalogo = await importarAtlas(Buffer.concat(chunks).toString("utf8"));
    process.stdout.write(`${JSON.stringify(catalogo, null, 2)}\n`);
  } catch (error) {
    // No repetir el contenido de entrada ni una traza con rutas privadas.
    console.error(`No se pudo importar el atlas (${error.code ?? "invalid_input"}).`);
    process.exitCode = 1;
  }
}
