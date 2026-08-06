import assert from "node:assert/strict";
import test from "node:test";

import { BANDAS } from "../scripts/asistencia/bandas.mjs";
import { CATALOGO_BASE, TAREAS_BASE } from "../scripts/asistencia/catalogo.mjs";
import { CLASES_ENFOQUE } from "../scripts/asistencia/enfoques.mjs";
import { abrir, crearSesion } from "../scripts/asistencia/sesion.mjs";
import { crearReto } from "../scripts/asistencia/temporizacion.mjs";
import { crearReto as crearRetoSecuencia } from "../scripts/asistencia/secuencia.mjs";
import { crearReto as crearRetoPrecision } from "../scripts/asistencia/precision.mjs";
import { crearReto as crearRetoPuzzle } from "../scripts/asistencia/puzzle.mjs";
import {
  FASES,
  vistaCierre,
  vistaOferta,
  vistaReto,
  vistaRetoPrecision,
  vistaRetoPuzzle,
  vistaRetoSecuencia,
  vistaTareas,
} from "../scripts/asistencia/vista.mjs";

/** Una oferta real, tal y como la produce el motor. Nada de datos inventados. */
function ofertaReal(tareaId = "estabilizar-sistema-caliente", opciones = {}) {
  const resultado = abrir({
    estado: crearSesion(),
    tarea: CATALOGO_BASE.buscar(tareaId),
    asistenteId: "asistente",
    nonce: "n1",
    tieneFicha: true,
    gmPermiteRecursos: true,
    ahora: 0,
    ...opciones,
  });
  assert.ok(resultado.ok, "el fixture debe abrir de verdad");
  return resultado.oferta;
}

test("las tareas narrativas se listan y se marcan, en vez de esconderse", () => {
  // Esconderlas haría creer que a sensores no se le puede ayudar. Lo que no
  // puede es prometer un efecto en la simulación, y eso sí se escribe.
  const vistas = vistaTareas(TAREAS_BASE);
  const sensores = vistas.find((t) => t.puestoAsistido === "sensors");
  assert.ok(sensores, "sensores sigue en la lista");
  assert.equal(sensores.narrativa, true);

  const ingenieria = vistas.find((t) => t.puestoAsistido === "engineering");
  assert.equal(ingenieria.narrativa, false);
  assert.equal(ingenieria.clavePuesto, "LAGUNAK.Puestos.engineering");
});

test("cada enfoque llega con su probabilidad ya legible, antes de comprometerse", () => {
  // Elegir enfoque es la única decisión real de quien ayuda. Sin el número, es
  // un botón al azar.
  const vista = vistaOferta(ofertaReal());
  const conTirada = vista.enfoques.filter((e) => e.conTirada);
  assert.ok(conTirada.length >= 2);
  for (const enfoque of conTirada) {
    assert.ok(Number.isInteger(enfoque.favorable), "porcentaje entero, no una fracción");
    assert.ok(enfoque.favorable >= 0 && enfoque.favorable <= 100);
    assert.ok(enfoque.dificultad > 0, "la CD contra la que se tira");
  }
});

test("una CD más alta da menos probabilidad: el número no es decorativo", () => {
  const vista = vistaOferta(ofertaReal());
  const facil = vista.enfoques.find((e) => e.id === "reparar-en-caliente");
  const dificil = vista.enfoques.find((e) => e.id === "recalcular-margenes");
  assert.ok(dificil.dificultad > facil.dificultad);
  assert.ok(dificil.favorable < facil.favorable, "más CD, menos probabilidad");
});

test("el enfoque sin tirada no finge un 100%: su banda es fija porque el motor la fija", () => {
  const vista = vistaOferta(ofertaReal());
  const conjuro = vista.enfoques.find((e) => e.clase === CLASES_ENFOQUE.SIN_TIRADA);
  assert.ok(conjuro, "con recursos permitidos, la vía de conjuro se ofrece");
  assert.equal(conjuro.conTirada, false);
  assert.equal(conjuro.favorable, null, "sin tirada no hay probabilidad que enseñar");
  assert.equal(conjuro.bandaFija, BANDAS.EXITO);
});

