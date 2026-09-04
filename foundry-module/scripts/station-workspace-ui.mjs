import { BridgeClient, BridgeError } from "./bridge-client.mjs";
import { getBridgeToken } from "./bridge-token-session.mjs";
import { openStationApp } from "./station-ui.mjs";
import { buildWorkspaceModel, stationForWorkspace } from "./station-workspaces.mjs";
import { normalizarBaseDatos } from "./base-datos-cientifica.mjs";
import { emitWorkspaceOrder } from "./station-order-wiring.mjs";
import { ORDER_FORMS } from "./station-order-forms.mjs";
import {
  AJUSTE_BASE_DATOS,
  AJUSTE_TELEMETRIA,
  aceptarSensores,
  aceptarSensoresSonda,
  aceptarTelemetria,
  difundirTelemetria,
  esMasReciente,
} from "./ship-view/telemetria-difusion.mjs";
import { pintarEscena, pintarNave } from "./retro3d-lienzo.mjs";
import { desmontarLamina, montarLaminaContacto } from "./lamina-contacto.mjs";
import { pintarVisorPiloto } from "./visor-piloto-lienzo.mjs";
import { CASCO_POR_DEFECTO, mallaDesdeCasco } from "./retro3d.mjs";
import { componerCascoPorDano } from "./ship-view/casco-dano.mjs";
import { PIXEL } from "./paleta.mjs";
import { anadirHerramienta } from "./control-escena.mjs";

let configuredModuleId = null;
let workspaceApp = null;

export function registerWorkspaceFeature(moduleId) {
  configuredModuleId = moduleId;
  Hooks.on("updateUser", () => renderWorkspace());
  Hooks.on("userConnected", () => renderWorkspace());

  // Recepción de la telemetría que publica el GM (#331). Llega por el ajuste de
  // mundo, no por socket: `game.socket` no acredita a quien emite y cualquier
  // cliente podía mandar una nave inventada —y, con un sello en el futuro, dejar
  // la consola clavada en ella—. Un ajuste de mundo solo lo escribe un GM, y esa
  // comprobación la hace el servidor.
  Hooks.on("updateSetting", (ajuste) => {
    if (!ajuste?.key?.endsWith?.(`.${AJUSTE_TELEMETRIA}`)) return;
    recibirTelemetria();
  });
}

/** Aplica la última telemetría publicada a la consola abierta. */
function recibirTelemetria() {
  const app = workspaceApp;
  if (!app || app.closed || !configuredModuleId) return;
  const sobre = game.settings?.get?.(configuredModuleId, AJUSTE_TELEMETRIA) ?? null;
  const ship = aceptarTelemetria(sobre);
  if (!ship) return;
  const sensores = aceptarSensores(sobre);
  const sensoresSonda = aceptarSensoresSonda(sobre);
  // Fuera de orden se descarta: dos escrituras seguidas pueden llegar cruzadas y
  // la consola parpadearía hacia atrás, que en un rumbo se ve como una sacudida.
  if (!esMasReciente(sobre, app.selloTelemetria)) return;
  app.selloTelemetria = sobre.sello;
  // El GM conserva su propio sondeo como fuente: tiene los contactos SIN
  // degradar, y pisarlo con el sobre recortado le quitaría precisión a quien
  // dirige la escena.
  if (!game.user?.isGM) {
    app.statePayload = { ship };
    app.sensores = sensores;
    app.sensoresSonda = sensoresSonda;
    // La tripulación no tiene token: la base de datos le llega por el ajuste
    // que publica el GM. `null` sigue siendo "sin consultar".
    app.baseDatos = game.settings?.get?.(configuredModuleId, AJUSTE_BASE_DATOS) ?? null;
    app.connection = "ok";
    app.error = "";
  }
  renderWorkspace();
}

export function addWorkspaceControl(controls) {
  const tool = {
    name: "lagunak-espacio-puesto",
    title: "LAGUNAK.Controles.AbrirEspacio",
    icon: "fa-solid fa-display",
    button: true,
    onClick: () => openWorkspaceApp(),
  };

  anadirHerramienta(controls, tool);
}

export function openWorkspaceApp(previewStation = null) {
  if (!configuredModuleId) return;
  workspaceApp ??= new (workspaceAppClass())();
  if (previewStation && game.user?.isGM) workspaceApp.setPreviewStation(previewStation);
  renderWorkspace(true);
}

