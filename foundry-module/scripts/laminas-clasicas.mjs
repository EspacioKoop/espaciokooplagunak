// Ornamento procedural en la tradición del grabado clásico (#318, §4.3 del
// catálogo de dominio público). Genera SVG en el navegador a partir de una
// semilla: cero ficheros binarios en el repositorio y cero contenido ajeno
// distribuido — solo *técnica*, que no es obra de nadie.
//
// Registros implementados, cada uno con la fuente de inspiración documentada
// en docs/DOMINIO_PUBLICO_SCIFI.md §4.3:
//
//   cartografia()  Hevelius, «Selenographia» (1647). La primera cartografía
//                  realista de otro mundo: retícula, rosa de los vientos,
//                  cartela y limbo sombreado. Es material de INTERFAZ, no
//                  ilustración de escena — de ahí que sea el de mayor
//                  rendimiento inmediato para el mapa vivo y el códice.
//   discoLunar()   Fases y relieve por punteado, como las láminas lunares.
//   tramaGrabado() Rayado cruzado a la manera del grabado a testa (Doré) y del
//                  aguafuerte (Goya, Rembrandt): sombra por densidad de línea,
//                  no por opacidad.
//
// Nada aquí toca Foundry, red ni DOM: devuelve cadenas SVG y datos puros, así
// que se prueba desde Node. Toda la aleatoriedad entra por `semilla`.

import { crearAleatorio } from "./minijuegos/aleatorio.mjs";
import { TINTA } from "./paleta.mjs";

// La tinta del grabado vive en `paleta.mjs` con la frontera de estilo (#351).
// Se reexporta porque los consumidores de este módulo ya la importaban de aquí.
export { TINTA };

const TAU = Math.PI * 2;

function num(valor, porDefecto) {
  const n = Number(valor);
  return Number.isFinite(n) ? n : porDefecto;
}

/**
 * Cuenta de elementos a dibujar: entero, finito y con tope explícito.
 *
 * El tope no es cosmético. Estos valores gobiernan bucles y asignaciones de
 * objetos, y estas figuras acabarán cableadas a opciones de escena; sin techo,
 * un `divisiones: 100000` escrito por error o por malicia bloquea la pestaña de
 * Foundry de toda la mesa. Se acota en vez de fallar porque una lámina de
 * adorno nunca debe tumbar la sesión.
 */
function cuenta(valor, porDefecto, minimo, maximo) {
  const n = Math.round(num(valor, porDefecto));
  return Math.max(minimo, Math.min(maximo, n));
}

// Techos de dibujo: por encima de esto ni se distingue a simple vista ni cabe
// en la lámina, así que solo cuesta tiempo de CPU.
const MAX_DIVISIONES = 64;
const MAX_CRATERES = 240;

// ---- Trama de grabado ------------------------------------------------------

/**
 * Rayado cruzado cuya DENSIDAD codifica la sombra, como en el grabado a testa:
 * más líneas por unidad de superficie = más oscuro. No usa opacidad, que es un
 * recurso de pantalla y delata el pastiche.
 *
 * `intensidad` va de 0 (sin trama) a 1 (rayado cruzado denso).
 */
export function tramaGrabado(intensidad, { lado = 8, angulo = 45 } = {}) {
  const fuerza = Math.max(0, Math.min(1, num(intensidad, 0)));
  if (fuerza === 0) return [];
  const lineas = [];
  // Hasta cuatro pasadas: una diagonal, luego la cruzada, luego intermedias.
  const pasadas = Math.max(1, Math.round(fuerza * 4));
  for (let p = 0; p < pasadas; p += 1) {
    const giro = angulo + p * 45;
    const separacion = lado / (1 + p);
    lineas.push({ angulo: giro % 180, separacion: Number(separacion.toFixed(3)) });
  }
  return lineas;
}

function patronesTrama(id, niveles) {
  return niveles
    .map((intensidad, indice) => {
      const trazos = tramaGrabado(intensidad)
        .map(
          ({ angulo, separacion }) =>
            `<path d="M -2 0 L ${separacion + 2} 0" stroke="${TINTA.linea}" stroke-width="0.6" ` +
            `transform="rotate(${angulo})"/>`,
        )
        .join("");
      const paso = 8;
      return (
        `<pattern id="${id}-t${indice}" width="${paso}" height="${paso}" ` +
        `patternUnits="userSpaceOnUse">${trazos}</pattern>`
      );
    })
    .join("");
}

// ---- Disco lunar -----------------------------------------------------------

