/**
 * Escritura del estado de la nave en el diario de Foundry (acción «Anotar
 * estado» del GM). Compartido por las cuatro factorías de la ventana de
 * estado (V1/V2), extraído de main.mjs.
 */

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => `&#${character.codePointAt(0)};`);
}

export function fechaLocal() {
  const idioma = game.i18n.lang === "es" ? "es-ES" : game.i18n.lang;
  return new Date().toLocaleString(idioma);
}

export function numeroBitacora(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number) : 0;
}

export function contenidoEstadoBitacora(nave, marca) {
  const texto = (key) => escapeHtml(game.i18n.localize(key));
  return `
      <p><strong>${escapeHtml(nave.callsign ?? "?")}</strong> — ${escapeHtml(marca)}</p>
      <ul>
        <li>${texto("LAGUNAK.Diario.Campo.Posicion")}: ${numeroBitacora(nave.position?.x)}, ${numeroBitacora(nave.position?.y)}</li>
        <li>${texto("LAGUNAK.Diario.Campo.Rumbo")}: ${numeroBitacora(nave.heading)}°</li>
        <li>${texto("LAGUNAK.Diario.Campo.Casco")}: ${numeroBitacora(nave.hull)} / ${numeroBitacora(nave.hull_max)}</li>
        <li>${texto("LAGUNAK.Diario.Campo.Energia")}: ${numeroBitacora(nave.energy)} / ${numeroBitacora(nave.energy_max)}</li>
        <li>${texto("LAGUNAK.Diario.Campo.Escudos")}: ${texto(nave.shields_active ? "LAGUNAK.EstadoNave.EscudosActivos" : "LAGUNAK.EstadoNave.EscudosInactivos")}</li>
      </ul>`;
}