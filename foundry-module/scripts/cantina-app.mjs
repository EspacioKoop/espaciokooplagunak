/* Ventana de la cantina (#423): la puerta única de la que cuelgan las mesas
 * sociales. No decide autoridad ni estado — eso lo sigue haciendo cada mesa
 * por su cuenta cuando se abre. Esta ventana solo traduce un clic en "abre
 * esa mesa" y se cierra: la sala pinta, no decide.
 *
 * Dos clases hermanas, como el resto del módulo (`mesa-poker-app.mjs`):
 * `Application` clásica en v11 y `ApplicationV2` en v12+, sin código
 * compartido entre ellas a propósito.
 */

import { MODULE_ID } from "./lagunak-constantes.mjs";
import { puertasCantina } from "./cantina.mjs";
import { arrancarCantina, miradaDesdePunto, miradaTrasTecla } from "./cantina-lienzo.mjs";

const PLANTILLA = `modules/${MODULE_ID}/templates/cantina.hbs`;

function contexto() {
  return {
    puertas: puertasCantina().map((puerta) => ({
      id: puerta.id,
      icono: puerta.icono,
      objeto: puerta.objeto,
      titulo: game.i18n.localize(puerta.tituloClave),
    })),
  };
}

/**
 * Enciende la sala dentro de una raíz ya renderizada y devuelve el mando (o
 * `null` si aquí no hay DOM que pintar, como en el arnés de pruebas).
 *
 * Vive fuera de las dos clases a propósito, igual que `enfocarPrimeraPuerta`:
 * es cableado de DOM, no comportamiento de ventana, y duplicarlo entre v11 y
 * v12+ solo aseguraría que un día el arreglo llegue a una sola de las dos.
 */
function encenderSala(raiz) {
  const sala = raiz?.querySelector?.(".lagunak-cantina-sala");
  if (!sala) return null;

  const objetos = [...(raiz.querySelectorAll?.("[data-objeto]") ?? [])].map((lienzo) => ({
    lienzo,
    objeto: lienzo.dataset?.objeto,
  }));

  // Respetar `prefers-reduced-motion` no es un extra: una sala que se mueve
  // sola es exactamente lo que esa preferencia existe para apagar (#227).
  const reducirMovimiento = Boolean(
    globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches,
  );

  // Sin `requestAnimationFrame` no hay bucle, y eso es todo lo que pasa: se
  // pinta un fotograma y la sala se queda quieta. Llamarlo a ciegas tiraba la
  // ventana ENTERA —puertas incluidas— en cualquier entorno que no lo tenga, y
  // una sala que no gira sigue siendo una sala; una cantina que no abre, no.
  const puedeAnimar = typeof globalThis.requestAnimationFrame === "function";
  const mando = arrancarCantina(
    { sala, objetos },
    {
      reducirMovimiento,
      ahora: () => globalThis.performance?.now?.() ?? Date.now(),
      pedirFotograma: puedeAnimar ? (cb) => globalThis.requestAnimationFrame(cb) : null,
      cancelarFotograma: puedeAnimar ? (id) => globalThis.cancelAnimationFrame(id) : null,
    },
  );

  // Asomarse con el ratón. Se escucha sobre la SALA y no sobre la ventana
  // entera: mover el ratón hacia los botones no debería estar moviendo también
  // la cámara, que es lo que hace que una escena se sienta nerviosa.
  sala.addEventListener("mousemove", (ev) => {
    mando.mirar(miradaDesdePunto({ x: ev.clientX, y: ev.clientY }, sala.getBoundingClientRect()));
  });
  // Al salir, la sala vuelve al centro: quedarse torcida porque el ratón se fue
  // por una esquina deja la cámara en una postura que nadie eligió.
  sala.addEventListener("mouseleave", () => mando.mirar({ x: 0, y: 0 }));

  // Y con el teclado, porque asomarse no puede ser solo de quien usa ratón. La
  // sala es focalizable para poder recibir las flechas, y su `tabindex` va aquí
  // y no en la plantilla: sin lienzo no hay nada que enfocar, y un `tabindex`
  // en la plantilla dejaría una parada de tabulación vacía.
  sala.tabIndex = 0;
  let miradaTeclado = { x: 0, y: 0 };
  sala.addEventListener("keydown", (ev) => {
    const siguiente = miradaTrasTecla(miradaTeclado, ev.key);
    if (!siguiente) return;
    // Solo se consume la tecla que se usa: las demás siguen su camino, que es
    // como se sigue pudiendo tabular fuera de aquí.
    ev.preventDefault();
    miradaTeclado = siguiente;
    mando.mirar(siguiente);
  });

  // El objeto de la puerta que se enfoca gira más rápido y se inclina. Vale
  // para ratón y para teclado sin escribir dos caminos: `focus`/`blur` los
  // disparan los dos, y `mouseenter` solo añade el hover.
  for (const boton of raiz.querySelectorAll?.("[data-puerta]") ?? []) {
    const objeto = boton.querySelector?.("[data-objeto]")?.dataset?.objeto ?? null;
    boton.addEventListener("mouseenter", () => mando.enfocar(objeto));
    boton.addEventListener("focus", () => mando.enfocar(objeto));
    boton.addEventListener("mouseleave", () => mando.enfocar(null));
    boton.addEventListener("blur", () => mando.enfocar(null));
  }

  return mando;
}