/**
 * Disco de cuerpo celeste con relieve punteado y terminador de fase, en la
 * línea de las láminas lunares del XVII: el relieve se sugiere con puntos de
 * distinto calibre, no con degradados.
 *
 * `fase` va de 0 (nueva) a 1 (llena).
 */
export function discoLunar(semilla, { radio = 40, fase = 0.6, crateres = 18 } = {}) {
  const { siguiente } = crearAleatorio(semilla);
  const r = Math.max(4, num(radio, 40));
  const marcas = [];
  const cuantos = cuenta(crateres, 18, 0, MAX_CRATERES);
  for (let i = 0; i < cuantos; i += 1) {
    // Distribución uniforme en el disco: sqrt evita la acumulación central.
    const distancia = Math.sqrt(siguiente()) * r * 0.86;
    const angulo = siguiente() * TAU;
    marcas.push({
      x: Number((Math.cos(angulo) * distancia).toFixed(2)),
      y: Number((Math.sin(angulo) * distancia).toFixed(2)),
      r: Number((0.8 + siguiente() * (r / 14)).toFixed(2)),
    });
  }
  const iluminacion = Math.max(0, Math.min(1, num(fase, 0.6)));
  return { radio: r, fase: iluminacion, crateres: marcas };
}

export function discoLunarSvg(semilla, opciones = {}) {
  const { radio, fase, crateres } = discoLunar(semilla, opciones);
  const lado = radio * 2 + 4;
  // El radio entra en el identificador porque el `clipPath` depende de él: dos
  // discos de la misma semilla y distinto radio en la misma página compartirían
  // id y el navegador resolvería `url(#…)` al primero, recortando mal el segundo.
  const id = `luna-${String(semilla).replace(/[^a-z0-9]/gi, "")}-${radio}`;

  // Terminador: media elipse cuyo eje horizontal encoge según la fase. Con
  // fase 0.5 es una recta (cuarto), con 0 o 1 coincide con el borde.
  const rx = Number((radio * (1 - fase * 2)).toFixed(2));
  const sombra =
    `M 0 ${-radio} A ${Math.abs(rx)} ${radio} 0 0 ${rx >= 0 ? 0 : 1} 0 ${radio} ` +
    `A ${radio} ${radio} 0 0 0 0 ${-radio} Z`;

  const circulos = crateres
    .map((c) => `<circle cx="${c.x}" cy="${c.y}" r="${c.r}" fill="none" stroke="${TINTA.lineaSuave}" stroke-width="0.5"/>`)
    .join("");

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-lado / 2} ${-lado / 2} ${lado} ${lado}" role="img">` +
    `<defs>${patronesTrama(id, [0.85])}` +
    `<clipPath id="${id}-c"><circle cx="0" cy="0" r="${radio}"/></clipPath></defs>` +
    `<circle cx="0" cy="0" r="${radio}" fill="none" stroke="${TINTA.linea}" stroke-width="1"/>` +
    circulos +
    // El rayado se recorta al disco para que nunca se salga del limbo.
    `<g clip-path="url(#${id}-c)">` +
    `<path d="${sombra}" fill="url(#${id}-t0)" stroke="${TINTA.linea}" stroke-width="0.7"/>` +
    `</g>` +
    `</svg>`
  );
}

// ---- Cartografía (Hevelius) ------------------------------------------------

/**
 * Marco de carta de navegación: retícula de coordenadas, rosa de los vientos y
 * cartela para el título. Pensado para envolver un lienzo existente (el mapa
 * vivo) sin taparlo: todo el interior queda hueco.
 */
export function cartografia({ ancho = 320, alto = 320, divisiones = 8, titulo = "" } = {}) {
  const w = Math.max(80, num(ancho, 320));
  const h = Math.max(80, num(alto, 320));
  const n = cuenta(divisiones, 8, 2, MAX_DIVISIONES);
  const marcasX = [];
  const marcasY = [];
  for (let i = 0; i <= n; i += 1) {
    marcasX.push(Number(((w / n) * i).toFixed(2)));
    marcasY.push(Number(((h / n) * i).toFixed(2)));
  }
  return { ancho: w, alto: h, marcasX, marcasY, titulo: String(titulo ?? "") };
}

// Rosa de los vientos de 8 brazos: los cardinales largos, los intercardinales
// cortos, como en las cartas grabadas.
export function rosaDeLosVientos(radio = 26) {
  const r = Math.max(6, num(radio, 26));
  return Array.from({ length: 8 }, (_, i) => {
    const angulo = (i * TAU) / 8 - Math.PI / 2;
    const largo = i % 2 === 0 ? r : r * 0.55;
    return {
      x: Number((Math.cos(angulo) * largo).toFixed(2)),
      y: Number((Math.sin(angulo) * largo).toFixed(2)),
      cardinal: i % 2 === 0,
    };
  });
}

