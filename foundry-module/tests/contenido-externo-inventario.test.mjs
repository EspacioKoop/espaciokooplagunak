import assert from "node:assert/strict";
import test from "node:test";

import { crearAdaptadorContenido, ADAPTADOR_AUSENTE } from "../scripts/contenido-externo/adaptador.mjs";
import { MOTIVOS } from "../scripts/contenido-externo/edicion.mjs";
import {
  EJEMPLOS_POR_TIPO,
  ORDEN_TIPOS,
  inventarioContenido,
  titularInventario,
} from "../scripts/contenido-externo/inventario.mjs";

/** Documento de 2014 aceptable: fuente en la lista blanca. */
const de2014 = (name) => ({ _id: name, name, system: { source: { book: "MM" } } });
/** Documento de 2024, que el clasificador rechaza por diseño. */
const de2024 = (name) => ({ _id: name, name, system: { source: { book: "XMM" } } });
/** Sin procedencia utilizable: el clasificador falla cerrado. */
const sinNada = (name) => ({ _id: name, name, system: {} });

const adaptadorCon = ({ criaturas = [], objetos = [], hechizos = [] }) =>
  crearAdaptadorContenido({
    proveedor: { criaturas: () => criaturas, objetos: () => objetos, hechizos: () => hechizos },
  });

test("sin proveedor la ventana enseña ceros, que es información, en vez de no abrirse", () => {
  const inventario = inventarioContenido(ADAPTADOR_AUSENTE);
  assert.equal(inventario.disponible, false);
  assert.equal(inventario.total, 0);
  assert.deepEqual(
    inventario.tipos.map((t) => t.tipo),
    [...ORDEN_TIPOS],
    "las tres filas siguen estando, aunque vacías",
  );
  assert.deepEqual(inventario.motivos, []);
});

test("ni un adaptador nulo rompe la ventana", () => {
  // La capa entera de #332 promete no reventar nunca por faltar algo; su primer
  // consumidor no puede ser la excepción.
  const inventario = inventarioContenido(null);
  assert.equal(inventario.disponible, false);
  assert.equal(inventario.aceptados, 0);
});

test("cuenta aceptados y descartados por tipo, sin mezclarlos", () => {
  const inventario = inventarioContenido(
    adaptadorCon({
      criaturas: [de2014("Goblin"), de2024("Goblin nuevo"), sinNada("Bicho sin ficha")],
      objetos: [de2014("Espada")],
      hechizos: [],
    }),
  );

  assert.equal(inventario.disponible, true);
  const porTipo = Object.fromEntries(inventario.tipos.map((f) => [f.tipo, f]));
  assert.equal(porTipo.criatura.aceptados, 1);
  assert.equal(porTipo.criatura.descartados, 2);
  assert.equal(porTipo.objeto.aceptados, 1);
  assert.equal(porTipo.hechizo.aceptados, 0);

  assert.equal(inventario.aceptados, 2);
  assert.equal(inventario.descartados, 2);
  assert.equal(inventario.total, 4);
});

test("los ejemplos llevan nombres: es lo que deja reconocer «esto es mi material»", () => {
  const muchas = Array.from({ length: EJEMPLOS_POR_TIPO + 3 }, (_, i) => de2014(`Criatura ${i}`));
  const inventario = inventarioContenido(adaptadorCon({ criaturas: muchas }));
  const fila = inventario.tipos.find((f) => f.tipo === "criatura");

  assert.equal(fila.ejemplos.length, EJEMPLOS_POR_TIPO, "se corta, no se vuelca el mundo entero");
  assert.equal(fila.ejemplos[0], "Criatura 0");
  assert.ok(
    fila.ejemplos.every((nombre) => nombre.length > 0),
    "un nombre vacío no es un ejemplo",
  );
});

test("solo se listan los motivos que han ocurrido, y de más a menos", () => {
  // Una lista con ocho ceros esconde el único que importa. Y el orden es el de
  // «¿por qué no me sale nada?»: primero lo que más se come el material.
  const inventario = inventarioContenido(
    adaptadorCon({
      criaturas: [de2024("A"), de2024("B"), de2024("C")],
      objetos: [sinNada("D")],
    }),
  );

  assert.deepEqual(
    inventario.motivos.map((m) => m.motivo),
    [MOTIVOS.FUENTE_2024, MOTIVOS.SIN_METADATOS],
  );
  assert.deepEqual(
    inventario.motivos.map((m) => m.total),
    [3, 1],
  );
  assert.ok(
    inventario.motivos.every((m) => m.total > 0),
    "ningún motivo a cero ocupa sitio",
  );
});