export async function revokeWorkspaceAccess() {
  const app = workspaceApp;
  if (!app) return;
  app.statePayload = null;
  app.contactsPayload = null;
  app.connection = "restricted";
  const root = app.element?.[0] ?? app.element;
  root?.replaceChildren?.();
  releaseWorkspaceApp(app);
  try {
    await app.close();
  } catch {
    // Datos, referencia y DOM ya están revocados aunque Foundry no cierre.
  }
}

function esAppV2() {
  return Boolean(foundry.applications?.api?.ApplicationV2);
}

function raizDe(app) {
  return app?.element?.[0] ?? app?.element ?? null;
}

// Un refresco no forzado solo es seguro si la consola sigue montada y quieta:
// `rendered` puede seguir a true mientras Foundry desmonta el elemento o
// mientras un _render asíncrono anterior sigue en vuelo, y un updateUser en ese
// hueco reproduce el TypeError de #263. La apertura usa force=true.
function puedeRefrescar(app) {
  if (!app.rendered) return false;
  if (globalThis.document && !raizDe(app)?.isConnected) return false;
  const estados = globalThis.Application?.RENDER_STATES;
  return !(estados && app._state === estados.RENDERING);
}

function renderWorkspace(force = false) {
  const app = workspaceApp;
  if (!app) return;
  if (!force && !puedeRefrescar(app)) return;
  if (esAppV2()) app.render({ force: true });
  else app.render(force);
}

function workspaceAppClass() {
  return foundry.applications?.api?.ApplicationV2 ? createV2Class() : createV1Class();
}

function bridgeClient() {
  return new BridgeClient({
    url: game.settings.get(configuredModuleId, "bridgeUrl"),
    token: getBridgeToken(),
  });
}

function workspaceContext(app) {
  let station = null;
  try {
    station = stationForWorkspace({
      user: game.user,
      moduleId: configuredModuleId,
      previewStation: app.previewStation,
    });
  } catch {
    station = null;
  }

  // Se guarda el modelo del último render para que el pintor del casco lo tenga
  // al enganchar el DOM: la plantilla ya se ha resuelto para entonces y el
  // contexto no llega a `_onRender`.
  app.ultimoModelo = buildWorkspaceModel({
    station,
    isGM: Boolean(game.user?.isGM),
    users: game.users,
    moduleId: configuredModuleId,
    i18n: game.i18n,
    statePayload: app.statePayload,
    contactsPayload: app.contactsPayload,
    // Contactos degradados que llegaron por difusión (#331 paso 3). Solo los
    // tiene la tripulación: el GM usa su propio sondeo, que es más preciso.
    sensores: app.sensores,
    // Vista de sonda (#520): la misma lectura degradada con otro centro.
    sensoresSonda: app.sensoresSonda ?? null,
    // Base de datos científica (#520). Se pide UNA vez al abrir la consola y no
    // en el bucle de sondeo: es contenido de referencia casi inmóvil, y
    // repetirlo cada ciclo reenviaría siempre lo mismo.
    baseDatos: app.baseDatos ?? null,
    connection: app.connection,
    error: app.error,
  });
  return app.ultimoModelo;
}

/**
 * Pide la base de datos científica UNA vez y la difunde a la mesa (#520).
 *
 * Fuera del bucle de sondeo a propósito: es contenido de referencia casi
 * inmóvil, y repetirlo cada ciclo reenviaría siempre lo mismo. Si falla se
 * queda en `null` —«sin consultar»— y no en una lista vacía, que diría que el
 * escenario no trae fichas.
 */
async function cargarBaseDatos(app, client) {
  if (!game.user?.isGM || app.baseDatos || app.cargandoBaseDatos) return;
  app.cargandoBaseDatos = true;
  try {
    const payload = await client.database();
    // Se revalida el rol DESPUÉS del await, igual que `refreshTelemetry`: quien
    // deja de ser GM mientras la consulta viaja no debe publicar al volver. El
    // servidor rechazaría el `settings.set` de un no-GM, así que esto es defensa
    // en profundidad (ADR-0011) y no la única barrera — pero sin ello las dos
    // funciones hermanas se comportaban distinto ante la misma revocación.
    if (app.closed || !game.user?.isGM) return;
    app.baseDatos = normalizarBaseDatos(payload);
    if (app.baseDatos && configuredModuleId) {
      // Se publica para que la tripulación de sensores la vea: no tienen token
      // con el que pedirla. No lleva nada sensible —son fichas de escenario— y
      // por eso va en su propio ajuste y no dentro del sobre de telemetría, que
      // se reescribe cada sondeo.
      await game.settings?.set?.(configuredModuleId, AJUSTE_BASE_DATOS, app.baseDatos);
    }
    renderWorkspace();
  } catch {
    // Silencio deliberado: la consola ya dice "sin consultar", que es la
    // verdad. Un aviso por una consulta opcional que falló sería ruido.
  } finally {
    app.cargandoBaseDatos = false;
  }
}

