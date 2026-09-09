/* ================================================================== */
/* Consola caliente del GM (ApplicationV2, v12+) — #276.               */
/*                                                                      */
/* Fusiona lo que antes eran `estado-nave-app-v2.mjs` +                */
/* `mapa-vivo-app-v2.mjs` en pestañas (Estado, Mapa, Encuentros) con UN */
/* bucle de sondeo y un backoff, en vez de dos ventanas con dos bucles. */
/*                                                                      */
/* Aislamiento V1/V2: esta clase NO comparte código con                */
/* `consola-caliente-v1.mjs` — misma disciplina que ya declaraban las   */
/* cuatro factorías originales (ver cabecera de `mapa-vivo-app-v1.mjs`).*/
/* Lo compartido entre generaciones es lo que ya lo era: los módulos    */
/* puros importados aquí (ventana-nave.mjs, mapa-render.mjs,            */
/* encuentro-control.mjs, ship-view.mjs...).                            */
/*                                                                      */
/* Aislamiento de fallo por pestaña (docs/CONSOLA_CALIENTE_GM.md):      */
/* `conexion` global SOLO la fija `healthz`; cada pestaña tiene su      */
/* propio estado de datos y un fallo suyo no toca a las demás; el       */
/* backoff es del bucle, nunca de una pestaña suelta. La orquestación   */
/* de ESO vive en `consola-caliente-poll.mjs`, puro y probado en Node.  */
/* ================================================================== */

import { BridgeClient, BridgeError } from "./bridge-client.mjs";
import { getBridgeToken } from "./bridge-token-session.mjs";
import { describirFoco, restaurarFoco } from "./foco-render.mjs";
import { processBridgeEvents } from "./event-journal.mjs";
import {
  claveResultadoEncuentro,
  introducirEncuentro,
  normalizarCatalogoEncuentros,
  prepararVistaEncuentros,
} from "./encuentro-control.mjs";
import { anotarAlertas, derivarAlertas } from "./alertas-nave.mjs";
import { publicarNivelAlerta } from "./alerta-escena.mjs";
import { publicarAlarmaCruzada } from "./alarma-cruzada-escena.mjs";
import { prepararVistaPausa } from "./pausa-control.mjs";
import {
  ajustarPotencia,
  claveResultadoIngenieria,
  prepararVistaIngenieria,
} from "./ingenieria-control.mjs";
import {
  claveResultadoManiobra,
  ordenarManiobra,
  prepararVistaManiobra,
} from "./maniobra-control.mjs";
import {
  claveResultadoReposicion,
  normalizarCatalogoAnclas,
  prepararVistaReposicion,
  reposicionarNave,
} from "./reposicion-control.mjs";
import { firmaEstadoNaveVisible, prepareRoute, prepareSystemRows } from "./ship-view/ship-view.mjs";
import {
  barraRecurso,
  barrasSistema,
  aplicarBarraDom,
  textoPorcentaje,
} from "./ship-view/barras-estado.mjs";
import { estadoIcono, iconoSistemaDataUri, aplicarIconoDom } from "./iconos-sistema.mjs";
import { setSimulationPaused } from "./tempo-control.mjs";
import { contenidoEstadoBitacora, fechaLocal } from "./bitacora-nave.mjs";
import { desmontarLamina, montarLaminaContacto } from "./lamina-contacto.mjs";
import { proyectarParaPuesto } from "./proyeccion-puesto.mjs";
import { dibujarFrame } from "./mapa-render.mjs";
// #526: el marco grabado del mapa. Ornamento con el interior hueco: no pinta
// dentro del lienzo ni añade ninguna lectura (sin tics de escala ni rosa).
import { estiloMarcoMapa } from "./mapa-marco.mjs";
import { calcularIntervaloMs, resolverCicloConsola, siguienteFallosSeguidos } from "./consola-caliente-poll.mjs";
import { buildWorkspaceModel, WORKSPACE_STATIONS } from "./station-workspaces.mjs";
import { abrirAsistencia } from "./asistencia-ui.mjs";
import {
  colorFaccion,
  componerFrame,
  contactoEnPunto,
  crearCampoEstrellas,
  debeDibujar,
  firmaEstructuralContactos,
  leyendaContactos,
  normalizarContactosMapa,
  normalizarPosicionMapa,
  prepararDetalleContacto,
  reconciliarIndiceContacto,
  rotarMuestras,
} from "./ventana-nave.mjs";
import {
  crearCacheDecorado,
  crearDecorado,
  crearEventosFondo,
  componerDecorado,
  ladoDecorado,
} from "./decorado-fondo.mjs";
import {
  ALERTAS_NONCE,
  BACKOFF_MAX_MS,
  MAPA_FPS,
  MAPA_RADIO_MUNDO,
  MODULE_ID,
  semillaDecoradoActual,
} from "./lagunak-constantes.mjs";

const PUESTOS_VISTA = Object.freeze([
  "captain",
  "navigation",
  "engineering",
  "sensors",
  "communications",
  "weapons",
  // #517: Relay entra en la previsualización del GM como un puesto más.
  "relay",
  // #522: Damage Control entra en la previsualización del GM.
  "damagecontrol",
]);

const PESTANAS = Object.freeze(["estado", "mapa", "encuentros", "previsualizacion"]);

const ETIQUETA_PESTANA = Object.freeze({
  estado: "Estado",
  mapa: "Mapa",
  encuentros: "Encuentros",
  previsualizacion: "Previsualizacion",
});

function derivarMovimiento(app, centro, tMs) {
  const prev = app._centroAnterior;
  const moviendo = Boolean(
    prev && centro && Math.hypot(centro.x - prev.x, centro.y - prev.y) > 0.5,
  );
  app._centroAnterior = centro ?? null;
  const ambiente = moviendo
    ? null
    : { dx: Math.sin(tMs / 1500) * 5, dy: Math.cos(tMs / 1900) * 5 };
  return { moviendo, ambiente };
}

