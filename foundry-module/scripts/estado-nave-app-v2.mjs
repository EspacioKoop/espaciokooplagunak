/* ================================================================== */
/* Ventana moderna (ApplicationV2, v12+).                             */
/*                                                                    */
/* Cuerpo de clase IDÉNTICO al esqueleto original (PR #18). No se      */
/* comparte nada con la ruta v11: cualquier cambio de esta ventana     */
/* tendría que ser aquí, explícito. Lo único movido respecto al        */
/* original es la desestructuración de la API y la definición de la    */
/* clase, ahora perezosas dentro de esta factoría.                     */
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
import { firmaEstadoNaveVisible, prepareRoute, prepareSystemRows } from "./ship-view.mjs";
import {
  barraRecurso,
  barrasSistema,
  aplicarBarraDom,
  textoPorcentaje,
} from "./barras-estado.mjs";
import { setSimulationPaused } from "./tempo-control.mjs";
import { contenidoEstadoBitacora, fechaLocal } from "./bitacora-nave.mjs";
import { ALERTAS_NONCE, BACKOFF_MAX_MS, MODULE_ID } from "./lagunak-constantes.mjs";

export function crearClaseV2() {
  const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

  return class EstadoNaveApp extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
      id: "lagunak-estado-nave",
      classes: ["lagunak-estado"],
      window: {
        title: "LAGUNAK.EstadoNave.Titulo",
        icon: "fa-solid fa-shuttle-space",
      },
      position: { width: 440, height: "auto" },
      actions: {
        anotar: EstadoNaveApp.onAnotar,
        pausar: EstadoNaveApp.onPausar,
        reanudar: EstadoNaveApp.onReanudar,
        encuentro: EstadoNaveApp.onEncuentro,
        ajustarIngenieria: EstadoNaveApp.onAjustarIngenieria,
        ordenarImpulso: EstadoNaveApp.onOrdenarImpulso,
        ordenarWarp: EstadoNaveApp.onOrdenarWarp,
        ordenarRumbo: EstadoNaveApp.onOrdenarRumbo,
        ordenarEscudos: EstadoNaveApp.onOrdenarEscudos,
      },
    };

    static PARTS = {
      main: { template: `modules/${MODULE_ID}/templates/estado-nave.hbs` },
    };

    /** Estado interno del sondeo. */
    #timer = null;
    #fallosSeguidos = 0;
    // Descriptor del control con foco justo antes de un render que reconstruye
    // el DOM (issue #227): sin esto, cualquier render() con foco activo lo
    // devuelve a document.body, un salto confuso con teclado/lector.
    #focoAConservar = null;
    // Última firma no-telemétrica renderizada (issue #227 punto 6): evita que
    // el sondeo reconstruya el panel —y sus regiones role="status"— cuando
    // solo cambió telemetría continua.
    #firmaVisibleAnterior = null;
    ultimoEstado = null; // último /v1/state correcto
    conexion = "conectando"; // "ok" | "error" | "conectando"
    detalleError = "";
    pausaConfirmada = null; // último `paused` de /v1/scenario (null = sin lectura)
    ordenPendiente = null; // orden de pausa en vuelo (true/false) o null
    confirmacionPendiente = null; // ACK recibido, a la espera de observarlo en /v1/scenario
    falloOrden = false; // la última orden de pausa terminó en error
    ayudaAbierta = false; // conserva <details open> entre reemplazos del DOM
    catalogoEncuentros = null; // catálogo de /v1/encounters (null = sin leer)
    encuentroPendiente = false; // orden spawn_encounter en vuelo
    encuentroArquetipo = null; // selección conservada entre re-renders
    encuentroRumbo = null;
    // Panel de ingeniería del GM: selección y orden en vuelo. La selección se
    // conserva entre reemplazos del DOM del sondeo (como <details open>).
    ingenieriaSistema = null;
    ingenieriaNivel = 1;
    ingenieriaPendiente = false;
    ingenieriaFallo = false;
    // Órdenes directas del GM (#176): una orden cada vez y último fallo.
    maniobraPendiente = false;
    maniobraFallo = false;
    bridgeAccessRevoked = false;

    #cliente() {
      return new BridgeClient({
        url: game.settings.get(MODULE_ID, "bridgeUrl"),
        token: getBridgeToken(),
      });
    }

    /** Captura el foco actual antes de reconstruir el DOM; _onRender lo restaura. */
    #renderConservandoFoco() {
      const activo = typeof document !== "undefined" && this.element?.contains?.(document.activeElement)
        ? document.activeElement
        : null;
      this.#focoAConservar = describirFoco(activo, this.element);
      this.render();
    }

    #intervaloMs() {
      const base = game.settings.get(MODULE_ID, "pollSeconds") * 1000;
      if (this.#fallosSeguidos === 0) return base;
      // Backoff exponencial acotado en fallos consecutivos; se rearma al primer éxito.
      return Math.min(base * 2 ** this.#fallosSeguidos, BACKOFF_MAX_MS);
    }

    async #sondear() {
      if (this.bridgeAccessRevoked || !game.user?.isGM) return;
      try {
        const cliente = this.#cliente();
        await cliente.healthz();
        if (this.bridgeAccessRevoked || !game.user?.isGM) return;
        const estado = await cliente.state();
        if (this.bridgeAccessRevoked || !game.user?.isGM) return;
        const escenario = await cliente.scenario();
        if (this.bridgeAccessRevoked || !game.user?.isGM) return;
        const eventos = await cliente.events();
        if (this.bridgeAccessRevoked || !game.user?.isGM) return;
        const navePrevAlertas = this.ultimoEstado?.ship ?? null;
        this.ultimoEstado = estado;
        this._registrarLecturaPausa(escenario);
        await processBridgeEvents({
          payload: eventos,
          game,
          JournalEntry,
          ui,
          sigueVigente: () => !this.bridgeAccessRevoked && Boolean(game.user?.isGM),
        });
        await anotarAlertas({
          alertas: derivarAlertas(navePrevAlertas, estado?.ship ?? null),
          nonce: ALERTAS_NONCE,
          game,
          JournalEntry,
          ui,
          sigueVigente: () => !this.bridgeAccessRevoked && Boolean(game.user?.isGM),
        });
        // Nivel sostenido para toda la mesa. Va después de las alertas de
        // flanco y es independiente de ellas: aquellas anotan el instante del
        // cruce, esto describe cómo está la nave mientras dura.
        await publicarNivelAlerta({ moduleId: MODULE_ID, nave: estado?.ship ?? null });
        if (this.bridgeAccessRevoked || !game.user?.isGM) return;
        if (this.bridgeAccessRevoked || !game.user?.isGM) return;
        // El catálogo es estático en el puente: se lee una vez por apertura.
        if (this.catalogoEncuentros === null) {
          const catalogo = await cliente.encounters();
          if (this.bridgeAccessRevoked || !game.user?.isGM) return;
          this.catalogoEncuentros = normalizarCatalogoEncuentros(catalogo);
        }
        if (this.bridgeAccessRevoked || !game.user?.isGM) return;
        this.conexion = "ok";
        this.detalleError = "";
        this.#fallosSeguidos = 0;
      } catch (err) {
        if (this.bridgeAccessRevoked || !game.user?.isGM) return;
        this.conexion = "error";
        this.detalleError = err instanceof BridgeError ? err.message : game.i18n.localize("LAGUNAK.Errores.Desconocido");
        this.#fallosSeguidos = Math.min(this.#fallosSeguidos + 1, 10);
        // Salida segura: si el sondeo falla con una confirmación pendiente,
        // no se deja la UI esperando para siempre un estado inobservable.
        if (this.confirmacionPendiente !== null) {
          this.confirmacionPendiente = null;
          this.falloOrden = true;
        }
      }
      if (this.rendered) {
        const nave = this.ultimoEstado?.ship ?? null;
        const ruta = prepareRoute(nave, game.i18n);
        const sistemas = nave ? prepareSystemRows(nave, game.i18n) : [];
        const firmaActual = firmaEstadoNaveVisible({
          conexion: this.conexion,
          detalleError: this.detalleError,
          ayudaAbierta: this.ayudaAbierta,
          esGM: Boolean(game.user?.isGM),
          naveExiste: Boolean(nave),
          naveCallsign: nave?.callsign ?? null,
          ruta,
          pausa: prepararVistaPausa({
            conexion: this.conexion,
            paused: this.pausaConfirmada,
            pendiente: this.ordenPendiente ?? this.confirmacionPendiente,
            falloOrden: this.falloOrden,
            foundryPausado: Boolean(game.paused),
            i18n: game.i18n,
          }),
          encuentros: prepararVistaEncuentros({
            conexion: this.conexion,
            catalogo: this.catalogoEncuentros,
            pendiente: this.encuentroPendiente,
            seleccionArquetipo: this.encuentroArquetipo,
            seleccionRumbo: this.encuentroRumbo,
            i18n: game.i18n,
          }),
          maniobra: prepararVistaManiobra({
            conexion: this.conexion,
            ship: nave,
            pendiente: this.maniobraPendiente,
            i18n: game.i18n,
          }),
          maniobraFallo: this.maniobraFallo,
          ingenieria: prepararVistaIngenieria({
            conexion: this.conexion,
            ship: nave,
            pendiente: this.ingenieriaPendiente,
            seleccionSistema: this.ingenieriaSistema,
            seleccionNivel: this.ingenieriaNivel,
            i18n: game.i18n,
          }),
          ingenieriaFallo: this.ingenieriaFallo,
          sistemas,
        });
        const cambioVisible = firmaActual !== this.#firmaVisibleAnterior;
        this.#firmaVisibleAnterior = firmaActual;
        if (cambioVisible) this.#renderConservandoFoco();
        else this.#actualizarTelemetriaDom(nave, ruta, sistemas);
      }
      this.#programar();
    }

    #programar() {
      clearTimeout(this.#timer);
      this.#timer = setTimeout(() => this.#sondear(), this.#intervaloMs());
    }

    /**
     * Patch directo del DOM para telemetría continua (posición, rumbo, casco,
     * energía, distancia/ETA y salud/calor/potencia de sistemas) que no
     * necesita reconstruir el panel ni sus regiones role="status" — evita el
     * ruido de aria-live del sondeo periódico (issue #227 punto 6).
     */
    #actualizarTelemetriaDom(nave, ruta, sistemas) {
      const raiz = this.element;
      if (!raiz?.querySelector || !nave) return;
      const set = (selector, texto) => {
        const nodo = raiz.querySelector(selector);
        if (nodo && nodo.textContent !== texto) nodo.textContent = texto;
      };
      // Celdas con barra: texto y relleno se actualizan juntos, sin rehacer DOM.
      const setBarra = (selector, texto, barra) =>
        aplicarBarraDom(raiz.querySelector(selector), texto, barra);
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
      }
    }

    /**
     * Única vía de actualización de `pausaConfirmada`: una lectura real de
     * /v1/scenario. El ACK de /v1/command solo deja `confirmacionPendiente`;
     * aquí se resuelve como confirmada (notificación) o discordante (aviso y
     * estado de error con reintento coherente).
     */
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

    _onFirstRender(context, options) {
      super._onFirstRender?.(context, options);
      this.#sondear();
    }

    _onRender(context, options) {
      super._onRender?.(context, options);
      restaurarFoco(this.element, this.#focoAConservar);
      this.#focoAConservar = null;
      const ayuda = this.element?.querySelector?.(".lagunak-ayuda");
      ayuda?.addEventListener?.("toggle", (event) => {
        this.ayudaAbierta = Boolean(event.currentTarget?.open);
      });
      // El sondeo reemplaza el DOM: las selecciones se conservan en la instancia.
      this.element?.querySelector?.("[data-lagunak-encuentro-arquetipo]")?.addEventListener?.("change", (event) => {
        this.encuentroArquetipo = event.currentTarget?.value || null;
      });
      this.element?.querySelector?.("[data-lagunak-encuentro-rumbo]")?.addEventListener?.("change", (event) => {
        this.encuentroRumbo = event.currentTarget?.value || null;
      });
      // La selección de ingeniería se conserva en la instancia para sobrevivir
      // a los reemplazos del DOM del sondeo (que reconstruyen los <select>).
      const sistema = this.element?.querySelector?.('[data-field="ingenieria-sistema"]');
      sistema?.addEventListener?.("change", (event) => {
        this.ingenieriaSistema = event.currentTarget?.value ?? null;
      });
      const nivel = this.element?.querySelector?.('[data-field="ingenieria-nivel"]');
      nivel?.addEventListener?.("change", (event) => {
        const parsed = Number(event.currentTarget?.value);
        if (Number.isFinite(parsed)) this.ingenieriaNivel = parsed;
      });
    }

    _onClose(options) {
      clearTimeout(this.#timer);
      this.#timer = null;
      this.#fallosSeguidos = 0;
      this.conexion = "conectando";
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
      this.#focoAConservar = null;
      this.#firmaVisibleAnterior = null;
      super._onClose?.(options);
    }

    async _prepareContext(_options) {
      const nave = this.ultimoEstado?.ship ?? null;
      return {
        conexion: this.conexion,
        conexionOk: this.conexion === "ok",
        conexionError: this.conexion === "error",
        conexionConectando: this.conexion === "conectando",
        detalleError: this.detalleError,
        ayudaAbierta: this.ayudaAbierta,
        esGM: Boolean(game.user?.isGM),
        nave,
        ruta: prepareRoute(nave, game.i18n),
        pausa: prepararVistaPausa({
          conexion: this.conexion,
          paused: this.pausaConfirmada,
          // La UI sigue en «pausando»/«reanudando» hasta observar la lectura.
          pendiente: this.ordenPendiente ?? this.confirmacionPendiente,
          falloOrden: this.falloOrden,
          foundryPausado: Boolean(game.paused),
          i18n: game.i18n,
        }),
        encuentros: prepararVistaEncuentros({
          conexion: this.conexion,
          catalogo: this.catalogoEncuentros,
          pendiente: this.encuentroPendiente,
          seleccionArquetipo: this.encuentroArquetipo,
          seleccionRumbo: this.encuentroRumbo,
          i18n: game.i18n,
        }),
        maniobra: prepararVistaManiobra({
          conexion: this.conexion,
          ship: nave,
          pendiente: this.maniobraPendiente,
          i18n: game.i18n,
        }),
        maniobraFallo: this.maniobraFallo,
        sistemas: nave
          ? prepareSystemRows(nave, game.i18n).map(({ id, name, health, heat, power }) => ({
              id,
              nombre: name,
              salud: textoPorcentaje(health),
              calor: textoPorcentaje(heat),
              potencia: textoPorcentaje(power),
              barras: barrasSistema({ health, heat, power }),
            }))
          : [],
        barras: {
          casco: barraRecurso(nave?.hull, nave?.hull_max),
          energia: barraRecurso(nave?.energy, nave?.energy_max),
        },
        ingenieria: prepararVistaIngenieria({
          conexion: this.conexion,
          ship: nave,
          pendiente: this.ingenieriaPendiente,
          seleccionSistema: this.ingenieriaSistema,
          seleccionNivel: this.ingenieriaNivel,
          i18n: game.i18n,
        }),
        ingenieriaFallo: this.ingenieriaFallo,
      };
    }

    /**
     * Ordena un encuentro del catálogo (#117). Una orden cada vez, como la
     * pausa; revalida revocación y rol tras el await antes de notificar o
     * repoblar (lección de #201: un ACK tardío no debe alterar una ventana ya
     * revocada).
     */
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
        const message = err instanceof BridgeError
          ? err.message
          : game.i18n.localize("LAGUNAK.Errores.Desconocido");
        ui.notifications.error(message);
      } finally {
        this.encuentroPendiente = false;
        if (!this.bridgeAccessRevoked && game.user?.isGM && this.rendered) this.#renderConservandoFoco();
      }
    }

    static async onEncuentro() {
      return this._introducirEncuentro();
    }

    /**
     * Emite una orden directa (#176). Una orden cada vez; revalida revocación y
     * rol tras el await antes de notificar o repoblar (lección de #201).
     */
    async _emitirManiobra(op, value) {
      if (this.maniobraPendiente || !game.user?.isGM || this.bridgeAccessRevoked) return;
      this.maniobraPendiente = true;
      this.maniobraFallo = false;
      if (this.rendered) this.#renderConservandoFoco();
      try {
        const respuesta = await ordenarManiobra({
          op,
          value,
          isGM: Boolean(game.user?.isGM),
          client: this.#cliente(),
        });
        if (this.bridgeAccessRevoked || !game.user?.isGM) return;
        const { ok, clave } = claveResultadoManiobra(respuesta);
        this.maniobraFallo = !ok;
        (ok ? ui.notifications.info : ui.notifications.warn).call(
          ui.notifications,
          game.i18n.localize(clave),
        );
      } catch (err) {
        if (this.bridgeAccessRevoked || !game.user?.isGM) return;
        this.maniobraFallo = true;
        const message = err instanceof BridgeError
          ? err.message
          : game.i18n.localize("LAGUNAK.Errores.Desconocido");
        ui.notifications.error(message);
      } finally {
        this.maniobraPendiente = false;
        if (!this.bridgeAccessRevoked && game.user?.isGM && this.rendered) this.#renderConservandoFoco();
      }
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
      // Una orden cada vez: mientras una viaja o espera confirmación, la UI
      // deshabilita ambas.
      if (this.ordenPendiente !== null || this.confirmacionPendiente !== null) return;
      this.ordenPendiente = paused;
      this.falloOrden = false;
      if (this.rendered) this.#renderConservandoFoco();
      try {
        const changed = await setSimulationPaused({
          paused,
          isGM: Boolean(game.user?.isGM),
          client: this.#cliente(),
        });
        if (changed && !this.bridgeAccessRevoked && game.user?.isGM) {
          // El ACK solo confirma que la orden fue aceptada: el estado se
          // considera confirmado únicamente al observarlo en /v1/scenario.
          this.confirmacionPendiente = paused;
        }
      } catch (err) {
        this.falloOrden = true;
        const message = err instanceof BridgeError
          ? err.message
          : game.i18n.localize("LAGUNAK.Errores.Desconocido");
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

    /**
     * Reparte energía al sistema seleccionado (panel de ingeniería del GM).
     * Una orden cada vez; revalida revocación y rol tras el await antes de
     * notificar o repoblar (lección de #201: un ACK tardío no debe alterar una
     * ventana ya revocada).
     */
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
        const respuesta = await ajustarPotencia({
          system,
          level,
          isGM: Boolean(game.user?.isGM),
          client: this.#cliente(),
        });
        if (this.bridgeAccessRevoked || !game.user?.isGM) return;
        const { ok, clave } = claveResultadoIngenieria(respuesta);
        this.ingenieriaFallo = !ok;
        (ok ? ui.notifications.info : ui.notifications.warn).call(
          ui.notifications,
          game.i18n.localize(clave),
        );
      } catch (err) {
        if (this.bridgeAccessRevoked || !game.user?.isGM) return;
        this.ingenieriaFallo = true;
        const message = err instanceof BridgeError
          ? err.message
          : game.i18n.localize("LAGUNAK.Errores.Desconocido");
        ui.notifications.error(message);
      } finally {
        this.ingenieriaPendiente = false;
        if (!this.bridgeAccessRevoked && game.user?.isGM && this.rendered) this.#renderConservandoFoco();
      }
    }

    /** Primer sistema presente en el último estado, para el valor por defecto. */
    #sistemaIngenieriaPorDefecto() {
      const vista = prepararVistaIngenieria({
        conexion: this.conexion,
        ship: this.ultimoEstado?.ship ?? null,
        i18n: game.i18n,
      });
      return vista.opcionesSistema[0]?.id ?? null;
    }

    /** Acción del botón «Anotar estado»: escribe el estado actual en el diario. */
    static async onAnotar() {
      if (!game.user?.isGM) return;
      const nave = this.ultimoEstado?.ship;
      if (!nave) {
        ui.notifications.warn(game.i18n.localize("LAGUNAK.Errores.SinEstado"));
        return;
      }

      const nombreDiario = game.i18n.localize("LAGUNAK.Diario.Nombre");
      const diario =
        game.journal.getName(nombreDiario) ??
        (await JournalEntry.create({ name: nombreDiario }));

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
