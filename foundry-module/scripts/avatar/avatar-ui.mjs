// Ventana para que cada quien modele su propio avatar de cantina (#450 sobre
// #423). Mismo patrón que `station-ui.mjs`: `User` como dueño del dato, el GM
// puede corregir, V1/V2 sin código compartido a propósito.
//
// La previsualización es obligatoria y no un extra: con 12 clases × 5 razas ×
// 3 siluetas × N pelos × N pieles × N colores de ropa × 6 gestos, elegir a
// ciegas es imposible de verdad. Se repinta con cada cambio de campo, nunca
// con un bucle propio — es exactamente el mismo criterio de reposo que ya usa
// el resto del módulo con `prefers-reduced-motion` (#227): la figura se está
// editando, no ambientando, y una que gira sola estorba.

import { AVATAR, FACCIONES, RETRATO } from "../paleta.mjs";
import { CLASES, GESTOS, RAZAS, SILUETAS } from "../cantina-avatar.mjs";
import { assignAvatar, avatarDeUsuario, AVATAR_ASSIGNMENT_ERRORS } from "./avatar-assignment.mjs";
import { componerAvatarPreview } from "./avatar-preview.mjs";
import { pintarEscena } from "../retro3d-lienzo.mjs";
import { sugerirAvatarDesdeActor } from "./avatar-sugerencia.mjs";
import { anadirHerramienta } from "../control-escena.mjs";

let avatarApp = null;
let configuredModuleId = null;

export function registerAvatarFeature(moduleId) {
  configuredModuleId = moduleId;
}

export function addAvatarControl(controls) {
  const tool = {
    name: "lagunak-avatar",
    title: "LAGUNAK.Avatar.AbrirControl",
    icon: "fa-solid fa-user-pen",
    button: true,
    onClick: () => openAvatarApp(),
  };

  anadirHerramienta(controls, tool);
}

export function openAvatarApp() {
  if (!configuredModuleId) return;
  // Una instancia nueva por apertura, igual que la cantina: el borrador de
  // edición no tiene por qué sobrevivir a un cierre, y así nunca hay que
  // decidir si lo que se ve es lo guardado o un cambio sin confirmar de la
  // vez anterior.
  avatarApp = new (avatarAppClass())();
  if (foundry.applications?.api?.ApplicationV2) avatarApp.render({ force: true });
  else avatarApp.render(true);
}

function avatarAppClass() {
  return foundry.applications?.api?.ApplicationV2 ? createV2Class() : createV1Class();
}

const CAMPOS_LISTA = Object.freeze([
  { clave: "raza", opciones: RAZAS },
  { clave: "clase", opciones: CLASES },
  { clave: "silueta", opciones: SILUETAS },
  { clave: "gesto", opciones: GESTOS },
]);

const CAMPOS_INDICE = Object.freeze([
  { clave: "pelo", cuantos: AVATAR.pelos.length },
  { clave: "piel", cuantos: RETRATO.cascos.length },
  { clave: "ropa", cuantos: FACCIONES.length },
]);

function contexto(borrador) {
  return {
    tieneSugerencia: Boolean(game.user?.character),
    campos: CAMPOS_LISTA.map(({ clave, opciones }) => ({
      clave,
      etiquetaCampo: game.i18n.localize(`LAGUNAK.Avatar.Campo.${clave}`),
      opciones: opciones.map((valor) => ({
        valor,
        etiqueta: game.i18n.localize(`LAGUNAK.Avatar.${clave}.${valor}`),
        selected: borrador[clave] === valor,
      })),
    })),
    indices: CAMPOS_INDICE.map(({ clave, cuantos }) => ({
      clave,
      etiquetaCampo: game.i18n.localize(`LAGUNAK.Avatar.Campo.${clave}`),
      posicion: `${borrador[clave] + 1} / ${cuantos}`,
    })),
  };
}

/** El estado de edición vive fuera de la clase de ventana: así V1 y V2 leen y
 * escriben exactamente el mismo borrador sin duplicar su forma. */
function borradorInicial() {
  return { ...avatarDeUsuario(game.user, configuredModuleId) };
}

function repintarPrevia(lienzo, borrador) {
  const ctx = lienzo?.getContext?.("2d");
  if (!ctx) return;
  const escena = componerAvatarPreview(borrador, { ancho: lienzo.width, alto: lienzo.height });
  pintarEscena(ctx, escena, { fondo: null });
}

