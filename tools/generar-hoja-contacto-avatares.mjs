// Artefacto de revisión visual para #1027. No es runtime ni asset de producción:
// genera una hoja HTML reproducible con la misma cámara lógica para comparar
// raza, silueta y condiciones de luz.
import { writeFileSync } from "node:fs";
import { piezasAvatar } from "../foundry-module/scripts/cantina-avatar.mjs";

const RAZAS = ["humano", "enano", "elfo", "mediano"];
const SILUETAS = ["estrecha", "neutra", "ancha"];
const LUCES = [
  ["frontal", "filter:brightness(1.05)"],
  ["lateral", "filter:brightness(.78) contrast(1.25)"],
  ["contraluz", "filter:brightness(.48) contrast(1.5)"],
];

function poligonos(pieza) {
  const [cx, cy] = pieza.centro;
  return pieza.malla.caras.map((cara, indice) => {
    const puntos = cara.map((vertice) => {
      const [x, y] = pieza.malla.vertices[vertice];
      return `${((cx + x) * 170 + 100).toFixed(1)},${((cy + y) * -170 + 205).toFixed(1)}`;
    }).join(" ");
    const tono = indice % 3 === 0 ? "#d2a276" : indice % 3 === 1 ? "#b8845d" : "#936747";
    return `<polygon points="${puntos}" fill="${tono}" stroke="#241f2b" stroke-width=".7"/>`;
  }).join("");
}

function avatarSvg(raza, silueta, estilo) {
  const piezas = piezasAvatar({ raza, silueta, gesto: "quieto" }, { pies: [0, 0, 0] });
  return `<svg viewBox="0 0 200 230" aria-label="${raza}, ${silueta}, ${estilo}" style="${LUCES.find(([nombre]) => nombre === estilo)[1]}"><rect width="200" height="230" fill="#4d5364"/>${piezas.map(poligonos).join("")}</svg>`;
}

export function hojaContacto() {
  const tarjetas = RAZAS.flatMap((raza) => SILUETAS.map((silueta) => `<article><h3>${raza} · ${silueta}</h3>${LUCES.map(([luz]) => `<figure>${avatarSvg(raza, silueta, luz)}<figcaption>${luz}</figcaption></figure>`).join("")}</article>`)).join("");
  return `<!doctype html><meta charset="utf-8"><title>Hoja de contacto de avatares #1027</title><style>body{background:#171923;color:#eee;font:14px sans-serif}main{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}article{background:#292d3b;padding:8px}figure{display:inline-block;margin:2px;width:30%}svg{width:100%;height:150px;image-rendering:pixelated}figcaption{text-align:center;font-size:11px}</style><h1>Avatares #1027 · raza × silueta × luz</h1><p>Artefacto reproducible de revisión; no es asset de producción.</p><main>${tarjetas}</main>`;
}

const destino = process.argv[2] ?? "/tmp/hoja-contacto-avatares-1027.html";
writeFileSync(destino, hojaContacto());
console.log(destino);
