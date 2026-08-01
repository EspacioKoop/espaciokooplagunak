import { desmontarLamina, montarLaminaContacto } from "./lamina-contacto.mjs";
import { proyectarParaPuesto } from "./proyeccion-puesto.mjs";
import { prepareSystemRows } from "./ship-view.mjs";

// Puestos que ofrece el selector de vista (#331, paso 2). Es la lista de
// `proyeccion-puesto.mjs` y no una copia con criterio propio: si algún día un
// puesto deja de existir, el selector no puede ser el sitio donde sobreviva.
const PUESTOS_VISTA = Object.freeze([
  "captain",
  "navigation",
  "engineering",
  "sensors",
  "communications",
  "weapons",
]);
/* ================================================================== */
/* Mapa vivo clásico (Application v1, solo v11): réplica equivalente y */
/* AISLADA de la ventana anterior, sin código compartido — mismo       */
/* criterio que EstadoNaveAppV1. `this.element` es jQuery en v1: el    */
/* canvas se busca vía `this.element?.[0]`.                            */
/* ================================================================== */

import { BridgeClient, BridgeError } from "./bridge-client.mjs";
import { getBridgeToken } from "./bridge-token-session.mjs";
import { dibujarFrame } from "./mapa-render.mjs";
import { resolverLoteMapa } from "./mapa-lote.mjs";
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
  BACKOFF_MAX_MS,
  MAPA_FPS,
  MAPA_RADIO_MUNDO,
  MODULE_ID,
  semillaDecoradoActual,
} from "./lagunak-constantes.mjs";

// Estado de movimiento de la nave propia entre frames (para encender los
// propulsores) y deriva ambiente lenta en reposo (para que el fondo «respire»
// aunque la nave esté parada). Guarda el centro anterior en la instancia.
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

