/**
 * Decorado de fondo del mapa vivo (issue #203): nebulosas, planetas lejanos y un
 * cinturón de asteroides que dan sensación de espacio y de movimiento sobre el
 * campo de estrellas, sin competir con la información táctica.
 *
 * Este módulo encapsula TODO el decorado —siembra determinista, parallax y
 * pintado— para no engordar `ventana-nave.mjs` (composición del frame) ni
 * `mapa-render.mjs` (pintor). Reutiliza el PRNG y el parallax de `ventana-nave`;
 * es puramente cosmético: no consulta red ni conoce Foundry.
 *
 * Contrato de dibujo: se pinta entre el fondo y las estrellas/retícula, nunca
 * sobre contactos, ruta o nave propia. Si no hay decorado, no pinta nada.
 *
 * ACOPLADO AL CANVAS: `dibujarDecorado` no se prueba en Node (no hay contexto 2D
 * real); su verificación es humana, como el resto de `mapa-render.mjs`. La
 * siembra y el parallax (`crearDecorado`, `componerDecorado`) sí son lógica pura
 * y tienen pruebas en `tests/decorado-fondo.test.mjs`.
 */

import { rngSemilla, offsetParallax } from "./ventana-nave.mjs";

// Paletas apagadas: colores frías/cálidas muy desaturados para no competir con
// PALETA_FACCIONES ni con el blanco de la nave propia.
export const PALETA_DECORADO = {
  nebulosas: ["#5a2a6a", "#2a4a6a", "#6a3a4a"],
  asteroide: "#c0a98f",
};

// Nebulosas «fantasía» de la capa más lejana (estilo Ojo de Dios/Hélix): un
// tono de anillo vibrante y un núcleo que contrasta. Más saturadas que las
// nebulosas de fondo porque van muy al fondo del parallax y no compiten con
// contactos ni ruta.
export const PALETA_NEBULOSA_LEJANA = [
  { anillo: "#e05fd0", nucleo: "#3fd0e0" }, // magenta / cian
  { anillo: "#5fb0ff", nucleo: "#ff9f5f" }, // azul / ámbar
  { anillo: "#8f6fff", nucleo: "#5fffc0" }, // violeta / menta
  { anillo: "#ff6f8f", nucleo: "#ffe08f" }, // rosa / oro
];

// Biomas de planeta: color base + secundario y un "rasgo" que dispara el detalle
// característico al pintar. Desaturados para no competir con contactos/ruta.
//  - casquetes: casquetes polares de hielo (blanco arriba/abajo).
//  - crateres:  superficie rocosa muy craterizada.
//  - grietas:   grietas de magma incandescentes (emisivas).
//  - bandas:    bandas atmosféricas marcadas (gigante gaseoso).
//  - oceano:    océano con manchas de tierra más claras.
export const BIOMAS = {
  helado: { color: "#7fa9c4", color2: "#dceff7", rasgo: "casquetes" },
  desertico: { color: "#c2914f", color2: "#8a5a30", rasgo: "crateres" },
  magma: { color: "#5a1f16", color2: "#150808", rasgo: "grietas" },
  gaseoso: { color: "#b1854a", color2: "#6a4a78", rasgo: "bandas" },
  oceanico: { color: "#2f6690", color2: "#4a8a6a", rasgo: "oceano" },
  rocoso: { color: "#6a6270", color2: "#403a48", rasgo: "crateres" },
};

// Factor de parallax por tipo: más pequeño = se mueve menos = se percibe más
// lejos. Ordena también las capas de lejana a cercana.
const FACTOR = { nebulosa_lejana: 0.035, nebulosa: 0.08, planeta: 0.16, asteroide: 0.5 };

/**
 * Siembra el decorado de forma determinista (misma `seed` → mismo decorado).
 * Devuelve capas ordenadas de lejana a cercana, cada una con su `tipo`, su
 * `factor` de parallax y sus `elementos` sin desplazar.
 *
 * @returns {{tipo:string, factor:number, elementos:object[]}[]}
 */
