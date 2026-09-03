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
import { arrancarCantina } from "./cantina-lienzo.mjs";
import { avatarDeUsuario } from "./avatar/avatar-assignment.mjs";

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
 * Quién está presente en la cantina, con el avatar que cada cual eligió
 * (`avatar-assignment.mjs`, #450) — el mismo molde que `stationRows` usa
 * para la tripulación (`station-assignment.mjs`), pero para el aspecto en
 * vez del puesto. Sin usuarios jugadores conectados (arnés de pruebas, mesa
 * vacía) devuelve una lista vacía: la sala se pinta igual, solo que sin
 * nadie dentro — nunca se inventa gente para no dejarla "vacía de verdad".
 *
 * El GM se excluye a propósito, igual que `visibleCrew`: dirige la partida,
 * no está sentado en la cantina.
 */
export function gentePresente(moduleId) {
  const usuarios = Array.from(game?.users ?? []).filter(
    (user) => !user.isGM && user.active,
  );
  return usuarios.map((user) => ({ id: user.id, ...avatarDeUsuario(user, moduleId) }));
}

/**
 * Enciende la sala dentro de una raíz ya renderizada y devuelve el mando (o
 * `null` si aquí no hay DOM que pintar, como en el arnés de pruebas).
 *
 * Vive fuera de las dos clases a propósito, igual que `enfocarPrimeraPuerta`:
 * es cableado de DOM, no comportamiento de ventana, y duplicarlo entre v11 y
 * v12+ solo aseguraría que un día el arreglo llegue a una sola de las dos.
 */
function encenderSala(raiz, alSeleccionar) {
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
    { sala, objetos, gente: gentePresente(MODULE_ID), yo: game.user?.id ?? null },
    {
      reducirMovimiento,
      ahora: () => globalThis.performance?.now?.() ?? Date.now(),
      pedirFotograma: puedeAnimar ? (cb) => globalThis.requestAnimationFrame(cb) : null,
      cancelarFotograma: puedeAnimar ? (id) => globalThis.cancelAnimationFrame(id) : null,
    },
  );

  // El puntero solo SEÑALA: resalta la opción que hay debajo. La cámara está
  // autorada y no se mueve con el ratón — mover el encuadre a mano deshacía la
  // composición de cada plano, que es justo lo que los planos existen para
  // proteger.
  const puntoDelLienzo = (ev) => {
    const rect = sala.getBoundingClientRect();
    const escalaX = sala.width / (rect.width || 1);
    const escalaY = sala.height / (rect.height || 1);
    return { x: (ev.clientX - rect.left) * escalaX, y: (ev.clientY - rect.top) * escalaY };
  };
  const buscar = (ev) => {
    const p = puntoDelLienzo(ev);
    return mando
      .opciones()
      .reduce(
        (mejor, opcion) => {
          const d = Math.hypot(opcion.x - p.x, opcion.y - p.y);
          return d < mejor.d && d <= 26 ? { opcion, d } : mejor;
        },
        { opcion: null, d: Infinity },
      ).opcion;
  };

  // Los botones de plano. Se repintan en cada corte porque las opciones son
  // del plano, no de la ventana.
  const barra = raiz.querySelector?.(".lagunak-cantina-acciones");
  const refrescarAcciones = ({ trasCorte = false } = {}) => {
    // Sin DOM completo —arnés de pruebas, host raro— no hay botones y ya está:
    // la sala se sigue pintando y los puntos sobre ella siguen siendo pulsables.
    // Perder los botones es aceptable; tirar el encendido de la sala, no.
    if (typeof barra?.replaceChildren !== "function") return;
    if (typeof raiz.ownerDocument?.createElement !== "function") return;

    // Rehacer los botones destruye el que tuviera el foco, y el foco se cae al
    // `<body>`. Quien recorre la sala con teclado moviéndose de plano en plano
    // perdía el foco EN CADA movimiento y tenía que volver tabulando: la ruta
    // accesible existía y era impracticable, que es la peor de las dos formas
    // de no tenerla.
    const indicePrevio = [...barra.children].indexOf(raiz.ownerDocument.activeElement);
    barra.replaceChildren();
    mando.opciones().forEach((opcion, i) => {
      const boton = raiz.ownerDocument.createElement("button");
      boton.type = "button";
      boton.className = "lagunak-cantina-accion";
      // El número es el atajo de teclado, y va delante para que se vea que lo
      // tiene: un atajo que no se anuncia no lo usa nadie.
      boton.textContent = `${i + 1}. ${game.i18n.localize(opcion.etiqueta)}`;
      boton.addEventListener("click", () => {
        elegir(opcion, mando, alSeleccionar);
        refrescarAcciones();
      });
      boton.addEventListener("mouseenter", () => mando.resaltar(opcion));
      boton.addEventListener("focus", () => mando.resaltar(opcion));
      boton.addEventListener("mouseleave", () => mando.resaltar(null));
      boton.addEventListener("blur", () => mando.resaltar(null));
      barra.append(boton);
    });

    if (indicePrevio < 0) return;
    // Tras un corte las opciones son OTRAS —son del plano, no de la ventana—,
    // así que conservar la posición dejaría el foco en algo que no tiene nada
    // que ver con lo que se acaba de pulsar; se va a la primera del plano
    // nuevo. Sin corte, la lista es la misma y el sitio se conserva.
    const botones = [...barra.children];
    const destino = trasCorte
      ? botones[0]
      : botones[Math.min(indicePrevio, botones.length - 1)];
    // Un plano sin opciones no puede tragarse el foco: cae en la sala, que es
    // tabulable y desde donde 1..9 siguen funcionando.
    (destino ?? sala).focus?.();
  };
  mando.alCortar(() => refrescarAcciones({ trasCorte: true }));
  refrescarAcciones();

  sala.addEventListener("mousemove", (ev) => {
    const opcion = buscar(ev);
    sala.style.cursor = opcion ? "pointer" : "default";
    mando.resaltar(opcion);
  });
  sala.addEventListener("mouseleave", () => mando.resaltar(null));

  sala.addEventListener("click", (ev) => {
    elegir(buscar(ev), mando, alSeleccionar);
    refrescarAcciones();
  });

  // Y con teclado: 1..9 recorren las opciones del plano, que es lo que hace que
  // esto no sea solo de ratón. Tab sigue tabulando fuera de la sala.
  sala.tabIndex = 0;
  sala.addEventListener("keydown", (ev) => {
    const n = Number.parseInt(ev.key, 10);
    if (!Number.isInteger(n) || n < 1) return;
    const opcion = mando.opciones()[n - 1];
    if (!opcion) return;
    ev.preventDefault();
    elegir(opcion, mando, alSeleccionar);
    refrescarAcciones();
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

/** Qué pasa al elegir una opción del plano: o te lleva a otro sitio de la sala,
 * o abre la mesa. Nada más — la cantina sigue sin decidir nada del juego. */
function elegir(opcion, mando, alSeleccionar) {
  if (!opcion) return;
  if (opcion.tipo === "ir") mando.cortarA(opcion.destino);
  else if (opcion.tipo === "jugar") alSeleccionar(opcion.puerta, { sentarse: true });
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
      position: { width: 700, height: "auto" },
    };

    static PARTS = { main: { template: PLANTILLA } };

    async _prepareContext(_options) {
      return contexto();
    }

    // Método propio y no un manejador anónimo: así el clic real y el test que
    // ejercita la decisión sin DOM (el arnés de `main-compat.test.mjs` no
    // simula clics dentro de una ventana) llaman a la misma ruta.
    seleccionarPuerta(id, opciones = {}) {
      if (!id) return;
      alSeleccionar(id, opciones);
      this.close();
    }

    _onRender(context, options) {
      super._onRender?.(context, options);
      this.element?.querySelectorAll?.("[data-puerta]")?.forEach((boton) => {
        boton.addEventListener("click", () =>
          this.seleccionarPuerta(boton.dataset.puerta, {
            sentarse: boton.dataset.sentarse === "1",
          }),
        );
      });
      // Una ventana que se repinta arranca OTRA sala: la anterior se para o
      // se quedan dos bucles pintando sobre el mismo lienzo.
      this.sala?.detener();
      // El punto "jugar" del plano pasa por `seleccionarPuerta`, la misma
      // ruta que los botones de la lista: las dos formas de sentarse deben
      // cerrar la cantina igual, porque no hay estado que conservar entre
      // una visita y la siguiente (ver `abrirCantina` en `main.mjs`) — dejar
      // el plano abierto detrás de la mesa solo deja un lienzo pintando para
      // nadie.
      this.sala = encenderSala(this.element, (id, opciones) => this.seleccionarPuerta(id, opciones));
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
        width: 700,
        height: "auto",
      });
    }

    getData(_options) {
      return contexto();
    }

    seleccionarPuerta(id, opciones = {}) {
      if (!id) return;
      alSeleccionar(id, opciones);
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
        this.seleccionarPuerta(ev.currentTarget?.dataset?.puerta, {
          sentarse: ev.currentTarget?.dataset?.sentarse === "1",
        });
      });
      // En v11 `html` es jQuery: el elemento real está en [0].
      this.sala?.detener();
      // Misma razón que en v12+: el punto "jugar" del plano cierra la
      // cantina igual que los botones de la lista.
      this.sala = encenderSala(html?.[0], (id, opciones) => this.seleccionarPuerta(id, opciones));
      enfocarPrimeraPuerta(html?.[0]);
    }
  };
}
