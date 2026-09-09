// El campo de pruebas: las escenas andables del módulo, SIN Foundry (#838).
//
// POR QUÉ EXISTE. La dirección de producto del fork es standalone-first: ante
// cualquier cosa nueva, «¿sigue siendo jugable si Foundry desaparece?». El museo
// (#598) y la playa (#587) ya cumplían esa regla por dentro —su geometría, su
// render y su motor de andar son módulos PUROS, sin una línea de Foundry— pero
// no había forma de comprobarlo: para verlas había que levantar un mundo.
//
// Y hace falta por una segunda razón, más prosaica: hay afirmaciones que son
// VISUALES y que ninguna prueba de Node demuestra. «El empaste de un cuadro se
// lee como bulto y no como agujero» depende del sentido de la luz sobre los
// costados, que es el error clásico del relieve dibujado a mano; «la niebla
// cierra el horizonte» depende de que el fondo y el alcance de dibujo casen. Hay
// que mirarlo, y esto es donde se mira.
//
// SON NIVELES, no una página por escena. Las dos que hay están declaradas en
// `niveles.mjs` sobre el catálogo del propio módulo, y la salida de cada una
// lleva a la siguiente: en la partida la cabina de la playa y la salida del
// museo vuelven a la cantina, y aquí no hay cantina a la que volver, así que en
// vez de simular un viaje que no existe se aprovecha el mismo punto de
// interacción para encadenar el recorrido. Un tercer nivel es una entrada más
// de esa lista.
//
// NO DUPLICA NADA, y es su única regla dura. Todo lo que se ve se importa de
// `foundry-module/scripts/`. Si esto tuviera su propia copia de una sala,
// dejaría de comprobar la sala de verdad el primer día que alguien tocara una
// de las dos. Lo propio de aquí es el teclado, el <canvas> y el panel de
// cartela — que es justamente lo que en Foundry pone la ventana.

import { arrancarAndar } from "../../foundry-module/scripts/nave-movimiento-lienzo.mjs";
import { CATALOGO_MUSEO } from "../../foundry-module/scripts/museo-piezas.mjs";
import { CATALOGO_CUADROS } from "../../foundry-module/scripts/museo-cuadros.mjs";
import { cartelaDe } from "../../foundry-module/scripts/catalogo-piezas.mjs";
import { estanciaDe, nivelDe, NIVELES, siguienteNivel } from "./niveles.mjs";

/**
 * Las cartelas, indexadas por ID de pieza. Los dos catálogos del museo en el
 * mismo saco: una escultura y un cuadro se COLOCAN distinto —de ahí que sean
 * catálogos separados— pero se LEEN igual, y quien pinta la ficha no tiene por
 * qué saber de cuál de los dos vino.
 */
function cartelas(idioma) {
  const todas = [...CATALOGO_MUSEO.piezas, ...CATALOGO_CUADROS.piezas];
  return new Map(todas.map((pieza) => [pieza.id, cartelaDe(pieza, idioma)]));
}

/**
 * La traducción de `claveNaturaleza` a texto.
 *
 * En Foundry esto lo hace `game.i18n`. Aquí se leen los MISMOS ficheros de
 * `lang/`, en vez de escribir las seis frases al lado: una copia a mano se
 * desincroniza en silencio, y la naturaleza de una pieza es justo el dato que
 * no puede mentir — es lo que separa «así era» de «así lo reconstruimos».
 */
async function cargarIdioma(idioma) {
  const ruta = `../../foundry-module/lang/${idioma === "en" ? "en" : "es"}.json`;
  const respuesta = await fetch(new URL(ruta, import.meta.url));
  if (!respuesta.ok) throw new Error(`No se pudo leer ${ruta}: ${respuesta.status}`);
  return respuesta.json();
}