async function refreshTelemetry(app) {
  if (!game.user?.isGM || app.loading || app.closed) return false;

  app.loading = true;
  app.connection = "loading";
  app.error = "";
  renderWorkspace();

  try {
    const client = bridgeClient();
    // La base de datos se pide con el MISMO cliente y NO se espera: es una
    // consulta opcional que no debe retrasar la telemetría, que sí es lo que la
    // mesa mira cada segundo. `cargarBaseDatos` no repite si ya la tiene.
    cargarBaseDatos(app, client);
    const [statePayload, contactsPayload] = await Promise.all([
      client.state(),
      client.contacts(),
    ]);
    if (app.closed || !game.user?.isGM) return false;
    app.statePayload = statePayload;
    app.contactsPayload = contactsPayload;
    app.connection = "ok";
    // La tripulación no puede sondear el puente —no tiene token— así que el GM
    // reparte lo que acaba de recibir (#331). La nave propia entera y los
    // contactos YA degradados por el alcance del radar (paso 3): el crudo entra
    // en `difundirTelemetria` y de ahí no sale, que es lo que hace que degradar
    // signifique algo.
    // Publicar es escribir un ajuste de mundo, y eso solo lo puede hacer un GM:
    // la autorización la impone el servidor, no este `if`.
    const publicado = difundirTelemetria({
      statePayload,
      contactsPayload,
      anterior: game.settings?.get?.(configuredModuleId, AJUSTE_TELEMETRIA) ?? null,
      publicar: (sobre) => game.settings?.set?.(configuredModuleId, AJUSTE_TELEMETRIA, sobre),
    });
    if (publicado) app.selloTelemetria = publicado.sello;
    return true;
  } catch (error) {
    if (app.closed) return false;
    app.connection = "error";
    app.error = error instanceof BridgeError
      ? error.message
      : game.i18n.localize("LAGUNAK.Errores.Desconocido");
    return false;
  } finally {
    app.loading = false;
    if (!app.closed) renderWorkspace();
  }
}

function actionFromEvent(event) {
  return event?.currentTarget?.dataset?.workspaceAction ?? null;
}

function submitStationOrder(app, spec) {
  const root = app.element?.[0] ?? app.element;
  const params = spec.read(root);
  if (!params) {
    ui.notifications?.warn?.(game.i18n.localize(spec.invalidKey));
    return;
  }
  emitWorkspaceOrder({ action: spec.action, params });
  ui.notifications?.info?.(game.i18n.localize("LAGUNAK.Espacios.Orden.Enviada"));
}

async function handleWorkspaceAction(app, event) {
  const action = actionFromEvent(event);
  if (action === "refresh") return refreshTelemetry(app);
  if (action === "assignments") return openStationApp();
  if (ORDER_FORMS[action]) return submitStationOrder(app, ORDER_FORMS[action]);
  return undefined;
}

// Casco propio en 3D (#362, rebanada 3).
//
// Se pinta UNA vez por render y no en un bucle: el rumbo solo cambia cuando
// llega telemetría, y la telemetría ya provoca un render. Un bucle de animación
// aquí gastaría fotogramas para repetir el mismo dibujo, y habría que acordarse
// de pararlo al cerrar.
//
// Y no gira por decorar. Sin lectura de rumbo la nave se queda QUIETA, con la
// misma regla que los iconos de sistema (#353): ausencia no es cero. Un casco
// girando alegremente en el puente mientras la nave real mantiene el rumbo sería
// una mentira pequeña, pero en una consola de mando no hay mentiras pequeñas.
const MALLA_PROPIA = mallaDesdeCasco(CASCO_POR_DEFECTO);
const SEMILLA_CIELO_PUENTE = 20362;

