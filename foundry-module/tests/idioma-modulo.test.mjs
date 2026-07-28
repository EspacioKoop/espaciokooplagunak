import assert from "node:assert/strict";
import test from "node:test";

import {
  IDIOMA_AUTOMATICO,
  PREFIJO_CLAVES,
  clavesDelModulo,
  idiomaEfectivo,
  opcionesIdioma,
} from "../scripts/idioma-modulo.mjs";

const DISPONIBLES = ["es", "en"];

test("«automático» es seguir a Foundry: quien no toque nada no nota que esto existe", () => {
  assert.equal(idiomaEfectivo(IDIOMA_AUTOMATICO, "es", DISPONIBLES), "es");
  assert.equal(idiomaEfectivo(IDIOMA_AUTOMATICO, "en", DISPONIBLES), "en");
  // Sin valor guardado (cliente que estrena el ajuste) se comporta igual.
  assert.equal(idiomaEfectivo(undefined, "es", DISPONIBLES), "es");
});

test("elegir un idioma propio desacopla el módulo del idioma de Foundry", () => {
  // Es el motivo de existir del ajuste: la mesa juega en castellano aunque el
  // Foundry de esa persona esté en inglés, o al revés.
  assert.equal(idiomaEfectivo("es", "en", DISPONIBLES), "es");
  assert.equal(idiomaEfectivo("en", "es", DISPONIBLES), "en");
});

test("un idioma que el módulo no tiene no deja la interfaz en claves crudas", () => {
  // Se cae al de Foundry si está, y si tampoco, al primero que haya. Enseñar
  // "LAGUNAK.Ajustes.Idioma.Nombre" en pantalla sería peor que enseñarlo en otro
  // idioma.
  assert.equal(idiomaEfectivo("eu", "es", DISPONIBLES), "es");
  assert.equal(idiomaEfectivo("eu", "de", DISPONIBLES), "en", "respaldo por defecto");
  assert.equal(idiomaEfectivo("eu", "de", ["es"]), "es", "o el único que haya");
  assert.equal(idiomaEfectivo("es", "es", []), "en", "sin idiomas declarados, respaldo");
});

test("solo se tocan las claves del módulo", () => {
  // El filtro no es decorativo: sin él este ajuste podría pisar traducciones del
  // core o de otro módulo, que es justo lo que un selector propio NO debe hacer.
  // Las claves se componen en vez de escribirse enteras a propósito: la prueba
  // de cobertura de i18n rastrea literales `LAGUNAK.*` por todo el árbol y
  // exigiría que estos inventos existieran en los ficheros de idioma.
  const propia = `${PREFIJO_CLAVES}Ajustes.Idioma.Nombre`;
  const anidada = `${PREFIJO_CLAVES}NoEsTexto`;
  const fichero = {
    [propia]: "Idioma del módulo",
    "DND5E.AbilityStr": "Fuerza",
    SETTINGS: "Ajustes",
    [anidada]: { anidado: true },
  };
  assert.deepEqual(clavesDelModulo(fichero), { [propia]: "Idioma del módulo" });
  for (const clave of Object.keys(clavesDelModulo(fichero))) {
    assert.ok(clave.startsWith(PREFIJO_CLAVES));
  }
  assert.deepEqual(clavesDelModulo(null), {});
  assert.deepEqual(clavesDelModulo("es.json"), {});
});

test("el desplegable ofrece «automático» primero y cada idioma por su nombre", () => {
  const opciones = opcionesIdioma(
    [
      { lang: "es", name: "Español", path: "lang/es.json" },
      { lang: "en", name: "English", path: "lang/en.json" },
      { name: "sin código" },
    ],
    "Automático",
  );
  assert.deepEqual(Object.keys(opciones), [IDIOMA_AUTOMATICO, "es", "en"]);
  assert.equal(opciones.es, "Español");
  assert.equal(opciones.en, "English");
});
