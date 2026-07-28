import assert from "node:assert/strict";
import test from "node:test";

import {
  IDIOMA_AUTOMATICO,
  crearAplicadorIdioma,
  PREFIJO_CLAVES,
  clavesDelModulo,
  idiomaEfectivo,
  opcionesIdioma,
  rutaIdioma,
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

test("REGRESIÓN: la ruta del manifiesto ya viene resuelta y no se duplica", () => {
  // Fallo visto en Foundry real: `modules/<id>/modules/<id>/lang/en.json` →
  // 404, y el selector no cargaba ningún idioma. `path` llega resuelto desde la
  // raíz de datos, no relativo al módulo.
  assert.equal(
    rutaIdioma("modules/espaciokoop-lagunak/lang/en.json", "espaciokoop-lagunak"),
    "modules/espaciokoop-lagunak/lang/en.json",
  );
  // Una ruta corta sí se completa, por si el manifiesto la trae así.
  assert.equal(
    rutaIdioma("lang/en.json", "espaciokoop-lagunak"),
    "modules/espaciokoop-lagunak/lang/en.json",
  );
  assert.equal(rutaIdioma("/otra/ruta/en.json", "x"), "/otra/ruta/en.json");
  assert.equal(rutaIdioma("", "x"), null);
  assert.equal(rutaIdioma(undefined, "x"), null);
});

// ---- Cargas que se pisan (bloqueante de la revisión) -----------------------

// Aplicador de mentira con cargas que se resuelven a mano, para poder decidir
// el orden de llegada. Es la única forma de reproducir la carrera.
function aplicadorDePrueba() {
  const idiomas = [
    { lang: "es", name: "Español", path: "lang/es.json" },
    { lang: "en", name: "English", path: "lang/en.json" },
  ];
  const estado = { pedido: IDIOMA_AUTOMATICO, idiomaFoundry: "en", idiomas };
  const pendientes = new Map();
  const fusionado = [];
  const fallos = [];
  const aplicar = crearAplicadorIdioma({
    leerEstado: () => ({ ...estado }),
    cargar: (ruta) =>
      new Promise((resolver, rechazar) => {
        pendientes.set(ruta, { resolver, rechazar });
      }),
    fusionar: (traducciones) => fusionado.push(traducciones),
    alFallar: (motivo) => fallos.push(motivo),
  });
  const resolverCon = (ruta, idioma) => {
    const pendiente = pendientes.get(ruta);
    pendientes.delete(ruta);
    // La clave se compone: el rastreo de cobertura de i18n busca literales
    // `LAGUNAK.*` por todo el árbol y exigiría que este invento existiera.
    pendiente.resolver({ [`${PREFIJO_CLAVES}Prueba`]: idioma });
  };
  const romper = (ruta) => {
    const pendiente = pendientes.get(ruta);
    pendientes.delete(ruta);
    pendiente.rechazar(new Error("404"));
  };
  return { estado, aplicar, resolverCon, romper, fusionado, fallos };
}

test("REGRESIÓN: dos cambios seguidos, respuestas en orden inverso — manda el último", () => {
  // El fallo: se lanzaba `es`, luego `en`, y si la respuesta inglesa llegaba
  // antes que la española, la última en fusionarse era la VIEJA. El ajuste
  // quedaba en «en» y los textos en «es», contradiciendo al propio selector, y
  // así se quedaba hasta el cambio siguiente o una recarga.
  const banco = aplicadorDePrueba();

  banco.estado.pedido = "es";
  const primera = banco.aplicar();
  banco.estado.pedido = "en";
  const segunda = banco.aplicar();

  // Llega ANTES la última lanzada...
  banco.resolverCon("lang/en.json", "inglés");
  // ...y después la vieja, que es la que antes ganaba.
  banco.resolverCon("lang/es.json", "español");

  return Promise.all([primera, segunda]).then(([r1, r2]) => {
    assert.equal(r2, "en", "la última petición sí se aplica");
    assert.equal(r1, null, "la vieja se descarta");
    assert.deepEqual(
      banco.fusionado,
      [{ [`${PREFIJO_CLAVES}Prueba`]: "inglés" }],
      "solo se fusiona el idioma vigente",
    );
    assert.ok(banco.fallos.includes("obsoleto"));
  });
});

test("una respuesta que llega tarde no pisa un idioma que ya volvió a su sitio", () => {
  // Caso hermano: la respuesta SÍ es la de la última petición, pero mientras
  // viajaba el ajuste volvió a lo de antes. Fusionar sería igual de erróneo, y
  // el número de generación por sí solo no lo detecta.
  const banco = aplicadorDePrueba();
  banco.estado.pedido = "es";
  const enVuelo = banco.aplicar();
  banco.estado.pedido = "en"; // vuelve al idioma que ya estaba puesto
  banco.resolverCon("lang/es.json", "español");

  return enVuelo.then((resultado) => {
    assert.equal(resultado, null);
    assert.deepEqual(banco.fusionado, [], "no se fusiona nada");
    assert.deepEqual(banco.fallos, ["obsoleto"]);
  });
});

test("una carga que falla no deja la interfaz en claves crudas", () => {
  // Sin fichero no se fusiona nada: se conserva lo que Foundry ya había
  // cargado, que es peor idioma pero sigue siendo texto legible.
  const banco = aplicadorDePrueba();
  banco.estado.pedido = "es";
  const enVuelo = banco.aplicar();
  banco.romper("lang/es.json");
  return enVuelo.then((resultado) => {
    assert.equal(resultado, null);
    assert.deepEqual(banco.fusionado, []);
    assert.deepEqual(banco.fallos, ["no_cargado"]);
  });
});
