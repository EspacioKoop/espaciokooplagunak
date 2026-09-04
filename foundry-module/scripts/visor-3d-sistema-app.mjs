// Integración con Foundry VTT (ACTIVADA).
//
// Vive en `scripts/` (lo exige el inventario de módulos: todo esmodule de
// `module.json` debe estar bajo `scripts/`, ver scripts/check_orphan_modules.py
// y tests/modulos-alcanzables.test.mjs). Se auto-registra en la barra de
// controles de escena añadiendo un botón al grupo propio `lagunak` (issue #125),
// sin tocar `main.mjs` ni `control-escena.mjs` salvo para reusar su helper puro
// `anadirHerramienta`. Por eso la colisión con otros workers es mínima.
//
// El visor 3D en sí es el visor standalone (carpeta
// `standalone/visor-3d-sistema/`): esta clase solo abre una ventana cuyo
// contenido es un <iframe> que carga `index.html` del visor. La ruta se deduce
// con `import.meta.url`, así que NO hay ninguna sentencia `import` (estática ni
// dinámica) que apunte fuera de `scripts/` — el grafo de alcanzabilidad del
// módulo lo exigiría como consumidor inexistente. El render Three.js queda
// totalmente aislado en la carpeta standalone, que sigue siendo autocontenida.
//
// Compatibilidad v11–v13: usa la clase `Application` clásica (global de appv1),
// que Foundry conserva por retrocompatibilidad en v13; es la misma ruta aislada
// que el resto del módulo usa para v11. Si la clase base no existe en el
// anfitrión, el botón se registra pero al abrir avisa y no rompe nada.
//
// Testeable sin Foundry: `registrarVisorSistema3D(hooks)` y la herramienta se
// exportan, así que un test Node las ejercita con Hooks/juego simulados.

import { anadirHerramienta } from "./control-escena.mjs";

export const ID_BOTON = "lagunak-visor-3d-sistema";
export const CLAVE_TITULO = "LAGUNAK.Controles.AbrirVisor3DSistema";

let visorApp = null;

function abrirVisor3D() {
  if (!game.user?.isGM) return;
  const Base = globalThis.Application;
  if (!Base) {
    console.warn("[lagunak] Visor 3D: Application no disponible en este anfitrión");
    return;
  }
  if (!visorApp) {
    visorApp = new (class extends Base {
      constructor() {
        super({
          title: "Visor de sistema planetario 3D",
          width: 760,
          height: 560,
          resizable: true,
        });
      }

      async render(force, opciones) {
        await super.render(force, opciones);
        const content = this.element?.[0]?.querySelector?.(".window-content");
        if (!content || content.dataset.ek3d) return;
        content.dataset.ek3d = "1";

        // El visor es el standalone: lo cargamos tal cual en un iframe. La ruta
        // relativa se resuelve desde este mismo módulo (import.meta.url), sin
        // sentencias import que el inventario de módulos deba seguir.
        const url = new URL("../standalone/visor-3d-sistema/index.html", import.meta.url).href;
        const iframe = document.createElement("iframe");
        iframe.src = url;
        iframe.title = "Visor de sistema planetario 3D";
        iframe.style.width = "100%";
        iframe.style.height = "100%";
        iframe.style.border = "0";
        iframe.style.display = "block";
        content.innerHTML = "";
        content.appendChild(iframe);
      }
    })();
  }
  if (globalThis.foundry?.applications?.api?.ApplicationV2) visorApp.render({ force: true });
  else visorApp.render(true);
}

// Descriptor de la herramienta de escena. Exportado para testearlo en Node sin
// Foundry: un test simula Hooks/juego y comprueba que se inyecta donde toca.
export const herramientaVisor3D = {
  name: ID_BOTON,
  title: CLAVE_TITULO,
  icon: "fa-solid fa-satellite",
  button: true,
  onClick: () => abrirVisor3D(),
};

/**
 * Registra el botón en la barra de escena. Inyectable: recibe el objeto `Hooks`
 * para que un test lo sustituya por un doble. Solo-GM (el hook de Foundry se
 * dispara para los controles del cliente actual, igual que `gmTools` en
 * main.mjs).
 *
 * @param {object|null} [hooks] - el `Hooks` de Foundry. Si es nulo, no hace nada
 *   (p. ej. en Node sin Foundry).
 */
export function registrarVisorSistema3D(hooks) {
  const destino = hooks ?? (typeof Hooks !== "undefined" ? Hooks : null);
  if (!destino) return;
  destino.on("getSceneControlButtons", (controls) => {
    if (!game.user?.isGM) return;
    anadirHerramienta(controls, herramientaVisor3D);
  });
}

// Auto-registro al cargar en Foundry (Hooks global presente). En Node no pasa
// nada, porque `Hooks` no existe.
registrarVisorSistema3D(typeof Hooks !== "undefined" ? Hooks : null);
