import { writeFile } from "node:fs/promises";
import { galeriaDePrueba, tarjetaSvg, tarjetasDeIniciativa } from "../foundry-module/scripts/turno-cartas-modelo.mjs";

const destino = process.argv[2] ?? "/tmp/galeria-cartas-combate.html";
const cartas = tarjetasDeIniciativa(galeriaDePrueba(), { activoId: "elfo-mago", siguienteId: "enano-guerrero" });
const cuerpo = cartas.map((carta) => `<figure class="${carta.activo ? "activo" : ""} ${carta.siguiente ? "siguiente" : ""}">${tarjetaSvg(carta)}<figcaption>${carta.nombre}${carta.activo ? " · ACTIVO" : carta.siguiente ? " · SIGUIENTE" : ""}</figcaption></figure>`).join("\n");
const html = `<!doctype html><meta charset="utf-8"><title>Galería cartas combate</title><style>body{background:#0b0f18;color:#f4e8c8;font:16px sans-serif}main{display:grid;grid-template-columns:repeat(3,120px);gap:20px}figure{margin:0;padding:4px;border:2px solid transparent}figure.activo{border-color:#ffb703}figure.siguiente{border-color:#8fa3d9}svg{width:120px;height:160px}figcaption{font-size:12px;text-align:center;margin-top:4px}</style><main>${cuerpo}</main>`;
await writeFile(destino, html);
console.log(`Galería escrita en ${destino}`);
