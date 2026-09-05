// Motor 3D de consola de los 90 (#362, rebanada 1): la geometría, no el lienzo.
//
// Por qué existe. `ventana-nave.mjs` declara en su cabecera que finge la
// profundidad —«parallax que finge la profundidad (sin 3D real)»—, y para un
// mapa cenital está bien. Para enseñar un casco girando no lo está. Esto trae
// profundidad de verdad sin traer un motor moderno.
//
// LA ÉPOCA ES UN PARÁMETRO, no dos módulos. PSX y GameCube no son el mismo
// aspecto y la diferencia no es nostalgia suelta: la PSX rasterizaba sin coma
// flotante y sin z-buffer, y de ahí salen sus dos firmas —el temblor de los
// vértices ajustados a la rejilla y los solapes del orden por pintor—. La
// GameCube tenía hardware honesto: sin temblor y más
// tonos, pero silueta de pocos polígonos. Con la época como parámetro, cada
// superficie elige: el visor del piloto puede ir sucio y la lámina del GM
// legible, sin duplicar el motor. Es la misma forma de decidir que `lenguajePara()`.
//
// LA VISIBILIDAD NO ES UN PARÁMETRO DE ÉPOCA (#510). Lo fue en el papel: había
// un `profundidadPorPixel` en `AJUSTES_EPOCA` que declaraba z-buffer para la
// GameCube y no para la PSX, y que NO LO LEÍA NADIE — dato muerto durante todo
// #362. Retirado en vez de implementado, y las dos mitades de esa decisión
// importan. No se implementa porque sobre un `<canvas>` 2D no hay dónde poner
// un z-buffer por píxel. Y no se declara por época porque quién tapa a quién es
// una GARANTÍA GEOMÉTRICA del motor y no un efecto (revisión externa de #510):
// el orden por pintor de más abajo es el mismo para las dos consolas, y lo que
// sigue cambiando entre ellas es el temblor, los tonos y la niebla, que sí son
// aspecto. Ese orden es hoy la parte más floja del motor —ver la sección
// «Orden por pintor», con lo ya intentado— pero es floja IGUAL para las dos.
//
// Frontera de arte (#351): esto es lenguaje PIXEL —se repinta con telemetría—,
// así que rejilla, paleta corta y ni un degradado. Los tonos NO se declaran
// aquí: se derivan por sombreado del color base que entra, que ya viene de
// `paleta.mjs`. Este módulo no inventa color ninguno.
//
// Puro: ni Foundry, ni DOM, ni <canvas>, ni reloj, ni Math.random(). Produce una
// lista de polígonos en coordenadas de pantalla; quien pinta vive fuera, igual
// que en `ventana-nave.mjs`.

import { PIXEL, canales } from "./paleta.mjs";

/** Épocas disponibles. Cualquier otra cosa cae en la de por defecto. */
export const EPOCAS = Object.freeze(["psx", "gamecube"]);

// Época de respaldo, DELIBERADAMENTE NO EXPORTADA. Cuál debe ser la época por
// defecto es una decisión de producto que #362 tiene abierta, y exportarla desde
// aquí la cerraría de tapadillo: quien importase la constante estaría heredando
// una preferencia que nadie ha acordado. Esta capa es pura y solo necesita no
// romperse cuando le dan una época que no conoce, así que se queda dentro.
const EPOCA_RESPALDO = "psx";

/**
 * Lo que cambia entre una consola y otra, escrito como datos y no como ramas
 * sueltas por el código.
 *
 * - `rejilla`: a cuántos píxeles se ajusta cada vértice proyectado. La PSX
 *   rasterizaba con enteros y por eso los vértices saltan; a 1 se reproduce
 *   sobre el búfer interno. A 0 no se ajusta nada.
 * - `tonos`: escalones del sombreado. Pocos y duros contra muchos y suaves.
 * - `niebla`: `desde` es la fracción del alcance a partir de la cual empieza a
 *   teñir, y `fuerza` cuánto llega a teñir en el plano lejano. La PSX tenía muy
 *   poca distancia de dibujo y usaba la niebla para que la geometría no
 *   APARECIERA de golpe en el borde: por eso su niebla llega a 1 —en el plano
 *   lejano el polígono ES el fondo y el recorte no se ve—. La GameCube dibujaba
 *   mucho más lejos y no necesitaba tapar nada, así que la suya es atmósfera y
 *   se queda a medias: nunca se traga la nave.
 */
export const AJUSTES_EPOCA = Object.freeze({
  psx: Object.freeze({
    rejilla: 1,
    tonos: 4,
    niebla: Object.freeze({ desde: 0.45, fuerza: 1 }),
  }),
  gamecube: Object.freeze({
    rejilla: 0,
    tonos: 16,
    niebla: Object.freeze({ desde: 0.75, fuerza: 0.5 }),
  }),
});

export function ajustesEpoca(epoca) {
  return AJUSTES_EPOCA[epoca] ?? AJUSTES_EPOCA[EPOCA_RESPALDO];
}

// ---- Álgebra mínima --------------------------------------------------------
//
// Suficiente para un cuerpo rígido y ni una función más: no hace falta una
// biblioteca de matrices para rotar una nave y proyectarla.

const resta = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