export function crearDecorado(
  seed,
  { ancho = 320, alto = 320, planetas = 5, nebulosas = 3, asteroides = 120, nebulosasLejanas = 2 } = {},
) {
  const rng = rngSemilla(seed);
  const elige = (lista) => lista[Math.floor(rng() * lista.length)];

  // Capa más lejana: nebulosas fantasía tipo Ojo de Dios (anillo + núcleo).
  const elemNebulosasLejanas = [];
  for (let i = 0; i < nebulosasLejanas; i += 1) {
    const paleta = elige(PALETA_NEBULOSA_LEJANA);
    elemNebulosasLejanas.push({
      x: rng() * ancho,
      y: rng() * alto,
      r: ancho * (0.34 + rng() * 0.26), // enormes, al fondo
      anilloColor: paleta.anillo,
      nucleoColor: paleta.nucleo,
      alpha: 0.16 + rng() * 0.1,
      semilla: Math.floor(rng() * 1e6),
    });
  }

  const elemNebulosas = [];
  for (let i = 0; i < nebulosas; i += 1) {
    elemNebulosas.push({
      x: rng() * ancho,
      y: rng() * alto,
      r: ancho * (0.26 + rng() * 0.3), // manchas grandes y envolventes
      color: elige(PALETA_DECORADO.nebulosas),
      color2: elige(PALETA_DECORADO.nebulosas), // segundo tono para veteado
      alpha: 0.06 + rng() * 0.07,
      semilla: Math.floor(rng() * 1e6),
    });
  }

  const elemPlanetas = [];
  // Baraja determinista de biomas → variedad sin repetición mientras alcance.
  const nombresBioma = Object.keys(BIOMAS);
  for (let i = nombresBioma.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [nombresBioma[i], nombresBioma[j]] = [nombresBioma[j], nombresBioma[i]];
  }
  for (let i = 0; i < planetas; i += 1) {
    const bioma = nombresBioma[i % nombresBioma.length];
    const def = BIOMAS[bioma];
    elemPlanetas.push({
      x: rng() * ancho,
      y: rng() * alto,
      r: ancho * (0.09 + rng() * 0.11), // planetas mayores (~29–64 px)
      bioma,
      rasgo: def.rasgo,
      color: def.color,
      color2: def.color2,
      brillo: 0.24 + rng() * 0.18,
      // Combinación de biomas: un planeta no-helado puede lucir casquetes de
      // hielo (p. ej. desértico con polos helados).
      casquetes: def.rasgo !== "casquetes" && rng() < 0.4,
      anillo: rng() < 0.45, // casi la mitad lucen anillo
      inclinacionAnillo: 0.28 + rng() * 0.22,
      semilla: Math.floor(rng() * 1e6), // cráteres/bandas deterministas
      // Giro axial: la superficie escrolla en longitud a esta velocidad
      // (rad/ms), en un sentido u otro. Cada planeta a su ritmo.
      velocidadGiro: (0.00003 + rng() * 0.00008) * (rng() < 0.5 ? 1 : -1),
    });
  }

  const elemAsteroides = [];
  const centroCinturon = rng() * alto;
  const inclinacionCinturon = (rng() - 0.5) * 0.35;
  for (let i = 0; i < asteroides; i += 1) {
    const x = rng() * ancho;
    // Tres muestras sumadas concentran las motas alrededor de una banda sin
    // necesitar trigonometría ni estado: sigue siendo determinista y teselable.
    const dispersion = (rng() + rng() + rng() - 1.5) * alto * 0.24;
    const y = envolver(
      centroCinturon + (x - ancho / 2) * inclinacionCinturon + dispersion,
      alto,
    );
    elemAsteroides.push({
      x,
      y,
      r: 2 + Math.floor(rng() * 3), // 2–4 px: peñascos con forma, no motas
      brillo: 0.36 + rng() * 0.3,
      semilla: Math.floor(rng() * 1e6), // forma/sombreado irregular determinista
    });
  }

  return [
    { tipo: "nebulosa_lejana", factor: FACTOR.nebulosa_lejana, elementos: elemNebulosasLejanas },
    { tipo: "nebulosa", factor: FACTOR.nebulosa, elementos: elemNebulosas },
    { tipo: "planeta", factor: FACTOR.planeta, elementos: elemPlanetas },
    { tipo: "asteroide", factor: FACTOR.asteroide, elementos: elemAsteroides },
  ];
}

/**
 * Aplica el desplazamiento en parallax a cada capa según la posición del mundo
 * (la nave), igual que hace `componerFrame` con el campo de estrellas. Lógica
 * pura: no toca el canvas.
 *
 * @returns {{tipo:string, dx:number, dy:number, elementos:object[]}[]}
 */