/* Al abrir la sala, el foco va a la primera puerta. Quien navega con teclado no
 * tiene por qué recorrer el marco de la ventana para llegar a lo único que la
 * cantina ofrece; y quien usa ratón no nota nada, porque `:focus-visible` solo
 * pinta el anillo cuando el foco llegó por teclado. Sin DOM (arnés de pruebas)
 * no hay nada que enfocar y la función calla. */
function enfocarPrimeraPuerta(raiz) {
  raiz?.querySelector?.("[data-puerta]")?.focus?.();
}

/* ---- v12+ --------------------------------------------------------------- */

export function crearClaseCantinaV2({ alSeleccionar }) {
  const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

  return class CantinaAppV2 extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
      id: "lagunak-cantina",
      classes: ["lagunak-cantina"],
      window: { title: "LAGUNAK.Cantina.Titulo", icon: "fa-solid fa-mug-saucer" },
      position: { width: 560, height: "auto" },
    };

    static PARTS = { main: { template: PLANTILLA } };

    async _prepareContext(_options) {
      return contexto();
    }

    // Método propio y no un manejador anónimo: así el clic real y el test que
    // ejercita la decisión sin DOM (el arnés de `main-compat.test.mjs` no
    // simula clics dentro de una ventana) llaman a la misma ruta.
    seleccionarPuerta(id) {
      if (!id) return;
      alSeleccionar(id);
      this.close();
    }

    _onRender(context, options) {
      super._onRender?.(context, options);
      this.element?.querySelectorAll?.("[data-puerta]")?.forEach((boton) => {
        boton.addEventListener("click", () => this.seleccionarPuerta(boton.dataset.puerta));
      });
      // Una ventana que se repinta arranca OTRA sala: la anterior se para o
      // se quedan dos bucles pintando sobre el mismo lienzo.
      this.sala?.detener();
      this.sala = encenderSala(this.element);
      enfocarPrimeraPuerta(this.element);
    }

    _onClose(options) {
      super._onClose?.(options);
      // Sin esto, cerrar la cantina deja un `requestAnimationFrame` vivo
      // pintando contra un lienzo que ya no está en el documento.
      this.sala?.detener();
      this.sala = null;
    }
  };
}

/* ---- v11 ---------------------------------------------------------------- */

export function crearClaseCantinaV1({ alSeleccionar }) {
  return class CantinaAppV1 extends Application {
    static get defaultOptions() {
      return foundry.utils.mergeObject(super.defaultOptions, {
        id: "lagunak-cantina",
        classes: ["lagunak-cantina"],
        title: game.i18n.localize("LAGUNAK.Cantina.Titulo"),
        template: PLANTILLA,
        width: 560,
        height: "auto",
      });
    }

    getData(_options) {
      return contexto();
    }

    seleccionarPuerta(id) {
      if (!id) return;
      alSeleccionar(id);
      this.close();
    }

    async close(options) {
      this.sala?.detener();
      this.sala = null;
      return super.close(options);
    }

    activateListeners(html) {
      super.activateListeners(html);
      html.find("[data-puerta]").on("click", (ev) => {
        this.seleccionarPuerta(ev.currentTarget?.dataset?.puerta);
      });
      // En v11 `html` es jQuery: el elemento real está en [0].
      this.sala?.detener();
      this.sala = encenderSala(html?.[0]);
      enfocarPrimeraPuerta(html?.[0]);
    }
  };
}