function pintarCascoPropio(root, modelo) {
  const lienzo = root?.querySelector?.("[data-lagunak-casco]");
  if (!lienzo) return null;
  const rumbo = modelo?.cascoRumbo;
  const hayLectura = Number.isFinite(rumbo);
  const opciones = {
    malla: MALLA_PROPIA,
    // La nave propia lleva el crema reservado del mapa vivo: es la misma nave y
    // se toma de la paleta, no se elige aquí.
    color: hayLectura ? PIXEL.naveJugador : PIXEL.sinFaccion,
    // Rumbo del mundo a giro del visor. Sin lectura, morro al frente y quieta.
    yaw: hayLectura ? (rumbo * Math.PI) / 180 : 0,
    // Ingeniería mira la cubierta superior: ahí están lomo y alas, las regiones
    // que separan reactor, armas y maniobra. Los demás puestos conservan la
    // perspectiva inferior que ya usaban antes de #419.
    pitch: modelo?.station === "engineering" ? -0.42 : 0.42,
    posicion: [0, 0, 4.4],
    fov: 55,
    // Cielo fijo (#384): la semilla es constante a propósito. El puente es
    // siempre el mismo sitio y las estrellas de fuera no cambian porque se
    // vuelva a abrir la consola; una semilla variable haría parpadear el
    // universo entero en cada render.
    cielo: { semilla: SEMILLA_CIELO_PUENTE },
  };
  const escena = pintarNave(lienzo, opciones);

  // Solo ingeniería colorea el casco por región (#419). Las demás consolas
  // conservan la nave propia crema/gris, y la matriz textual de sistemas sigue
  // siendo el canal informativo y accesible. `pintarNave` prepara también el
  // cielo estable; sustituimos únicamente sus polígonos y pintamos el conjunto
  // una vez más para conservar ese cielo sin duplicar el motor 3D.
  if (escena && modelo?.station === "engineering") {
    const regional = componerCascoPorDano(MALLA_PROPIA, modelo.systems, {
      ...opciones,
      ancho: lienzo.width,
      alto: lienzo.height,
      // Feedback 3D de la reparación automática (#464/#466): las regiones
      // dañadas cambian de color cuando la tripulación la activa.
      autoRepairActivo: modelo?.autoRepairActivo === true,
    });
    escena.poligonos = regional.poligonos;
    pintarEscena(lienzo.getContext?.("2d"), escena);
  }
  return escena;
}

// Lámina del objetivo de atraque (#391, rebanada 6 de #362).
//
// Reutiliza entera la lámina del contacto: mismo pipeline, misma tabla de cascos
// por clase, mismo cielo. Lo único propio es CUÁNDO existe —solo mientras hay
// atraque— y que no depende de una selección: el objetivo lo dice el juego.
//
// GameCube y no PSX, por lo mismo que la lámina del contacto: esto se mira FIJO
// para reconocer contra qué se está atracando; el casco propio se ve de reojo.
// Y gira, porque una lámina no dice hacia dónde va nadie: dice qué forma tiene, y
// girar es lo que enseña la silueta entera sin orbitar la cámara a mano.
//
// Es refuerzo y no la única vía: el estado y el nombre del sitio están en la
// matriz de métricas, en texto, y quien use lector de pantalla no pierde nada.
const SEMILLA_CIELO_ATRAQUE = 20391;
// La ranura de la lámina de atraque. Se nombra una vez porque montarla y
// pararla tienen que referirse a la MISMA, o el desmontaje no encontraría nada.
const SELECTOR_ATRAQUE = "[data-lagunak-atraque]";

function montarLaminaAtraque(root, modelo, app) {
  // Desmontar SIEMPRE primero, también cuando el atraque ha terminado: si no, al
  // soltar amarras el bucle seguiría girando contra un lienzo que ya no está en
  // el documento. Va contra la instancia de la aplicación y no contra la raíz,
  // por lo que aprendió #374: un render puede sustituir la raíz entera.
  desmontarLamina(root, app, SELECTOR_ATRAQUE);
  const atraque = modelo?.atraque;
  if (!atraque) return null;
  return montarLaminaContacto(
    root,
    { clase: atraque.clase, color: PIXEL.sinFaccion },
    { dueño: app, selector: SELECTOR_ATRAQUE, cielo: { semilla: SEMILLA_CIELO_ATRAQUE } },
  );
}

function bindWorkspaceRoot(root, app) {
  root?.querySelectorAll?.("[data-workspace-action]").forEach((element) => {
    element.addEventListener("click", (event) => handleWorkspaceAction(app, event));
  });
  pintarCascoPropio(root, app.ultimoModelo);
  montarLaminaAtraque(root, app.ultimoModelo, app);
  pintarVisorPiloto(root, app.ultimoModelo);
}

function initialiseApp(app) {
  app.previewStation = null;
  app.statePayload = null;
  app.contactsPayload = null;
  // La tripulación ya no está «restringida»: espera la difusión del GM. Si no
  // llega —porque no hay GM conectado o su puente está caído— se queda en espera
  // y lo dice, que es distinto de «no tienes permiso».
  app.connection = "loading";
  app.selloTelemetria = null;
  app.sensores = null;
  app.sensoresSonda = null;
  app.baseDatos = null;
  app.error = "";
  app.loading = false;
  app.closed = false;
  app.ultimoModelo = null;
}

