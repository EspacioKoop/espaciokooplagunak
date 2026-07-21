/* ================================================================== */
/* Ventana clásica (Application v1): SOLO se usa en v11, donde no      */
/* existe ApplicationV2. Réplica de comportamiento equivalente, sin    */
/* compartir código con la ruta v12+: así no puede afectar a los hosts */
/* modernos. La única diferencia observable es el marco de ventana     */
/* clásico de v11 frente al de v12+.                                   */
/* ================================================================== */

import { BridgeClient, BridgeError } from "./bridge-client.mjs";
import { getBridgeToken } from "./bridge-token-session.mjs";
import { describirFoco, restaurarFoco } from "./foco-render.mjs";
import { processBridgeEvents } from "./event-journal.mjs";
import { anotarAlertas, derivarAlertas } from "./alertas-nave.mjs";
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
import { setSimulationPaused } from "./tempo-control.mjs";
import { contenidoEstadoBitacora, fechaLocal } from "./bitacora-nave.mjs";
import { ALERTAS_NONCE, BACKOFF_MAX_MS, MODULE_ID } from "./lagunak-constantes.mjs";

export function crearClaseV1() {
  return class EstadoNaveAppV1 extends Application {
    #timer = null;
    #fallosSeguidos = 0;
    #sondeando = false;
    // Descriptor del control con foco justo antes de un render que reconstruye
    // el DOM (issue #227): sin esto, cualquier render() con foco activo lo
    // devuelve a document.body, un salto confuso con teclado/lector.
    #focoAConservar = null;
    // Última firma no-telemétrica renderizada (issue #227 punto 6): evita que
    // el sondeo reconstruya el panel —y sus regiones role="status"— cuando
    // solo cambió telemetría continua.
    #firmaVisibleAnterior = null;
    ultimoEstado = null;
    conexion = "conectando";
    detalleError = "";
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
    bridgeAccessRevoked = false;

    static get defaultOptions() {
      return foundry.utils.mergeObject(super.defaultOptions, {
        id: "lagunak-estado-nave",
        classes: ["lagunak-estado"],
        template: `modules/${MODULE_ID}/templates/estado-nave.hbs`,
        width: 440,
        height: "auto",
        resizable: true,
      });
    }

    get title() {
      return game.i18n.localize("LAGUNAK.EstadoNave.Titulo");
    }

    #cliente() {
      return new BridgeClient({
        url: game.settings.get(MODULE_ID, "bridgeUrl"),
        token: getBridgeToken(),
      });
    }

    /** Captura el foco actual antes de reconstruir el DOM; activateListeners lo restaura. */
    #renderConservandoFoco(force) {
      const raiz = this.element?.[0];
      const activo = typeof document !== "undefined" && raiz?.contains?.(document.activeElement)
        ? document.activeElement
        : null;
      this.#focoAConservar = describirFoco(activo, raiz);
      this.render(force);
    }

    #intervaloMs() {
      const base = game.settings.get(MODULE_ID, "pollSeconds") * 1000;
      if (this.#fallosSeguidos === 0) return base;
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
        });
        await anotarAlertas({
          alertas: derivarAlertas(navePrevAlertas, estado?.ship ?? null),
          nonce: ALERTAS_NONCE,
          game,
          JournalEntry,
          ui,
          sigueVigente: () => !this.bridgeAccessRevoked && Boolean(game.user?.isGM),
        });
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
        if (cambioVisible) this.#renderConservandoFoco(false);
        else this.#actualizarTelemetriaDom(nave, ruta, sistemas);
      }
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
      const raiz = this.element?.[0];
      if (!raiz?.querySelector || !nave) return;
      const set = (selector, texto) => {
        const nodo = raiz.querySelector(selector);
        if (nodo && nodo.textContent !== texto) nodo.textContent = texto;
      };
      set('[data-field="nave-posicion"]', `${nave.position?.x ?? "?"}, ${nave.position?.y ?? "?"}`);
      set('[data-field="nave-rumbo"]', `${nave.heading ?? "?"}°`);
      set('[data-field="nave-casco"]', `${nave.hull ?? "?"} / ${nave.hull_max ?? "?"}`);
      set('[data-field="nave-energia"]', `${nave.energy ?? "?"} / ${nave.energy_max ?? "?"}`);
      if (ruta) {
        set('[data-field="ruta-distancia"]', ruta.distanceLabel);
        set('[data-field="ruta-eta"]', ruta.etaLabel);
      }
      for (const sistema of sistemas) {
        set(`[data-sistema-id="${sistema.id}"] [data-campo="salud"]`, `${sistema.health}%`);
        set(`[data-sistema-id="${sistema.id}"] [data-campo="calor"]`, `${sistema.heat}%`);
        set(`[data-sistema-id="${sistema.id}"] [data-campo="potencia"]`, `${sistema.power}%`);
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

    async _render(force, options) {
      await super._render(force, options);
      if (!this.#sondeando) {
        this.#sondeando = true;
        this.#sondear();
      }
    }

    async close(options) {
      clearTimeout(this.#timer);
      this.#timer = null;
      this.#sondeando = false;
      this.#fallosSeguidos = 0;
      this.conexion = "conectando";
      this.pausaConfirmada = null;
      this.ordenPendiente = null;
      this.confirmacionPendiente = null;
      this.falloOrden = false;
      this.ayudaAbierta = false;
      this.ingenieriaSistema = null;
      this.ingenieriaNivel = 1;
      this.ingenieriaPendiente = false;
      this.ingenieriaFallo = false;
      this.maniobraPendiente = false;
      this.maniobraFallo = false;
      this.#focoAConservar = null;
      this.#firmaVisibleAnterior = null;
      return super.close(options);
    }

    activateListeners(html) {
      super.activateListeners(html);
      restaurarFoco(html?.[0], this.#focoAConservar);
      this.#focoAConservar = null;
      html.find('[data-action="anotar"]').on("click", () => this.#anotar());
      html.find('[data-action="ordenarImpulso"]').on("click", (event) =>
        this.#emitirManiobra("impulse", Number(event.currentTarget?.dataset?.value)));
      html.find('[data-action="ordenarWarp"]').on("click", (event) =>
        this.#emitirManiobra("warp", Number(event.currentTarget?.dataset?.value)));
      html.find('[data-action="ordenarEscudos"]').on("click", (event) =>
        this.#emitirManiobra("shields", event.currentTarget?.dataset?.value === "true"));
      html.find('[data-action="ordenarRumbo"]').on("click", () =>
        this.#emitirManiobra("heading", Number(html.find('[data-field="maniobra-rumbo"]').val())));
      html.find('[data-action="pausar"]').on("click", () => this.#cambiarPausa(true));
      html.find('[data-action="reanudar"]').on("click", () => this.#cambiarPausa(false));
      html.find('[data-action="ajustarIngenieria"]').on("click", () => this.#ajustarIngenieria());
      html.find('[data-field="ingenieria-sistema"]').on("change", (event) => {
        this.ingenieriaSistema = event.currentTarget?.value ?? null;
      });
      html.find('[data-field="ingenieria-nivel"]').on("change", (event) => {
        const parsed = Number(event.currentTarget?.value);
        if (Number.isFinite(parsed)) this.ingenieriaNivel = parsed;
      });
      html.find(".lagunak-ayuda").on("toggle", (event) => {
        this.ayudaAbierta = Boolean(event.currentTarget?.open);
      });
    }

    getData(_options) {
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
              salud: health,
              calor: heat,
              potencia: power,
            }))
          : [],
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

    async #ajustarIngenieria() {
      if (this.ingenieriaPendiente || !game.user?.isGM || this.bridgeAccessRevoked) return;
      const system = this.ingenieriaSistema ?? this.#sistemaIngenieriaPorDefecto();
      const level = this.ingenieriaNivel;
      if (system == null) return;
      this.ingenieriaSistema = system;
      this.ingenieriaPendiente = true;
      this.ingenieriaFallo = false;
      if (this.rendered) this.#renderConservandoFoco(false);
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
        if (!this.bridgeAccessRevoked && game.user?.isGM && this.rendered) this.#renderConservandoFoco(false);
      }
    }

    async #emitirManiobra(op, value) {
      if (this.maniobraPendiente || !game.user?.isGM || this.bridgeAccessRevoked) return;
      this.maniobraPendiente = true;
      this.maniobraFallo = false;
      if (this.rendered) this.#renderConservandoFoco(false);
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
        if (!this.bridgeAccessRevoked && game.user?.isGM && this.rendered) this.#renderConservandoFoco(false);
      }
    }

    #sistemaIngenieriaPorDefecto() {
      const vista = prepararVistaIngenieria({
        conexion: this.conexion,
        ship: this.ultimoEstado?.ship ?? null,
        i18n: game.i18n,
      });
      return vista.opcionesSistema[0]?.id ?? null;
    }

    async #cambiarPausa(paused) {
      // Una orden cada vez: mientras una viaja o espera confirmación, la UI
      // deshabilita ambas.
      if (this.ordenPendiente !== null || this.confirmacionPendiente !== null) return;
      this.ordenPendiente = paused;
      this.falloOrden = false;
      if (this.rendered) this.#renderConservandoFoco(false);
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
        if (this.rendered) this.#renderConservandoFoco(false);
      }
    }

    async #anotar() {
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
