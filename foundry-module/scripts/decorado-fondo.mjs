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
 * El pintor directo y la caché se verifican con contextos Canvas instrumentados
 * en Node; el aspecto final y el coste del compositor real siguen requiriendo
 * smoke en Foundry. La siembra y el parallax son lógica pura.
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
/** Lado de diseño del decorado: el ruido de nebulosa está calibrado a 320. */
export const LADO_DECORADO_BASE = 320;

// Legibilidad del mapa (issue #290): los planetas son decorado, no contactos.
// Sus discos no deben apelotonarse ni invadir la zona de lectura inmediata de
// la nave propia. Los márgenes escalan con el backing para conservar la misma
// composición a resoluciones menores.
export const MARGEN_PLANETAS_BASE = 10;
export const RADIO_ZONA_TACTICA_BASE = 34;
const INTENTOS_POSICION_PLANETA = 64;

function distanciaToroidal(ax, ay, bx, by, ancho, alto) {
  const dx = Math.abs(ax - bx);
  const dy = Math.abs(ay - by);
  return Math.hypot(Math.min(dx, ancho - dx), Math.min(dy, alto - dy));
}

function huellaPlaneta(el) {
  return el.anillo ? el.r * 1.9 + 2 : el.r;
}

function elegirPosicionPlaneta(rng, huella, colocados, ancho, alto) {
  const escala = ancho / LADO_DECORADO_BASE;
  const margen = MARGEN_PLANETAS_BASE * escala;
  const radioZonaTactica = RADIO_ZONA_TACTICA_BASE * escala;
  const centroX = ancho / 2;
  const centroY = alto / 2;
  let mejor = null;

  for (let intento = 0; intento < INTENTOS_POSICION_PLANETA; intento += 1) {
    const candidato = { x: rng() * ancho, y: rng() * alto };
    const holguraCentro = Math.hypot(candidato.x - centroX, candidato.y - centroY)
      - huella - radioZonaTactica;
    let holgura = holguraCentro;
    for (const previo of colocados) {
      holgura = Math.min(
        holgura,
        distanciaToroidal(candidato.x, candidato.y, previo.x, previo.y, ancho, alto)
          - huella - huellaPlaneta(previo) - margen,
      );
    }
    if (!mejor || holgura > mejor.holgura) mejor = { ...candidato, holgura };
    if (holgura >= 0) return candidato;
  }

  // Un recuento/radio personalizado puede hacer imposible cumplir todos los
  // márgenes. Conservamos determinismo y elegimos la alternativa menos densa.
  return { x: mejor.x, y: mejor.y };
}

/**
 * Lado del backing del canvas que evita el aliasing de #260.
 *
 * El canvas se pinta 1:1 con la pantalla salvo cuando hay sitio de sobra: por
 * encima del lado de diseño (320) mantenemos el backing en 320 y dejamos que la
 * CSS lo agrande con `image-rendering: pixelated` (píxel gordo retro, upscale
 * limpio). Por debajo de 320 subescalar ese ráster a nearest-neighbor rompe el
 * ruido fino de las nebulosas en bloques, así que renderizamos al tamaño real
 * (nunca reducimos): el backing sigue al display y el decorado se regenera a ese
 * lado. Nunca por debajo de 1 px para no crear un canvas degenerado.
 *
 * @param {number} anchoDisplay ancho mostrado del canvas (p.ej. `clientWidth`).
 * @param {number} [base] lado de diseño por encima del cual se conserva el chunky.
 * @returns {number} lado entero del backing a usar.
 */