export function crearClaseMapaV1() {
  return class MapaVivoAppV1 extends Application {
    #timer = null;
    #fallosSeguidos = 0;
    #sondeando = false;
    #generacion = 0;
    #rafId = null;
    #ultimoDibujoMs = null;
    #ultimoFrame = null; // último frame pintado, para el hit-test de clic (issue #259)
    #campo = crearCampoEstrellas(semillaDecoradoActual());
    #decorado = crearDecorado(semillaDecoradoActual());
    #eventosFondo = crearEventosFondo(semillaDecoradoActual());
    #cacheDecorado = crearCacheDecorado();

    /** Nuevo decorado con `semilla` (issue #215): regenera cielo, decorado y
     * eventos de fondo in situ y limpia la caché de sprites para que el
     * próximo frame rasterice con el nuevo aspecto. */
    regenerarDecorado(semilla) {
      this.#campo = crearCampoEstrellas(semilla);
      this.#decorado = crearDecorado(semilla);
      this.#eventosFondo = crearEventosFondo(semilla);
      this.#cacheDecorado.limpiar();
    }
    #muestraPrev = null;
    #muestraActual = null;
    contactos = [];
    destino = null; // último destination confirmado de /v1/state (issue #175)
    seleccion = null; // índice reconciliado del contacto seleccionado
    // Puesto desde el que se lee el mapa (#331, paso 2). El capitán es la
    // lectura sin editar, así que arrancar ahí deja el mapa como siempre ha
    // sido: la vista es algo que se pide, no algo que se sufre.
    puestoVista = "captain";
    naveVigente = null;
    conexion = "conectando";
    detalleError = "";
    // Estado propio de la superficie de contactos (#276, paso 0): el puente
    // responde, pero `/v1/contacts` no. La nave propia se sigue pintando.
    contactosCaidos = false;
    bridgeAccessRevoked = false;

    static get defaultOptions() {
      return foundry.utils.mergeObject(super.defaultOptions, {
        id: "lagunak-mapa-vivo",
        classes: ["lagunak-mapa"],
        template: `modules/${MODULE_ID}/templates/mapa-vivo.hbs`,
        width: 640,
        height: "auto",
        resizable: true,
      });
    }

    get title() {
      return game.i18n.localize("LAGUNAK.MapaVivo.Titulo");
    }

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
      // Misma disciplina que la ruta V2 (réplica aislada): la generación se
      // captura al entrar y una respuesta tardía tras cerrar muere sin tocar
      // estado, renderizar ni rearmar el polling.
      const generacion = this.#generacion;
      const contactosAnteriores = this.contactos;
      const seleccionAnterior = this.seleccion;
      const firmaAnterior = firmaEstructuralContactos(this.contactos);
      const conexionAnterior = this.conexion;
      const detalleErrorAnterior = this.detalleError;
      const contactosCaidosAnterior = this.contactosCaidos;
      let rotadas = null;
      let contactos = null;
      let destino = null;
      let nave = null;
      let fallo = null;
      let falloContactos = null;
      try {
        const cliente = this.#cliente();
        await cliente.healthz();
        if (this.bridgeAccessRevoked || !game.user?.isGM) return;
        // Mismo reparto que V2 y por el mismo módulo puro: un `contacts` caído
        // no tira un `state` que llegó bien (#276, paso 0). Compartir la
        // DECISIÓN no rompe el aislamiento de esta réplica —que es de la
        // ventana, no de las reglas—, igual que ya se comparten
        // `ventana-nave.mjs` y `mapa-render.mjs`.
        const lote = resolverLoteMapa(...await Promise.allSettled([
          cliente.state(),
          cliente.contacts(),
        ]));
        nave = lote.estado?.ship ?? null;
        destino = nave?.destination ?? null;
        contactos = normalizarContactosMapa(lote.contactosCrudos);
        falloContactos = lote.falloContactos;
        if (nave) {
          const centro = normalizarPosicionMapa(nave.position);
          if (!centro) throw new Error("Posición de nave no finita");
          // Ventana de reproducción equivalente a V2: centro, rumbo y
          // contactos comparten la misma ventana temporal confirmada.
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
        // La nave propia se guarda para las vistas de puesto (#331, paso 2):
        // el vector de navegación y el calor de ingeniería salen de aquí, no de
        // una lectura aparte que podría contradecir a la del mapa.
        this.naveVigente = nave;
        this.conexion = "ok";
        this.detalleError = "";
        // La caída de contactos NO toca `#fallosSeguidos`: el backoff frena el
        // ciclo entero y lo que frena el ciclo es que el puente no conteste.
        this.contactosCaidos = falloContactos !== null;
        this.#fallosSeguidos = 0;
      } else {
        this.conexion = "error";
        this.detalleError = fallo instanceof BridgeError ? fallo.message : game.i18n.localize("LAGUNAK.Errores.Desconocido");
        // Con la conexión caída el aviso de contactos sobra: ya lo dice el de
        // arriba, y dos mensajes de error para una sola causa confunden.
        this.contactosCaidos = false;
        this.#fallosSeguidos = Math.min(this.#fallosSeguidos + 1, 10);
      }
      const cambioVisible = conexionAnterior !== this.conexion
        || detalleErrorAnterior !== this.detalleError
        || contactosCaidosAnterior !== this.contactosCaidos
        || firmaAnterior !== firmaEstructuralContactos(this.contactos)
        || seleccionAnterior !== this.seleccion;
      if (this.rendered && cambioVisible) this.render(false);
      else if (this.rendered) this.#actualizarTelemetriaDom();
      clearTimeout(this.#timer);
      this.#timer = setTimeout(() => this.#sondear(), this.#intervaloMs());
    }

    #actualizarTelemetriaDom() {
      const raiz = this.element?.[0];
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

    // Ajusta el backing del canvas al lado real de dibujo para no subescalar el
    // decorado por debajo de 320 (aliasing de #260). Regenera el decorado solo
    // al cambiar de lado: es determinista y barato entre resizes.
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
      const relojRaf = Number.isFinite(rafMs) ? rafMs : (globalThis.performance?.now?.() ?? 0);
      const ahora = Date.now();
      if (!debeDibujar(this.#ultimoDibujoMs, relojRaf, MAPA_FPS)) return;
      const canvas = this.element?.[0]?.querySelector?.(".lagunak-mapa-canvas");
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
        // El mismo frame, leído desde el puesto elegido (#331, paso 2). El
        // capitán es la lectura sin editar, así que la vista por defecto pinta
        // exactamente lo de siempre.
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

    /* Selección de contacto (issue #126), réplica aislada de la ruta V2:
     * clic selecciona, clic en el seleccionado deselecciona. */
    activateListeners(html) {
      super.activateListeners(html);
      // Lámina del contacto seleccionado (#362). Se remonta en cada render:
      // montar otra lámina de esta ventana detiene la anterior, así que cambiar
      // de selección no deja un bucle huérfano pintando sobre un lienzo que ya
      // no está en el documento. La parada se guarda contra `this` y no contra
      // la raíz porque un render puede sustituir la raíz entera.
      montarLaminaContacto(this.element?.[0], this.detalleVigente, { dueño: this });
      // Ver el comentario de la ruta V2: cambiar de vista no re-renderiza.
      html.find("[data-lagunak-puesto-vista]").on("change", (ev) => {
        this.puestoVista = ev.currentTarget?.value ?? "captain";
      });
      html.find("[data-contacto]").on("click", (ev) => {
        const indice = Number.parseInt(ev.currentTarget?.dataset?.contactoIndice ?? "", 10);
        if (!Number.isInteger(indice)) return;
        this.seleccion = indice === this.seleccion ? null : indice;
        this.render(false);
      });
      // Clic directo sobre el objeto en el mapa vivo (issue #259), misma
      // lógica que la ruta V2: reutiliza la selección/panel de detalle ya
      // existente en vez de un popover flotante nuevo.
      html.find(".lagunak-mapa-canvas").on("click", (ev) => {
        const canvas = ev.currentTarget;
        if (!this.#ultimoFrame || !canvas) return;
        const rect = canvas.getBoundingClientRect();
        const x = ((ev.clientX - rect.left) / rect.width) * canvas.width;
        const y = ((ev.clientY - rect.top) / rect.height) * canvas.height;
        const indice = contactoEnPunto(this.#ultimoFrame.blips, x, y);
        if (indice === null) return;
        this.seleccion = indice === this.seleccion ? null : indice;
        this.render(false);
      });
    }

    async _render(force, options) {
      await super._render(force, options);
      if (!this.#sondeando) {
        this.#sondeando = true;
        this.#sondear();
        this.#animar();
      }
    }

    async close(options) {
      desmontarLamina(this.element?.[0], this);
      // Invalida cualquier #sondear en vuelo (ver comentario en #sondear).
      this.#generacion += 1;
      clearTimeout(this.#timer);
      this.#timer = null;
      this.#sondeando = false;
      if (this.#rafId != null && typeof cancelAnimationFrame === "function") {
        cancelAnimationFrame(this.#rafId);
      }
      this.#rafId = null;
      this.#ultimoDibujoMs = null;
      this.#cacheDecorado.limpiar();
      this.#fallosSeguidos = 0;
      this.conexion = "conectando";
      this.contactosCaidos = false;
      return super.close(options);
    }

    getData(_options) {
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
          clase: d.clase,
          color: d.color,
          tipo: d.tipo ?? desconocido,
          // La clase se escribe además de dibujarse: la lámina es refuerzo, no
          // el único sitio donde se puede leer con qué se está uno encontrando.
          clase: d.clase,
          claseLabel: d.clase ?? desconocido,
          faccion: d.esJugador ? propia : d.faccion ?? desconocido,
          distanciaLabel: game.i18n.format("LAGUNAK.EstadoNave.DistanciaUnidades", {
            distance: Math.round(d.distancia),
          }),
          rumboLabel: game.i18n.format("LAGUNAK.MapaVivo.RumboGrados", {
            rumbo: Math.round(d.rumboDeg),
          }),
        };
      }
      // Se conserva para el pintor de la lámina: al enganchar el DOM la
      // plantilla ya está resuelta y el contexto no llega hasta allí.
      this.detalleVigente = detalle;
      return {
        conexion: this.conexion,
        conexionOk: this.conexion === "ok",
        conexionError: this.conexion === "error",
        conexionConectando: this.conexion === "conectando",
        detalleError: this.detalleError,
        contactosCaidos: this.contactosCaidos,
        esGM: Boolean(game.user?.isGM),
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
