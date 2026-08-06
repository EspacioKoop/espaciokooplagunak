/* Ventana de la sección de la nave (#427).
 *
 * La sección es una superficie de MESA, no del GM: quien juega tiene que poder
 * mirar dónde está todo el mundo y qué parte de la nave está ardiendo sin pedir
 * permiso, igual que la cantina la ve todo el mundo. Lo que no da es autoridad
 * — pulsar una sala abre su vista, no sus mandos (#237).
 *
 * Esta ventana solo traduce: compone la sección con la lectura que le den,
 * la pinta, y convierte un clic en «abre eso». La planta la declara
 * `seccion-nave.mjs` y el cuadro lo pinta `seccion-lienzo.mjs`.
 *
 * Dos clases hermanas, como el resto del módulo: `Application` clásica en v11 y
 * `ApplicationV2` en v12+, sin código compartido entre ellas a propósito.
 */

import { MODULE_ID } from "./lagunak-constantes.mjs";
import {
  componerSeccion,
  salaEnCelda,
  salaPorId,
  sistemasDeSala,
  tripulacionPorSala,
} from "./seccion-nave.mjs";
import { celdaEnPunto, medidas, pintarSeccion } from "./seccion-lienzo.mjs";

const PLANTILLA = `modules/${MODULE_ID}/templates/seccion-nave.hbs`;

/**
 * La lista textual que acompaña al plano. Es el canal accesible de la sección y
 * no un adorno: el color dice «aquí pasa algo» y esto dice qué, dónde y quién
 * — que es lo que puede leer un lector de pantalla y lo que sigue estando si el
 * lienzo no pinta.
 */
function contexto({ sistemas = [], presencias = [] } = {}) {
  const seccion = componerSeccion(sistemas);
  const gente = tripulacionPorSala(presencias);
  return {
    salas: seccion.salas.map((sala) => ({
      id: sala.id,
      titulo: game.i18n.localize(sala.tituloClave),
      entrable: Boolean(sala.destino),
      // Sin lectura se dice SIN LECTURA. Un guion o un cero serían una
      // afirmación sobre el casco que nadie ha hecho.
      salud: Number.isFinite(sala.salud)
        ? game.i18n.format("LAGUNAK.Seccion.SaludPorcentaje", { valor: Math.round(sala.salud) })
        : game.i18n.localize("LAGUNAK.Seccion.SinLectura"),
      sistemas: sistemasDeSala(sala.id).join(", "),
      gente: (gente[sala.id] ?? []).map((persona) => persona.nombre).filter(Boolean).join(", "),
    })),
  };
}

/**
 * Enciende el plano dentro de una raíz ya renderizada. Un solo fotograma: la
 * sección no se anima —es un plano, no una sala— así que no hay bucle que parar
 * al cerrar, y eso es una fuente entera de fugas que aquí no existe.
 *
 * Vive fuera de las dos clases a propósito, como en `cantina-app.mjs`: es
 * cableado de DOM, y duplicarlo entre v11 y v12+ solo aseguraría que un día el
 * arreglo llegue a una sola de las dos.
 */
function encenderPlano(raiz, { leerSistemas, leerPresencias, alEntrar }) {
  const lienzo = raiz?.querySelector?.(".lagunak-seccion-plano");
  const ctx = lienzo?.getContext?.("2d");
  if (!lienzo || !ctx) return null;

  const seccion = componerSeccion(leerSistemas());
  const tripulacion = tripulacionPorSala(leerPresencias());
  let foco = null;

  const repintar = () => {
    ctx.imageSmoothingEnabled = false;
    pintarSeccion(ctx, seccion, {
      ancho: lienzo.width,
      alto: lienzo.height,
      foco,
      tripulacion,
      rotulo: (sala) => game.i18n.localize(sala.tituloClave),
    });
  };
  repintar();

  const salaBajoPuntero = (ev) => {
    const rect = lienzo.getBoundingClientRect?.() ?? { left: 0, top: 0, width: lienzo.width, height: lienzo.height };
    const escalaX = lienzo.width / (rect.width || 1);
    const escalaY = lienzo.height / (rect.height || 1);
    const punto = { x: (ev.clientX - rect.left) * escalaX, y: (ev.clientY - rect.top) * escalaY };
    // Las mismas medidas con las que se pintó: el grosor del casco lo sabe el
    // lienzo y solo el lienzo, o el ratón acabaría señalando una sala de al lado.
    const celda = celdaEnPunto(
      punto,
      medidas({ ancho: lienzo.width, alto: lienzo.height, rejilla: seccion.rejilla }),
    );
    return salaEnCelda(celda.x, celda.y);
  };

  lienzo.addEventListener?.("mousemove", (ev) => {
    const sala = salaBajoPuntero(ev);
    const id = sala?.id ?? null;
    if (id === foco) return;
    foco = id;
    repintar();
  });
  lienzo.addEventListener?.("mouseleave", () => {
    if (foco === null) return;
    foco = null;
    repintar();
  });
  // El plano es un ATAJO al mismo sitio al que llevan los botones de la lista.
  // Nunca la única forma de llegar: pulsar un rectángulo de veinte píxeles no
  // puede ser el requisito para entrar a una sala.
  lienzo.addEventListener?.("click", (ev) => {
    const sala = salaBajoPuntero(ev);
    if (sala?.destino) alEntrar(sala.id);
  });

  return { repintar };
}

