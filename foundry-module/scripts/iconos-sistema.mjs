// Icono de daño por sistema (#353): el estado se DIBUJA, no solo se colorea.
//
// Por qué existe. Las barras de `barras-estado.mjs` comunican la severidad por
// color, y este repositorio ya declaró que eso no basta: `alerta-escena.mjs`
// lo escribe explícito —«el borde de color por sí solo comunicaría por color en
// solitario, que es justo lo que no debe hacerse (WCAG 1.4.1)»—. Un icono que
// se agrieta añade el canal que falta, con forma en vez de tono.
//
// EL CUARTO ESTADO ES EL IMPORTANTE. `barras-estado.mjs` ya resolvió la trampa
// que este módulo podría reintroducir: `null` significa «no hay lectura», NO
// «cero». Un icono agrietado por falta de sondeo miente diciendo «destruido»,
// que en plena sesión es peor que no dibujar nada. Por eso «sin lectura» tiene
// su propio dibujo, y ninguna entrada nula puede producir otro.
//
// Un solo juego de siluetas para todos los sistemas: esta rebanada no trae
// iconografía propia por sistema, que el nombre ya va escrito al lado.
//
// Puro: ni Foundry, ni DOM, ni red. Sin animación, así que no hay nada que
// detener bajo `prefers-reduced-motion`.

import { crearAleatorio } from "./minijuegos/aleatorio.mjs";
import { SISTEMA } from "./paleta.mjs";

export const LADO = 10;

/** Los cuatro estados de dibujo. «sin-lectura» no es ninguno de los otros. */
export const ESTADOS = Object.freeze(["intacto", "dañado", "inutilizado", "sin-lectura"]);

// Silueta única: un módulo de nave visto de frente, con marco y núcleo.
// '#' = marco, '+' = núcleo, '.' = vacío.
const SILUETA = Object.freeze([
  "..######..",
  ".########.",
  "##++++++##",
  "##++++++##",
  "##++++++##",
  "##++++++##",
  "##++++++##",
  "##++++++##",
  ".########.",
  "..######..",
]);

/**
 * Estado de dibujo a partir de la barra de salud que produce `barrasSistema`.
 *
 * La correspondencia con la severidad es deliberada y vale la pena decirla: el
 * módulo no recibe ninguna señal propia de «sistema desactivado», así que lee
 * `critico` como inutilizado. Si algún día el puente publica ese estado aparte,
 * este es el único sitio que hay que tocar.
 *
 * @param {{nivel?: string}|null|undefined} salud `null` = no hubo lectura.
 */
export function estadoIcono(salud) {
  // Cualquier ausencia de lectura cae aquí, y solo aquí. Nunca se degrada a
  // «intacto» (optimismo falso) ni a «inutilizado» (alarma falsa).
  if (salud == null || typeof salud !== "object") return "sin-lectura";
  switch (salud.nivel) {
    case "ok":
      return "intacto";
    case "aviso":
      return "dañado";
    case "critico":
      return "inutilizado";
    default:
      return "sin-lectura";
  }
}

/**
 * Celdas del icono ya resueltas: qué se pinta y de qué color. El daño se
 * siembra con el id del sistema, así que las mismas grietas salen en todos los
 * clientes y no bailan entre sondeos.
 */
export function iconoSistema(estado, semilla = "") {
  const modo = ESTADOS.includes(estado) ? estado : "sin-lectura";
  const { siguiente } = crearAleatorio(`${semilla}|${modo}`);

  const celdas = [];
  SILUETA.forEach((fila, y) => {
    [...fila].forEach((codigo, x) => {
      if (codigo === ".") return;
      const esMarco = codigo === "#";

      if (modo === "sin-lectura") {
        // Contorno discontinuo y núcleo vacío: se ve que hay un sistema y se ve
        // que no se sabe nada de él. No se parece a ninguno de los otros tres.
        if (!esMarco || (x + y) % 2 === 1) return;
        celdas.push({ x, y, color: SISTEMA.sinLectura });
        return;
      }

      if (esMarco) {
        celdas.push({ x, y, color: SISTEMA.marco });
        return;
      }

      if (modo === "intacto") {
        celdas.push({ x, y, color: SISTEMA.nucleo });
        return;
      }

      if (modo === "dañado") {
        // Grietas: una diagonal quebrada que atraviesa el núcleo. Es forma, no
        // tono — se distingue en escala de grises y a tamaño pequeño.
        const grieta = Math.abs(x - y) <= 1 || Math.abs(x + y - LADO + 1) <= 0;
        celdas.push({ x, y, color: grieta ? SISTEMA.grieta : SISTEMA.nucleo });
        return;
      }

      // Inutilizado: núcleo mayoritariamente apagado, con los pocos píxeles que
      // quedan encendidos dispersos. La silueta sigue ahí: el sistema existe,
      // pero no responde.
      celdas.push({ x, y, color: siguiente() < 0.22 ? SISTEMA.nucleo : SISTEMA.apagado });
    });
  });

  return { estado: modo, celdas };
}

/** SVG autosuficiente del icono: sin URLs, sin `<image>`, sin fuentes. */
export function iconoSistemaSvg(estado, semilla = "") {
  const { celdas, estado: modo } = iconoSistema(estado, semilla);
  const porColor = new Map();
  for (const { x, y, color } of celdas) {
    if (!porColor.has(color)) porColor.set(color, []);
    porColor.get(color).push(`M${x} ${y}h1v1h-1z`);
  }
  const capas = [...porColor]
    .map(([color, d]) => `<path fill="${color}" d="${d.join("")}"/>`)
    .join("");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${LADO} ${LADO}" ` +
    `shape-rendering="crispEdges" role="img" aria-hidden="true" ` +
    `data-estado="${modo}">${capas}</svg>`
  );
}

/** El icono como `data:` URI, listo para el `src` de un `<img>`. */
export function iconoSistemaDataUri(estado, semilla = "") {
  return `data:image/svg+xml,${encodeURIComponent(iconoSistemaSvg(estado, semilla))}`;
}

/**
 * Actualiza el icono ya presente en el DOM sin reconstruir la fila, igual que
 * `aplicarBarraDom` hace con la barra: los patchers de telemetría de V1 y V2
 * comparten esta función para no duplicar el detalle.
 *
 * No crea el nodo si falta. Una plantilla anterior sin `[data-icono]` sigue
 * funcionando: el texto y la barra son la información, el icono es el canal
 * añadido.
 */
export function aplicarIconoDom(raiz, selectorFila, id, salud) {
  const nodo = raiz?.querySelector?.(`${selectorFila} [data-icono]`);
  if (!nodo) return;
  const uri = iconoSistemaDataUri(estadoIcono(salud), id);
  if (nodo.getAttribute?.("src") !== uri) nodo.setAttribute?.("src", uri);
}
