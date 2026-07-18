import assert from "node:assert/strict";
import test from "node:test";

import { BridgeError } from "../scripts/bridge-client.mjs";
import {
  claveResultadoReposicion,
  normalizarCatalogoAnclas,
  prepararVistaReposicion,
  reposicionarNave,
} from "../scripts/reposicion-control.mjs";

const i18n = { localize: (key) => key, has: () => false };

test("normaliza el catálogo: descarta no-cadenas, vacíos y duplicados", () => {
  const r = normalizarCatalogoAnclas({ anchors: ["argia", "argia", "", 7, "lagunak", null] });
  assert.deepEqual(r, { anchors: ["argia", "lagunak"] });
});

test("catálogo ausente o malformado degrada a lista vacía", () => {
  assert.deepEqual(normalizarCatalogoAnclas(null), { anchors: [] });
  assert.deepEqual(normalizarCatalogoAnclas({ anchors: "argia" }), { anchors: [] });
});

test("reposicionar: no-GM no toca la red y devuelve null", async () => {
  let llamado = false;
  const client = { repositionShip: async () => { llamado = true; } };
  const r = await reposicionarNave({ anchor: "argia", isGM: false, catalogo: { anchors: ["argia"] }, client });
  assert.equal(r, null);
  assert.equal(llamado, false);
});

test("reposicionar: ancla fuera de catálogo se rechaza sin tocar la red", async () => {
  let llamado = false;
  const client = { repositionShip: async () => { llamado = true; } };
  await assert.rejects(
    reposicionarNave({ anchor: "andromeda", isGM: true, catalogo: { anchors: ["argia"] }, client }),
    (e) => e instanceof BridgeError && e.kind === "parse",
  );
  assert.equal(llamado, false);
});

test("reposicionar: GM con ancla válida ordena al puente", async () => {
  const enviado = [];
  const client = { repositionShip: async (anchor) => { enviado.push(anchor); return { op: "reposition_ship", result: { ok: true } }; } };
  const r = await reposicionarNave({ anchor: "argia", isGM: true, catalogo: { anchors: ["argia", "lagunak"] }, client });
  assert.deepEqual(enviado, ["argia"]);
  assert.deepEqual(r, { op: "reposition_ship", result: { ok: true } });
});

test("clave de resultado: mapea cada reason del puente", () => {
  assert.deepEqual(claveResultadoReposicion({ result: { ok: true } }), { ok: true, clave: "LAGUNAK.Reposicion.Hecha" });
  assert.deepEqual(claveResultadoReposicion({ result: { ok: false, reason: "no_ship" } }), { ok: false, clave: "LAGUNAK.Reposicion.SinNave" });
  assert.deepEqual(claveResultadoReposicion({ result: { ok: false, reason: "not_supported" } }), { ok: false, clave: "LAGUNAK.Reposicion.NoSoportado" });
  assert.deepEqual(claveResultadoReposicion({ result: { ok: false } }), { ok: false, clave: "LAGUNAK.Reposicion.Fallo" });
  assert.deepEqual(claveResultadoReposicion(undefined), { ok: false, clave: "LAGUNAK.Reposicion.Fallo" });
});

test("vista: sin catálogo, no disponible y botón deshabilitado", () => {
  const v = prepararVistaReposicion({ conexion: "ok", catalogo: { anchors: [] }, i18n });
  assert.equal(v.disponible, false);
  assert.equal(v.puedeReposicionar, false);
  assert.deepEqual(v.anclas, []);
});

test("vista: catálogo presente pero sin conexión no permite reposicionar", () => {
  const v = prepararVistaReposicion({ conexion: "error", catalogo: { anchors: ["argia"] }, i18n });
  assert.equal(v.disponible, true);
  assert.equal(v.puedeReposicionar, false);
});

test("vista: orden en vuelo deshabilita el botón", () => {
  const v = prepararVistaReposicion({ conexion: "ok", catalogo: { anchors: ["argia"] }, pendiente: true, i18n });
  assert.equal(v.pendiente, true);
  assert.equal(v.puedeReposicionar, false);
});

test("vista: primera ancla seleccionada por defecto; etiqueta cae al id sin i18n", () => {
  const v = prepararVistaReposicion({ conexion: "ok", catalogo: { anchors: ["argia", "lagunak"] }, i18n });
  assert.equal(v.puedeReposicionar, true);
  assert.deepEqual(v.anclas, [
    { id: "argia", etiqueta: "argia", seleccionada: true },
    { id: "lagunak", etiqueta: "lagunak", seleccionada: false },
  ]);
});

test("vista: selección explícita respeta el ancla elegida y localiza si hay clave", () => {
  const i18nConClave = {
    localize: (k) => (k === "LAGUNAK.Reposicion.Ancla.argia" ? "Puesto avanzado Argia" : k),
    has: (k) => k === "LAGUNAK.Reposicion.Ancla.argia",
  };
  const v = prepararVistaReposicion({ conexion: "ok", catalogo: { anchors: ["argia", "lagunak"] }, seleccionAncla: "lagunak", i18n: i18nConClave });
  assert.equal(v.anclas[0].etiqueta, "Puesto avanzado Argia");
  assert.equal(v.anclas[0].seleccionada, false);
  assert.equal(v.anclas[1].seleccionada, true);
});