/** Qué pasa al entrar a una sala. La sección no abre nada por su cuenta: se lo
 * pide a quien sí sabe de ventanas, y se aparta. */
function entrar(id, alEntrar) {
  const sala = salaPorId(id);
  if (!sala?.destino) return false;
  alEntrar({
    destino: sala.destino,
    sala: sala.id,
    // Opacos los dos para esta ventana: los transporta tal cual hasta quien
    // sabe abrir cada vista, sin mirarlos ni validarlos.
    estancia: sala.estancia ?? null,
    puesto: sala.puesto ?? null,
  });
  return true;
}

/* ---- v12+ --------------------------------------------------------------- */

export function crearClaseSeccionV2({ leerSistemas, leerPresencias, alEntrar }) {
  const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

  return class SeccionNaveAppV2 extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
      id: "lagunak-seccion-nave",
      classes: ["lagunak-seccion"],
      window: { title: "LAGUNAK.Seccion.Titulo", icon: "fa-solid fa-diagram-project" },
      position: { width: 760, height: "auto" },
    };

    static PARTS = { main: { template: PLANTILLA } };

    async _prepareContext(_options) {
      return contexto({ sistemas: leerSistemas(), presencias: leerPresencias() });
    }

    // Método propio y no un manejador anónimo, por lo mismo que en la cantina:
    // el clic real y el test que ejercita la decisión sin DOM llaman a la misma
    // ruta.
    entrarEnSala(id) {
      if (entrar(id, alEntrar)) this.close();
    }

    _onRender(context, options) {
      super._onRender?.(context, options);
      this.element?.querySelectorAll?.("[data-sala]")?.forEach((boton) => {
        boton.addEventListener("click", () => this.entrarEnSala(boton.dataset.sala));
      });
      this.plano = encenderPlano(this.element, {
        leerSistemas,
        leerPresencias,
        alEntrar: (id) => this.entrarEnSala(id),
      });
    }
  };
}

/* ---- v11 ---------------------------------------------------------------- */

export function crearClaseSeccionV1({ leerSistemas, leerPresencias, alEntrar }) {
  return class SeccionNaveAppV1 extends Application {
    static get defaultOptions() {
      return foundry.utils.mergeObject(super.defaultOptions, {
        id: "lagunak-seccion-nave",
        classes: ["lagunak-seccion"],
        title: game.i18n.localize("LAGUNAK.Seccion.Titulo"),
        template: PLANTILLA,
        width: 760,
        height: "auto",
      });
    }

    getData(_options) {
      return contexto({ sistemas: leerSistemas(), presencias: leerPresencias() });
    }

    entrarEnSala(id) {
      if (entrar(id, alEntrar)) this.close();
    }

    activateListeners(html) {
      super.activateListeners(html);
      html.find("[data-sala]").on("click", (ev) => {
        this.entrarEnSala(ev.currentTarget?.dataset?.sala);
      });
      // En v11 `html` es jQuery: el elemento real está en [0].
      this.plano = encenderPlano(html?.[0], {
        leerSistemas,
        leerPresencias,
        alEntrar: (id) => this.entrarEnSala(id),
      });
    }
  };
}