test("el coste viaja pegado a su opción, no en una confirmación posterior", () => {
  // Pagar un espacio de conjuro por sorpresa es cómo se consigue que nadie
  // vuelva a pulsar el botón.
  const vista = vistaOferta(ofertaReal());
  const conjuro = vista.enfoques.find((e) => e.clase === CLASES_ENFOQUE.SIN_TIRADA);
  assert.deepEqual(conjuro.coste, { espacio: 1 });

  const gratis = vista.enfoques.find((e) => e.id === "reparar-en-caliente");
  assert.equal(gratis.coste, null, "el enfoque que no gasta nada no inventa un coste");
});

test("sin permiso del GM la vía que gasta recursos ni se ofrece", () => {
  const vista = vistaOferta(ofertaReal("estabilizar-sistema-caliente", { gmPermiteRecursos: false }));
  assert.ok(
    vista.enfoques.every((e) => e.clase !== CLASES_ENFOQUE.SIN_TIRADA),
    "esa puerta la abre el GM o no existe",
  );
});

test("las bandas a cero no ocupan sitio en el desglose", () => {
  const vista = vistaOferta(ofertaReal());
  for (const enfoque of vista.enfoques.filter((e) => e.conTirada)) {
    assert.ok(enfoque.bandas.length > 0);
    assert.ok(
      enfoque.bandas.every((b) => b.probabilidad > 0),
      "una banda imposible no se lista",
    );
  }
});

test("una oferta que no llega no revienta la ventana", () => {
  assert.equal(vistaOferta(null), null);
  assert.equal(vistaOferta({}), null);
});

test("el reto sale en unidades de pintado, sin cuentas en la plantilla", () => {
  // Una plantilla que multiplica por cien es una plantilla que un día
  // multiplicará mal.
  const reto = crearReto({ semilla: "s", inicioMs: 0 });
  const vista = vistaReto(reto, 100);

  for (const clave of ["cursor", "zonaDesde", "zonaAncho"]) {
    assert.ok(vista[clave] >= 0 && vista[clave] <= 100, `${clave} en 0–100`);
  }
  assert.ok(vista.zonaDesde + vista.zonaAncho <= 100.001, "la zona no se sale de la pista");
});

test("el reto trae SIEMPRE su lectura de texto: no se juega solo con los ojos", () => {
  // Un minijuego que solo se puede jugar viendo moverse una barra excluye a
  // quien no la ve, y la asistencia es justo la mecánica que no debería exigir
  // reflejos finos de nadie.
  const reto = crearReto({ semilla: "s", inicioMs: 0 });
  for (const t of [0, 250, 700, 1500]) {
    const vista = vistaReto(reto, t);
    assert.ok(["centro", "dentro", "cerca", "lejos"].includes(vista.lectura.zona));
    assert.equal(typeof vista.lectura.segundosRestantes, "number");
  }
});

test("«dentro» concuerda con la zona pintada, no se calcula por otro lado", () => {
  const reto = crearReto({ semilla: "s", inicioMs: 0 });
  for (let t = 0; t < 2000; t += 37) {
    const vista = vistaReto(reto, t);
    const dentroDeLaBarra = vista.cursor >= vista.zonaDesde - 0.11 && vista.cursor <= vista.zonaDesde + vista.zonaAncho + 0.11;
    assert.equal(vista.dentro, dentroDeLaBarra, `en t=${t} lo pintado y lo juzgado deben coincidir`);
  }
});

test("sin reto no hay vista de reto, y no es un error", () => {
  assert.equal(vistaReto(null, 0), null);
});

test("la oferta lleva el minijuego de destreza para que la ventana sepa qué reto empezar", () => {
  const conSecuencia = vistaOferta({ via: "destreza", minijuegoDestreza: "secuencia", enfoques: [] });
  assert.equal(conSecuencia.via, "destreza");
  assert.equal(conSecuencia.minijuegoDestreza, "secuencia");

  // Sin declararlo, se asume temporización: compatibilidad con ofertas de
  // antes de #500.
  const sinDeclarar = vistaOferta({ via: "destreza", enfoques: [] });
  assert.equal(sinDeclarar.minijuegoDestreza, "temporizacion");
});

