// Integración con Foundry VTT (ACTIVADA).
//
// Este archivo es un `esmodule` del módulo (ver module.json), así que Foundry
// lo carga y ejecuta al arrancar. Se auto-registra en la barra de controles de
// escena añadiendo un botón al grupo propio `lagunak` (issue #125), sin tocar
// `main.mjs` ni `control-escena.mjs` salvo para reusar su helper puro
// `anadirHerramienta`. Por eso la colisión con otros workers es mínima.
//
// Three.js se importa con la forma `+esm` de jsDelivr DENTRO de `visor.mjs`,
// de modo que funciona aquí sin importmap de módulo. El import es dinámico y
// solo ocurre al abrir la ventana, para no romper el arranque si la CDN falla.
//
// Compatibilidad v11–v13: usa la clase `Application` clásica (global de
// appv1), que Foundry conserva por retrocompatibilidad en v13; es la misma ruta
// aislada que el resto del módulo usa para v11. Si la clase base no existe en
// el anfitrión, el botón se registra pero al abrir avisa y no rompe nada.
//
// Testeable sin Foundry: `registrarVisorSistema3D(hooks)` y la herramienta se
// exportan, así que un test Node las ejercita con Hooks/juego simulados.

import { anadirHerramienta } from "../../scripts/control-escena.mjs";

export const ID_BOTON = "lagunak-visor-3d-sistema";
export const CLAVE_TITULO = "LAGUNAK.Controles.AbrirVisor3DSistema";

const PLANTILLA = `
<div class="ek3d-sistema">
  <div class="ek3d-barra">
    <button type="button" data-ek3d="pausa">Pausar</button>
    <button type="button" data-ek3d="orbitas">Orbitas: sí</button>
  </div>
  <div id="ek3d-lienzo" style="width:100%;height:460px"></div>
</div>`;

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
        this._visor = null;
      }

      async render(force, opciones) {
        await super.render(force, opciones);
        const content = this.element?.[0]?.querySelector?.(".window-content");
        if (!content) return;
        if (!content.dataset.ek3d) {
          content.dataset.ek3d = "1";
          content.innerHTML = PLANTILLA; // una sola vez
        }
        const el = content.querySelector("#ek3d-lienzo");
        if (!el || this._visor) return;

        const [{ montarEnElemento }, { SISTEMA_EJEMPLO }] = await Promise.all([
          import("./visor.mjs"),
          import("./datos.mjs"),
        ]);
        this._visor = montarEnElemento(el, { sistema: SISTEMA_EJEMPLO, velocidad: 1 });

        const btnPausa = content.querySelector('[data-ek3d="pausa"]');
        btnPausa?.addEventListener("click", () => {
          this._visor.velocidad = this._visor.velocidad === 0 ? 1 : 0;
          btnPausa.textContent = this._visor.velocidad === 0 ? "Reanudar" : "Pausar";
        });
        const btnOrbitas = content.querySelector('[data-ek3d="orbitas"]');
        btnOrbitas?.addEventListener("click", () => {
          this._visor.mostrarOrbitas = !this._visor.mostrarOrbitas;
          btnOrbitas.textContent = `Orbitas: ${this._visor.mostrarOrbitas ? "sí" : "no"}`;
          this._visor.cargarSistema(this._visor.sistema);
        });
      }

      async close(opciones) {
        this._visor?.dispose?.();
        this._visor = null;
        return super.close(opciones);
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
