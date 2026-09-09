// Panel de sonido con Freesound (#604): buscar, filtrar por licencia libre y
// escuchar sin salir de la mesa. Mismo patrón que la ventana de contenido
// externo (#332) y el token del puente (#183): SOLO GM, y una instancia
// reutilizada entre aperturas en vez de una por clic.
//
// POR QUÉ NO USA `audio-ficheros.mjs` (#571). Ese reproductor exige una
// ficha de procedencia COMPLETA —incluido el sha256, que solo se puede
// calcular sobre el fichero ya descargado— porque está pensado para el
// catálogo de sonidos YA INCORPORADOS al módulo. Un resultado de búsqueda no
// lo está: es la mitad "audicionar" de la frontera que este issue traza, y
// audicionar un preview remoto con un `<audio>` normal del navegador es
// exactamente lo barato que el issue pide, sin fingir una procedencia que
// todavía no existe. `audio-ficheros.mjs` sigue esperando a su consumidor
// real: el mezclador de ambientes de una entrega futura, cuando el sonido ya
// esté incorporado con su ficha completa.
//
// NINGÚN BOTÓN "USAR EN LA ESCENA": lo máximo que ofrece este panel es
// "preparar ficha", que escribe un borrador de procedencia para copiar a un
// PR — nunca toca `assets/` ni el mundo.

import { crearAdaptadorBusquedaSonido, borradorProcedencia } from "./adaptador.mjs";
import { crearProveedorFreesound } from "./proveedor-freesound.mjs";
import { getFreesoundKey, setFreesoundKey, clearFreesoundKey } from "./session.mjs";

let moduloConfigurado = null;
let ventana = null;

export function registrarSonidoFreesound(moduleId) {
  moduloConfigurado = moduleId;
}

/** El adaptador vigente. Se construye EN CADA BÚSQUEDA, como
 *  `adaptadorVigente` en #332: la clave puede cambiar entre una búsqueda y
 *  la siguiente, y cachear el adaptador la congelaría. */
function adaptadorVigente() {
  const proveedor = crearProveedorFreesound({ apiKey: getFreesoundKey });
  return crearAdaptadorBusquedaSonido({ proveedor });
}

/** Contexto de la ventana. Separado del render para poder probarlo sin
 *  Foundry, igual que `contextoContenidoExterno`. */
export function contextoSonidoFreesound(estado) {
  const claveConfigurada = Boolean(getFreesoundKey());
  return {
    claveConfigurada,
    consulta: estado.consulta ?? "",
    buscando: Boolean(estado.buscando),
    mensaje: estado.mensaje ?? "",
    resultados: (estado.resultados ?? []).map((r) => ({
      id: r.id,
      title: r.title,
      author: r.author,
      duration: r.duration,
      licenseCode: r.license.codigo,
      requiereAtribucion: r.license.requiereAtribucion,
      sonando: estado.reproduciendoId === r.id,
      ficha: estado.fichaAbiertaId === r.id ? borradorProcedencia(r) : null,
    })),
  };
}

// No añade herramienta de barra propia: se abre desde el catálogo del panel
// de GM (#448) como el resto de sus entradas — `panel-gm.mjs` declara la
// entrada "sonido" y `main.mjs` la conecta a `abrirSonidoFreesound`.
export function abrirSonidoFreesound() {
  if (!moduloConfigurado || !game.user?.isGM) return;
  ventana ??= new (claseVentana())();
  if (foundry.applications?.api?.ApplicationV2) ventana.render({ force: true });
  else ventana.render(true);
}

function claseVentana() {
  return foundry.applications?.api?.ApplicationV2 ? crearClaseV2() : crearClaseV1();
}

/** Estado mutable compartido entre V1 y V2, para no duplicar la lógica de
 *  acciones — la única diferencia entre ambas clases es cómo se injerta en
 *  Foundry, no lo que hacen los botones. */
function estadoInicial() {
  return {
    consulta: "",
    buscando: false,
    mensaje: "",
    resultados: [],
    reproduciendoId: null,
    fichaAbiertaId: null,
    audioActivo: null,
  };
}

const MENSAJES = Object.freeze({
  "sin-clave": "LAGUNAK.SonidoFreesound.Error.SinClave",
  "sin-proveedor": "LAGUNAK.SonidoFreesound.Error.SinClave",
  network: "LAGUNAK.SonidoFreesound.Error.Red",
  timeout: "LAGUNAK.SonidoFreesound.Error.Red",
  parse: "LAGUNAK.SonidoFreesound.Error.Red",
  http: "LAGUNAK.SonidoFreesound.Error.Http",
});

async function ejecutarBusqueda(app) {
  app.estado.buscando = true;
  app.estado.mensaje = "";
  await app.render();
  const { resultados, error } = await adaptadorVigente().buscar(app.estado.consulta);
  app.estado.buscando = false;
  app.estado.resultados = resultados;
  app.estado.reproduciendoId = null;
  app.estado.fichaAbiertaId = null;
  if (error) {
    app.estado.mensaje = game.i18n.localize(MENSAJES[error] ?? "LAGUNAK.SonidoFreesound.Error.Red");
  } else if (resultados.length === 0) {
    app.estado.mensaje = game.i18n.localize("LAGUNAK.SonidoFreesound.SinResultados");
  }
  await app.render();
}