const TECLAS = new Map([
  ["KeyW", "adelante"], ["ArrowUp", "adelante"],
  ["KeyS", "atras"], ["ArrowDown", "atras"],
  ["KeyA", "izquierda"], ["KeyD", "derecha"],
  ["KeyQ", "girar-izq"], ["ArrowLeft", "girar-izq"],
  ["KeyE", "girar-der"], ["ArrowRight", "girar-der"],
  ["Space", "saltar"], ["KeyC", "agachado"],
]);

/**
 * Dónde se empieza en un nivel. Por defecto su entrada declarada; con `mirador`
 * puesto, plantado delante de esa pieza y mirando hacia ella.
 *
 * El mirador existe para MIRAR, que es a lo que vino esta herramienta:
 * comprobar el relieve de un cuadro andando doce metros cada vez que se cambia
 * un tono es como no comprobarlo. Vive aquí y no en la escena a propósito — una
 * sala no tiene por qué saber que alguien la está revisando, y un parámetro de
 * QA en el módulo sería superficie de producto que nadie pidió.
 */
function arranque(estancia, mirador) {
  const entrada = estancia.entrada;
  if (!mirador) return { x: entrada.x, z: entrada.z, yaw: entrada.yaw };
  const punto = (estancia.interacciones ?? []).find(
    (interaccion) => interaccion.accion?.pieza === mirador || interaccion.id === mirador,
  );
  if (!punto) {
    const ids = (estancia.interacciones ?? []).map((i) => i.accion?.pieza ?? i.id).filter(Boolean);
    throw new Error(`Aquí no hay ningún «${mirador}». Hay: ${ids.join(", ") || "nada"}`);
  }
  return { x: punto.punto[0], z: punto.punto[1], yaw: punto.orientacion ?? 0 };
}