export function componerDecorado(
  decorado = [],
  { centro = null, escalaFondo = 0.05, ancho = 320, alto = 320, ambiente = null } = {},
) {
  const ax = ambiente?.dx ?? 0;
  const ay = ambiente?.dy ?? 0;
  return decorado.map((capa) => {
    const { dx, dy } = offsetParallax(capa.factor, centro, escalaFondo, ancho, alto);
    // El drift ambiente (reposo) se suma a mayor amplitud en las capas cercanas
    // para que el fondo «respire» aunque la nave esté parada.
    const escala = 0.4 + capa.factor;
    return {
      tipo: capa.tipo,
      elementos: capa.elementos,
      dx: dx + ax * escala,
      dy: dy + ay * escala,
    };
  });
}

/** Convierte "#rrggbb" + alpha en una cadena rgba() para el canvas. */
function rgba(hex, alpha) {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** Mezcla "#rrggbb" hacia blanco (factor>0) o negro (factor<0), devuelve hex. */
function ajustarHex(hex, factor) {
  const n = Number.parseInt(hex.slice(1), 16);
  const canal = (c) => {
    const v = factor >= 0 ? c + (255 - c) * factor : c * (1 + factor);
    return Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  };
  return `#${canal((n >> 16) & 255)}${canal((n >> 8) & 255)}${canal(n & 255)}`;
}

// Luz direccional del sistema (arriba-derecha, algo frontal): da el volumen
// esférico del «falso 3D» PS1.
const LUZ = (() => {
  const x = 0.5, y = -0.55, z = 0.68;
  const m = Math.hypot(x, y, z);
  return { x: x / m, y: y / m, z: z / m };
})();

// Matriz de Bayer 4×4 (offset [-0.5,0.5)) para el dithering ordenado que da el
// bandeado retro tipo PS1 en el degradado esférico.
const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
].map((fila) => fila.map((v) => v / 16 - 0.5));

// Aplica un factor de brillo b∈[0,1] a un color: 0.5 neutro, <0.5 oscurece,
// >0.5 aclara. Es el sombreado del terminador día/noche.
function sombrear(hex, b) {
  return ajustarHex(hex, (b - 0.5) * 1.5);
}

// Tono y emisión de la superficie según el bioma, muestreada en coordenadas
// ESFÉRICAS (longitud `lon` + latitud `ny`) para que el giro axial escrolle la
// textura de forma coherente y envolvente. `emision>0` = brilla en sombra.
function superficieBioma(el, lon, ny, semilla) {
  // Casquetes polares: bioma helado o combinación (cualquier planeta con hielo).
  if ((el.casquetes || el.rasgo === "casquetes") && Math.abs(ny) > 0.6) {
    return { tono: "#eaf6fb", emision: 0 };
  }
  const ix = Math.round(lon * 9); // celdas por longitud (giran con el tiempo)
  const iy = Math.round(ny * 9);
  switch (el.rasgo) {
    case "bandas": { // gigante gaseoso: bandas por latitud (giran poco a la vista)
      const onda = Math.sin(ny * 7 + ruidoCelda(0, iy, semilla) * 1.6);
      return { tono: onda > 0 ? el.color : el.color2, emision: 0 };
    }
    case "grietas": { // magma: base oscura con grietas incandescentes
      const v = ruidoCelda(ix, iy, semilla);
      if (v > 0.82) return { tono: "#ff7a1e", emision: 0.5 + (v - 0.82) * 3 };
      return { tono: el.color2, emision: 0 };
    }
    case "oceano": { // océano con continentes más claros
      const v = ruidoCelda(ix, iy, semilla);
      return { tono: v > 0.72 ? el.color2 : el.color, emision: 0 };
    }
    default: { // rocoso/desértico: cráteres oscuros dispersos
      const v = ruidoCelda(ix, iy, semilla);
      return { tono: v > 0.88 ? ajustarHex(el.color, -0.32) : el.color, emision: 0 };
    }
  }
}

// Envuelve una coordenada al rango [0, tam).
const envolver = (v, tam) => ((v % tam) + tam) % tam;