export function crearClaseConsolaCalienteV2() {
  const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

  return class ConsolaCalienteApp extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
      id: "lagunak-consola-caliente",
      classes: ["lagunak-consola-caliente-shell"],
      window: {
        title: "LAGUNAK.ConsolaCaliente.Titulo",
        icon: "fa-solid fa-gauge-high",
      },
      position: { width: 640, height: "auto" },
      actions: {
        anotar: ConsolaCalienteApp.onAnotar,
        pausar: ConsolaCalienteApp.onPausar,
        reanudar: ConsolaCalienteApp.onReanudar,
        encuentro: ConsolaCalienteApp.onEncuentro,
        ajustarIngenieria: ConsolaCalienteApp.onAjustarIngenieria,
        ordenarImpulso: ConsolaCalienteApp.onOrdenarImpulso,
        ordenarWarp: ConsolaCalienteApp.onOrdenarWarp,
        ordenarRumbo: ConsolaCalienteApp.onOrdenarRumbo,
        ordenarEscudos: ConsolaCalienteApp.onOrdenarEscudos,
        reposicionar: ConsolaCalienteApp.onReposicionar,
        abrirMando: ConsolaCalienteApp.onAbrirMando,
      },
    };

    static PARTS = {
      main: { template: `modules/${MODULE_ID}/templates/consola-caliente.hbs` },
    };

    /* ---- Bucle único de sondeo (paso 1) ---- */
    #timer = null;
    #fallosSeguidos = 0;
    #generacion = 0;
    #focoAConservar = null;
    #firmaVisibleAnterior = null;

    /* ---- Pestaña activa: SIEMPRE arranca en Estado, no se recuerda entre
       sesiones (decisión de producto del encargo). ---- */
    pestanaActiva = "estado";
    // El mapa mantiene una ventana de reproducción (`rotarMuestras`) que se
    // rompe si se queda sin muestras: una vez visto en este ciclo de vida de
    // la ventana, sus extras se siguen pidiendo aunque quede oculto.
    #mapaVistoAlgunaVez = false;

    /* ---- Conexión global: SOLO la fija `healthz`. ---- */
    conexion = "conectando";
    detalleErrorConexion = "";

    /* ---- Pestaña Estado ---- */
    ultimoEstado = null;
    estadoStatus = "sin-datos"; // "ok" | "sin-datos" | "error"
    estadoDetalleError = "";
    pausaConfirmada = null;
    ordenPendiente = null;
    confirmacionPendiente = null;
    falloOrden = false;
    ayudaAbierta = false;
    ingenieriaSistema = null;
    ingenieriaNivel = 1;
    ingenieriaPendiente = false;
    ingenieriaFallo = false;
    maniobraPendiente = false;
    maniobraFallo = false;
    /* Reposición (#176, cableada en #537). El catálogo de anclas se pide UNA vez
       —igual que el de encuentros— porque lo publica el escenario cargado y no
       cambia mientras esté cargado. `reposicionAviso` guarda la clave i18n del
       último resultado: a diferencia de maniobra, el acierto también se dice,
       porque teletransportar la nave sin confirmación visible dejaría al GM sin
       saber si el clic llegó. */
    catalogoAnclas = null;
    reposicionAncla = null;
    reposicionPendiente = false;
    reposicionFallo = false;
    reposicionAviso = "";

    /* ---- Pestaña Mapa ---- */
    #rafId = null;
    #ultimoDibujoMs = null;
    #ultimoFrame = null;
    #campo = crearCampoEstrellas(semillaDecoradoActual());
    #decorado = crearDecorado(semillaDecoradoActual());
    #eventosFondo = crearEventosFondo(semillaDecoradoActual());
    #cacheDecorado = crearCacheDecorado();
    #muestraPrev = null;
    #muestraActual = null;
    contactos = [];
    destino = null;
    seleccion = null;
    puestoVista = "captain";
    naveVigente = null;
    mapaStatus = "sin-datos";
    mapaDetalleError = "";
    contactosCaidos = false;

    /* ---- Pestaña Encuentros ---- */
    catalogoEncuentros = null;
    encuentroPendiente = false;
    encuentroArquetipo = null;
    encuentroRumbo = null;

    /* ---- Pestaña Previsualización (#276, paso 4) ---- */
    // Migrada desde el `isGM` branch de `station-workspaces.mjs`/`espacio-puesto.hbs`
    // (#237/#331): el GM ve la consola de un puesto tal y como la vería su
    // tripulante, sin abrir ningún dato nuevo — `buildWorkspaceModel` es el mismo
    // módulo puro que ya usaba la ventana de espacio de puesto.
    previsualizacionEstacion = "captain";
    contactosPayloadCrudo = null;

    bridgeAccessRevoked = false;

    regenerarDecorado(semilla) {
      this.#campo = crearCampoEstrellas(semilla);
      this.#decorado = crearDecorado(semilla);
      this.#eventosFondo = crearEventosFondo(semilla);
      this.#cacheDecorado.limpiar();
    }

    #cliente() {
      return new BridgeClient({
        url: game.settings.get(MODULE_ID, "bridgeUrl"),
        token: getBridgeToken(),
      });
    }

    #renderConservandoFoco() {
      const activo = typeof document !== "undefined" && this.element?.contains?.(document.activeElement)
        ? document.activeElement
        : null;
      this.#focoAConservar = describirFoco(activo, this.element);
      this.render();
    }

    #intervaloMs() {
      const base = game.settings.get(MODULE_ID, "pollSeconds") * 1000;
      return calcularIntervaloMs(base, this.#fallosSeguidos, BACKOFF_MAX_MS);
    }

    /** Plan de petición del ciclo (spec #276): healthz siempre; state una vez
     * compartido; extras solo de pestañas que podrían pintarse ahora mismo
     * (Estado: scenario/events; Mapa: contacts, también si estuvo visible
     * antes en este ciclo de vida, por la ventana de `rotarMuestras`);
     * encounters una vez por sesión, perezoso. */
    async #sondear() {
      if (this.bridgeAccessRevoked || !game.user?.isGM) return;
      const generacion = this.#generacion;
      const cliente = this.#cliente();

      const pideEstado = this.pestanaActiva === "estado";
      const pideMapa = this.pestanaActiva === "mapa" || this.#mapaVistoAlgunaVez;
      if (this.pestanaActiva === "mapa") this.#mapaVistoAlgunaVez = true;
      // La previsualización necesita contactos crudos solo para sensores/armas,
      // pero pedirlos siempre que la pestaña esté activa es más simple y barato
      // que distinguir por puesto elegido dentro del plan de sondeo.
      const pidePrevisualizacion = this.pestanaActiva === "previsualizacion";
      const pideContactos = pideMapa || pidePrevisualizacion;

      let healthzResultado = null;
      let stateResultado = null;
      let scenarioResultado = null;
      let eventsResultado = null;
      let contactsResultado = null;
      let catalogoResultado = null;
      let anclasResultado = null;

      const salud = await Promise.allSettled([cliente.healthz()]);
      healthzResultado = salud[0];
      if (generacion !== this.#generacion || this.bridgeAccessRevoked || !game.user?.isGM) return;

      if (healthzResultado.status === "fulfilled") {
        const peticiones = [cliente.state()];
        const indices = { state: 0 };
        if (pideEstado) {
          indices.scenario = peticiones.push(cliente.scenario()) - 1;
          indices.events = peticiones.push(cliente.events()) - 1;
        }
        if (pideContactos) {
          indices.contacts = peticiones.push(cliente.contacts()) - 1;
        }
        if (this.catalogoEncuentros === null) {
          indices.encounters = peticiones.push(cliente.encounters()) - 1;
        }
        if (this.catalogoAnclas === null) {
          indices.anchors = peticiones.push(cliente.anchors()) - 1;
        }
        const resultados = await Promise.allSettled(peticiones);
        if (generacion !== this.#generacion || this.bridgeAccessRevoked || !game.user?.isGM) return;
        stateResultado = resultados[indices.state];
        scenarioResultado = indices.scenario !== undefined ? resultados[indices.scenario] : null;
        eventsResultado = indices.events !== undefined ? resultados[indices.events] : null;
        contactsResultado = indices.contacts !== undefined ? resultados[indices.contacts] : null;
        catalogoResultado = indices.encounters !== undefined ? resultados[indices.encounters] : null;
        anclasResultado = indices.anchors !== undefined ? resultados[indices.anchors] : null;
      }

      const ciclo = resolverCicloConsola({
        healthz: healthzResultado,
        state: stateResultado,
        extras: { scenario: scenarioResultado, events: eventsResultado, contacts: contactsResultado },
        dependeDeState: ["contacts"],
      });

      this.conexion = ciclo.conexion;
      this.detalleErrorConexion = ciclo.conexion === "error"
        ? (ciclo.detalleErrorConexion instanceof BridgeError
          ? ciclo.detalleErrorConexion.message
          : game.i18n.localize("LAGUNAK.Errores.Desconocido"))
        : "";

      // Backoff a nivel de bucle: SOLO healthz/state lo disparan.
      const falloDeBucle = ciclo.conexion === "error" || ciclo.state.status === "error";
      this.#fallosSeguidos = siguienteFallosSeguidos(this.#fallosSeguidos, falloDeBucle);

      await this.#aplicarEstadoTab(ciclo);
      this.#aplicarMapaTab(ciclo);
      this.#aplicarEncuentrosTab(catalogoResultado);
      this.#aplicarCatalogoAnclas(anclasResultado);

      if (generacion !== this.#generacion || this.bridgeAccessRevoked || !game.user?.isGM) return;

      if (this.rendered) {
        const nave = this.ultimoEstado?.ship ?? null;
        const ruta = prepareRoute(nave, game.i18n);
        const sistemas = nave ? prepareSystemRows(nave, game.i18n) : [];
        const firmaEstadoBase = firmaEstadoNaveVisible({
          conexion: this.conexion,
          detalleError: this.detalleErrorConexion,
          ayudaAbierta: this.ayudaAbierta,
          esGM: Boolean(game.user?.isGM),
          naveExiste: Boolean(nave),
          naveCallsign: nave?.callsign ?? null,
          ruta,
          pausa: this.#vistaPausa(),
          encuentros: this.#vistaEncuentros(),
          maniobra: this.#vistaManiobra(nave),
          maniobraFallo: this.maniobraFallo,
          reposicion: this.#vistaReposicion(),
          reposicionAviso: this.reposicionAviso,
          ingenieria: this.#vistaIngenieria(nave),
          ingenieriaFallo: this.ingenieriaFallo,
          sistemas,
        });
        // `firmaEstadoNaveVisible` asumía una sola pestaña; la consola
        // fusionada añade lo que le falta para que un cambio en la pestaña
        // activa, o en Mapa/Encuentros (que esa firma no conoce), también
        // dispare la reconstrucción del DOM en vez de quedarse obsoleto.
        const firmaActual = JSON.stringify({
          firmaEstadoBase,
          pestanaActiva: this.pestanaActiva,
          estadoStatus: this.estadoStatus,
          estadoDetalleError: this.estadoDetalleError,
          mapaStatus: this.mapaStatus,
          mapaDetalleError: this.mapaDetalleError,
          mapaSeleccion: this.seleccion,
          mapaFirmaContactos: firmaEstructuralContactos(this.contactos),
          mapaContactosCaidos: this.contactosCaidos,
          mapaSinDatos: !this.#muestraActual,
          previsualizacionEstacion: this.previsualizacionEstacion,
          previsualizacionModelo: this.pestanaActiva === "previsualizacion" ? this.#vistaPrevisualizacion().modelo : null,
        });
        const cambioVisible = firmaActual !== this.#firmaVisibleAnterior;
        this.#firmaVisibleAnterior = firmaActual;
        if (cambioVisible) this.#renderConservandoFoco();
        else this.#actualizarTelemetriaDom(nave, ruta, sistemas);
      }
      this.#programar();
    }

    async #aplicarEstadoTab(ciclo) {
      if (ciclo.conexion === "error") {
        this.estadoStatus = "sin-datos";
        this.estadoDetalleError = "";
        return;
      }
      if (ciclo.state.status === "error") {
        this.estadoStatus = "error";
        this.estadoDetalleError = ciclo.state.motivo instanceof BridgeError
          ? ciclo.state.motivo.message
          : game.i18n.localize("LAGUNAK.Errores.Desconocido");
        if (this.confirmacionPendiente !== null) {
          this.confirmacionPendiente = null;
          this.falloOrden = true;
        }
        return;
      }
      if (ciclo.state.status === "sin-datos") return; // Estado no era la pestaña pedida esta vuelta
      // ok
      const navePrevAlertas = this.ultimoEstado?.ship ?? null;
      this.ultimoEstado = ciclo.state.dato;
      this.estadoStatus = "ok";
      this.estadoDetalleError = "";
      const escenario = ciclo.extras.scenario;
      if (escenario?.status === "ok") this._registrarLecturaPausa(escenario.dato);
      const eventos = ciclo.extras.events;
      if (eventos?.status === "ok") {
        await processBridgeEvents({
          payload: eventos.dato,
          game,
          JournalEntry,
          ui,
          sigueVigente: () => !this.bridgeAccessRevoked && Boolean(game.user?.isGM),
        });
        await anotarAlertas({
          alertas: derivarAlertas(navePrevAlertas, this.ultimoEstado?.ship ?? null),
          nonce: ALERTAS_NONCE,
          game,
          JournalEntry,
          ui,
          sigueVigente: () => !this.bridgeAccessRevoked && Boolean(game.user?.isGM),
        });
        await publicarNivelAlerta({ moduleId: MODULE_ID, nave: this.ultimoEstado?.ship ?? null });
        await publicarAlarmaCruzada({ moduleId: MODULE_ID, nave: this.ultimoEstado?.ship ?? null });
      }
    }

    #aplicarMapaTab(ciclo) {
      const contactosResultado = ciclo.extras.contacts;
      if (ciclo.conexion === "error") {
        this.mapaStatus = "sin-datos";
        this.mapaDetalleError = "";
        this.contactosCaidos = false;
        return;
      }
      if (ciclo.state.status === "error") {
        this.mapaStatus = "error";
        this.mapaDetalleError = ciclo.state.motivo instanceof BridgeError
          ? ciclo.state.motivo.message
          : game.i18n.localize("LAGUNAK.Errores.Desconocido");
        this.contactosCaidos = false;
        return;
      }
      if (ciclo.state.status === "sin-datos") return; // el mapa no se pidió esta vuelta
      const nave = ciclo.state.dato?.ship ?? null;
      const contactosAnteriores = this.contactos;
      const seleccionAnterior = this.seleccion;
      if (contactosResultado?.status === "ok") this.contactosPayloadCrudo = contactosResultado.dato ?? null;
      const contactosCrudos = contactosResultado?.status === "ok" ? contactosResultado.dato?.contacts ?? [] : [];
      const contactos = normalizarContactosMapa(contactosCrudos);
      if (nave) {
        const centro = normalizarPosicionMapa(nave.position);
        if (centro) {
          const rotadas = rotarMuestras(this.#muestraActual, {
            centro,
            rumboDeg: Number.isFinite(nave.heading) ? nave.heading : 0,
            contactos,
          }, Date.now());
          this.#muestraPrev = rotadas.prev;
          this.#muestraActual = rotadas.actual;
        }
      }
      this.seleccion = reconciliarIndiceContacto(contactosAnteriores, contactos, seleccionAnterior);
      this.contactos = contactos;
      this.destino = nave?.destination ?? null;
      this.naveVigente = nave;
      this.mapaStatus = "ok";
      this.mapaDetalleError = "";
      this.contactosCaidos = contactosResultado?.status === "error";
    }

    #aplicarEncuentrosTab(catalogoResultado) {
      if (catalogoResultado?.status === "fulfilled") {
        this.catalogoEncuentros = normalizarCatalogoEncuentros(catalogoResultado.value);
      }
    }

    /**
     * Un catálogo de anclas que falla se queda en `null` a propósito, para que
     * el siguiente ciclo lo reintente. Guardar un catálogo vacío apagaría el
     * bloque de reposición para siempre por un fallo de red pasajero, y el GM
     * no tendría forma de saber que existió.
     */
    #aplicarCatalogoAnclas(anclasResultado) {
      if (anclasResultado?.status === "fulfilled") {
        this.catalogoAnclas = normalizarCatalogoAnclas(anclasResultado.value);
      }
    }

    #vistaPausa() {
      return prepararVistaPausa({
        conexion: this.conexion,
        paused: this.pausaConfirmada,
        pendiente: this.ordenPendiente ?? this.confirmacionPendiente,
        falloOrden: this.falloOrden,
        foundryPausado: Boolean(game.paused),
        i18n: game.i18n,
      });
    }

    #vistaEncuentros() {
      return prepararVistaEncuentros({
        conexion: this.conexion,
        catalogo: this.catalogoEncuentros,
        pendiente: this.encuentroPendiente,
        seleccionArquetipo: this.encuentroArquetipo,
        seleccionRumbo: this.encuentroRumbo,
        i18n: game.i18n,
      });
    }

    #vistaReposicion() {
      return prepararVistaReposicion({
        conexion: this.conexion,
        catalogo: this.catalogoAnclas,
        pendiente: this.reposicionPendiente,
        seleccionAncla: this.reposicionAncla,
        i18n: game.i18n,
      });
    }

    #vistaManiobra(nave) {
      return prepararVistaManiobra({
        conexion: this.conexion,
        ship: nave,
        pendiente: this.maniobraPendiente,
        i18n: game.i18n,
      });
    }

    #vistaIngenieria(nave) {
      return prepararVistaIngenieria({
        conexion: this.conexion,
        ship: nave,
        pendiente: this.ingenieriaPendiente,
        seleccionSistema: this.ingenieriaSistema,
        seleccionNivel: this.ingenieriaNivel,
        i18n: game.i18n,
      });
    }

    #programar() {
      clearTimeout(this.#timer);
      this.#timer = setTimeout(() => this.#sondear(), this.#intervaloMs());
    }

    #actualizarTelemetriaDom(nave, ruta, sistemas) {
      const raiz = this.element;
      if (!raiz?.querySelector) return;
      const set = (selector, texto) => {
        const nodo = raiz.querySelector(selector);
        if (nodo && nodo.textContent !== texto) nodo.textContent = texto;
      };
      const setBarra = (selector, texto, barra) =>
        aplicarBarraDom(raiz.querySelector(selector), texto, barra);
      if (this.pestanaActiva === "estado" && nave) {
        set('[data-field="nave-posicion"]', `${nave.position?.x ?? "?"}, ${nave.position?.y ?? "?"}`);
        set('[data-field="nave-rumbo"]', `${nave.heading ?? "?"}°`);
        setBarra(
          '[data-field="nave-casco"]',
          `${nave.hull ?? "?"} / ${nave.hull_max ?? "?"}`,
          barraRecurso(nave.hull, nave.hull_max),
        );
        setBarra(
          '[data-field="nave-energia"]',
          `${nave.energy ?? "?"} / ${nave.energy_max ?? "?"}`,
          barraRecurso(nave.energy, nave.energy_max),
        );
        if (ruta) {
          set('[data-field="ruta-distancia"]', ruta.distanceLabel);
          set('[data-field="ruta-eta"]', ruta.etaLabel);
        }
        for (const sistema of sistemas) {
          const barras = barrasSistema(sistema);
          const base = `[data-sistema-id="${sistema.id}"]`;
          setBarra(`${base} [data-campo="salud"]`, textoPorcentaje(sistema.health), barras.salud);
          setBarra(`${base} [data-campo="calor"]`, textoPorcentaje(sistema.heat), barras.calor);
          setBarra(`${base} [data-campo="potencia"]`, textoPorcentaje(sistema.power), barras.potencia);
          aplicarIconoDom(this.element?.[0] ?? this.element, base, sistema.id, barras.salud);
        }
      }
      if (this.pestanaActiva === "mapa") this.#actualizarTelemetriaMapaDom();
    }

    #actualizarTelemetriaMapaDom() {
      const raiz = this.element;
      const centro = this.#muestraActual?.centro ?? null;
      if (!raiz?.querySelectorAll || !centro) return;
      for (const boton of raiz.querySelectorAll("[data-contacto]")) {
        const indice = Number.parseInt(boton.dataset.contactoIndice ?? "", 10);
        const contacto = Number.isInteger(indice) ? this.contactos[indice] : null;
        if (!contacto) continue;
        const detalle = prepararDetalleContacto(contacto, centro);
        const distancia = boton.querySelector?.(".lagunak-mapa-distancia");
        if (distancia) {
          distancia.textContent = game.i18n.format("LAGUNAK.EstadoNave.DistanciaUnidades", {
            distance: Math.round(detalle.distancia),
          });
        }
        const fuera = boton.querySelector?.("[data-lagunak-fuera]");
        if (fuera) fuera.hidden = detalle.distancia <= MAPA_RADIO_MUNDO;
      }
      const seleccionado = Number.isInteger(this.seleccion) ? this.contactos[this.seleccion] : null;
      if (!seleccionado) return;
      const detalle = prepararDetalleContacto(seleccionado, centro);
      const distancia = raiz.querySelector("[data-lagunak-detalle-distancia]");
      const rumbo = raiz.querySelector("[data-lagunak-detalle-rumbo]");
      if (distancia) {
        distancia.textContent = game.i18n.format("LAGUNAK.EstadoNave.DistanciaUnidades", {
          distance: Math.round(detalle.distancia),
        });
      }
      if (rumbo) {
        rumbo.textContent = game.i18n.format("LAGUNAK.MapaVivo.RumboGrados", {
          rumbo: Math.round(detalle.rumboDeg),
        });
      }
    }

    #ajustarBacking(canvas) {
      const lado = ladoDecorado(canvas.clientWidth);
      if (canvas.width === lado) return;
      canvas.width = lado;
      canvas.height = lado;
      this.#decorado = crearDecorado(semillaDecoradoActual(), { ancho: lado, alto: lado });
    }

    #animar(rafMs = null) {
      if (!this.rendered || typeof requestAnimationFrame !== "function") {
        this.#rafId = null;
        return;
      }
      this.#rafId = requestAnimationFrame((siguienteRafMs) => this.#animar(siguienteRafMs));
      if (this.pestanaActiva !== "mapa") return;
      const relojRaf = Number.isFinite(rafMs) ? rafMs : (globalThis.performance?.now?.() ?? 0);
      const ahora = Date.now();
      if (!debeDibujar(this.#ultimoDibujoMs, relojRaf, MAPA_FPS)) return;
      const canvas = this.element?.querySelector?.(".lagunak-mapa-canvas");
      const ctx = canvas?.getContext?.("2d");
      if (!ctx) return;
      this.#ajustarBacking(canvas);
      this.#ultimoDibujoMs = relojRaf;
      const frame = componerFrame({
        muestraPrev: this.#muestraPrev,
        muestraActual: this.#muestraActual,
        contactos: this.contactos,
        destino: this.destino,
        campo: this.#campo,
        tMs: ahora,
        ancho: canvas.width,
        alto: canvas.height,
        radioMundo: MAPA_RADIO_MUNDO,
      });
      const { moviendo, ambiente } = derivarMovimiento(this, frame.centro, ahora);
      const decorado = frame.sinDatos
        ? []
        : componerDecorado(this.#decorado, {
            centro: frame.centro,
            ancho: canvas.width,
            alto: canvas.height,
            ambiente,
          });
      dibujarFrame(ctx, frame, {
        vista: proyectarParaPuesto(frame, this.puestoVista, {
          nave: this.naveVigente,
          sistemas: prepareSystemRows(this.naveVigente, game.i18n),
        }),
        ancho: canvas.width,
        alto: canvas.height,
        decorado,
        cacheDecorado: this.#cacheDecorado,
        eventosFondo: this.#eventosFondo,
        moviendo,
        tMs: ahora,
      });
      this.#ultimoFrame = frame;
    }

    _onFirstRender(context, options) {
      super._onFirstRender?.(context, options);
      this.#sondear();
      this.#animar();
    }

    _onRender(context, options) {
      super._onRender?.(context, options);
      restaurarFoco(this.element, this.#focoAConservar);
      this.#focoAConservar = null;

      this.element?.querySelectorAll?.("[data-consola-tab]")?.forEach((boton) => {
        boton.addEventListener("click", () => {
          const id = boton.dataset.consolaTab;
          if (!PESTANAS.includes(id) || id === this.pestanaActiva) return;
          this.pestanaActiva = id;
          this.render();
        });
      });

      const ayuda = this.element?.querySelector?.(".lagunak-ayuda");
      ayuda?.addEventListener?.("toggle", (event) => {
        this.ayudaAbierta = Boolean(event.currentTarget?.open);
      });
      this.element?.querySelector?.("[data-lagunak-encuentro-arquetipo]")?.addEventListener?.("change", (event) => {
        this.encuentroArquetipo = event.currentTarget?.value || null;
      });
      this.element?.querySelector?.("[data-lagunak-encuentro-rumbo]")?.addEventListener?.("change", (event) => {
        this.encuentroRumbo = event.currentTarget?.value || null;
      });
      const sistema = this.element?.querySelector?.('[data-field="ingenieria-sistema"]');
      sistema?.addEventListener?.("change", (event) => {
        this.ingenieriaSistema = event.currentTarget?.value ?? null;
      });
      const nivel = this.element?.querySelector?.('[data-field="ingenieria-nivel"]');
      nivel?.addEventListener?.("change", (event) => {
        const parsed = Number(event.currentTarget?.value);
        if (Number.isFinite(parsed)) this.ingenieriaNivel = parsed;
      });
      this.element?.querySelectorAll?.("[data-lagunak-previsualizacion-estacion]")?.forEach((boton) => {
        boton.addEventListener("click", () => {
          const id = boton.dataset.lagunakPrevisualizacionEstacion;
          if (!WORKSPACE_STATIONS.includes(id) || id === this.previsualizacionEstacion) return;
          this.previsualizacionEstacion = id;
          this.render();
        });
      });

      montarLaminaContacto(this.element, this.detalleVigente, { dueño: this });
      const selector = this.element?.querySelector?.("[data-lagunak-puesto-vista]");
      selector?.addEventListener("change", (ev) => {
        this.puestoVista = ev.target?.value ?? "captain";
      });
      this.element?.querySelectorAll?.("[data-contacto]")?.forEach((el) => {
        el.addEventListener("click", () => {
          const indice = Number.parseInt(el.dataset.contactoIndice ?? "", 10);
          if (!Number.isInteger(indice)) return;
          this.seleccion = indice === this.seleccion ? null : indice;
          this.render();
        });
      });
      const canvas = this.element?.querySelector?.(".lagunak-mapa-canvas");
      canvas?.addEventListener("click", (ev) => {
        if (!this.#ultimoFrame) return;
        const rect = canvas.getBoundingClientRect();
        const x = ((ev.clientX - rect.left) / rect.width) * canvas.width;
        const y = ((ev.clientY - rect.top) / rect.height) * canvas.height;
        const indice = contactoEnPunto(this.#ultimoFrame.blips, x, y);
        if (indice === null) return;
        this.seleccion = indice === this.seleccion ? null : indice;
        this.render();
      });
    }

    _onClose(options) {
      desmontarLamina(this.element, this);
      this.#generacion += 1;
      clearTimeout(this.#timer);
      this.#timer = null;
      if (this.#rafId != null && typeof cancelAnimationFrame === "function") {
        cancelAnimationFrame(this.#rafId);
      }
      this.#rafId = null;
      this.#ultimoDibujoMs = null;
      this.#cacheDecorado.limpiar();
      this.#fallosSeguidos = 0;
      this.pestanaActiva = "estado";
      this.#mapaVistoAlgunaVez = false;
      this.conexion = "conectando";
      this.detalleErrorConexion = "";
      this.estadoStatus = "sin-datos";
      this.mapaStatus = "sin-datos";
      this.pausaConfirmada = null;
      this.ordenPendiente = null;
      this.confirmacionPendiente = null;
      this.falloOrden = false;
      this.ayudaAbierta = false;
      this.catalogoEncuentros = null;
      this.encuentroPendiente = false;
      this.encuentroArquetipo = null;
      this.encuentroRumbo = null;
      this.ingenieriaSistema = null;
      this.ingenieriaNivel = 1;
      this.ingenieriaPendiente = false;
      this.ingenieriaFallo = false;
      this.maniobraPendiente = false;
      this.maniobraFallo = false;
      this.catalogoAnclas = null;
      this.reposicionAncla = null;
      this.reposicionPendiente = false;
      this.reposicionFallo = false;
      this.reposicionAviso = "";
      this.contactosCaidos = false;
      this.previsualizacionEstacion = "captain";
      this.contactosPayloadCrudo = null;
      this.#focoAConservar = null;
      this.#firmaVisibleAnterior = null;
      super._onClose?.(options);
    }

    async _prepareContext(_options) {
      const nave = this.ultimoEstado?.ship ?? null;
      const centro = this.#muestraActual?.centro ?? null;
      const desconocido = game.i18n.localize("LAGUNAK.MapaVivo.Desconocido");
      const propia = game.i18n.localize("LAGUNAK.MapaVivo.LeyendaPropia");
      const contactoSeleccionado = Number.isInteger(this.seleccion) ? this.contactos[this.seleccion] ?? null : null;
      let detalle = null;
      if (contactoSeleccionado) {
        const d = prepararDetalleContacto(contactoSeleccionado, centro);
        detalle = {
          callsign: d.callsign,
          color: d.color,
          tipo: d.tipo ?? desconocido,
          clase: d.clase,
          claseLabel: d.clase ?? desconocido,
          faccion: d.esJugador ? propia : d.faccion ?? desconocido,
          distanciaLabel: game.i18n.format("LAGUNAK.EstadoNave.DistanciaUnidades", { distance: Math.round(d.distancia) }),
          rumboLabel: game.i18n.format("LAGUNAK.MapaVivo.RumboGrados", { rumbo: Math.round(d.rumboDeg) }),
        };
      }
      this.detalleVigente = detalle;

      return {
        conexion: this.conexion,
        conexionOk: this.conexion === "ok",
        conexionError: this.conexion === "error",
        conexionConectando: this.conexion === "conectando",
        detalleError: this.detalleErrorConexion,
        ayudaAbierta: this.ayudaAbierta,
        esGM: Boolean(game.user?.isGM),
        pausa: this.#vistaPausa(),
        maniobra: this.#vistaManiobra(nave),
        maniobraFallo: this.maniobraFallo,
        reposicion: this.#vistaReposicion(),
        reposicionAviso: this.reposicionAviso,
        reposicionFallo: this.reposicionFallo,
        estiloMarcoMapa: estiloMarcoMapa({
          ancho: 508,
          alto: 508,
          titulo: this.naveVigente?.callsign ?? "",
        }),
        tabs: PESTANAS.map((id) => ({
          id,
          label: game.i18n.localize(`LAGUNAK.ConsolaCaliente.${ETIQUETA_PESTANA[id]}`),
          selected: id === this.pestanaActiva,
        })),
        estadoActiva: this.pestanaActiva === "estado",
        mapaActiva: this.pestanaActiva === "mapa",
        encuentrosActiva: this.pestanaActiva === "encuentros",
        previsualizacionActiva: this.pestanaActiva === "previsualizacion",
        estado: {
          enError: this.estadoStatus === "error",
          detalleError: this.estadoDetalleError,
          nave,
          ruta: prepareRoute(nave, game.i18n),
          sistemas: nave
            ? prepareSystemRows(nave, game.i18n).map(({ id, name, health, heat, power }) => ({
                id,
                nombre: name,
                salud: textoPorcentaje(health),
                calor: textoPorcentaje(heat),
                potencia: textoPorcentaje(power),
                barras: barrasSistema({ health, heat, power }),
                icono: iconoSistemaDataUri(estadoIcono(barrasSistema({ health, heat, power }).salud), id),
              }))
            : [],
          barras: {
            casco: barraRecurso(nave?.hull, nave?.hull_max),
            energia: barraRecurso(nave?.energy, nave?.energy_max),
          },
          ingenieria: this.#vistaIngenieria(nave),
          ingenieriaFallo: this.ingenieriaFallo,
        },
        mapa: {
          enError: this.mapaStatus === "error",
          detalleError: this.mapaDetalleError,
          contactosCaidos: this.contactosCaidos,
          sinDatos: !this.#muestraActual,
          alcanceLabel: game.i18n.format("LAGUNAK.MapaVivo.Alcance", { radio: MAPA_RADIO_MUNDO }),
          puestosVista: PUESTOS_VISTA.map((id) => ({
            id,
            etiqueta: game.i18n.localize(`LAGUNAK.Puestos.${id}`),
            activo: id === this.puestoVista,
          })),
          detalle,
          leyenda: leyendaContactos(this.contactos).map((e) => ({
            color: e.color,
            etiqueta: e.esJugador ? propia : e.faccion ?? game.i18n.localize("LAGUNAK.MapaVivo.LeyendaNeutro"),
          })),
          contactos: this.contactos.map((c, indice) => {
            const dx = (c.position?.x ?? 0) - (centro?.x ?? 0);
            const dy = (c.position?.y ?? 0) - (centro?.y ?? 0);
            const distancia = Math.hypot(dx, dy);
            return {
              callsign: c.callsign ?? "?",
              color: colorFaccion(c.faction ?? null, Boolean(c.is_player)),
              esJugador: Boolean(c.is_player),
              seleccionado: indice === this.seleccion,
              distanciaLabel: game.i18n.format("LAGUNAK.EstadoNave.DistanciaUnidades", { distance: Math.round(distancia) }),
              fuera: distancia > MAPA_RADIO_MUNDO,
            };
          }),
        },
        encuentros: this.#vistaEncuentros(),
        previsualizacion: this.#vistaPrevisualizacion(),
      };
    }

    #vistaPrevisualizacion() {
      return {
        estaciones: WORKSPACE_STATIONS.map((id) => ({
          id,
          etiqueta: game.i18n.localize(`LAGUNAK.Puestos.${id}`),
          activo: id === this.previsualizacionEstacion,
        })),
        modelo: buildWorkspaceModel({
          station: this.previsualizacionEstacion,
          isGM: true,
          users: game.users,
          moduleId: MODULE_ID,
          i18n: game.i18n,
          statePayload: this.ultimoEstado,
          contactsPayload: this.contactosPayloadCrudo,
          connection: this.conexion === "ok" ? "ok" : this.conexion,
          error: this.detalleErrorConexion,
        }),
      };
    }

    _registrarLecturaPausa(escenario) {
      const lectura = typeof escenario?.paused === "boolean" ? escenario.paused : null;
      this.pausaConfirmada = lectura;
      if (this.confirmacionPendiente === null || lectura === null) return;
      const esperado = this.confirmacionPendiente;
      this.confirmacionPendiente = null;
      if (lectura === esperado) {
        const key = lectura ? "LAGUNAK.Tempo.Pausado" : "LAGUNAK.Tempo.Reanudado";
        ui.notifications.info(game.i18n.localize(key));
      } else {
        this.falloOrden = true;
        ui.notifications.warn(game.i18n.localize("LAGUNAK.Tempo.Discordante"));
      }
    }

    async _introducirEncuentro() {
      if (this.encuentroPendiente) return;
      const raiz = this.element;
      const archetype = raiz?.querySelector?.("[data-lagunak-encuentro-arquetipo]")?.value
        ?? this.encuentroArquetipo
        ?? this.catalogoEncuentros?.archetypes?.[0];
      const bearing = raiz?.querySelector?.("[data-lagunak-encuentro-rumbo]")?.value || null;
      this.encuentroPendiente = true;
      if (this.rendered) this.#renderConservandoFoco();
      try {
        const respuesta = await introducirEncuentro({
          archetype,
          bearing,
          isGM: Boolean(game.user?.isGM),
          catalogo: this.catalogoEncuentros,
          client: this.#cliente(),
        });
        if (this.bridgeAccessRevoked || !game.user?.isGM) return;
        if (respuesta !== null) {
          const resultado = claveResultadoEncuentro(respuesta);
          const mensaje = game.i18n.localize(resultado.clave);
          if (resultado.ok) ui.notifications.info(mensaje);
          else ui.notifications.warn(mensaje);
        }
      } catch (err) {
        if (this.bridgeAccessRevoked || !game.user?.isGM) return;
        const message = err instanceof BridgeError ? err.message : game.i18n.localize("LAGUNAK.Errores.Desconocido");
        ui.notifications.error(message);
      } finally {
        this.encuentroPendiente = false;
        if (!this.bridgeAccessRevoked && game.user?.isGM && this.rendered) this.#renderConservandoFoco();
      }
    }

    static async onEncuentro() {
      return this._introducirEncuentro();
    }

    async _emitirManiobra(op, value) {
      if (this.maniobraPendiente || !game.user?.isGM || this.bridgeAccessRevoked) return;
      this.maniobraPendiente = true;
      this.maniobraFallo = false;
      if (this.rendered) this.#renderConservandoFoco();
      try {
        const respuesta = await ordenarManiobra({ op, value, isGM: Boolean(game.user?.isGM), client: this.#cliente() });
        if (this.bridgeAccessRevoked || !game.user?.isGM) return;
        const { ok, clave } = claveResultadoManiobra(respuesta);
        this.maniobraFallo = !ok;
        (ok ? ui.notifications.info : ui.notifications.warn).call(ui.notifications, game.i18n.localize(clave));
      } catch (err) {
        if (this.bridgeAccessRevoked || !game.user?.isGM) return;
        this.maniobraFallo = true;
        const message = err instanceof BridgeError ? err.message : game.i18n.localize("LAGUNAK.Errores.Desconocido");
        ui.notifications.error(message);
      } finally {
        this.maniobraPendiente = false;
        if (!this.bridgeAccessRevoked && game.user?.isGM && this.rendered) this.#renderConservandoFoco();
      }
    }

    /**
     * Reposiciona la nave a un ancla NOMBRADA (#176, cableada en #537).
     *
     * `reposicionarNave` valida el ancla contra el catálogo del puente antes de
     * tocar la red, así que un `<select>` manipulado desde el inspector no
     * consigue enviar una coordenada ni un ancla inventada: se queda en un
     * `BridgeError` local. La misma guarda post-await que #201 dejó como
     * lección, porque un `await` de red puede volver con la ventana cerrada o
     * con el acceso al puente revocado.
     */
    async _reposicionar(anchor) {
      if (this.reposicionPendiente || !game.user?.isGM || this.bridgeAccessRevoked) return;
      if (anchor === "") return;
      this.reposicionAncla = anchor;
      this.reposicionPendiente = true;
      this.reposicionFallo = false;
      this.reposicionAviso = "";
      if (this.rendered) this.#renderConservandoFoco();
      try {
        const respuesta = await reposicionarNave({
          anchor,
          isGM: Boolean(game.user?.isGM),
          catalogo: this.catalogoAnclas,
          client: this.#cliente(),
        });
        if (this.bridgeAccessRevoked || !game.user?.isGM) return;
        const { ok, clave } = claveResultadoReposicion(respuesta);
        this.reposicionFallo = !ok;
        this.reposicionAviso = clave;
        (ok ? ui.notifications.info : ui.notifications.warn).call(ui.notifications, game.i18n.localize(clave));
      } catch (err) {
        if (this.bridgeAccessRevoked || !game.user?.isGM) return;
        this.reposicionFallo = true;
        this.reposicionAviso = "LAGUNAK.Reposicion.Fallo";
        const message = err instanceof BridgeError ? err.message : game.i18n.localize("LAGUNAK.Errores.Desconocido");
        ui.notifications.error(message);
      } finally {
        this.reposicionPendiente = false;
        if (!this.bridgeAccessRevoked && game.user?.isGM && this.rendered) this.#renderConservandoFoco();
      }
    }

    static async onReposicionar() {
      const select = this.element?.querySelector?.('[data-field="reposicion-ancla"]');
      return this._reposicionar(String(select?.value ?? ""));
    }

    static onAbrirMando() {
      return abrirAsistencia();
    }

    static async onOrdenarImpulso(_event, target) {
      return this._emitirManiobra("impulse", Number(target?.dataset?.value));
    }

    static async onOrdenarWarp(_event, target) {
      return this._emitirManiobra("warp", Number(target?.dataset?.value));
    }

    static async onOrdenarRumbo() {
      const select = this.element?.querySelector?.('[data-field="maniobra-rumbo"]');
      return this._emitirManiobra("heading", Number(select?.value));
    }

    static async onOrdenarEscudos(_event, target) {
      return this._emitirManiobra("shields", target?.dataset?.value === "true");
    }

    async _cambiarPausa(paused) {
      if (this.ordenPendiente !== null || this.confirmacionPendiente !== null) return;
      this.ordenPendiente = paused;
      this.falloOrden = false;
      if (this.rendered) this.#renderConservandoFoco();
      try {
        const changed = await setSimulationPaused({ paused, isGM: Boolean(game.user?.isGM), client: this.#cliente() });
        if (changed && !this.bridgeAccessRevoked && game.user?.isGM) {
          this.confirmacionPendiente = paused;
        }
      } catch (err) {
        this.falloOrden = true;
        const message = err instanceof BridgeError ? err.message : game.i18n.localize("LAGUNAK.Errores.Desconocido");
        ui.notifications.error(message);
      } finally {
        this.ordenPendiente = null;
        if (this.rendered) this.#renderConservandoFoco();
      }
    }

    static async onPausar() {
      return this._cambiarPausa(true);
    }

    static async onReanudar() {
      return this._cambiarPausa(false);
    }

    static async onAjustarIngenieria() {
      return this._ajustarIngenieria();
    }

    async _ajustarIngenieria() {
      if (this.ingenieriaPendiente || !game.user?.isGM || this.bridgeAccessRevoked) return;
      const system = this.ingenieriaSistema ?? this.#sistemaIngenieriaPorDefecto();
      const level = this.ingenieriaNivel;
      if (system == null) return;
      this.ingenieriaSistema = system;
      this.ingenieriaPendiente = true;
      this.ingenieriaFallo = false;
      if (this.rendered) this.#renderConservandoFoco();
      try {
        const respuesta = await ajustarPotencia({ system, level, isGM: Boolean(game.user?.isGM), client: this.#cliente() });
        if (this.bridgeAccessRevoked || !game.user?.isGM) return;
        const { ok, clave } = claveResultadoIngenieria(respuesta);
        this.ingenieriaFallo = !ok;
        (ok ? ui.notifications.info : ui.notifications.warn).call(ui.notifications, game.i18n.localize(clave));
      } catch (err) {
        if (this.bridgeAccessRevoked || !game.user?.isGM) return;
        this.ingenieriaFallo = true;
        const message = err instanceof BridgeError ? err.message : game.i18n.localize("LAGUNAK.Errores.Desconocido");
        ui.notifications.error(message);
      } finally {
        this.ingenieriaPendiente = false;
        if (!this.bridgeAccessRevoked && game.user?.isGM && this.rendered) this.#renderConservandoFoco();
      }
    }

    #sistemaIngenieriaPorDefecto() {
      const vista = prepararVistaIngenieria({ conexion: this.conexion, ship: this.ultimoEstado?.ship ?? null, i18n: game.i18n });
      return vista.opcionesSistema[0]?.id ?? null;
    }

    static async onAnotar() {
      if (!game.user?.isGM) return;
      const nave = this.ultimoEstado?.ship;
      if (!nave) {
        ui.notifications.warn(game.i18n.localize("LAGUNAK.Errores.SinEstado"));
        return;
      }
      const nombreDiario = game.i18n.localize("LAGUNAK.Diario.Nombre");
      const diario = game.journal.getName(nombreDiario) ?? (await JournalEntry.create({ name: nombreDiario }));
      const marca = fechaLocal();
      const contenido = contenidoEstadoBitacora(nave, marca);
      await diario.createEmbeddedDocuments("JournalEntryPage", [
        {
          type: "text",
          name: `${game.i18n.localize("LAGUNAK.Diario.PaginaPrefijo")} ${marca}`,
          text: { content: contenido },
        },
      ]);
      ui.notifications.info(game.i18n.localize("LAGUNAK.Diario.Anotado"));
    }
  };
}