test("el titular distingue los tres fallos que un recuento confunde", () => {
  // Es el motivo de que exista la ventana: «0 criaturas» y «no tengo criaturas
  // importadas» se ven igual en una tabla de números.
  assert.equal(titularInventario(inventarioContenido(ADAPTADOR_AUSENTE)), "LAGUNAK.ContenidoExterno.Titular.SinProveedor");

  const vacio = inventarioContenido(adaptadorCon({}));
  assert.equal(titularInventario(vacio), "LAGUNAK.ContenidoExterno.Titular.SinContenido");

  const todoFuera = inventarioContenido(adaptadorCon({ criaturas: [de2024("X"), de2024("Y")] }));
  assert.equal(titularInventario(todoFuera), "LAGUNAK.ContenidoExterno.Titular.TodoDescartado");

  const bien = inventarioContenido(adaptadorCon({ criaturas: [de2014("Z")] }));
  assert.equal(titularInventario(bien), "LAGUNAK.ContenidoExterno.Titular.Correcto");

  assert.equal(titularInventario(null), "LAGUNAK.ContenidoExterno.Titular.SinProveedor");
});

test("un proveedor que explota se ve como «no hay nada», no como una excepción", () => {
  const adaptador = crearAdaptadorContenido({
    proveedor: {
      criaturas: () => {
        throw new Error("mundo a medio cargar");
      },
      objetos: () => [de2014("Espada")],
      hechizos: () => [],
    },
  });

  const inventario = inventarioContenido(adaptador);
  assert.equal(inventario.disponible, true);
  assert.equal(inventario.aceptados, 1, "lo que sí se pudo leer se sigue leyendo");
});

test("el inventario es inmutable: la ventana no puede retocar el diagnóstico", () => {
  const inventario = inventarioContenido(adaptadorCon({ criaturas: [de2014("Goblin")] }));
  assert.ok(Object.isFrozen(inventario));
  assert.ok(Object.isFrozen(inventario.tipos));
  assert.ok(inventario.tipos.every((fila) => Object.isFrozen(fila)));
});

// --- La ventana (superficie de GM) -----------------------------------------

const { adaptadorVigente, contextoContenidoExterno } = await import(
  "../scripts/contenido-externo/ventana.mjs"
);

const mundo = ({ sistema = "dnd5e", actores = [], items = [] } = {}) => ({
  system: { id: sistema },
  actors: actores,
  items,
});

test("un mundo que no es dnd5e no se lee, y la ventana lo dice en vez de callar", () => {
  // El motivo más común de «no me sale nada» no es el filtro de 2014: es tener
  // abierto un mundo de otro sistema. Sin decirlo, el GM culpa al clasificador.
  const contexto = contextoContenidoExterno({ juego: mundo({ sistema: "pf2e" }) });
  assert.equal(contexto.compatible, false);
  assert.equal(contexto.sistema, "pf2e");
  assert.equal(contexto.disponible, false);
  assert.equal(contexto.titular, "LAGUNAK.ContenidoExterno.Titular.SinProveedor");
});

test("sin `game` ninguno la ventana sigue abriendo con ceros", () => {
  const contexto = contextoContenidoExterno({ juego: undefined });
  assert.equal(contexto.compatible, false);
  assert.equal(contexto.aceptados, 0);
  assert.equal(contexto.sistema, "");
});

test("el contexto trae las claves ya compuestas: la plantilla no concatena", () => {
  // Handlebars no trae `concat` ni `join`, y registrar helpers globales para
  // dos líneas sería pagar de más.
  const contexto = contextoContenidoExterno({
    juego: mundo({ actores: [{ _id: "a", type: "npc", name: "Goblin", system: { source: { book: "MM" } } }] }),
  });
  const criaturas = contexto.tipos.find((f) => f.tipo === "criatura");
  assert.equal(criaturas.clave, "LAGUNAK.ContenidoExterno.Tipo.criatura");
  assert.equal(typeof criaturas.ejemplos, "string", "ya unidos, no un array");
  assert.equal(criaturas.ejemplos, "Goblin");
});

test("los motivos también llegan con su clave, y solo los que ocurrieron", () => {
  const contexto = contextoContenidoExterno({
    juego: mundo({ actores: [{ _id: "b", type: "npc", name: "Nuevo", system: { source: { book: "XMM" } } }] }),
  });
  assert.deepEqual(
    contexto.motivos.map((m) => m.clave),
    ["LAGUNAK.ContenidoExterno.Motivo.fuente-2024"],
  );
});

test("el adaptador se construye en cada uso: importar con la ventana abierta se ve", () => {
  // Cachearlo enseñaría el mundo de hace media hora. Leer las colecciones es
  // barato; equivocarse sobre lo que hay importado, no.
  const juego = mundo();
  assert.equal(adaptadorVigente({ juego }).resolverCriaturas().elementos.length, 0);

  juego.actors = [{ _id: "c", type: "npc", name: "Tarde", system: { source: { book: "MM" } } }];
  assert.equal(adaptadorVigente({ juego }).resolverCriaturas().elementos.length, 1);
});
