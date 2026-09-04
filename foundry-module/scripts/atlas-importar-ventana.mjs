import { importarAtlas } from "./importador-atlas.mjs";
import { anadirHerramienta } from "./control-escena.mjs";

let moduloConfigurado = null;

export function registrarImportadorAtlas(moduleId) {
  moduloConfigurado = moduleId;
}

export function addImportadorAtlasControl(controls) {
  if (!game.user?.isGM) return;
  anadirHerramienta(controls, {
    name: "lagunak-importar-atlas",
    title: "LAGUNAK.Controles.ImportarAtlas",
    icon: "fa-solid fa-globe",
    button: true,
    onClick: () => abrirImportadorAtlas(),
  });
}

export async function importarTextoAtlas(contenido, opciones = {}) {
  const catalogo = await importarAtlas(contenido, opciones);
  return {
    entradas: catalogo.entries.length,
    formato: catalogo.format,
    version: catalogo.version,
  };
}

export function abrirImportadorAtlas() {
  if (!moduloConfigurado || !game.user?.isGM || typeof Dialog !== "function") return;

  new Dialog({
    title: game.i18n.localize("LAGUNAK.Atlas.Titulo"),
    content: `<form><p>${game.i18n.localize("LAGUNAK.Atlas.Instruccion")}</p><textarea name="atlas" rows="14" autofocus></textarea><p class="notes">${game.i18n.localize("LAGUNAK.Atlas.NoPersiste")}</p></form>`,
    buttons: {
      validar: {
        label: game.i18n.localize("LAGUNAK.Atlas.Validar"),
        callback: (html) => {
          const contenido = html.find?.("textarea[name=atlas]")?.val?.() ?? "";
          void importarTextoAtlas(contenido)
            .then(({ entradas, formato, version }) => {
              ui.notifications.info(
                game.i18n.format("LAGUNAK.Atlas.Valido", { entradas, formato, version }),
              );
            })
            .catch((error) => {
              ui.notifications.error(
                game.i18n.format("LAGUNAK.Atlas.Invalido", { motivo: error.message }),
              );
            });
        },
      },
      cancelar: { label: game.i18n.localize("LAGUNAK.Atlas.Cancelar") },
    },
    default: "validar",
  }).render(true);
}
