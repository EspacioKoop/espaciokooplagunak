// El cubilete pintado: la fila de dados de un jugador, en 3D retro (#413).
//
// `dados-3d.mjs` da la geometría de UN dado y `retro3d-lienzo.mjs` sabe volcar
// polígonos a un `<canvas>`. Faltaba lo de en medio: colocar varios dados en una
// fila que quepa, y que siga cabiendo cuando alguien pierda uno. Eso es esto, y
// nada más — no sabe de reglas, ni de turnos, ni de quién mira.
//
// LA PARTE PURA ES LA GRANDE. `escenaCubilete` compone y devuelve datos; pintar
// es una línea. Así la colocación —que es donde de verdad se rompe algo— se
// prueba en Node sin un lienzo de mentira, igual que el resto del 3D.
//
// PRIVACIDAD POR CONSTRUCCIÓN. El cubilete ajeno no se pinta tapado: se pinta
// SIN VALORES, porque el pintor nunca recibe los valores ajenos. La vista
// pública no los lleva (`dados-motor.mjs` solo publica cuántos dados hay), así
// que aquí no hay nada que ocultar y, sobre todo, nada que se pueda filtrar por
// un descuido de dibujo. Un dado ajeno es un cubo liso hasta el destape.
//
// Frontera de arte (#351): ni un color declarado. Todo entra desde fuera o desde
// `paleta.mjs`, como en el resto del 3D.

import { PIXEL } from "../paleta.mjs";
import { pintarEscena } from "../retro3d-lienzo.mjs";
import { componerEscena } from "../retro3d.mjs";
import { escenaDado, giroDeTirada, mallaDado, orientacionParaValor } from "./dados-3d.mjs";

/** Separación entre dados, como fracción del lado de su celda. */
const AIRE = 0.16;

/**
 * Compone la fila de dados de un cubilete.
 *
 * @param {object} opciones
 *   - `valores`: los dados que se ven. Para un cubilete ajeno, pásale `null` y
 *     `cantidad`: se dibujan cubos lisos, sin cara.
 *   - `cantidad`: cuántos dados hay, cuando no se ven sus valores.
 *   - `ancho` / `alto`: el búfer donde va la fila.
 *   - `epoca`, `fondo`, `color`, `tinta`: como en `escenaDado`.
 * @returns {{ancho, alto, epoca, dados: object[], poligonos: object[]}}
 */
export function escenaCubilete(opciones = {}) {
  const ancho = enteroPositivo(opciones.ancho, 160);
  const alto = enteroPositivo(opciones.alto, 48);
  const valores = Array.isArray(opciones.valores) ? opciones.valores : null;
  const cantidad = Math.max(
    0,
    Math.trunc(Number(valores ? valores.length : opciones.cantidad) || 0),
  );

  if (cantidad === 0) {
    return { ancho, alto, epoca: opciones.epoca, dados: [], poligonos: [] };
  }

  // Cada dado tiene su celda y su propia cámara: es más simple que una escena
  // única con seis cubos trasladados, y evita que el orden por pintor tenga que
  // resolver solapes que no existen —los dados no se tocan—.
  const celda = ancho / cantidad;
  const lado = Math.max(1, Math.round(Math.min(celda * (1 - AIRE), alto)));

  const dados = [];
  const poligonos = [];
  let epoca = opciones.epoca;
  for (let i = 0; i < cantidad; i += 1) {
    const valor = valores ? valores[i] : null;
    // El giro puede venir por dado —es lo que permite que rueden desacompasados
    // durante una tirada— o no venir, y entonces cada uno se queda en su
    // orientación legible.
    const giro = typeof opciones.giro === "function"
      ? opciones.giro(i, valor)
      : opciones.giro ?? null;
    const escena = valor
      ? escenaDado({ ...opciones, giro, valor, ancho: lado, alto: lado, fondo: null })
      : escenaCubo({ ...opciones, giro, ancho: lado, alto: lado });
    epoca = escena.epoca;
    // El desplazamiento se aplica DESPUÉS de proyectar, sobre coordenadas de
    // pantalla ya ajustadas a la rejilla: moverlo antes, en el mundo, metería
    // cada dado en una perspectiva distinta —el de la derecha se vería de lado—
    // y la fila dejaría de leerse como una fila de dados iguales.
    const dx = Math.round(i * celda + (celda - lado) / 2);
    const dy = Math.round((alto - lado) / 2);
    const desplazados = escena.poligonos.map((poligono) => ({
      ...poligono,
      puntos: poligono.puntos.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy })),
    }));
    dados.push({ valor: valor ?? null, x: dx, y: dy, lado });
    poligonos.push(...desplazados);
  }

  return { ancho, alto, epoca, dados, poligonos };
}

