// Prerrenderiza la textura del muro como PNG indexado
import { texturaMuro } from '../foundry-module/scripts/piel-textura.mjs';
import { codificarPngIndexado } from '../foundry-module/scripts/png-indexado.mjs';
import { mkdir, writeFile, readFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { ANCHO_TESELA, METROS_POR_TEXEL } from '../foundry-module/scripts/piel-textura.mjs';
import { ALTURA } from '../foundry-module/scripts/nave-sala-caja.mjs';

// Relativa AL SCRIPT, no al directorio de trabajo: con una ruta relativa a
// secas el PNG acababa fuera del arbol segun desde donde se invocara, que es
// lo que paso al generarlo desde la raiz del worktree.
const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const OUTPUT_PATH = join(RAIZ, 'foundry-module/assets/piel/muro.png');

async function main() {
  const args = process.argv.slice(2);
  const checkMode = args.includes('--check');

  // Calcular dimensiones como en nave-sala-caja.mjs
  const ancho = Math.round(ANCHO_TESELA / METROS_POR_TEXEL);
  const alto = Math.round(ALTURA / METROS_POR_TEXEL);

  // Generar textura
  const { indices, paleta } = texturaMuro({ ancho, alto });
  const pngBytes = codificarPngIndexado({ ancho, alto, indices, paleta });

  if (checkMode) {
    try {
      const existing = await readFile(OUTPUT_PATH);
      const equal = existing.length === pngBytes.length && 
                    existing.every((b, i) => b === pngBytes[i]);
      if (equal) {
        process.exit(0);
      } else {
        console.error('PNG generado difiere del archivo existente');
        process.exit(1);
      }
    } catch (err) {
      if (err.code === 'ENOENT') {
        console.error('Archivo existente no encontrado:', OUTPUT_PATH);
      } else {
        console.error('Error leyendo archivo existente:', err);
      }
      process.exit(1);
    }
  } else {
    // Modo normal: escribir PNG
    try {
      await mkdir(dirname(OUTPUT_PATH), { recursive: true });
      await writeFile(OUTPUT_PATH, pngBytes);
      console.log(`PNG escrito en ${OUTPUT_PATH}`);
    } catch (err) {
      console.error('Error escribiendo PNG:', err);
      process.exit(1);
    }
  }
}

main().catch(err => {
  console.error('Error inesperado:', err);
  process.exit(1);
});