function cruz(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function normalizar(v) {
  const largo = Math.hypot(v[0], v[1], v[2]);
  // Un triángulo degenerado (dos vértices iguales) da normal cero. Se devuelve
  // el vector nulo en vez de NaN: el sombreado lo trata como cara sin luz y el
  // polígono sigue pintándose, que es preferible a un color «NaN» en el lienzo.
  if (!Number.isFinite(largo) || largo === 0) return [0, 0, 0];
  return [v[0] / largo, v[1] / largo, v[2] / largo];
}

const punto = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Centroide de un polígono: la media de sus vértices. */
function centro(vertices) {
  const suma = vertices.reduce((acc, v) => [acc[0] + v[0], acc[1] + v[1], acc[2] + v[2]], [0, 0, 0]);
  const n = vertices.length || 1;
  return [suma[0] / n, suma[1] / n, suma[2] / n];
}

/**
 * Rota un vértice en el orden yaw (Y) → pitch (X) → roll (Z) y lo traslada.
 * El orden es fijo y se escribe porque componer rotaciones no es conmutativo:
 * cambiarlo aquí movería todas las mallas sin que nadie lo pidiera.
 */
export function transformar(vertice, opciones = {}) {
  const [x, y, z] = triple(vertice, [0, 0, 0]);
  // Las rotaciones entran por la puerta: `Math.cos(NaN)` es `NaN` y a partir de
  // ahí todo el vértice deja de ser un número, pero el resultado sigue teniendo
  // la forma de un vértice y viaja tan tranquilo hasta el lienzo.
  const yaw = finito(opciones.yaw, 0);
  const pitch = finito(opciones.pitch, 0);
  const roll = finito(opciones.roll, 0);
  const posicion = triple(opciones.posicion, [0, 0, 0]);
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  let px = x * cy + z * sy;
  let py = y;
  let pz = -x * sy + z * cy;

  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const ry = py * cp - pz * sp;
  const rz = py * sp + pz * cp;
  py = ry;
  pz = rz;

  const cr = Math.cos(roll);
  const sr = Math.sin(roll);
  const rx = px * cr - py * sr;
  py = px * sr + py * cr;
  px = rx;

  return [px + posicion[0], py + posicion[1], pz + posicion[2]];
}

// ---- Proyección ------------------------------------------------------------

/**
 * Distancia focal en píxeles para un campo de visión vertical dado. Se calcula
 * y no se configura a mano para que cambiar el tamaño del visor no cambie
 * también cuánto se ve.
 */
export function focal(alto, fovGrados = 60) {
  const fov = (acotar(fovGrados, 1, 179, 60) * Math.PI) / 180;
  // El alto también se acota: `focal(NaN)` devolvía `NaN` y `focal(Infinity)`
  // devolvía `Infinity`, y una focal así no revienta nada — simplemente manda
  // toda la geometría a un sitio imposible, muy lejos de donde entró el valor
  // malo. El mínimo es 1: un visor de alto 0 no tiene proyección que calcular.
  return acotar(alto, 1, 1e6, 1) / 2 / Math.tan(fov / 2);
}

/**
 * Acota a un rango. `Math.min`/`Math.max` propagan `NaN` en silencio y el
 * resultado acaba en el lienzo como un `#NaNNaNNaN` o una focal infinita, muy
 * lejos de donde entró el valor malo.
 */
function acotar(valor, minimo, maximo, porDefecto) {
  const n = Number(valor);
  if (!Number.isFinite(n)) return porDefecto;
  return Math.max(minimo, Math.min(maximo, n));
}

/** Número finito o el de repuesto. Para lo que no tiene rango, como un ángulo. */
function finito(valor, porDefecto) {
  const n = Number(valor);
  return Number.isFinite(n) ? n : porDefecto;
}

/**
 * Triple de números finitos. Vale para vértices y para posiciones, y admite que
 * no llegue nada: `posicion: null` reventaba con un `TypeError` al leer
 * `posicion[0]`, y un vértice con una coordenada mala contaminaba la escena
 * entera sin que nadie pudiera decir de dónde salió.
 */
function triple(valor, porDefecto) {
  if (!Array.isArray(valor)) return [...porDefecto];
  return [
    finito(valor[0], porDefecto[0]),
    finito(valor[1], porDefecto[1]),
    finito(valor[2], porDefecto[2]),
  ];
}

/**
 * Proyecta un vértice en espacio de cámara (la cámara mira hacia +z) a
 * coordenadas de pantalla. `rejilla` ajusta el resultado, que es de donde sale
 * el temblor de la PSX: no es un fallo que reproducimos por capricho, es la
 * consecuencia de rasterizar con enteros.
 *
 * Devuelve también `z`, que el orden por pintor necesita después.
 */
export function proyectar(vertice, opciones = {}) {
  const [x, y, z] = triple(vertice, [0, 0, 1]);
  const ancho = acotar(opciones.ancho, 1, 1e6, 1);
  const alto = acotar(opciones.alto, 1, 1e6, 1);
  const f = acotar(opciones.f, 1e-6, 1e9, 1);
  const rejilla = acotar(opciones.rejilla, 0, 1e3, 0);
  // Dividir por un `z` no positivo es el fallo clásico del rasterizador casero:
  // el vértice sale disparado. `recortarCercano` lo evita antes de llegar aquí,
  // pero esta función es pública y no puede fiarse de que la llamen en orden.
  const profundidad = z > 0 && Number.isFinite(z) ? z : 1e-6;
  const px = ancho / 2 + (x * f) / profundidad;
  // La pantalla crece hacia abajo y el mundo hacia arriba: sin este signo la
  // nave sale del revés y se arregla luego rotando la malla, que es peor.
  const py = alto / 2 - (y * f) / profundidad;
  if (rejilla > 0) {
    return { x: Math.round(px / rejilla) * rejilla, y: Math.round(py / rejilla) * rejilla, z };
  }
  return { x: px, y: py, z };
}

/**
 * Recorta un polígono contra el plano cercano (Sutherland-Hodgman sobre un solo
 * plano). Sin esto, un vértice detrás de la cámara divide por un `z` diminuto o
 * negativo y el triángulo sale disparado por la pantalla: es EL fallo clásico
 * de un rasterizador casero, y a la PSX le pasaba de verdad. Aquí se recorta a
 * propósito, porque un artefacto que no se puede leer no es estética.
 */
export function recortarCercano(vertices, cerca) {
  // Un plano cercano no finito o negativo deja pasar vértices detrás de la
  // cámara, que es justo lo que este recorte existe para impedir.
  return recortarContra(vertices, acotar(cerca, 1e-6, 1e6, 0.1), 1);
}

/**
 * Recorta un polígono contra los CUATRO planos laterales del frustum
 * (izquierda, derecha, arriba, abajo), derivados de `ancho`/`alto`/`f` — los
 * mismos que usa `proyectar` para pasar de cámara a pantalla, así que un
 * vértice que sobrevive a este recorte cae siempre dentro de `[0,ancho]` y
 * `[0,alto]` una vez proyectado.
 *
 * OPCIONAL A PROPÓSITO (ver el comentario en `componerEscena`): sin él, un
 * muro visto de canto —un pasillo mirado de frente, el caso normal— puede
 * pasar el recorte cercano con un `x`/`y` de cámara moderado y `proyectar`
 * lo dispara a miles de píxeles fuera de pantalla: matemáticamente es la
 * perspectiva correcta de un punto casi tangente al ojo, pero ese punto
 * nunca estuvo dentro del cono de visión — solo lo parecía por mirar solo la
 * profundidad. `componerEscena({ recorteLateral: true })` lo activa.
 */
export function recortarLateral(vertices, { ancho, alto, f }) {
  const anchoOk = acotar(ancho, 1, 1e6, 160);
  const altoOk = acotar(alto, 1, 1e6, 120);
  const fOk = acotar(f, 1e-6, 1e9, 1);
  // Medio ancho/alto del volumen de vista a `z=1`: el plano se escala con
  // `z` (más lejos, más ancho vale), la ecuación de un plano por el origen.
  const mitadX = anchoOk / (2 * fOk);
  const mitadY = altoOk / (2 * fOk);
  let recortados = recortarContraPlano(vertices, (v) => v[2] * mitadX + v[0]); // izquierda
  recortados = recortarContraPlano(recortados, (v) => v[2] * mitadX - v[0]); // derecha
  recortados = recortarContraPlano(recortados, (v) => v[2] * mitadY + v[1]); // abajo
  recortados = recortarContraPlano(recortados, (v) => v[2] * mitadY - v[1]); // arriba
  return recortados;
}

/**
 * Sutherland-Hodgman genérico: `evaluar(vertice)` es la distancia (con
 * signo) de un vértice al plano — dentro cuando es `>= 0`. Sirve para
 * cualquier plano que pase por el origen de cámara, que es lo que
 * `recortarLateral` necesita y `recortarContra` (fijo al eje Z) no puede dar.
 */
function recortarContraPlano(vertices, evaluar) {
  const dentro = [];
  const n = vertices.length;
  for (let i = 0; i < n; i += 1) {
    const actual = vertices[i];
    const siguiente = vertices[(i + 1) % n];
    const dA = evaluar(actual);
    const dB = evaluar(siguiente);
    const actualDentro = dA >= 0;
    const siguienteDentro = dB >= 0;
    if (actualDentro) dentro.push(actual);
    if (actualDentro !== siguienteDentro) {
      const t = dA / (dA - dB);
      // TODAS las componentes, igual que en el recorte cercano y en el lejano
      // (#573). Este se quedó fuera de aquel arreglo y el fallo tardó en salir
      // porque hasta el matte del horizonte (#584) ninguna superficie texturada
      // llegaba a los bordes del cuadro: un polígono cortado por el lateral
      // perdía sus UV y volvía al color plano de la cara, o sea, el horizonte
      // se quedaba liso justo en los dos extremos de la pantalla.
      const cortado = new Array(Math.max(actual.length, siguiente.length));
      for (let k = 0; k < cortado.length; k += 1) {
        const a = actual[k] ?? 0;
        const b = siguiente[k] ?? 0;
        cortado[k] = a + (b - a) * t;
      }
      dentro.push(cortado);
    }
  }
  return dentro;
}

/**
 * Recorta un polígono contra el plano lejano (`z <= lejos`), el mismo
 * Sutherland-Hodgman con el signo cambiado.
 *
 * Descartar la cara entera cuando su vértice más cercano cruza el alcance no
 * basta: una cara larga atraviesa el plano sin cortarse y luego desaparece de
 * golpe todavía visible bajo la niebla, que es justo el salto que el alcance
 * existe para evitar. Recortando, lo que sobrevive nunca queda detrás del plano
 * y la cara se funde con el fondo antes de irse.
 */
export function recortarLejano(vertices, lejos) {
  return recortarContra(vertices, acotar(lejos, 1e-6, 1e9, 80), -1);
}

/**
 * Sutherland-Hodgman sobre un solo plano de profundidad. `signo` +1 conserva
 * `z >= plano` (cercano) y -1 conserva `z <= plano` (lejano).
 */
function recortarContra(vertices, plano, signo) {
  const dentro = [];
  const n = vertices.length;
  for (let i = 0; i < n; i += 1) {
    const actual = vertices[i];
    const siguiente = vertices[(i + 1) % n];
    const actualDentro = signo * (actual[2] - plano) >= 0;
    const siguienteDentro = signo * (siguiente[2] - plano) >= 0;
    if (actualDentro) dentro.push(actual);
    if (actualDentro !== siguienteDentro) {
      const t = (plano - actual[2]) / (siguiente[2] - actual[2]);
      // TODAS las componentes se interpolan, no solo las tres primeras (#573).
      // Un vértice es `[x, y, z]` o `[x, y, z, u, v]` según lleve textura, y el
      // corte tiene que producir un vértice con la MISMA forma: si las UV no se
      // interpolan aquí, un muro texturado que cruce el plano cercano pierde sus
      // coordenadas justo en el trozo que sí se ve, y la textura salta.
      //
      // Genérico en vez de un caso especial para `u,v`: el día que un vértice
      // lleve una tercera coordenada —un color por vértice, por ejemplo— esto ya
      // funciona, y un recortador que solo sabe de UV habría que volver a tocarlo.
      const cortado = new Array(Math.max(actual.length, siguiente.length));
      for (let k = 0; k < cortado.length; k += 1) {
        const a = actual[k] ?? 0;
        const b = siguiente[k] ?? 0;
        cortado[k] = a + (b - a) * t;
      }
      // La componente del plano se fija EXACTA en vez de dejarla interpolada:
      // el redondeo de coma flotante puede dejarla un pelo al otro lado y el
      // vértice que acabamos de meter dentro volvería a salirse en el siguiente
      // recorte.
      cortado[2] = plano;
      dentro.push(cortado);
    }
  }
  return dentro;
}

// ---- Sombreado -------------------------------------------------------------

/**
 * La direccional de serie: alta y de tres cuartos, la luz de interior de nave
 * con la que se calibraron las trece salas del Phobos.
 *
 * Sigue siendo el valor por defecto —ninguna escena existente cambia— pero ya no
 * es la ÚNICA: una escena puede declarar la suya (#587). El primer exterior del
 * módulo lo pide de verdad: un sol bajo sobre el mar no es la misma luz que un
 * fluorescente de mamparo, y forzarle esta dirección era la razón principal de
 * que la playa se viera plana.
 */
const LUZ = normalizar([-0.4, 0.8, -0.45]);

/**
 * Suelo de luz ambiente. Una cara a oscuras total se funde con el fondo y la
 * silueta se rompe, que en un visor pequeño se lee como un agujero — y con
 * focos (abajo) el riesgo crece, porque una cara fuera de todos ellos podría
 * quedarse en negro absoluto dentro de una sala interior.
 */
const AMBIENTE = 0.35;

/**
 * Cuántos focos se evalúan como mucho en una escena (#556). El coste es por
 * CARA y no por píxel, y una sala son ~800 caras: es barato, pero el límite se
 * escribe antes de que crezca solo. Se quedan los más cercanos a la cámara,
 * que son los que producen un charco de luz visible.
 */
export const TOPE_FOCOS = 4;

/**
 * Aportación de un foco a una cara, evaluada en su CENTROIDE (#556).
 *
 * Por qué en el centroide y no por píxel: el motor sombrea plano por cara, así
 * que un foco ilumina la cara entera con un solo valor. Eso antes no valía la
 * pena —un muro era uno o dos cuadriláteros grandes y encender una lámpara al
 * lado no daba un charco de luz, sino un muro que cambiaba de tono de golpe—,
 * pero la piel pixelart de #548–#552 partió los muros en cientos de caras
 * pequeñas: medido en la sala del reactor, 742 de 768 caras ocupan menos del
 * 0,5% del cuadro. A esa granularidad una intensidad por cara ya se lee como un
 * degradado. La condición que faltaba la cumple la geometría que YA existe: no
 * se subdivide nada a propósito para iluminar, ni se toca el rasterizador.
 *
 * La caída es lineal hasta `alcance` y ahí se corta. No es física —la física es
 * inversa del cuadrado, que no llega nunca a cero— y esa es justo la razón: un
 * foco con alcance finito se puede presupuestar, y la máquina de referencia
 * tampoco hacía otra cosa.
 *
 * Un foco NO es una superficie emisiva. `emisivo` (#555) dice cómo se ve la
 * propia luminaria —fullbright, sin sombreado—; un foco dice cómo modifica la
 * intensidad de las DEMÁS caras. Mezclarlas es como se acaba con superficies
 * que se iluminan a sí mismas dos veces.
 *
 * @param {{posicion:number[], potencia?:number, alcance?:number}} foco
 * @param {number[]} centroide - centro de la cara, en el mismo espacio que el foco.
 * @param {number[]} normal - normal de la cara, ya unitaria.
 * @returns {number} aportación en [0, potencia].
 */
export function contribucionFoco(foco, centroide, normal) {
  if (!foco) return 0;
  const posicion = triple(foco.posicion, [0, 0, 0]);
  const potencia = acotar(foco.potencia, 0, 4, 1);
  const alcance = acotar(foco.alcance, 1e-6, 1e6, 6);
  const hacia = resta(posicion, centroide);
  const distancia = Math.hypot(hacia[0], hacia[1], hacia[2]);
  if (distancia >= alcance) return 0;
  // Un foco EN el plano de la cara (distancia 0) no tiene dirección: se toma
  // como iluminación frontal en vez de devolver NaN al normalizar el vector nulo.
  const lambert = distancia === 0 ? 1 : Math.max(0, punto(normal, normalizar(hacia)));
  return potencia * lambert * (1 - distancia / alcance);
}

/**
 * Los `TOPE_FOCOS` focos más cercanos a un punto (la cámara), en orden. El
 * recorte se hace UNA VEZ por escena y no por cara: así el coste de tener seis
 * lámparas declaradas en una sala no se multiplica por sus ochocientas caras.
 */
export function focosCercanos(focos, referencia, tope = TOPE_FOCOS) {
  if (!Array.isArray(focos) || focos.length === 0) return [];
  const desde = triple(referencia, [0, 0, 0]);
  return focos
    .filter((foco) => foco && Array.isArray(foco.posicion))
    .map((foco) => {
      const p = triple(foco.posicion, [0, 0, 0]);
      return { foco, d: Math.hypot(p[0] - desde[0], p[1] - desde[1], p[2] - desde[2]) };
    })
    .sort((a, b) => a.d - b.d)
    .slice(0, Math.max(0, acotar(tope, 0, 64, TOPE_FOCOS)))
    .map((entrada) => entrada.foco);
}

/**
 * Intensidad de una cara, ya escalonada según la época: la direccional fija de
 * siempre más la aportación de los focos declarados por la escena (#556).
 *
 * El orden importa y es contrato, no detalle: **se suman TODAS las luces y solo
 * después se escalona**. Escalonar cada foco por separado haría que dos focos
 * débiles dieran un resultado distinto del de un foco equivalente más fuerte, y
 * metería escalones donde no los pide ninguna luz.
 *
 * Sin focos —`opciones` ausente o lista vacía— el resultado es exactamente el
 * de antes: la suma se queda en el término direccional y el techo de 1 ya lo
 * tenía (0,35 + 0,65). Una escena sin focos declarados se ve idéntica.
 *
 * @param {number[]} normal
 * @param {number} tonos
 * @param {{centroide?:number[], focos?:object[]}} [opciones] - el centroide y
 *   los focos van en el MISMO espacio que la normal (ver `luzFija`).
 */
export function intensidadCara(normal, tonos, opciones) {
  // AMBIENTE DECLARABLE (#587). El suelo de luz de serie (0,35) es el de un
  // interior de nave, donde lo que no toca la direccional lo rellenan cuatro
  // mamparos oscuros. A la intemperie el relleno es la BÓVEDA DEL CIELO entera,
  // que es enorme y clara: con 0,35 y un sol rasante, la arena de una playa a
  // pleno día salía al 57% de su color y se veía embarrada. No es un truco de
  // brillo, es que un exterior tiene otra luz de relleno.
  const ambiente = Number.isFinite(opciones?.ambiente) ? Math.max(0, Math.min(1, opciones.ambiente)) : AMBIENTE;
  // La dirección de la luz puede venir de la escena. Se normaliza aquí y no se
  // exige normalizada al llamador: un vector a ojo («el sol está por allí») es
  // exactamente como se escribe una luz, y obligar a normalizarlo fuera es
  // pedirle al que ambienta que haga trigonometría.
  const direccion = Array.isArray(opciones?.luz) ? normalizar(triple(opciones.luz, LUZ)) : LUZ;
  const lambert = Math.max(0, punto(normal, direccion));
  let crudo = ambiente + (1 - ambiente) * lambert;

  const focos = opciones?.focos;
  const centroide = opciones?.centroide;
  if (centroide && Array.isArray(focos) && focos.length > 0) {
    for (const foco of focos) crudo += contribucionFoco(foco, centroide, normal);
    // El techo se aplica ANTES de escalonar, por la misma razón que la suma:
    // recortar después dejaría el último escalón haciendo de tope y comiéndose
    // el penúltimo.
    crudo = Math.min(1, crudo);
  }

  // Negado a propósito, y no `tonos <= 1`: así un `tonos` que no sea número cae
  // también aquí en vez de colarse y devolver NaN.
  if (!(tonos > 1)) return crudo;
  // Escalonado: el sombreado suave es justo lo que no queremos: delata el
  // render moderno y rompe la frontera de paleta corta. Sigue siendo el
  // parámetro de época de #362, y por eso ocurre también con focos: una luz
  // suave sin escalonar sería un cambio de época encubierto.
  return Math.round(crudo * (tonos - 1)) / (tonos - 1);
}

/**
 * Aplica una intensidad a un color base y devuelve un `#rrggbb`.
 *
 * El color entra desde fuera —de `paleta.mjs`, vía facción o acento— y aquí solo
 * se oscurece. Por eso este módulo no declara ni un literal de color: la guardia
 * de `paleta.test.mjs` lo comprueba, y así una nave nueva no puede colar su
 * propio verde.
 */
export function sombrear(colorBase, intensidad, tinte = null) {
  const rgb = canales(colorBase);
  // Un color ilegible no se adivina: se devuelve tal cual y quien pinte verá el
  // valor original en vez de un negro silencioso que parece un fallo de luz.
  if (!rgb) return colorBase;
  const k = acotar(intensidad, 0, 1, 1);
  // TINTE OPCIONAL (#587). Sin él, sombrear es lo que siempre fue: multiplicar
  // el color por la intensidad, o sea, lo iluminado es el mismo color más claro
  // y lo oscuro el mismo color más apagado. Eso es exactamente lo que se ve como
  // PLANO en un exterior: en la realidad —y en cualquier pintura que se haya
  // molestado en mirarla— la luz del sol es cálida y la sombra la rellena el
  // cielo, que es frío. Sin esa oposición, un objeto redondo no gira y una
  // superficie grande no tiene aire encima.
  //
  // Se aplica ANTES del multiplicativo, sobre el color base: teñir después
  // arrastraría el tinte al negro y las sombras se irían todas al mismo azul,
  // perdiendo el color propio de cada cosa.
  if (tinte && (tinte.calida || tinte.fria)) {
    const haciaLuz = tinte.calida ? mezclar(colorBase, tinte.calida, FUERZA_TINTE * k) : colorBase;
    const teñido = tinte.fria ? mezclar(haciaLuz, tinte.fria, FUERZA_TINTE * (1 - k)) : haciaLuz;
    const rgbTeñido = canales(teñido);
    if (rgbTeñido) {
      const hexT = rgbTeñido
        .map((c) => Math.round(Math.max(0, Math.min(255, c * 255 * k))).toString(16).padStart(2, "0"))
        .join("");
      return `#${hexT}`;
    }
  }
  const hex = rgb
    .map((c) => Math.round(Math.max(0, Math.min(255, c * 255 * k))).toString(16).padStart(2, "0"))
    .join("");
  return `#${hex}`;
}

/**
 * Cuánto llega a teñir el tinte en los extremos de la escala de luz.
 *
 * 0,3 y no más: pasado ese punto el color propio de la arena deja de ser arena y
 * la escena entera vira a la luz, que es el error opuesto al de no teñir nada.
 * Es un realce de la oposición cálido/frío, no un filtro.
 */
const FUERZA_TINTE = 0.3;

// ---- Niebla ----------------------------------------------------------------

/**
 * Mezcla dos colores. `t` a 0 devuelve el primero; a 1, el segundo.
 *
 * Se mezcla en sRGB tal cual, sin pasar por lineal, porque es lo que hacía el
 * hardware de entonces: una mezcla «correcta» daría una transición distinta de
 * la que se está imitando.
 */
export function mezclar(colorA, colorB, t) {
  const a = canales(colorA);
  const b = canales(colorB);
  // Sin los dos colores no hay mezcla posible: se devuelve el de partida en vez
  // de inventar uno, igual que hace `sombrear` con un color ilegible.
  if (!a || !b) return colorA;
  const k = acotar(t, 0, 1, 0);
  const hex = a
    .map((c, i) => Math.round(Math.max(0, Math.min(255, (c + (b[i] - c) * k) * 255)))
      .toString(16)
      .padStart(2, "0"))
    .join("");
  return `#${hex}`;
}

/**
 * Cuánta niebla le toca a una profundidad, en [0, 1].
 *
 * Lineal a propósito: la niebla exponencial es de la generación siguiente y se
 * nota. Antes de `desde` no hay nada —la nave que estás mirando no se destiñe
 * por existir—, y a partir de ahí sube hasta `fuerza` en el plano lejano.
 */
export function factorNiebla(profundidad, { cerca, lejos, niebla }) {
  if (!niebla || !(niebla.fuerza > 0)) return 0;
  const inicio = cerca + (lejos - cerca) * acotar(niebla.desde, 0, 1, 0.5);
  if (!(lejos > inicio)) return 0;
  const t = (finito(profundidad, 0) - inicio) / (lejos - inicio);
  return Math.max(0, Math.min(1, t)) * acotar(niebla.fuerza, 0, 1, 1);
}

// ---- Orden por pintor ------------------------------------------------------
//
// El orden es por el CENTROIDE de profundidad de cada cara, y sigue siéndolo.
// Es la parte más floja del motor y está documentada como tal en #510: dos
// caras que se tocan tienen centroides casi iguales, y cuál va antes lo decide
// el tercer decimal. Medido durante el QA de #508/#509, componiendo la cantina
// caminable dos veces con 0,002 rad de diferencia de yaw —el temblor de estar
// de pie quieto—, 13 de 81 polígonos cambiaban de sitio en la lista. Eso es lo
// que QA describe como «se glitchean las texturas».
//
// LO QUE YA SE HA PROBADO Y NO VALE, para que no se intente una cuarta vez:
//
//  1. Un epsilon con orden estable (#510, revertido). Congela el orden de
//     declaración de las piezas, que es narrativo y no tiene relación con la
//     profundidad: cambia un parpadeo que acierta a ratos por un orden fijo que
//     puede estar mal siempre.
//  2. El algoritmo de Newell SIN partir caras (#510, descartado antes de
//     entregarse). Probar cada par en conflicto por geometría —solape de rangos
//     de profundidad, cajas de pantalla, lados del plano y solape real en
//     pantalla— y adelantar el que tape, sin el paso de CORTAR la cara cuando
//     el conflicto es cíclico. Medido sobre 672 encuadres de la cantina
//     caminable, INTRODUCE una clase de error que el centroide casi no comete:
//     pares en los que una cara queda enteramente detrás de otra, se solapan en
//     pantalla y aun así se pinta después (1575 pares con centroide, 6579 con
//     Newell sin cortes). El motivo es el propio ciclo: al adelantar una cara se
//     salta por encima de otras que ya estaban resueltas, y sin el corte no hay
//     forma de deshacer ese conflicto nuevo. Newell es correcto CON el corte;
//     media implementación de Newell es peor que ninguna.
//
// Lo que sí queda de ese intento y se usa: `seSolapanEnPantalla`, que es la
// pregunta «¿comparten estas dos caras un solo píxel?» —la que separa un
// desorden que se ve de uno que no—, y la geometría de cámara que ahora viaja
// con cada polígono (`camara`), sin la cual no se puede decidir nada de esto.

/**
 * ¿Se solapan de verdad los dos polígonos EN PANTALLA? Eje separador sobre las
 * normales de las aristas de ambos: si existe una recta que los deja a cada
 * lado, no comparten ni un píxel y su orden de dibujo da igual.
 *
 * Existe para poder hablar del orden por pintor sin confundir dos cosas muy
 * distintas: que dos caras cambien de sitio en la lista, y que ese cambio se
 * VEA. Solo lo segundo es un defecto, y separarlas es lo que permitió medir el
 * intento de Newell de #510 en vez de opinar sobre él.
 *
 * Los polígonos que llegan aquí son convexos y con área firmada positiva —caras
 * convexas recortadas por planos siguen siéndolo, y el motor descarta antes las
 * de espaldas—, que es lo que este test exige.
 *
 * `TOLERANCIA_SOLAPE` está en píxeles y existe por el caso más común de todos:
 * dos caras que COMPARTEN ARISTA (el lomo y el costado de un casco, dos muros
 * de una sala en su esquina). Ahí la separación es exactamente cero y sin
 * margen se leerían como solapadas.
 */
const TOLERANCIA_SOLAPE = 1e-6;

export function seSolapanEnPantalla(a, b) {
  const puntosA = Array.isArray(a?.puntos) ? a.puntos : [];
  const puntosB = Array.isArray(b?.puntos) ? b.puntos : [];
  return !hayEjeSeparador(puntosA, puntosB) && !hayEjeSeparador(puntosB, puntosA);
}

function hayEjeSeparador(puntosA, puntosB) {
  const n = puntosA.length;
  if (n < 3 || puntosB.length < 3) return true;
  for (let i = 0; i < n; i += 1) {
    const p = puntosA[i];
    const q = puntosA[(i + 1) % n];
    // Normal EXTERIOR de la arista, para el sentido de giro que garantiza
    // `areaFirmada > 0`. Lo de dentro del polígono queda con proyección
    // negativa, así que un `min` no negativo sobre el otro polígono significa
    // que está entero fuera de esta arista: eje separador.
    const ex = q.y - p.y;
    const ey = p.x - q.x;
    const largo = Math.hypot(ex, ey);
    if (!(largo > 0)) continue;
    let minB = Infinity;
    for (const v of puntosB) {
      const d = ((v.x - p.x) * ex + (v.y - p.y) * ey) / largo;
      if (d < minB) minB = d;
    }
    if (minB >= -TOLERANCIA_SOLAPE) return true;
  }
  return false;
}

/** Orden de pintor de una lista de polígonos: primero lo que va debajo. */
function ordenarPorPintor(poligonos) {
  return [...poligonos].sort((a, b) => b.profundidad - a.profundidad);
}

/**
 * Funde varias escenas en una sola, con UN orden de pintor global.
 *
 * Existe porque el orden por pintor NO ES COMPONIBLE —dos listas correctas
 * concatenadas dan una lista incorrecta en cuanto dos piezas se solapan— y
 * hasta #510 cada consumidor lo resolvía a mano con el mismo `flatMap` +
 * `sort` copiado en ocho módulos (cantina, visor del piloto, dados, póker,
 * blackjack, avatar, sala de la nave, casco dañado). Ocho copias de una regla
 * que el motor no ofrecía es también la razón de que mejorar esa regla fuera
 * imposible sin tocar ocho archivos: la primitiva vive aquí para que el día que
 * el orden mejore (#510) mejore en todas a la vez.
 *
 * Acepta escenas (`{poligonos}`) y listas sueltas de polígonos, porque los
 * avatares de otros jugadores llegan ya como lista. Lo que no tenga polígonos
 * se ignora en silencio: fundir con una escena que no se pudo componer es
 * normal —sin telemetría no hay contactos que pintar—, no un error.
 *
 * Devuelve una escena con los metadatos de la PRIMERA que los traiga (época,
 * ancho, alto, lejos): fundir escenas compuestas con cámaras distintas no
 * tendría sentido geométrico, así que no se intenta reconciliar nada.
 */
export function fundirEscenas(escenas) {
  const partes = Array.isArray(escenas) ? escenas : [];
  const poligonos = [];
  let base = null;
  for (const parte of partes) {
    if (Array.isArray(parte)) {
      poligonos.push(...parte);
      continue;
    }
    if (!parte || !Array.isArray(parte.poligonos)) continue;
    poligonos.push(...parte.poligonos);
    if (!base) base = parte;
  }
  return {
    epoca: base?.epoca,
    ancho: base?.ancho,
    alto: base?.alto,
    lejos: base?.lejos,
    poligonos: ordenarPorPintor(poligonos),
  };
}

// ---- Escena ----------------------------------------------------------------

/**
 * Compone una escena: malla + cámara → lista de polígonos de pantalla, ya
 * ordenados para pintar y con su color resuelto.
 *
 * Devuelve datos y no dibuja: el lienzo vive fuera, como en `ventana-nave.mjs`.
 * Así esto se prueba en Node sin un `<canvas>` de mentira.
 *
 * @param {{vertices: number[][], caras: number[][]}} malla
 * @param {object} opciones `recorteLateral` (default `false`) activa el
 *   recorte contra los cuatro planos del frustum, ver `recortarLateral`.
 */
export function componerEscena(malla, opciones = {}) {
  // TODA la entrada se normaliza aquí, en el borde, y no en cada operación de
  // dentro: un `alto: NaN` producía ocho polígonos con coordenadas no finitas
  // —geometría con la forma correcta y los números rotos— que el pintor
  // aceptaría sin rechistar. Lo que entra mal se corrige o se sustituye, pero no
  // sigue hacia dentro.
  const {
    epoca = EPOCA_RESPALDO,
    // Casco sin color de facción, tomado de la paleta y no escrito aquí.
    color = PIXEL.neutro,
  } = opciones;
  const ancho = acotar(opciones.ancho, 1, 1e6, 160);
  const alto = acotar(opciones.alto, 1, 1e6, 120);
  const fov = acotar(opciones.fov, 1, 179, 60);
  const cerca = acotar(opciones.cerca, 1e-6, 1e6, 0.1);
  // Alcance de dibujo. Existe por la misma razón que el plano cercano: sin él,
  // la profundidad no tiene escala y «lejos» no significa nada, así que la
  // niebla no sabría cuánto teñir. Un `lejos` por debajo del `cerca` sería un
  // volumen de cámara vacío; se corrige aquí y no se propaga.
  const lejos = Math.max(cerca * 2, acotar(opciones.lejos, 1e-6, 1e9, 80));
  // El color al que se funde la distancia es el FONDO, y por eso entra desde
  // fuera: teñir hacia un color inventado aquí dejaría un halo que no casa con
  // lo que hay pintado detrás, y además metería un literal de color en el módulo
  // que la guardia de `paleta.test.mjs` prohíbe. Sin fondo declarado —lienzo
  // transparente— no hay hacia dónde fundir, así que no hay niebla.
  const fondo = typeof opciones.fondo === "string" ? opciones.fondo : null;
  // Malla EMISIVA: sus caras se pintan a intensidad plena, sin sombreado por
  // normal (#555). Es lo que hace que una lámpara se lea encendida en un motor
  // que solo tiene una luz direccional y un suelo ambiente — y es exactamente lo
  // que hacía la máquina de referencia: los polígonos de una luz, una pantalla o
  // un motor iban «fullbright», sin iluminar. No es una luz: no alumbra a nadie,
  // solo se exceptúa de la sombra. Poner luces de verdad es otra decisión, más
  // cara y que cambiaría el aspecto de todas las superficies (#556).
  //
  // La NIEBLA sí se le aplica: una luminaria al fondo de una nave larga tiene que
  // apagarse con la distancia como todo lo demás, o el pasillo pierde la
  // profundidad que la niebla le da.
  const emisivo = opciones.emisivo === true;
  // Transparencia de la malla entera (#556), que viaja en cada polígono hasta el
  // pintor. No es una decisión de composición —aquí no se mezcla nada— sino un
  // dato que `pintarEscena` necesita; ausente, los polígonos salen sin `alpha` y
  // el pintor no toca `globalAlpha`.
  const alpha = Number.isFinite(opciones.alpha) ? Math.max(0, Math.min(1, opciones.alpha)) : null;
  // EL SOL DE LA ESCENA (#587), opcional. Sin él manda `LUZ`, la direccional de
  // interior con la que están calibradas las trece salas del Phobos: ninguna
  // escena existente cambia ni un píxel. Va en el MISMO espacio que las normales
  // —el del mundo cuando hay `luzFija`—, igual que los focos.
  const luz = Array.isArray(opciones.luz) ? opciones.luz : null;
  const ambiente = Number.isFinite(opciones.ambiente) ? opciones.ambiente : null;
  // Y de qué COLOR es esa luz, y de qué color la sombra que rellena el cielo.
  // Los dos vienen de fuera porque son decisiones de ambientación, no del motor:
  // aquí no se sabe si es mediodía o si el sol está entrando en el mar.
  const tinte =
    opciones.tinte && (opciones.tinte.calida || opciones.tinte.fria)
      ? { calida: opciones.tinte.calida ?? null, fria: opciones.tinte.fria ?? null }
      : null;
  const yaw = finito(opciones.yaw, 0);
  const pitch = finito(opciones.pitch, 0);
  const roll = finito(opciones.roll, 0);
  const posicion = triple(opciones.posicion, [0, 0, 6]);

  const ajustes = ajustesEpoca(epoca);
  const f = focal(alto, fov);
  const vertices = Array.isArray(malla?.vertices) ? malla.vertices : [];
  const caras = Array.isArray(malla?.caras) ? malla.caras : [];
  // TEXTURA OPCIONAL (#573). La malla puede traer `uvs`: una lista paralela a
  // `caras` con un `[u, v]` por vértice de cada cara. Es paralela a `caras` y no
  // a `vertices` a propósito: un cubo texturado necesita UV DISTINTAS para el
  // mismo vértice según qué cara se pinte, y atarlas al vértice obligaría a
  // duplicar geometría —justo lo que hace que una caja de ocho vértices pase a
  // tener veinticuatro— para nada.
  //
  // Sin textura no cambia absolutamente nada: los vértices siguen siendo
  // `[x, y, z]` y el polígono sale sin `textura`, así que todas las superficies
  // que ya existen pintan exactamente igual.
  const textura = opciones.textura ?? null;
  const uvs = textura && Array.isArray(malla?.uvs) ? malla.uvs : null;

  // FOCOS (#556). Luces de punto declaradas por la escena, evaluadas en el
  // centroide de cada cara. Se declaran en el MISMO espacio del que sale la
  // normal —el del mundo con `luzFija`, el de la cámara sin él—, porque una luz
  // y la cara que ilumina tienen que medirse en el mismo sitio o la distancia
  // entre ambas no significa nada. Sin focos, ni se calcula el centroide.
  //
  // `observador` es dónde está la cámara EN ESE MISMO ESPACIO, y solo sirve
  // para quedarse con los `TOPE_FOCOS` más cercanos. Por defecto es el origen,
  // que es exactamente donde está la cámara en espacio de cámara; una escena
  // con `luzFija` declara sus focos en el mundo y es la única que sabe dónde
  // está el jugador ahí, así que lo pasa ella.
  const focos = focosCercanos(opciones.focos, opciones.observador ?? [0, 0, 0]);

  const enCamara = vertices.map((v) => transformar(v, { yaw, pitch, roll, posicion }));

  const poligonos = [];
  for (const [indiceCara, cara] of caras.entries()) {
    if (!Array.isArray(cara) || cara.length < 3) continue;
    // Con textura, el vértice que entra al recorte lleva sus UV pegadas
    // (`[x, y, z, u, v]`): así el recortador —que interpola TODAS las
    // componentes— las corta con el mismo `t` que la posición, sin saber qué son.
    const uvCara = uvs?.[indiceCara];
    const crudos = cara
      .map((indice, k) => {
        const v = enCamara[indice];
        if (!v) return null;
        const uv = uvCara?.[k];
        return uv ? [v[0], v[1], v[2], finito(uv[0], 0), finito(uv[1], 0)] : v;
      })
      .filter(Boolean);
    if (crudos.length < 3) continue;

    // Primero el plano cercano, LUEGO opcionalmente los cuatro laterales, y
    // después el lejano: lo que quede está dentro del volumen de dibujo, así
    // que ni la proyección ni la niebla ven geometría que el alcance ya no
    // cubre.
    //
    // `recorteLateral` es OPT-IN, no el comportamiento por defecto (#508 QA,
    // documentado en #510): sin él, un vértice a `z` diminuto con un `x`/`y`
    // de cámara moderado sigue pasando el recorte cercano y `proyectar` lo
    // dispara a miles de píxeles fuera de pantalla — el bug real que motivó
    // esto. Actívalo y arregla ese caso, pero las cámaras ya publicadas de la
    // cantina (`cantina-planos.mjs`) cuentan HOY con que geometría fuera del
    // cono de visión nominal se cuele sin recortar — activarlo por defecto
    // recortaría de golpe planos ya afinados a ojo (hasta un 70% menos de
    // polígonos en alguno), un cambio visual que necesita ojos delante de un
    // cliente real, no una decisión de código. Actívalo explícitamente en
    // escenas nuevas que ya se hayan comprobado sin ese riesgo.
    let recortada = recortarCercano(crudos, cerca);
    if (opciones.recorteLateral) recortada = recortarLateral(recortada, { ancho, alto, f });
    recortada = recortarLejano(recortada, lejos);
    if (recortada.length < 3) continue;

    // La normal se toma de la cara SIN recortar: el recorte añade vértices sobre
    // el plano cercano y puede dejar los tres primeros casi alineados, lo que
    // daría una normal basura y un parpadeo de sombreado justo al pasar rozando
    // la cámara — que es cuando más se nota.
    //
    // `luzFija` (QA: "las paredes van cambiando de iluminación sin sentido al
    // girar") decide DE QUÉ VÉRTICES sale esa normal. Por defecto sale de
    // `crudos` —ya girados por `yaw`/`pitch`/`roll`—, y eso es lo correcto
    // para una pieza que ROTA delante de una cámara fija (`girarNave`, dados,
    // cartas: el efecto de "vitrina bajo una luz" es intencional, y por eso
    // no se toca por defecto). Pero en el bucle de andar ese mismo `yaw` no es
    // el giro de la pieza: es el giro de la CÁMARA fingido rotando el mundo
    // al revés (ver la cabecera de `nave-sala-caja.mjs`) — con la normal
    // saliendo de vértices ya girados así, la luz (un vector fijo, sin
    // contrarrotar) queda pegada a hacia dónde mira el jugador, como un
    // frontal en la cabeza, en vez de fija en el mundo. `luzFija: true` toma
    // la normal de los vértices SIN ese giro de cámara —siguen ahí, en
    // `vertices`, porque el giro se aplica en `enCamara` y no in-place—, que
    // es la orientación real e inmóvil de la pared en el mundo.
    const baseNormal = opciones.luzFija ? cara.map((indice) => vertices[indice]).filter(Boolean) : crudos;
    if (baseNormal.length < 3) continue;
    const normal = normalizar(cruz(resta(baseNormal[1], baseNormal[0]), resta(baseNormal[2], baseNormal[0])));

    const puntos = recortada.map((v) => {
      const p = proyectar(v, { ancho, alto, f, rejilla: ajustes.rejilla });
      // Las UV viajan en el punto de pantalla porque el rasterizador las
      // necesita ahí: `proyectar` es geometría y no tiene por qué saber de
      // texturas, así que se le pegan después en vez de ensuciar su firma.
      return v.length > 3 ? { ...p, u: v[3], v: v[4] } : p;
    });

    // Caras de espaldas fuera, medido en pantalla: es más barato que en 3D y,
    // además, descarta los polígonos que el ajuste a rejilla ha aplastado hasta
    // dejarlos sin área, que no se verían pero sí se pintarían.
    if (areaFirmada(puntos) <= 0) continue;

    // La profundidad se mide sobre la geometría YA recortada: es la que se
    // pinta, y así la niebla nunca tiñe por un trozo de cara que quedó fuera del
    // alcance. Una cara larga que entra en el volumen por un extremo se ve, pero
    // solo hasta el plano lejano.
    const profundidad = recortada.reduce((suma, v) => suma + v[2], 0) / recortada.length;

    // El centroide sale de los MISMOS vértices que la normal (`baseNormal`), no
    // de los recortados: el recorte mueve el centro de la cara hacia el borde
    // de la pantalla, y con él se movería el charco de luz al girar la cámara
    // — luz que se desplaza sola, que es justo el defecto que `luzFija` existe
    // para evitar. Solo se calcula si hay focos.
    const centroide = focos.length > 0 ? centro(baseNormal) : null;
    const intensidad = emisivo ? 1 : intensidadCara(normal, ajustes.tonos, { centroide, focos, luz, ambiente });

    const sombreado = emisivo ? color : sombrear(color, intensidad, tinte);
    const niebla = fondo ? factorNiebla(profundidad, { cerca, lejos, niebla: ajustes.niebla }) : 0;
    poligonos.push({
      puntos,
      color: niebla > 0 ? mezclar(sombreado, fondo, niebla) : sombreado,
      ...(alpha === null ? {} : { alpha }),
      profundidad,
      niebla,
      // La textura viaja con el polígono, no con la escena: dos mallas fundidas
      // con `fundirEscenas` pueden traer texturas distintas, y una textura por
      // escena obligaría a fundir también eso. `intensidad` es el sombreado de
      // la cara SIN aplicar al color: con textura no se puede premultiplicar el
      // color como se hace arriba —cada téxel es distinto—, así que el
      // rasterizador multiplica téxel por intensidad, que es lo que hacía la
      // máquina de referencia con su modulación por vértice.
      ...(textura && uvCara ? { textura, intensidad } : {}),
      // La geometría de cámara ya recortada viaja con el polígono porque el
      // orden por pintor la necesita: decidir quién tapa a quién exige el plano
      // real de la cara, y en pantalla ese plano ya no existe (la perspectiva no
      // conserva la planaridad en `x,y,z`). Va aquí y no en un canal aparte para
      // que sobreviva al `flatMap` con el que los consumidores funden escenas.
      camara: recortada,
    });
  }

  return {
    epoca: EPOCAS.includes(epoca) ? epoca : EPOCA_RESPALDO,
    ancho,
    alto,
    // El alcance sale en la escena porque una superficie que coloca cosas a
    // distancia necesita saber a partir de dónde dejan de verse, y adivinarlo
    // desde fuera sería duplicar el valor por defecto en dos sitios.
    lejos,
    // Ordenados por el mismo camino que usa `fundirEscenas`: una escena de una
    // sola malla es el caso de una sola pieza, no un caso aparte, y así el día
    // que ese orden mejore mejora en los dos sitios.
    poligonos: ordenarPorPintor(poligonos),
  };
}

/** Área firmada del polígono en pantalla. Positiva = mirándonos. */
export function areaFirmada(puntos) {
  let suma = 0;
  for (let i = 0; i < puntos.length; i += 1) {
    const a = puntos[i];
    const b = puntos[(i + 1) % puntos.length];
    suma += a.x * b.y - b.x * a.y;
  }
  return suma / 2;
}

// ---- Malla ------------------------------------------------------------------

/**
 * Topología común de todos los cascos: qué vértice va con cuál. Los índices van
 * en sentido antihorario visto desde fuera, que es lo que hace funcionar el
 * descarte de caras traseras.
 */
const CARAS_CASCO = Object.freeze([
  [0, 2, 1], // lomo
  [0, 1, 3], // costado izquierdo
  [0, 3, 2], // costado derecho
  [1, 2, 3], // popa
  [0, 1, 4], // ala izquierda, cara superior
  [0, 4, 3], // ala izquierda, cara inferior
  [0, 5, 2], // ala derecha, cara superior
  [0, 3, 5], // ala derecha, cara inferior
]);

/** Medidas de un casco de serie. Un caza: corto, estrecho y con mucha ala. */
export const CASCO_POR_DEFECTO = Object.freeze({
  eslora: 1.6,
  manga: 0.75,
  envergadura: 1.7,
  quilla: 0.35,
});

/**
 * Malla a partir de CUATRO MEDIDAS, no de una lista de vértices a mano.
 *
 * Decidido en #362 tras ver las dos opciones renderizadas: con una malla escrita
 * a mano, un carguero y un caza son la misma nave repintada, y eso no vale para
 * un atlas. Con medidas, la clase se lee de un vistazo — el carguero es ancho y
 * el caza afilado— y una nave nueva no obliga a dibujar nada.
 *
 * En esta fase los números se escriben en el módulo. Cuando exista el editor
 * declarativo de naves (#55), se cambia de dónde vienen y este código no se
 * entera: es justo lo que se gana empezando por aquí y no por el catálogo.
 *
 * Morro en +z (la cámara mira hacia +z, así que de frente se ve venir), alas en
 * ±x, quilla en −y.
 */
export function mallaDesdeCasco(entrada = {}) {
  // `= {}` solo cubre `undefined`; un `null` explícito llegaría hasta aquí y
  // reventaría al leer la primera medida.
  const medidas = entrada ?? {};
  const eslora = acotar(medidas.eslora, 0.2, 8, CASCO_POR_DEFECTO.eslora);
  const manga = acotar(medidas.manga, 0.1, 4, CASCO_POR_DEFECTO.manga);
  const envergadura = acotar(medidas.envergadura, 0.1, 6, CASCO_POR_DEFECTO.envergadura);
  const quilla = acotar(medidas.quilla, 0.05, 3, CASCO_POR_DEFECTO.quilla);
  return {
    vertices: [
      [0, 0, eslora], // 0 morro
      [-manga, 0.18, -0.6], // 1 popa alta izquierda
      [manga, 0.18, -0.6], // 2 popa alta derecha
      [0, -quilla, -0.5], // 3 quilla
      [-envergadura, -0.05, -0.75], // 4 punta de ala izquierda
      [envergadura, -0.05, -0.75], // 5 punta de ala derecha
    ],
    caras: CARAS_CASCO.map((cara) => [...cara]),
  };
}

/** El caza de serie, por comodidad de quien no quiere pensar en medidas. */
export const MALLA_CAZA = Object.freeze(mallaDesdeCasco(CASCO_POR_DEFECTO));