function ruidoCelda(ix, iy, semilla) {
  let n = Math.imul(ix + semilla, 374761393) + Math.imul(iy - semilla, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function pintarNebulosa(ctx, el, x, y) {
  const paso = 4; // celdas más finas → nube más detallada
  const radio = Math.max(1, Math.round(el.r));
  const semilla = el.semilla ?? Math.round(el.x * 17 + el.y * 31);
  for (let dy = -radio; dy <= radio; dy += paso) {
    for (let dx = -radio; dx <= radio; dx += paso) {
      const distancia = Math.hypot(dx, dy) / radio;
      if (distancia >= 1) continue;
      const densidad = (1 - distancia) * 0.62;
      const ruido = ruidoCelda(dx / paso, dy / paso, semilla);
      if (ruido > densidad) continue;
      // Veteado a dos tonos: el ruido decide qué color de la nube usar.
      const tono = ruido < densidad * 0.5 ? el.color : (el.color2 ?? el.color);
      ctx.fillStyle = rgba(tono, Math.min(0.24, el.alpha * 2.2));
      ctx.fillRect(Math.round(x + dx), Math.round(y + dy), paso - 1, paso - 1);
    }
  }
}

// Nebulosa «fantasía» de capa lejana (Ojo de Dios/Hélix): un anillo vibrante y
// un núcleo que contrasta, con textura de ruido y grano grueso (paso 3) para el
// look pixelado. Muy al fondo del parallax, así que puede permitirse color.
function pintarNebulosaLejana(ctx, el, x, y) {
  const paso = 3;
  const radio = Math.max(2, Math.round(el.r));
  const semilla = el.semilla ?? 1;
  for (let dy = -radio; dy <= radio; dy += paso) {
    for (let dx = -radio; dx <= radio; dx += paso) {
      const d = Math.hypot(dx, dy) / radio;
      if (d > 1) continue;
      const anillo = Math.exp(-(((d - 0.55) / 0.16) ** 2)); // gaussiana en d≈0.55
      const nucleo = Math.max(0, 1 - d / 0.32); // brillo central
      const ruido = 0.5 + ruidoCelda(dx / paso, dy / paso, semilla) * 0.75;
      const intensidad = (anillo * 0.9 + nucleo * 0.8) * ruido;
      if (intensidad < 0.08) continue;
      const color = nucleo > anillo ? el.nucleoColor : el.anilloColor;
      ctx.fillStyle = rgba(color, Math.min(0.5, intensidad * el.alpha * 2.4));
      ctx.fillRect(Math.round(x + dx), Math.round(y + dy), paso - 1, paso - 1);
    }
  }
}

// Anillo elíptico pixelado alrededor del planeta. `frente` pinta la mitad
// delantera (sobre el disco) o la trasera (detrás), para fingir profundidad.
function pintarAnillo(ctx, el, cx, cy, radio, frente) {
  const rx = radio * 1.9;
  const ry = Math.max(1, radio * (el.inclinacionAnillo ?? 0.3));
  const color = ajustarHex(el.color, 0.3);
  for (let a = 0; a < Math.PI * 2; a += 0.06) {
    const abajo = Math.sin(a) > 0; // mitad inferior = delante en cabina
    if (abajo !== frente) continue;
    for (let banda = 0; banda < 2; banda += 1) {
      const px = Math.round(cx + Math.cos(a) * (rx + banda * 2));
      const py = Math.round(cy + Math.sin(a) * (ry + banda));
      ctx.fillStyle = rgba(color, banda === 0 ? 0.5 : 0.28);
      ctx.fillRect(px, py, 1, 1);
    }
  }
}

// Color de un píxel del disco (o null si cae fuera). Encapsula la iluminación
// lambert, el dither ordenado, la cuantización y el tono de superficie del
// bioma, para mantener el bucle de `pintarPlaneta` simple.
function colorPlanetaPixel(el, dx, dy, radio, semilla, tMs) {
  const nx = dx / radio;
  const ny = dy / radio;
  const h = nx * nx + ny * ny;
  if (h > 1) return null; // fuera del disco
  const nz = Math.sqrt(1 - h);
  const lambert = Math.max(0, nx * LUZ.x + ny * LUZ.y + nz * LUZ.z);
  // Longitud esférica + giro axial en el tiempo (la luz NO gira: el terminador
  // se queda quieto y la superficie escrolla por debajo).
  const lon = Math.atan2(nx, nz) + (el.velocidadGiro ?? 0) * tMs;
  const { tono, emision } = superficieBioma(el, lon, ny, semilla);

  const dither = BAYER4[((dy % 4) + 4) % 4][((dx % 4) + 4) % 4];
  const b = Math.round(Math.max(0, Math.min(1, 0.16 + lambert * 0.92 + dither * 0.14)) * 5) / 5;

  if (emision > 0) {
    // Emisivo: las grietas brillan aunque estén en la cara nocturna.
    return ajustarHex(tono, Math.min(0.45, emision * 0.35) + (1 - b) * 0.12);
  }
  const color = sombrear(tono, b);
  // Halo atmosférico: fino limbo iluminado en el borde hacia la luz.
  return h > 0.86 && lambert > 0.35 ? ajustarHex(color, 0.4) : color;
}

// Esfera sombreada por píxel («falso 3D» PS1): normal fingida por la posición
// en el disco, iluminación lambert con la LUZ del sistema, dithering ordenado y
// cuantización de brillo en pocos niveles → bandeado retro.
function pintarPlaneta(ctx, el, x, y, tMs = 0) {
  const radio = Math.max(2, Math.round(el.r));
  const cx = Math.round(x);
  const cy = Math.round(y);
  const semilla = el.semilla ?? Math.round(el.x * 13 + el.y * 7);

  if (el.anillo) pintarAnillo(ctx, el, cx, cy, radio, false); // anillo trasero
  for (let dy = -radio; dy <= radio; dy += 1) {
    for (let dx = -radio; dx <= radio; dx += 1) {
      const color = colorPlanetaPixel(el, dx, dy, radio, semilla, tMs);
      if (color === null) continue;
      ctx.fillStyle = color;
      ctx.fillRect(cx + dx, cy + dy, 1, 1);
    }
  }
  if (el.anillo) pintarAnillo(ctx, el, cx, cy, radio, true); // anillo delantero
}

// Elementos grandes (nebulosa/planeta): se replican en una rejilla 3×3 para
// envolver el lienzo sin costura; las copias fuera de vista se descartan.
function pintarGrande(ctx, tipo, el, x, y, ancho, alto, tMs) {
  for (const ox of [-ancho, 0, ancho]) {
    for (const oy of [-alto, 0, alto]) {
      const px = x + ox;
      const py = y + oy;
      if (px + el.r < 0 || px - el.r > ancho || py + el.r < 0 || py - el.r > alto) continue;
      if (tipo === "nebulosa_lejana") pintarNebulosaLejana(ctx, el, px, py);
      else if (tipo === "nebulosa") pintarNebulosa(ctx, el, px, py);
      else pintarPlaneta(ctx, el, px, py, tMs);
    }
  }
}

// Un peñasco: contorno irregular por ruido (recorta esquinas) y sombreado con
// la LUZ del sistema (claro arriba-izquierda, oscuro abajo-derecha).
function dibujarPenasco(ctx, x, y, tam, brillo, semilla) {
  if (tam <= 1) {
    ctx.fillStyle = rgba(PALETA_DECORADO.asteroide, brillo);
    ctx.fillRect(x, y, 1, 1);
    return;
  }
  const claro = ajustarHex(PALETA_DECORADO.asteroide, 0.22);
  const oscuro = ajustarHex(PALETA_DECORADO.asteroide, -0.42);
  for (let dy = 0; dy < tam; dy += 1) {
    for (let dx = 0; dx < tam; dx += 1) {
      if (ruidoCelda(dx, dy, semilla) < 0.22) continue; // esquina recortada
      ctx.fillStyle = rgba(dx + dy < tam - 1 ? claro : oscuro, brillo);
      ctx.fillRect(x + dx, y + dy, 1, 1);
    }
  }
}

// Asteroides: peñascos replicados en 3×3 para conservar también la esquina
// cuando uno cruza a la vez los bordes horizontal y vertical.
function pintarAsteroide(ctx, el, x, y, ancho, alto) {
  const tam = Math.max(1, Math.round(el.r));
  const semilla = el.semilla ?? Math.round(el.x * 7 + el.y * 13);
  for (const ox of [-ancho, 0, ancho]) {
    for (const oy of [-alto, 0, alto]) {
      const px = Math.round(x + ox);
      const py = Math.round(y + oy);
      if (px + tam <= 0 || px >= ancho || py + tam <= 0 || py >= alto) continue;
      dibujarPenasco(ctx, px, py, tam, el.brillo, semilla);
    }
  }
}

/**
 * Pinta el decorado ya compuesto (salida de `componerDecorado`) sobre el
 * contexto 2D. Debe llamarse tras el fondo y antes de estrellas/retícula.
 */
export function dibujarDecorado(ctx, decoradoFrame = [], { ancho = 320, alto = 320, tMs = 0 } = {}) {
  for (const capa of decoradoFrame) {
    for (const el of capa.elementos ?? []) {
      const x = envolver(el.x + capa.dx, ancho);
      const y = envolver(el.y + capa.dy, alto);
      if (capa.tipo === "asteroide") pintarAsteroide(ctx, el, x, y, ancho, alto);
      else pintarGrande(ctx, capa.tipo, el, x, y, ancho, alto, tMs);
    }
  }
}