export function ladoDecorado(anchoDisplay, base = LADO_DECORADO_BASE) {
  const ancho = Math.round(Number(anchoDisplay));
  if (!Number.isFinite(ancho) || ancho <= 0) return base;
  return Math.max(1, Math.min(base, ancho));
}

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
    const semilla = Math.floor(rng() * 1e6);
    elemNebulosasLejanas.push({
      x: rng() * ancho,
      y: rng() * alto,
      r: ancho * (0.34 + rng() * 0.26), // enormes, al fondo
      anilloColor: paleta.anillo,
      nucleoColor: paleta.nucleo,
      alpha: 0.16 + rng() * 0.1,
      semilla,
      // Contorno no circular (issue #215): precomputado aquí para que el
      // culling/caché usen la misma huella que el pintor sin recalcularla.
      formaArmonicos: armonicosNebulosa(semilla),
    });
  }

  const elemNebulosas = [];
  for (let i = 0; i < nebulosas; i += 1) {
    const semilla = Math.floor(rng() * 1e6);
    elemNebulosas.push({
      x: rng() * ancho,
      y: rng() * alto,
      r: ancho * (0.26 + rng() * 0.3), // manchas grandes y envolventes
      color: elige(PALETA_DECORADO.nebulosas),
      color2: elige(PALETA_DECORADO.nebulosas), // segundo tono para veteado
      alpha: 0.06 + rng() * 0.07,
      semilla,
      formaArmonicos: armonicosNebulosa(semilla),
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
    const r = ancho * (0.06 + rng() * 0.02); // 19–26 px a 320: legibles sin dominar el radar
    const anillo = rng() < 0.45;
    const posicion = elegirPosicionPlaneta(rng, huellaPlaneta({ r, anillo }), elemPlanetas, ancho, alto);
    elemPlanetas.push({
      x: posicion.x,
      y: posicion.y,
      r,
      bioma,
      rasgo: def.rasgo,
      color: def.color,
      color2: def.color2,
      brillo: 0.24 + rng() * 0.18,
      // Combinación de biomas: un planeta no-helado puede lucir casquetes de
      // hielo (p. ej. desértico con polos helados).
      casquetes: def.rasgo !== "casquetes" && rng() < 0.4,
      anillo, // casi la mitad lucen anillo
      inclinacionAnillo: 0.28 + rng() * 0.22,
      semilla: Math.floor(rng() * 1e6), // cráteres/bandas deterministas
      // Giro axial: la superficie escrolla en longitud a esta velocidad
      // (rad/ms), en un sentido u otro. Cada planeta a su ritmo.
      velocidadGiro: (0.00003 + rng() * 0.00008) * (rng() < 0.5 ? 1 : -1),
      // Reparte uniformemente la renovación de sprites entre frames. No altera
      // el aspecto ni la velocidad: solo evita recalcular dos planetas a la vez.
      faseGiro: planetas > 0 ? i / planetas : 0,
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

// Contorno de nebulosa (issue #215, mejora de la review): en vez de un círculo
// perfecto, el radio se modula por ángulo con 3 armónicos deterministas (fase y
// amplitud propias de la semilla) que se suman en una curva suave — un blob
// orgánico sin aristas ni rectas, no un polígono. `amplitudMaxima` es la suma de
// las amplitudes: cota superior del abombado, usada para el culling y la caché
// de sprites (si no se agranda la huella, el lóbulo más ancho se recortaría en
// el borde del lienzo, la misma costura que ya corrigió #260).
function armonicosNebulosa(semilla) {
  return [1, 2, 3].map((k) => ({
    k,
    amp: 0.1 + ruidoCelda(k, 0, semilla) * 0.16,
    fase: ruidoCelda(0, k, semilla) * Math.PI * 2,
  }));
}

function amplitudMaximaNebulosa(armonicos) {
  return armonicos.reduce((acc, a) => acc + a.amp, 0);
}

function factorFormaNebulosa(armonicos, angulo) {
  let factor = 1;
  for (const { k, amp, fase } of armonicos) factor += amp * Math.cos(k * angulo + fase);
  return factor;
}

function pintarNebulosa(ctx, el, x, y) {
  const paso = 4; // celdas más finas → nube más detallada
  const radio = Math.max(1, Math.round(el.r));
  const semilla = el.semilla ?? Math.round(el.x * 17 + el.y * 31);
  const armonicos = el.formaArmonicos ?? armonicosNebulosa(semilla);
  const radioMax = radio * (1 + amplitudMaximaNebulosa(armonicos));
  for (let dy = -radioMax; dy <= radioMax; dy += paso) {
    for (let dx = -radioMax; dx <= radioMax; dx += paso) {
      const radioEfectivo = radio * factorFormaNebulosa(armonicos, Math.atan2(dy, dx));
      const distancia = Math.hypot(dx, dy) / radioEfectivo;
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
// Comparte el mismo contorno no circular que `pintarNebulosa` (armónicos
// propios, distinta semilla → distinto blob).
function pintarNebulosaLejana(ctx, el, x, y) {
  const paso = 3;
  const radio = Math.max(2, Math.round(el.r));
  const semilla = el.semilla ?? 1;
  const armonicos = el.formaArmonicos ?? armonicosNebulosa(semilla);
  const radioMax = radio * (1 + amplitudMaximaNebulosa(armonicos));
  for (let dy = -radioMax; dy <= radioMax; dy += paso) {
    for (let dx = -radioMax; dx <= radioMax; dx += paso) {
      const radioEfectivo = radio * factorFormaNebulosa(armonicos, Math.atan2(dy, dx));
      const d = Math.hypot(dx, dy) / radioEfectivo;
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

// Huella exterior de un elemento grande para el culling de la rejilla 3×3. Un
// planeta con anillo se extiende hasta `1.9*r` (más la segunda banda), muy por
// encima de `el.r`: descartar por `el.r` cortaría el anillo al cruzar un borde
// (costura). Las nebulosas (contorno no circular, issue #215) se abomban hasta
// `r*(1+amplitudMáxima)`: sin ampliar la huella, el lóbulo más ancho se
// recortaría al cruzar un borde, la misma costura que ya corrigió #260.
function huellaGrande(tipo, el) {
  if (tipo !== "nebulosa" && tipo !== "nebulosa_lejana" && el.anillo) {
    return el.r * 1.9 + 2;
  }
  if (tipo === "nebulosa" || tipo === "nebulosa_lejana") {
    const armonicos = el.formaArmonicos ?? armonicosNebulosa(el.semilla ?? 1);
    return el.r * (1 + amplitudMaximaNebulosa(armonicos));
  }
  return el.r;
}

// Elementos grandes (nebulosa/planeta): se replican en una rejilla 3×3 para
// envolver el lienzo sin costura; las copias fuera de vista se descartan.
function pintarGrande(ctx, tipo, el, x, y, ancho, alto, tMs) {
  const huella = huellaGrande(tipo, el);
  for (const ox of [-ancho, 0, ancho]) {
    for (const oy of [-alto, 0, alto]) {
      const px = x + ox;
      const py = y + oy;
      if (px + huella < 0 || px - huella > ancho || py + huella < 0 || py - huella > alto) continue;
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

// El giro es deliberadamente sutil: cinco sprites por segundo conservan el
// movimiento visible sin volver a rasterizar miles de píxeles a 60 FPS.
export const INTERVALO_CACHE_PLANETA_MS = 200;

function crearLienzoNativo(ancho, alto) {
  let lienzo = null;
  if (typeof globalThis.OffscreenCanvas === "function") {
    lienzo = new globalThis.OffscreenCanvas(ancho, alto);
  } else if (globalThis.document?.createElement) {
    lienzo = globalThis.document.createElement("canvas");
    lienzo.width = ancho;
    lienzo.height = alto;
  }
  return lienzo;
}

/**
 * Caché de sprites independiente por ventana. La factoría inyectable mantiene
 * la ruta testeable en Node; en Foundry usa OffscreenCanvas cuando existe y un
 * canvas DOM fuera de pantalla como fallback para v11.
 */
export function crearCacheDecorado({
  crearLienzo = crearLienzoNativo,
  intervaloPlanetaMs = INTERVALO_CACHE_PLANETA_MS,
} = {}) {
  return {
    crearLienzo,
    intervaloPlanetaMs: Math.max(1, Number(intervaloPlanetaMs) || INTERVALO_CACHE_PLANETA_MS),
    sprites: new WeakMap(),
    limpiar() {
      this.sprites = new WeakMap();
    },
  };
}

function crearSprite(cache, tipo, el, tMs, presupuesto) {
  if (!cache?.sprites || typeof cache.crearLienzo !== "function") return null;
  const fasePlaneta = tipo === "planeta"
    ? Math.floor(
        Number.isFinite(el.faseGiro)
          ? envolver(el.faseGiro, 1) * cache.intervaloPlanetaMs
          : envolver(Number(el.semilla) || 0, cache.intervaloPlanetaMs),
      )
    : 0;
  const version = tipo === "planeta"
    ? Math.floor((Math.max(0, tMs) + fasePlaneta) / cache.intervaloPlanetaMs)
    : 0;
  const previo = cache.sprites.get(el);
  if (previo?.tipo === tipo && previo.version === version) return previo;
  // Tras un salto de rAF podrían quedar varios planetas obsoletos a la vez.
  // Conserva temporalmente el sprite anterior y reparte su renovación entre
  // frames; el primer frame sí construye todos porque todavía no hay fallback.
  if (tipo === "planeta" && previo && presupuesto.actualizacionesPlaneta >= 1) return previo;

  // Los planetas grandes ya se muestran como pixel art. Rasterizarlos a media
  // resolución y ampliarlos sin suavizado reduce el coste cuadrático del disco
  // y refuerza el píxel grueso en vez de difuminarlo.
  const escala = tipo === "planeta" && el.r >= 48 ? 2 : 1;
  const elementoSprite = escala === 1 ? el : { ...el, r: el.r / escala };
  // Se calcula sobre el elemento reducido: la segunda banda del anillo conserva
  // dos píxeles propios y no debe recortarse al dividir la huella original.
  const centroSprite = Math.max(1, Math.ceil(huellaGrande(tipo, elementoSprite)));
  const tam = centroSprite * 2 + 1;
  const lienzo = cache.crearLienzo(tam, tam);
  const spriteCtx = lienzo?.getContext?.("2d");
  if (!spriteCtx) return null;
  spriteCtx.imageSmoothingEnabled = false;

  if (tipo === "nebulosa_lejana") pintarNebulosaLejana(spriteCtx, el, centroSprite, centroSprite);
  else if (tipo === "nebulosa") pintarNebulosa(spriteCtx, el, centroSprite, centroSprite);
  else {
    const tiempoSprite = Math.max(0, version * cache.intervaloPlanetaMs - fasePlaneta);
    pintarPlaneta(spriteCtx, elementoSprite, centroSprite, centroSprite, tiempoSprite);
  }

  const sprite = {
    tipo,
    version,
    lienzo,
    escala,
    huella: centroSprite * escala,
  };
  if (tipo === "planeta" && previo) presupuesto.actualizacionesPlaneta += 1;
  cache.sprites.set(el, sprite);
  return sprite;
}

function pintarGrandeCacheado(ctx, cache, tipo, el, x, y, ancho, alto, tMs, presupuesto) {
  if (typeof ctx.drawImage !== "function") return false;
  const sprite = crearSprite(cache, tipo, el, tMs, presupuesto);
  if (!sprite) return false;
  const huella = sprite.huella;
  for (const ox of [-ancho, 0, ancho]) {
    for (const oy of [-alto, 0, alto]) {
      const px = x + ox;
      const py = y + oy;
      if (px + huella < 0 || px - huella > ancho || py + huella < 0 || py - huella > alto) continue;
      const destinoX = Math.round(px - huella);
      const destinoY = Math.round(py - huella);
      if (sprite.escala === 1) {
        ctx.drawImage(sprite.lienzo, destinoX, destinoY);
      } else {
        ctx.drawImage(
          sprite.lienzo,
          destinoX,
          destinoY,
          sprite.lienzo.width * sprite.escala,
          sprite.lienzo.height * sprite.escala,
        );
      }
    }
  }
  return true;
}

/**
 * Pinta el decorado ya compuesto (salida de `componerDecorado`) sobre el
 * contexto 2D. Debe llamarse tras el fondo y antes de estrellas/retícula.
 *
 * Con `cache`, nebulosas y planetas se rasterizan fuera de pantalla y cada
 * frame solo recompone sprites. Si el host no permite crear el lienzo auxiliar,
 * cae automáticamente al pintor directo anterior.
 *
 * `eventos` (issue #215, mejora de la review) añade sucesos puntuales y sutiles
 * — naves lejanas, cometas, estrellas fugaces — que cruzan el fondo; se pintan
 * tras el decorado estático, con el mismo contrato (nunca sobre contactos/ruta/
 * nave, que se pintan después en `dibujarFrame`).
 */
export function dibujarDecorado(
  ctx,
  decoradoFrame = [],
  { ancho = 320, alto = 320, tMs = 0, cache = null, eventos = [] } = {},
) {
  const presupuesto = { actualizacionesPlaneta: 0 };
  for (const capa of decoradoFrame) {
    for (const el of capa.elementos ?? []) {
      const x = envolver(el.x + capa.dx, ancho);
      const y = envolver(el.y + capa.dy, alto);
      // El parallax desplaza el decorado respecto a su siembra. Conservamos la
      // zona de lectura de la nave también durante ese movimiento: un planeta
      // puramente ambiental que la invadiría no se pinta en ese frame.
      if (
        capa.tipo === "planeta"
        && Math.hypot(x - ancho / 2, y - alto / 2)
          < huellaPlaneta(el) + RADIO_ZONA_TACTICA_BASE * (ancho / LADO_DECORADO_BASE)
      ) continue;
      if (capa.tipo === "asteroide") {
        pintarAsteroide(ctx, el, x, y, ancho, alto);
      } else if (!pintarGrandeCacheado(
        ctx, cache, capa.tipo, el, x, y, ancho, alto, tMs, presupuesto,
      )) {
        pintarGrande(ctx, capa.tipo, el, x, y, ancho, alto, tMs);
      }
    }
  }
  if (eventos.length) dibujarEventosFondo(ctx, eventos, tMs, ancho, alto);
}

// Tipos de eventos estéticos de fondo (issue #215, mejora pedida en review):
// sucesos puntuales que cruzan el lienzo de fondo sin tocar la simulación ni
// competir con contactos/ruta/nave. Cada uno tiene su propio ritmo: la estrella
// fugaz es breve y frecuente, la nave lejana es larga y rara, el cometa queda
// entre ambas.
const TIPOS_EVENTO = ["estrella_fugaz", "cometa", "nave_lejana"];
const DURACION_EVENTO_MS = { estrella_fugaz: 600, cometa: 3200, nave_lejana: 9000 };
const PERIODO_EVENTO_MS = { estrella_fugaz: 14000, cometa: 26000, nave_lejana: 45000 };

/**
 * Siembra los eventos de fondo de forma determinista (misma `seed` → mismos
 * eventos). Cada evento cruza el lienzo en línea recta con una deriva vertical
 * sutil; su posición es una función pura de `tMs` (ver `posicionEvento`), no
 * hay estado mutable ni se reinicia con el movimiento de la nave: son sucesos
 * de fondo lejanos, no atados a la posición del mundo.
 *
 * @returns {{tipo:string, sentido:number, y:number, pendiente:number,
 *   margen:number, offsetMs:number, periodoMs:number, duracionMs:number,
 *   semilla:number}[]}
 */
export function crearEventosFondo(seed, { cantidad = 3, ancho = 320, alto = 320 } = {}) {
  const rng = rngSemilla(seed);
  const eventos = [];
  const margen = Math.max(ancho, alto) * 0.15;
  for (let i = 0; i < cantidad; i += 1) {
    const tipo = TIPOS_EVENTO[i % TIPOS_EVENTO.length];
    eventos.push({
      tipo,
      sentido: rng() < 0.5 ? 1 : -1,
      y: rng() * alto,
      pendiente: (rng() - 0.5) * 0.5, // deriva vertical sutil durante el cruce
      margen,
      offsetMs: Math.floor(rng() * PERIODO_EVENTO_MS[tipo]),
      periodoMs: PERIODO_EVENTO_MS[tipo],
      duracionMs: DURACION_EVENTO_MS[tipo],
      semilla: Math.floor(rng() * 1e6),
    });
  }
  return eventos;
}

/**
 * Posición de un evento en el instante `tMs`, o `null` si está fuera de su
 * ventana activa (la mayor parte del tiempo, para que sea un suceso puntual y
 * no un tráfico constante) o si la deriva vertical lo saca del lienzo. Pura:
 * mismo (evento, tMs) → misma posición, sin depender de llamadas anteriores.
 *
 * @returns {{tipo:string, x:number, y:number, progreso:number, semilla:number,
 *   sentido:number}|null}
 */
export function posicionEvento(evento, tMs, ancho = 320, alto = 320) {
  const t = envolver((Math.max(0, tMs) || 0) + evento.offsetMs, evento.periodoMs);
  if (t >= evento.duracionMs) return null;
  const progreso = t / evento.duracionMs;
  const recorrido = ancho + evento.margen * 2;
  const xInicio = evento.sentido > 0 ? -evento.margen : ancho + evento.margen;
  const x = xInicio + evento.sentido * recorrido * progreso;
  const y = evento.y + (x - ancho / 2) * evento.pendiente;
  if (y < -evento.margen || y > alto + evento.margen) return null;
  return { tipo: evento.tipo, x, y, progreso, semilla: evento.semilla, sentido: evento.sentido };
}

// Racha breve y brillante que se desvanece hacia la cola, en la dirección del
// movimiento — más viva a mitad de recorrido, apagándose en los extremos.
function pintarEstrellaFugaz(ctx, ev) {
  const x = Math.round(ev.x);
  const y = Math.round(ev.y);
  const longitud = 6;
  const brilloPico = 1 - Math.abs(ev.progreso - 0.5) * 1.7;
  if (brilloPico <= 0) return;
  for (let i = 0; i < longitud; i += 1) {
    const alpha = brilloPico * (1 - i / longitud);
    if (alpha <= 0.03) continue;
    ctx.fillStyle = rgba("#fffff0", alpha);
    ctx.fillRect(x - ev.sentido * i, y, 1, 1);
  }
}

// Cometa: núcleo brillante de 2×2 con cola difusa más larga y tenue.
function pintarCometa(ctx, ev) {
  const x = Math.round(ev.x);
  const y = Math.round(ev.y);
  const alphaNucleo = 0.6 * Math.min(1, Math.sin(Math.PI * ev.progreso) * 1.6 + 0.2);
  if (alphaNucleo <= 0.03) return;
  ctx.fillStyle = rgba("#d2f0ff", alphaNucleo);
  ctx.fillRect(x, y, 2, 2);
  const longitudCola = 10;
  for (let i = 1; i <= longitudCola; i += 1) {
    const alpha = alphaNucleo * (1 - i / longitudCola) * 0.6;
    if (alpha <= 0.03) continue;
    ctx.fillStyle = rgba("#8cbedc", alpha);
    ctx.fillRect(Math.round(x - ev.sentido * i * 1.4), y, 1, 1);
  }
}

// Nave lejana: silueta mínima de 2×1 con una luz de posición que parpadea
// despacio, muy tenue para no confundirse con un contacto real.
function pintarNaveLejana(ctx, ev) {
  const x = Math.round(ev.x);
  const y = Math.round(ev.y);
  ctx.fillStyle = rgba("#b4becd", 0.45);
  ctx.fillRect(x, y, 2, 1);
  if (Math.floor(ev.progreso * 20) % 2 === 0) {
    ctx.fillStyle = rgba("#ff8c8c", 0.75);
    ctx.fillRect(x + ev.sentido, y, 1, 1);
  }
}

function pintarEvento(ctx, ev) {
  if (ev.tipo === "estrella_fugaz") pintarEstrellaFugaz(ctx, ev);
  else if (ev.tipo === "cometa") pintarCometa(ctx, ev);
  else pintarNaveLejana(ctx, ev);
}

/** Dibuja los eventos de fondo activos en `tMs`. Ver `dibujarDecorado`. */
export function dibujarEventosFondo(ctx, eventos = [], tMs = 0, ancho = 320, alto = 320) {
  for (const evento of eventos) {
    const pos = posicionEvento(evento, tMs, ancho, alto);
    if (pos) pintarEvento(ctx, pos);
  }
}