export async function arrancarCampo({ lienzo, panel, rotulo, idioma = "es", nivel: pedido, mirador = null }) {
  const textos = await cargarIdioma(idioma);
  const fichas = cartelas(idioma);
  const lengua = idioma === "en" ? "en" : "es";

  let nivel = nivelDe(pedido);
  let estancia = estanciaDe(nivel.id);

  const ficha = (etiqueta, texto, clase) => {
    const p = document.createElement("p");
    p.className = clase;
    if (etiqueta) {
      const b = document.createElement("strong");
      b.textContent = etiqueta;
      p.append(b, " ");
    }
    p.append(texto);
    return p;
  };

  const pintarCartela = (interaccion) => {
    panel.innerHTML = "";
    if (interaccion?.accion?.tipo === "cartela") {
      const datos = fichas.get(interaccion.accion.pieza);
      if (!datos) {
        panel.hidden = true;
        return;
      }
      panel.hidden = false;
      const titulo = document.createElement("h2");
      titulo.textContent = datos.titulo;
      panel.append(titulo);
      panel.append(ficha(null, textos[datos.claveNaturaleza] ?? datos.claveNaturaleza, "naturaleza"));
      panel.append(ficha(null, datos.texto, "texto"));
      panel.append(ficha(null, datos.credito, "credito"));
      if (datos.fuente) {
        const enlace = document.createElement("a");
        enlace.href = datos.fuente;
        enlace.textContent = datos.fuente;
        enlace.rel = "noreferrer";
        enlace.target = "_blank";
        panel.append(enlace);
      }
      return;
    }
    if (interaccion?.accion?.tipo === "estancia") {
      // En la partida esto vuelve a la cantina. Aquí encadena los niveles, y se
      // DICE: fingir que hay una cantina detrás sería contar algo que no está.
      panel.hidden = false;
      const destino = siguienteNivel(nivel.id);
      panel.append(
        ficha(
          lengua === "en" ? "Way out." : "La salida.",
          lengua === "en"
            ? `In the full game it leads back to the canteen. Here: ${destino.nombre.en}. Press ENTER.`
            : `En la partida lleva de vuelta a la cantina. Aquí: ${destino.nombre.es}. Pulsa INTRO.`,
          "salida",
        ),
      );
      return;
    }
    panel.hidden = true;
  };

  let salidaAlAlcance = null;

  const mando = arrancarAndar(lienzo, {
    planta: estancia.planta,
    componer: estancia.componer,
    puertas: estancia.puertas ?? [],
    interacciones: estancia.interacciones ?? [],
    fondo: estancia.fondo ?? null,
    alAlcanzarInteraccion: (interaccion) => {
      salidaAlAlcance = interaccion?.accion?.tipo === "estancia" ? interaccion : null;
      pintarCartela(interaccion);
    },
    // El flanco de SALIDA (#598): la cartela se retira al apartarse. Sin esto el
    // rótulo se queda pegado a la cámara al otro lado de la sala, que es
    // exactamente lo que la sala no debe hacer — enseña, y deja de enseñar.
    alSalirDeInteraccion: () => {
      salidaAlAlcance = null;
      panel.hidden = true;
      panel.innerHTML = "";
    },
    ...arranque(estancia, mirador),
    // EL BUCLE HAY QUE DÁRSELO. `arrancarAndar` no llama a
    // `requestAnimationFrame` por su cuenta —es un módulo puro y no conoce el
    // navegador—, así que sin esto pinta UN fotograma y se queda ahí: la escena
    // se ve, pero no se anda, no corre el reloj del viento y no salta ninguna
    // cartela. Se ve bien en una captura y está muerta, que es la clase de fallo
    // que solo aparece al abrirlo de verdad.
    pedirFotograma: (cb) => requestAnimationFrame(cb),
    cancelarFotograma: (id) => cancelAnimationFrame(id),
  });

  const rotular = () => {
    rotulo.textContent = `${nivel.nombre[lengua]} — ${nivel.mira[lengua]}`;
  };
  rotular();

  /** Cambia de nivel SIN reiniciar el bucle: es la misma costura que usa la nave
   *  entre salas, y por eso este archivo no tiene que saber montar una escena. */
  const irA = (id) => {
    nivel = nivelDe(id);
    estancia = estanciaDe(nivel.id);
    panel.hidden = true;
    panel.innerHTML = "";
    salidaAlAlcance = null;
    mando.cambiarEstancia({
      planta: estancia.planta,
      componer: estancia.componer,
      puertas: estancia.puertas ?? [],
      interacciones: estancia.interacciones ?? [],
      fondo: estancia.fondo ?? null,
      ...arranque(estancia, null),
    });
    rotular();
    const url = new URL(location.href);
    url.searchParams.set("nivel", nivel.id);
    url.searchParams.delete("mirador");
    history.replaceState(null, "", url);
  };

  const alPulsar = (evento) => {
    if (evento.code === "KeyV") {
      mando.alternarCamara();
      evento.preventDefault();
      return;
    }
    if (evento.code === "Enter" && salidaAlAlcance) {
      irA(siguienteNivel(nivel.id).id);
      evento.preventDefault();
      return;
    }
    if (evento.code === "Tab") {
      irA(siguienteNivel(nivel.id).id);
      evento.preventDefault();
      return;
    }
    const direccion = TECLAS.get(evento.code);
    if (!direccion) return;
    evento.preventDefault();
    if (direccion.startsWith("girar-")) mando.girar(direccion === "girar-izq" ? -1 : 1);
    else mando.pulsar(direccion);
  };
  const alSoltar = (evento) => {
    const direccion = TECLAS.get(evento.code);
    if (!direccion) return;
    evento.preventDefault();
    if (direccion.startsWith("girar-")) mando.girar(0);
    else mando.soltar(direccion);
  };

  addEventListener("keydown", alPulsar);
  addEventListener("keyup", alSoltar);
  // Soltarlo todo al perder el foco es cosa de aquí y no del mando: el bucle
  // sabe qué direcciones están activas, no que exista un teclado que pueda
  // quedarse con una tecla hundida al cambiar de pestaña.
  addEventListener("blur", () => {
    for (const direccion of new Set(TECLAS.values())) {
      if (direccion.startsWith("girar-")) mando.girar(0);
      else mando.soltar(direccion);
    }
  });

  return { mando, irA, niveles: NIVELES, nivelActual: () => nivel };
}