/**
 * Desvío mínimo y DETERMINISTA de una coordenada, para que las líneas no salgan
 * perfectamente rectas. Una plancha se corta a mano: la irregularidad de una
 * fracción de píxel es la diferencia entre algo bello y algo geométrico, y es
 * lo que impide que la carta parezca una hoja de cálculo con adornos.
 */
function temblor(aleatorio, amplitud = 0.6) {
  return Number(((aleatorio.siguiente() - 0.5) * 2 * amplitud).toFixed(2));
}

/**
 * Carta grabada en SVG.
 *
 * `tics` y `rosa` existen para poder usar esta lámina sobre un instrumento que
 * SÍ se lee (#526). Sobre una ilustración, los tics del limbo y la rosa de los
 * vientos son adorno; sobre el mapa vivo serían una escala y una marcación que
 * nadie ha calculado, y el mapa tiene la regla de no inventar lecturas. Apagarlos
 * deja el encuadre —doble filete y cartela— que es lo que hace que parezca una
 * lámina impresa, sin añadir ni un signo que se pueda confundir con un dato.
 *
 * Por defecto van encendidos: es el registro completo de Hevelius y ninguna
 * llamada existente cambia de aspecto.
 */
export function cartografiaSvg(opciones = {}) {
  const { ancho, alto, marcasX, marcasY, titulo } = cartografia(opciones);
  const conTics = opciones.tics !== false;
  const conRosa = opciones.rosa !== false;
  const escalaTic = 6;
  // La semilla sale de las medidas: la misma carta tiembla siempre igual, así
  // que no parpadea entre renders.
  const aleatorio = crearAleatorio(`carta-${ancho}x${alto}-${marcasX.length}`);

  const tic = (x1, y1, x2, y2) =>
    `<path d="M ${x1} ${y1} L ${Number((x2 + temblor(aleatorio)).toFixed(2))} ` +
    `${Number((y2 + temblor(aleatorio)).toFixed(2))}" stroke="${TINTA.linea}" stroke-width="0.7"/>`;

  const ticsSuperior = marcasX.map((x) => tic(x, 0, x, escalaTic)).join("");
  const ticsInferior = marcasX.map((x) => tic(x, alto, x, alto - escalaTic)).join("");
  const ticsIzquierda = marcasY.map((y) => tic(0, y, escalaTic, y)).join("");
  const ticsDerecha = marcasY.map((y) => tic(ancho, y, ancho - escalaTic, y)).join("");

  const brazos = rosaDeLosVientos(18)
    .map(
      (b) =>
        `<path d="M 0 0 L ${b.x} ${b.y}" stroke="${TINTA.linea}" ` +
        `stroke-width="${b.cardinal ? 0.9 : 0.5}"/>`,
    )
    .join("");

  const cartela = titulo
    ? `<g transform="translate(${ancho / 2} ${alto - 14})">` +
      `<rect x="-70" y="-11" width="140" height="18" fill="${TINTA.papel}" fill-opacity="0.75" ` +
      `stroke="${TINTA.linea}" stroke-width="0.7"/>` +
      `<text x="0" y="2" text-anchor="middle" fill="${TINTA.realce}" ` +
      `font-family="Georgia, serif" font-size="9" letter-spacing="2">${escapar(titulo)}</text>` +
      `</g>`
    : "";

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ancho} ${alto}" ` +
    `role="img" aria-hidden="true">` +
    `<defs>${patronesTrama("carta", [0.25])}</defs>` +
    // Doble filete, como el encuadre de una lámina impresa.
    `<rect x="0.5" y="0.5" width="${ancho - 1}" height="${alto - 1}" fill="none" ` +
    `stroke="${TINTA.linea}" stroke-width="1"/>` +
    `<rect x="4.5" y="4.5" width="${ancho - 9}" height="${alto - 9}" fill="none" ` +
    `stroke="${TINTA.lineaSuave}" stroke-width="0.6"/>` +
    (conTics ? ticsSuperior + ticsInferior + ticsIzquierda + ticsDerecha : "") +
    (conRosa ? `<g transform="translate(${ancho - 26} 26)">${brazos}</g>` : "") +
    cartela +
    `</svg>`
  );
}

// El título viaja a un <text>: se escapa para que un nombre de escenario con
// `<` o `&` no pueda inyectar marcado.
function escapar(texto) {
  return String(texto)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function cartografiaDataUri(opciones = {}) {
  return `data:image/svg+xml,${encodeURIComponent(cartografiaSvg(opciones))}`;
}
