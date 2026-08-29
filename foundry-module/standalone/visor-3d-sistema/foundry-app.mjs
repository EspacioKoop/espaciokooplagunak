// Integración opt-in con Foundry VTT (NO se carga aún).
//
// Este wrapper envuelve el visor standalone en una Application de Foundry para
// que el GM pueda abrirlo como ventana. NO está en `module.json` (esmodules),
// así que por ahora es inerte y no colisiona con nadie. Para activarlo:
//   1) añade "standalone/visor-3d-sistema/foundry-app.mjs" a `esmodules` de
//      foundry-module/module.json;
//   2) llama a `registrarVisorSistema3D()` desde scripts/main.mjs (tras el
//      hook `ready`), por ejemplo creando un botón en los controles de escena.
//
// Three.js se resuelve con el importmap del index.html del visor; en Foundry hay
// que proveerlo (CDN o asset del módulo). El import de visor.mjs es dinámico y
// solo ocurre al renderizar, para no romper el arranque si Three no está listo.

const PLANTILLA = `
<div class="ek3d-sistema">
  <div class="ek3d-barra">
    <button type="button" data-ek3d="pausa">Pausar</button>
    <button type="button" data-ek3d="orbitas">Orbitas: sí</button>
  </div>
  <div class="ek3d-lienzo" style="width:100%;height:420px"></div>
</div>`;

// Visor para Foundry v11 (Application clásica, verificada en v11.302).
// Si el anfitrión expone ApplicationV2, ese es el camino moderno; aquí se deja
// una sola implementación v11 y un comentario para el puente v13.
export class VisorSistemaApp extends Application {
  constructor(opciones = {}) {
    super({
      title: "Visor de sistema planetario 3D",
      width: 720,
      height: 520,
      resizable: true,
      ...opciones,
    });
    this._visor = null;
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["ek3d-visor"],
      template: undefined, // usamos content directo
    });
  }

  async getData() {
    return {};
  }

  // Monta el visor tras pintar el contenido de la ventana.
  async render(force, opciones) {
    await super.render(force, opciones);
    const el = this.element?.[0]?.querySelector?.(".ek3d-lienzo");
    if (!el) return;
    if (this._visor) return; // ya montado

    const { montarEnElemento } = await import("./visor.mjs");
    const { SISTEMA_EJEMPLO } = await import("./datos.mjs");
    this._visor = montarEnElemento(el, { sistema: SISTEMA_EJEMPLO, velocidad: 1 });

    const btnPausa = this.element[0].querySelector('[data-ek3d="pausa"]');
    btnPausa?.addEventListener("click", () => {
      this._visor.velocidad = this._visor.velocidad === 0 ? 1 : 0;
      btnPausa.textContent = this._visor.velocidad === 0 ? "Reanudar" : "Pausar";
    });
    const btnOrbitas = this.element[0].querySelector('[data-ek3d="orbitas"]');
    btnOrbitas?.addEventListener("click", () => {
      this._visor.mostrarOrbitas = !this._visor.mostrarOrbitas;
      btnOrbitas.textContent = `Orbitas: ${this._visor.mostrarOrbitas ? "sí" : "no"}`;
      this._visor.cargarSistema(this._visor.sistema);
    });
  }

  // Limpia el visor al cerrar la ventana.
  async close(opciones) {
    this._visor?.dispose?.();
    this._visor = null;
    return super.close(opciones);
  }
}

// Punto de registro para main.mjs (inertes hasta ser llamados).
export function registrarVisorSistema3D() {
  if (typeof foundry === "undefined" || !game?.user?.isGM) return;
  // Ejemplo: exponer en la consola del GM. Sustituye por el botón de escena
  // real cuando se integre (issue de la ventana de estado de la nave).
  game.settings?.registries; // no-op, placeholder
  Hooks.on("ready", () => {
    if (game.user.isGM) {
      // new VisorSistemaApp().render(true);
    }
  });
}