/**
 * Un dado sin cara: el cubo del cubilete ajeno.
 *
 * Se compone con la misma malla y la misma orientación legible del 1 —para que
 * un dado ajeno tenga exactamente el mismo aspecto y el mismo peso visual que
 * uno propio— pero SIN la malla de puntos. No es un dado tapado: es que sus
 * valores no han llegado hasta aquí.
 */
function escenaCubo(opciones) {
  const orientacion = opciones.giro ?? orientacionParaValor(1, opciones.inclinacion);
  return componerEscena(mallaDado(), {
    ...opciones,
    yaw: orientacion.yaw,
    pitch: orientacion.pitch,
    roll: orientacion.roll ?? 0,
    posicion: opciones.posicion ?? [0, 0, 3],
    color: opciones.color ?? PIXEL.cara,
    fondo: null,
  });
}

/**
 * Compone y pinta de una vez, como `pintarNave`. El tamaño del búfer sale del
 * propio lienzo para que nadie tenga que mantener dos números a mano.
 */
export function pintarCubilete(lienzo, opciones = {}) {
  const ctx = lienzo?.getContext?.("2d");
  if (!ctx) return null;
  const escena = escenaCubilete({ ...opciones, ancho: lienzo.width, alto: lienzo.height });
  pintarEscena(ctx, escena, { fondo: opciones.fondo ?? null });
  return escena;
}

/**
 * La tirada: los dados ruedan y se paran enseñando su valor.
 *
 * Mismo contrato que `girarNave` y por las mismas razones, que no son de estilo:
 *
 * - `prefers-reduced-motion` se consulta EN CADA FOTOGRAMA, no una vez al
 *   arrancar. Alguien puede cambiar la preferencia con la ventana abierta, y
 *   quedarse con los dados dando vueltas después de pedir que no lo hagan es
 *   justo el fallo que la preferencia existe para evitar. Con la preferencia
 *   puesta se pinta UN fotograma con los dados ya parados y a la vista: el
 *   resultado nunca depende de haber visto la animación.
 * - Todo lo que toca el mundo —reloj y fotogramas— entra inyectado, así que esto
 *   se prueba en Node sin navegador.
 * - Devuelve la función de parada; llamarla dos veces no hace daño.
 *
 * El aterrizaje es exacto por construcción (ver `giroDeTirada`): al terminar, la
 * cara que vale mira a la cámara sin corrección de último fotograma.
 */
export function rodarDados(lienzo, opciones = {}) {
  const {
    valores = [],
    duracionMs = 1400,
    vueltas = 3,
    alTerminar = () => {},
    ahora = () => globalThis.performance?.now?.() ?? Date.now(),
    pedirFotograma = (fn) => globalThis.requestAnimationFrame?.(fn),
    cancelarFotograma = (id) => globalThis.cancelAnimationFrame?.(id),
    movimientoReducido = () =>
      Boolean(globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches),
  } = opciones;

  const duracion = Math.max(1, Number(duracionMs) || 1);
  const inicio = ahora();
  let id = null;
  let vivo = true;
  let avisado = false;

  const quieto = () => {
    pintarCubilete(lienzo, { ...opciones, giro: null });
    if (!avisado) {
      avisado = true;
      alTerminar();
    }
  };

  const paso = () => {
    if (!vivo) return;
    if (movimientoReducido()) {
      quieto();
      return;
    }
    const t = (ahora() - inicio) / duracion;
    if (t >= 1) {
      quieto();
      return;
    }
    pintarCubilete(lienzo, {
      ...opciones,
      // Un desfase por dado, derivado del índice: ruedan desacompasados sin que
      // intervenga el azar, así que la misma tirada se ve igual dos veces.
      giro: (indice, valor) => giroDeTirada(valor ?? 1, t, {
        vueltas,
        desfase: indice * 0.7,
      }),
    });
    id = pedirFotograma(paso);
  };

  if (valores.length === 0 && !opciones.cantidad) {
    quieto();
    return () => {};
  }

  paso();
  return () => {
    if (!vivo) return;
    vivo = false;
    if (id != null) cancelarFotograma(id);
    id = null;
  };
}

function enteroPositivo(valor, porDefecto) {
  const n = Math.trunc(Number(valor));
  return Number.isFinite(n) && n > 0 ? n : porDefecto;
}
