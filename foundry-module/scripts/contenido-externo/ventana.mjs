// La superficie de GM del contenido externo (#332), y el cableado que por fin
// construye el proveedor.
//
// Hasta aquí NADIE llamaba a `crearProveedorFoundry`: la capa entera existía sin
// que una sola línea del módulo la usara. Este archivo es el enchufe, y a la vez
// el primer consumidor —la ventana de diagnóstico que el propio doc de #332
// listaba como pendiente—.
//
// SOLO GM, y no por secretismo: lo que enseña es el estado del MUNDO del
// anfitrión (qué compendios importó, qué se filtró), no información de partida.
// A un jugador no le dice nada y le invitaría a pedir cambios en la instalación
// de otro.
//
// Detectar, no depender: sin sistema compatible el proveedor no se construye y
// la ventana enseña ceros con su titular explicándolo. Es la misma promesa que
// el resto de #332 y no se rompe aquí.
//
// La lógica de qué se cuenta vive en `inventario.mjs`, que es puro. Aquí solo
// hay Foundry.

import { crearAdaptadorContenido } from "./adaptador.mjs";
import { crearProveedorFoundry, sistemaCompatible } from "./proveedor-foundry.mjs";
import { inventarioContenido, titularInventario } from "./inventario.mjs";

let moduloConfigurado = null;
let ventana = null;

export function registrarContenidoExterno(moduleId) {
  moduloConfigurado = moduleId;
}

/**
 * El adaptador vigente. Se construye EN CADA USO y no se cachea a propósito: el
 * GM puede importar un compendio con la ventana abierta, y un adaptador guardado
 * enseñaría el mundo de hace media hora. Leer las colecciones de Foundry es
 * barato; equivocarse sobre lo que hay importado, no.
 */
export function adaptadorVigente({ juego = globalThis.game } = {}) {
  if (!sistemaCompatible(juego)) return crearAdaptadorContenido();
  return crearAdaptadorContenido({ proveedor: crearProveedorFoundry(juego) });
}

/** Contexto de la ventana. Separado del render para poder probarlo. */
export function contextoContenidoExterno({ juego = globalThis.game, adaptador } = {}) {
  const inventario = inventarioContenido(adaptador ?? adaptadorVigente({ juego }));
  // Las claves se componen AQUÍ y no en la plantilla: Handlebars no trae un
  // `concat` y registrar uno propio para esto sería pagar un helper global por
  // dos líneas. Es la misma forma en que `alerta-escena.mjs` arma
  // `LAGUNAK.Alerta.Nivel.<nivel>`.
  return {
    ...inventario,
    titular: titularInventario(inventario),
    tipos: inventario.tipos.map((fila) => ({
      ...fila,
      clave: `LAGUNAK.ContenidoExterno.Tipo.${fila.tipo}`,
      // Unido aquí por lo mismo: `join` tampoco es un helper de Foundry.
      ejemplos: fila.ejemplos.join(", "),
    })),
    motivos: inventario.motivos.map((fila) => ({
      ...fila,
      clave: `LAGUNAK.ContenidoExterno.Motivo.${fila.motivo}`,
    })),
    // El sistema se nombra en la ventana porque el motivo más común de «no sale
    // nada» no es el filtro: es tener un mundo que no es de dnd5e.
    sistema: juego?.system?.id ?? "",
    compatible: sistemaCompatible(juego),
  };
}

export function addContenidoExternoControl(controls) {
  // Solo GM: el resto de la mesa no tiene nada que hacer con esto.
  if (!game.user?.isGM) return;

  const tool = {
    name: "lagunak-contenido-externo",
    title: "LAGUNAK.ContenidoExterno.Control",
    icon: "fa-solid fa-book-open-reader",
    button: true,
    onClick: () => abrirContenidoExterno(),
  };

  if (Array.isArray(controls)) {
    const grupo = controls.find?.((group) => group.name === "lagunak");
    if (grupo) grupo.tools.push(tool);
    return;
  }

  const group = controls?.lagunak;
  if (group?.tools && !Array.isArray(group.tools)) {
    group.tools[tool.name] = { ...tool, order: Object.keys(group.tools).length, onChange: tool.onClick };
  }
}

export function abrirContenidoExterno() {
  if (!moduloConfigurado || !game.user?.isGM) return;
  ventana ??= new (claseVentana())();
  if (foundry.applications?.api?.ApplicationV2) {
    ventana.render({ force: true });
  } else {
    ventana.render(true);
  }
}

function claseVentana() {
  return foundry.applications?.api?.ApplicationV2 ? crearClaseV2() : crearClaseV1();
}

function crearClaseV2() {
  const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
  return class ContenidoExternoV2 extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
      id: "lagunak-contenido-externo",
      classes: ["lagunak-contenido-externo"],
      window: { title: "LAGUNAK.ContenidoExterno.Titulo", icon: "fa-solid fa-book-open-reader" },
      position: { width: 520, height: "auto" },
    };

    static PARTS = {
      main: { template: `modules/${moduloConfigurado}/templates/contenido-externo.hbs` },
    };

    async _prepareContext() {
      return contextoContenidoExterno();
    }
  };
}

function crearClaseV1() {
  return class ContenidoExternoV1 extends Application {
    static get defaultOptions() {
      return foundry.utils.mergeObject(super.defaultOptions, {
        id: "lagunak-contenido-externo",
        classes: ["lagunak-contenido-externo"],
        template: `modules/${moduloConfigurado}/templates/contenido-externo.hbs`,
        width: 520,
        height: "auto",
        resizable: true,
      });
    }

    get title() {
      return game.i18n.localize("LAGUNAK.ContenidoExterno.Titulo");
    }

    getData() {
      return contextoContenidoExterno();
    }
  };
}