function releaseWorkspaceApp(app) {
  app.closed = true;
  if (workspaceApp === app) workspaceApp = null;
}

function createV2Class() {
  const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
  return class StationWorkspaceV2 extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
      id: "lagunak-espacio-puesto",
      classes: ["lagunak-workspace"],
      window: {
        title: "LAGUNAK.Espacios.Titulo",
        icon: "fa-solid fa-display",
      },
      position: { width: 860, height: 680 },
    };

    static PARTS = {
      main: { template: `modules/${configuredModuleId}/templates/espacio-puesto.hbs` },
    };

    constructor(...args) {
      super(...args);
      initialiseApp(this);
    }

    setPreviewStation(station) {
      this.previewStation = station;
    }

    async refreshTelemetry() {
      return refreshTelemetry(this);
    }

    async _prepareContext() {
      return workspaceContext(this);
    }

    _onFirstRender(context, options) {
      super._onFirstRender?.(context, options);
      if (game.user?.isGM) this.refreshTelemetry();
    }

    _onRender(context, options) {
      super._onRender?.(context, options);
      bindWorkspaceRoot(this.element, this);
    }

    _onClose(options) {
      // Cerrar la consola con atraque en curso dejaba el requestAnimationFrame
      // vivo contra un lienzo ya retirado: no habrá otro render que lo desmonte.
      // Se para por la instancia, que es la clave del bucle.
      desmontarLamina(this.element, this);
      releaseWorkspaceApp(this);
      super._onClose?.(options);
    }
  };
}

function createV1Class() {
  return class StationWorkspaceV1 extends Application {
    constructor(...args) {
      super(...args);
      initialiseApp(this);
      this.started = false;
    }

    static get defaultOptions() {
      return foundry.utils.mergeObject(super.defaultOptions, {
        id: "lagunak-espacio-puesto",
        classes: ["lagunak-workspace"],
        template: `modules/${configuredModuleId}/templates/espacio-puesto.hbs`,
        width: 860,
        height: 680,
        resizable: true,
      });
    }

    get title() {
      return game.i18n.localize("LAGUNAK.Espacios.Titulo");
    }

    setPreviewStation(station) {
      this.previewStation = station;
    }

    async refreshTelemetry() {
      return refreshTelemetry(this);
    }

    getData() {
      return workspaceContext(this);
    }

    async _render(force, options) {
      await super._render(force, options);
      if (!this.started && game.user?.isGM) {
        this.started = true;
        this.refreshTelemetry();
      }
    }

    /**
     * El mismo updateUser que re-renderiza esta consola también puede
     * revocarla (main.mjs cierra el workspace al cambiar de puesto). Como el
     * _render de Foundry V1 es asíncrono, _replaceHTML puede llegar con el
     * elemento ya desmontado o nulo y revienta con «can't access property
     * "hasChildNodes"» (#263). Si el DOM ya no está, no hay nada que
     * reemplazar: el siguiente render con force lo reconstruye entero.
     */
    _replaceHTML(element, html) {
      const nodo = element?.[0] ?? element;
      if (!nodo?.isConnected) return;
      // revokeWorkspaceAccess vacía el elemento ENTERO (replaceChildren), así
      // que puede seguir conectado pero sin esqueleto de ventana. El
      // _replaceHTML de Foundry v11 hace `.find(".window-title")[0].hasChildNodes()`
      // sin comprobar nada: sin cabecera, revienta. Aquí solo se protege; la
      // reconstrucción la hace renderWorkspace ANTES de renderizar, porque
      // re-entrar en render() desde dentro deja al _render externo llamando a
      // setPosition con el elemento ya sustituido.
      if (!nodo.querySelector?.(".window-title")) return;
      super._replaceHTML(element, html);
    }

    activateListeners(html) {
      super.activateListeners(html);
      html.find("[data-workspace-action]").on("click", (event) => handleWorkspaceAction(this, event));
      // Las dos rutas montan lo MISMO. Si esta se quedara solo con el casco
      // propio, en el objetivo clásico v11 el atraque saldría en texto y la
      // lámina simplemente no existiría, sin que nada lo dijera.
      pintarCascoPropio(raizDe(this), this.ultimoModelo);
      montarLaminaAtraque(raizDe(this), this.ultimoModelo, this);
      pintarVisorPiloto(raizDe(this), this.ultimoModelo);
    }

    async close(options) {
      desmontarLamina(raizDe(this), this);
      releaseWorkspaceApp(this);
      return super.close(options);
    }
  };
}