test("el reto de secuencia sale en unidades de pintado, con el progreso del intento en curso", () => {
  const reto = crearRetoSecuencia({ semilla: "s", dificultad: "facil", inicioMs: 0 });

  // En fase «muestra»: hay un símbolo activo y ningún intento propio todavía.
  const enMuestra = vistaRetoSecuencia(reto, [], 1);
  assert.equal(enMuestra.fase, "muestra");
  assert.equal(enMuestra.simboloActivo, reto.secuencia[0]);
  assert.equal(enMuestra.progreso, 0);
  assert.equal(enMuestra.longitud, reto.secuencia.length);
  assert.deepEqual(Array.from(enMuestra.simbolos), Array.from({ length: reto.simbolos }, (_, i) => i));

  // En fase «entrada»: el progreso refleja los intentos ya dados.
  const intentos = [reto.secuencia[0]];
  const enEntrada = vistaRetoSecuencia(reto, intentos, reto.finMuestraMs + 1);
  assert.equal(enEntrada.fase, "entrada");
  assert.equal(enEntrada.simboloActivo, null);
  assert.equal(enEntrada.progreso, 1);
  assert.equal(typeof enEntrada.lectura.segundosRestantes, "number");
});

test("sin reto de secuencia no hay vista, y no es un error", () => {
  assert.equal(vistaRetoSecuencia(null, [], 0), null);
});

test("el reto de precisión sale en unidades de pintado, sin cursor: la zona ya está quieta", () => {
  const reto = crearRetoPrecision({ semilla: "s", dificultad: "facil", inicioMs: 0 });
  const vista = vistaRetoPrecision(reto, 100);

  assert.equal("cursor" in vista, false, "no hay nada que se mueva en precisión");
  for (const clave of ["zonaDesde", "zonaAncho"]) {
    assert.ok(vista[clave] >= 0 && vista[clave] <= 100, `${clave} en 0–100`);
  }
  assert.ok(vista.zonaDesde + vista.zonaAncho <= 100.001, "la zona no se sale de la pista");
  assert.equal(typeof vista.lectura.segundosRestantes, "number");
});

test("sin reto de precisión no hay vista, y no es un error", () => {
  assert.equal(vistaRetoPrecision(null, 0), null);
});

test("el reto de puzzle muestra SIEMPRE el objetivo junto al estado actual del panel", () => {
  const reto = crearRetoPuzzle({ semilla: "s", dificultad: "facil", inicioMs: 0 });
  const panel = [true]; // solo la primera casilla encendida, venga o no a cuento
  const vista = vistaRetoPuzzle(reto, panel, null, 100);

  assert.equal(vista.celdas.length, reto.celdas);
  for (let i = 0; i < reto.celdas; i += 1) {
    assert.equal(vista.celdas[i].objetivo, reto.patronObjetivo[i]);
    assert.equal(vista.celdas[i].encendida, i === 0);
  }
  assert.equal(vista.ultimoIntento, null);
  assert.equal(typeof vista.lectura.segundosRestantes, "number");
});

test("el último intento de puzzle viaja a la vista sin cerrar nada por su cuenta", () => {
  const reto = crearRetoPuzzle({ semilla: "s", dificultad: "facil", inicioMs: 0 });
  const intento = { aciertos: 1, sobrantes: 1, encendidosObjetivo: 2, exacto: false, cerrado: false };
  const vista = vistaRetoPuzzle(reto, [], intento, 100);
  assert.deepEqual(vista.ultimoIntento, { aciertos: 1, sobrantes: 1 });
});

test("sin reto de puzzle no hay vista, y no es un error", () => {
  assert.equal(vistaRetoPuzzle(null, [], null, 0), null);
});

test("el cierre distingue los tres finales que un «no se pudo» aplasta", () => {
  const conFruto = vistaCierre({
    propuesta: { accion: "set_system_coolant", banda: BANDAS.EXITO, puestoAsistido: "engineering" },
  });
  assert.equal(conFruto.tipo, "propuesta");
  // Quién la gasta importa, y no es quien ayudó.
  assert.equal(conFruto.clavePuesto, "LAGUNAK.Puestos.engineering");

  const sinFruto = vistaCierre({ propuesta: { accion: null, banda: BANDAS.FALLO } });
  assert.equal(sinFruto.tipo, "sin-fruto");

  const rechazo = vistaCierre({ rechazo: "presupuesto-agotado" });
  assert.equal(rechazo.tipo, "rechazo");
  assert.equal(rechazo.claveDetalle, "LAGUNAK.Asistencia.Error.presupuesto-agotado");

  assert.equal(vistaCierre({}), null, "sin nada que decir, no se dice nada");
});

test("las fases son las cinco declaradas: añadir una es una decisión", () => {
  assert.deepEqual(Object.values(FASES).sort(), ["cerrada", "esperando", "menu", "oferta", "reto"]);
});