function pararPreview(app) {
  app.estado.audioActivo?.pause?.();
  app.estado.audioActivo = null;
  app.estado.reproduciendoId = null;
}

async function alternarPreview(app, id) {
  const resultado = app.estado.resultados.find((r) => r.id === id);
  if (!resultado) return;
  if (app.estado.reproduciendoId === id) {
    pararPreview(app);
    await app.render();
    return;
  }
  pararPreview(app);
  const audio = new Audio(resultado.previewUrl);
  audio.addEventListener("ended", () => {
    if (app.estado.reproduciendoId === id) {
      app.estado.reproduciendoId = null;
      app.estado.audioActivo = null;
      app.render();
    }
  });
  app.estado.audioActivo = audio;
  app.estado.reproduciendoId = id;
  await app.render();
  audio.play().catch(() => {
    // Autoplay bloqueado o red caída a mitad de preview: no rompe la
    // ventana, simplemente se queda sin sonar.
    if (app.estado.reproduciendoId === id) {
      app.estado.reproduciendoId = null;
      app.estado.audioActivo = null;
      app.render();
    }
  });
}

async function alternarFicha(app, id) {
  app.estado.fichaAbiertaId = app.estado.fichaAbiertaId === id ? null : id;
  await app.render();
}

async function guardarClave(app, value) {
  if (!setFreesoundKey(value)) {
    ui.notifications.warn(game.i18n.localize("LAGUNAK.SonidoFreesound.ClaveVacia"));
    return;
  }
  ui.notifications.info(game.i18n.localize("LAGUNAK.SonidoFreesound.ClaveGuardada"));
  await app.render();
}

async function borrarClave(app) {
  clearFreesoundKey();
  pararPreview(app);
  app.estado.resultados = [];
  ui.notifications.info(game.i18n.localize("LAGUNAK.SonidoFreesound.ClaveBorrada"));
  await app.render();
}

function crearClaseV2() {
  const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
  return class SonidoFreesoundV2 extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
      id: "lagunak-sonido-freesound",
      classes: ["lagunak-sonido-freesound"],
      window: { title: "LAGUNAK.SonidoFreesound.Titulo", icon: "fa-solid fa-volume-high" },
      position: { width: 560, height: "auto" },
      actions: {
        guardarClave: async function () {
          const value = this.element?.querySelector?.('[name="freesound-key"]')?.value ?? "";
          await guardarClave(this, value);
        },
        borrarClave: async function () {
          await borrarClave(this);
        },
        buscar: async function () {
          this.estado.consulta = this.element?.querySelector?.('[name="freesound-query"]')?.value ?? "";
          await ejecutarBusqueda(this);
        },
        escuchar: async function (_event, target) {
          await alternarPreview(this, Number(target?.dataset?.id));
        },
        prepararFicha: async function (_event, target) {
          await alternarFicha(this, Number(target?.dataset?.id));
        },
      },
    };

    static PARTS = {
      main: { template: `modules/${moduloConfigurado}/templates/sonido-freesound.hbs` },
    };

    constructor(...args) {
      super(...args);
      this.estado = estadoInicial();
    }

    async _prepareContext() {
      return contextoSonidoFreesound(this.estado);
    }

    _onClose(options) {
      pararPreview(this);
      if (ventana === this) ventana = null;
      super._onClose?.(options);
    }
  };
}

function crearClaseV1() {
  return class SonidoFreesoundV1 extends Application {
    static get defaultOptions() {
      return foundry.utils.mergeObject(super.defaultOptions, {
        id: "lagunak-sonido-freesound",
        classes: ["lagunak-sonido-freesound"],
        template: `modules/${moduloConfigurado}/templates/sonido-freesound.hbs`,
        width: 560,
        height: "auto",
        resizable: true,
      });
    }

    constructor(...args) {
      super(...args);
      this.estado = estadoInicial();
    }

    get title() {
      return game.i18n.localize("LAGUNAK.SonidoFreesound.Titulo");
    }

    getData() {
      return contextoSonidoFreesound(this.estado);
    }

    activateListeners(html) {
      super.activateListeners(html);
      html.find('[data-action="guardarClave"]').on("click", async () => {
        await guardarClave(this, html.find('[name="freesound-key"]').val());
      });
      html.find('[data-action="borrarClave"]').on("click", async () => {
        await borrarClave(this);
      });
      html.find('[data-action="buscar"]').on("click", async () => {
        this.estado.consulta = html.find('[name="freesound-query"]').val();
        await ejecutarBusqueda(this);
      });
      html.find('[data-action="escuchar"]').on("click", async (event) => {
        await alternarPreview(this, Number(event.currentTarget?.dataset?.id));
      });
      html.find('[data-action="prepararFicha"]').on("click", async (event) => {
        await alternarFicha(this, Number(event.currentTarget?.dataset?.id));
      });
    }

    async close(options) {
      pararPreview(this);
      const result = await super.close(options);
      if (ventana === this) ventana = null;
      return result;
    }
  };
}