async function guardar(borrador) {
  try {
    const guardado = await assignAvatar({
      actor: game.user,
      target: game.user,
      descripcion: borrador,
      moduleId: configuredModuleId,
    });
    ui.notifications.info(game.i18n.localize("LAGUNAK.Avatar.Guardado"));
    return guardado;
  } catch (error) {
    const key = error?.code === AVATAR_ASSIGNMENT_ERRORS.NOT_ALLOWED
      ? "LAGUNAK.Avatar.NoPermitido"
      : "LAGUNAK.Avatar.ErrorGuardado";
    ui.notifications.error(game.i18n.localize(key));
    return null;
  }
}

/** Cablea los controles de una raíz ya renderizada contra un borrador mutable
 * en memoria. Un solo camino para V1 y V2: lo que cambia entre ellas es cómo
 * se consigue la raíz y cómo se repinta la ventana, no esta lógica. */
function cablear(raiz, borrador, { alGuardar } = {}) {
  const lienzo = raiz?.querySelector?.("[data-avatar-previa]");
  repintarPrevia(lienzo, borrador);

  raiz?.querySelectorAll?.("[data-avatar-campo]")?.forEach((select) => {
    select.addEventListener("change", () => {
      borrador[select.dataset.avatarCampo] = select.value;
      repintarPrevia(lienzo, borrador);
    });
  });

  raiz?.querySelectorAll?.("[data-avatar-indice]")?.forEach((boton) => {
    boton.addEventListener("click", () => {
      const clave = boton.dataset.avatarIndice;
      const cuantos = CAMPOS_INDICE.find((c) => c.clave === clave)?.cuantos ?? 1;
      const paso = boton.dataset.avatarPaso === "-1" ? -1 : 1;
      borrador[clave] = ((borrador[clave] + paso) % cuantos + cuantos) % cuantos;
      repintarPrevia(lienzo, borrador);
      alGuardar?.({ soloRepintar: true });
    });
  });

  raiz?.querySelector?.("[data-avatar-sugerir]")?.addEventListener("click", () => {
    Object.assign(borrador, sugerirAvatarDesdeActor(game.user?.character, borrador));
    repintarPrevia(lienzo, borrador);
    alGuardar?.({ soloRepintar: true, reconstruir: true });
  });

  raiz?.querySelector?.("[data-avatar-guardar]")?.addEventListener("click", async () => {
    await guardar(borrador);
  });
}

function createV2Class() {
  const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
  return class AvatarAppV2 extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
      id: "lagunak-avatar",
      classes: ["lagunak-avatar"],
      window: { title: "LAGUNAK.Avatar.Titulo", icon: "fa-solid fa-user-pen" },
      position: { width: 420, height: "auto" },
    };

    static PARTS = {
      main: { template: `modules/${configuredModuleId}/templates/avatar.hbs` },
    };

    async _prepareContext() {
      this.borrador ??= borradorInicial();
      return contexto(this.borrador);
    }

    _onRender(contextData, options) {
      super._onRender?.(contextData, options);
      // Los índices/sugerencia solo necesitan repintar la previa, no volver a
      // pedir el HTML del select entero: reconstruir la ventana en cada clic
      // de flecha le tiraría el foco al `<body>`.
      cablear(this.element, this.borrador, {
        alGuardar: ({ reconstruir }) => {
          if (reconstruir) this.render({ force: true });
        },
      });
    }
  };
}

function createV1Class() {
  return class AvatarAppV1 extends Application {
    static get defaultOptions() {
      return foundry.utils.mergeObject(super.defaultOptions, {
        id: "lagunak-avatar",
        classes: ["lagunak-avatar"],
        template: `modules/${configuredModuleId}/templates/avatar.hbs`,
        width: 420,
        height: "auto",
        resizable: true,
      });
    }

    get title() {
      return game.i18n.localize("LAGUNAK.Avatar.Titulo");
    }

    getData() {
      this.borrador ??= borradorInicial();
      return contexto(this.borrador);
    }

    activateListeners(html) {
      super.activateListeners(html);
      cablear(html?.[0], this.borrador, {
        alGuardar: ({ reconstruir }) => {
          if (reconstruir) this.render(true);
        },
      });
    }
  };
}
