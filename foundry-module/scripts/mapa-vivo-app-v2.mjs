/* ================================================================== */
/* Mapa vivo (ApplicationV2, v12+). Ventana solo-vista: starfield en   */
/* parallax + blips de contactos de /v1/contacts, con nave, rumbo y    */
/* contactos inequívocos tweeneados entre las dos últimas muestras     */
/* confirmadas (nunca extrapola: es una vista, no un simulador).       */
/* Sondeo de datos cada pollSeconds con backoff; dibujo por rAF a      */
/* MAPA_FPS. NO llama a processBridgeEvents: el diario es asunto de la */
/* ventana de estado (evita anotaciones duplicadas). Misma disciplina  */
/* de aislamiento V2/V1 que el estado de nave.                         */
/* ================================================================== */

import { BridgeClient, BridgeError } from "./bridge-client.mjs";
import { getBridgeToken } from "./bridge-token-session.mjs";
import { dibujarFrame } from "./mapa-render.mjs";
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
import { crearDecorado, componerDecorado } from "./decorado-fondo.mjs";
import { BACKOFF_MAX_MS, MAPA_FPS, MAPA_RADIO_MUNDO, MAPA_SEMILLA, MODULE_ID } from "./lagunak-constantes.mjs";

export function crearClaseMapaV2() {
  const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

  return class MapaVivoApp extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
      id: "lagunak-mapa-vivo",
      classes: ["lagunak-mapa"],
      window: {
        title: "LAGUNAK.MapaVivo.Titulo",
        icon: "fa-solid fa-satellite-dish",
      },
      position: { width: 480, height: "auto" },
    };

    static PARTS = {
      main: { template: `modules/${MODULE_ID}/templates/mapa-vivo.hbs` },
    };

    /** Estado interno: sondeo + animación. */
    #timer = null;
    #fallosSeguidos = 0;
    #generacion = 0;
    #rafId = null;
    #ultimoDibujoMs = null;
    #ultimoFrame = null; // último frame pintado, para el hit-test de clic (issue #259)
    #campo = crearCampoEstrellas(MAPA_SEMILLA);
    #decorado = crearDecorado(MAPA_SEMILLA);
    #muestraPrev = null;
    #muestraActual = null;
    contactos = [];
    destino = null; // último destination confirmado de /v1/state (issue #175)
    seleccion = null; // índice reconciliado del contacto seleccionado
    conexion = "conectando";
    detalleError = "";
    bridgeAccessRevoked = false;

    #cliente() {
      return new BridgeClient({
        url: game.settings.get(MODULE_ID, "bridgeUrl"),
        token: getBridgeToken(),
      });
    }

    #intervaloMs() {
      const base = game.settings.get(MODULE_ID, "pollSeconds") * 1000;
      if (this.#fallosSeguidos === 0) return base;
      return Math.min(base * 2 ** this.#fallosSeguidos, BACKOFF_MAX_MS);
    }

    async #sondear() {
      if (this.bridgeAccessRevoked || !game.user?.isGM) return;
      // La generación se captura al entrar: si la ventana se cierra (o se
      // reabre) con esta petición en vuelo, la respuesta tardía no puede
      // tocar estado, renderizar ni rearmar el polling.
      const generacion = this.#generacion;
      const contactosAnteriores = this.contactos;
      const seleccionAnterior = this.seleccion;
      const firmaAnterior = firmaEstructuralContactos(this.contactos);
      const conexionAnterior = this.conexion;
      const detalleErrorAnterior = this.detalleError;
      let rotadas = null;
      let contactos = null;
      let destino = null;
      let fallo = null;
      try {
        const cliente = this.#cliente();
        await cliente.healthz();
        if (this.bridgeAccessRevoked || !game.user?.isGM) return;
        // Estado y contactos se solicitan juntos para reducir el desfase
        // temporal entre ambas fotografías confirmadas del simulador.
        const resultados = await Promise.allSettled([
          cliente.state(),
          cliente.contacts(),
        ]);
        const rechazado = resultados.find((resultado) => resultado.status === "rejected");
        if (rechazado) throw rechazado.reason;
        const [estado, respuestaContactos] = resultados.map((resultado) => resultado.value);
        const nave = estado?.ship ?? null;
        contactos = normalizarContactosMapa(respuestaContactos?.contacts ?? []);
        destino = nave?.destination ?? null;
        if (nave) {
          const centro = normalizarPosicionMapa(nave.position);
          if (!centro) throw new Error("Posición de nave no finita");
          // Ventana de reproducción: nave, rumbo y contactos comparten los
          // mismos timestamps y avanzan juntos entre sondeos confirmados.
          rotadas = rotarMuestras(this.#muestraActual, {
            centro,
            rumboDeg: Number.isFinite(nave.heading) ? nave.heading : 0,
            contactos,
          }, Date.now());
        }
      } catch (err) {
        fallo = err;
      }
      if (generacion !== this.#generacion || this.bridgeAccessRevoked || !game.user?.isGM) return;
      if (fallo === null) {
        if (rotadas) {
          this.#muestraPrev = rotadas.prev;
          this.#muestraActual = rotadas.actual;
        }
        this.seleccion = reconciliarIndiceContacto(contactosAnteriores, contactos, seleccionAnterior);
        this.contactos = contactos;
        this.destino = destino;
        this.conexion = "ok";
        this.detalleError = "";
        this.#fallosSeguidos = 0;
      } else {
        this.conexion = "error";
        this.detalleError = fallo instanceof BridgeError ? fallo.message : game.i18n.localize("LAGUNAK.Errores.Desconocido");
        this.#fallosSeguidos = Math.min(this.#fallosSeguidos + 1, 10);
      }
      const cambioVisible = conexionAnterior !== this.conexion
        || detalleErrorAnterior !== this.detalleError
        || firmaAnterior !== firmaEstructuralContactos(this.contactos)
        || seleccionAnterior !== this.seleccion;
      // Una posición nueva alimenta el rAF sin sustituir el canvas. Solo los
      // cambios estructurales o de conexión necesitan reconstruir la ventana;
      // las cifras confirmadas se actualizan sobre el DOM estable.
      if (this.rendered && cambioVisible) this.render();
      else if (this.rendered) this.#actualizarTelemetriaDom();
      this.#programar();
    }

    #programar() {
      clearTimeout(this.#timer);
      this.#timer = setTimeout(() => this.#sondear(), this.#intervaloMs());
    }

    #actualizarTelemetriaDom() {
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

    #animar(rafMs = null) {
      // Sin rAF global (p. ej. arnés de pruebas) la animación se auto-inhibe;
      // el mapa sigue funcionando a golpe de re-render del sondeo.
      if (!this.rendered || typeof requestAnimationFrame !== "function") {
        this.#rafId = null;
        return;
      }
      this.#rafId = requestAnimationFrame((siguienteRafMs) => this.#animar(siguienteRafMs));
      const relojRaf = Number.isFinite(rafMs) ? rafMs : (globalThis.performance?.now?.() ?? 0);
      const ahora = Date.now();
      if (!debeDibujar(this.#ultimoDibujoMs, relojRaf, MAPA_FPS)) return;
      // El re-render del sondeo reemplaza el DOM del part (canvas incluido):
      // el lienzo se busca en cada tick, nunca se cachea.
      const canvas = this.element?.querySelector?.(".lagunak-mapa-canvas");
      const ctx = canvas?.getContext?.("2d");
      if (!ctx) return;
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
      const decorado = frame.sinDatos
        ? []
        : componerDecorado(this.#decorado, {
            centro: frame.centro,
            ancho: canvas.width,
            alto: canvas.height,
          });
      dibujarFrame(ctx, frame, { ancho: canvas.width, alto: canvas.height, decorado });
      this.#ultimoFrame = frame;
    }

    _onFirstRender(context, options) {
      super._onFirstRender?.(context, options);
      this.#sondear();
      this.#animar();
    }

    /* Selección de contacto (issue #126): un cambio estructural puede sustituir
     * la lista, así que los listeners se re-atan tras cada render. Clic en el
     * contacto ya seleccionado lo deselecciona. */
    _onRender(context, options) {
      super._onRender?.(context, options);
      this.element?.querySelectorAll?.("[data-contacto]")?.forEach((el) => {
        el.addEventListener("click", () => {
          const indice = Number.parseInt(el.dataset.contactoIndice ?? "", 10);
          if (!Number.isInteger(indice)) return;
          this.seleccion = indice === this.seleccion ? null : indice;
          this.render();
        });
      });
      // Clic directo sobre el objeto en el mapa vivo (issue #259): mismo
      // mecanismo de selección que la lista de contactos, así que reutiliza
      // el panel de detalle ya existente sin duplicar lógica.
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
      // Invalida cualquier #sondear en vuelo: su respuesta tardía morirá en
      // la comparación de generación sin rearmar el polling.
      this.#generacion += 1;
      clearTimeout(this.#timer);
      this.#timer = null;
      if (this.#rafId != null && typeof cancelAnimationFrame === "function") {
        cancelAnimationFrame(this.#rafId);
      }
      this.#rafId = null;
      this.#ultimoDibujoMs = null;
      this.#fallosSeguidos = 0;
      this.conexion = "conectando";
      super._onClose?.(options);
    }

    async _prepareContext(_options) {
      const centro = this.#muestraActual?.centro ?? null;
      const desconocido = game.i18n.localize("LAGUNAK.MapaVivo.Desconocido");
      const propia = game.i18n.localize("LAGUNAK.MapaVivo.LeyendaPropia");
      const contactoSeleccionado = Number.isInteger(this.seleccion)
        ? this.contactos[this.seleccion] ?? null
        : null;
      let detalle = null;
      if (contactoSeleccionado) {
        const d = prepararDetalleContacto(contactoSeleccionado, centro);
        detalle = {
          callsign: d.callsign,
          color: d.color,
          tipo: d.tipo ?? desconocido,
          faccion: d.esJugador ? propia : d.faccion ?? desconocido,
          distanciaLabel: game.i18n.format("LAGUNAK.EstadoNave.DistanciaUnidades", {
            distance: Math.round(d.distancia),
          }),
          rumboLabel: game.i18n.format("LAGUNAK.MapaVivo.RumboGrados", {
            rumbo: Math.round(d.rumboDeg),
          }),
        };
      }
      return {
        conexion: this.conexion,
        conexionOk: this.conexion === "ok",
        conexionError: this.conexion === "error",
        conexionConectando: this.conexion === "conectando",
        detalleError: this.detalleError,
        esGM: Boolean(game.user?.isGM),
        sinDatos: !this.#muestraActual,
        alcanceLabel: game.i18n.format("LAGUNAK.MapaVivo.Alcance", { radio: MAPA_RADIO_MUNDO }),
        detalle,
        leyenda: leyendaContactos(this.contactos).map((e) => ({
          color: e.color,
          etiqueta: e.esJugador
            ? propia
            : e.faccion ?? game.i18n.localize("LAGUNAK.MapaVivo.LeyendaNeutro"),
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
            distanciaLabel: game.i18n.format("LAGUNAK.EstadoNave.DistanciaUnidades", {
              distance: Math.round(distancia),
            }),
            fuera: distancia > MAPA_RADIO_MUNDO,
          };
        }),
      };
    }
  };
}
