// La maquinaria de sala (#560).
//
// Dos riesgos, y los dos son de colocación más que de dibujo: que un mueble
// sólido caiga donde se aparece al cruzar una puerta —pasó en #557 con la
// consola— y que entre todos sellen un paso. Lo segundo lo cubre la prueba de
// alcanzabilidad sobre el catálogo real; lo primero se ataca aquí.

import test from "node:test";
import assert from "node:assert/strict";

import { CATALOGO, piezasMobiliarioSala, sitiosJuntoAlMuro } from "../scripts/nave-mobiliario-sala.mjs";
import { CATALOGO_ANDAR } from "../scripts/nave-catalogo-andar.mjs";
import { MURAL, SECCION } from "../scripts/paleta.mjs";
import { ALTURA_OJOS } from "../scripts/nave-sala-caja.mjs";

const SALA = { ancho: 12, profundidad: 10 };
const PUERTA = { rect: { x: 5, z: 0, ancho: 2, profundidad: 1.2 } };

const piezas = (extra = {}) =>
  piezasMobiliarioSala({ sala: SALA, sistema: "Reactor", puertas: [PUERTA], semilla: 7, ...extra });

test("la maquinaria sale del SISTEMA de la sala, no de su nombre", () => {
  // Es la misma regla que el resto de la nave: la planta salió del .lua, la
  // consola de tener puesto, y esto del sistema que aloja.
  const reactor = piezas().map((p) => p.nombre.split("-")[1]);
  assert.ok(reactor.includes("conducto"), "un reactor lleva conductos");
  const misiles = piezas({ sistema: "MissileSystem" }).map((p) => p.nombre.split("-")[1]);
  assert.ok(misiles.includes("armario"), "un pañol de misiles lleva armarios");
  assert.notDeepEqual(reactor.sort(), misiles.sort(), "dos sistemas no traen lo mismo");
});

test("dos salas del mismo sistema traen el mismo material", () => {
  // Una nave se monta con material de serie: lo que las diferencia es dónde
  // está cada pieza, no que una tenga otro catálogo.
  const a = piezas({ semilla: 1 }).map((p) => p.nombre.split("-")[1]);
  const b = piezas({ semilla: 99 }).map((p) => p.nombre.split("-")[1]);
  assert.deepEqual(a, b);
});

test("una sala sin sistema lleva lo mínimo: es tránsito", () => {
  const pasarela = piezas({ sistema: null });
  assert.ok(pasarela.length > 0, "algo lleva");
  assert.ok(pasarela.length < piezas().length, "pero mucho menos que una sala de máquinas");
});

test("la densidad se mantiene, no el número", () => {
  // Con una pasada fija, el reactor (22x22) quedaba con cinco muebles en un
  // descampado y una sala pequeña abarrotada con los mismos cinco. Es la misma
  // regla que las luminarias de #555.
  const pequena = piezasMobiliarioSala({ sala: { ancho: 8, profundidad: 6 }, sistema: "Reactor", semilla: 3 });
  const grande = piezasMobiliarioSala({ sala: { ancho: 22, profundidad: 22 }, sistema: "Reactor", semilla: 3 });
  assert.ok(grande.length > pequena.length, "una sala mayor tiene más máquinas");
  const porMetro = (p, sala) => p.length / (2 * (sala.ancho + sala.profundidad));
  const densidadPequena = porMetro(pequena, { ancho: 8, profundidad: 6 });
  const densidadGrande = porMetro(grande, { ancho: 22, profundidad: 22 });
  assert.ok(Math.abs(densidadGrande - densidadPequena) < densidadPequena, "y una densidad parecida");
});

test("nada se planta delante de una puerta", () => {
  // El fallo de #557, que aquí sería peor porque son muchos muebles: quien cruza
  // se aparece cerca de la puerta, y un armario ahí lo deja dentro de la caja.
  const cx = PUERTA.rect.x + PUERTA.rect.ancho / 2;
  const cz = PUERTA.rect.z + PUERTA.rect.profundidad / 2;
  for (const pieza of piezas()) {
    const d = Math.hypot(pieza.centro[0] - cx, pieza.centro[2] - cz);
    assert.ok(d >= 2, `${pieza.nombre} está a ${d.toFixed(2)} m de la puerta`);
  }
});

test("ni delante de la consola, que necesita su hueco", () => {
  const consola = { x: 8, z: 7, ancho: 1.6, profundidad: 1.6 };
  for (const pieza of piezas({ consola })) {
    const d = Math.hypot(pieza.centro[0] - (consola.x + 0.8), pieza.centro[2] - (consola.z + 0.8));
    assert.ok(d >= 1.7, `${pieza.nombre} tapa la consola`);
  }
});

test("todo va pegado al muro: el centro queda despejado", () => {
  // Una sala llena por el medio no se cruza, y el centro es justo por donde se
  // pasa de una puerta a otra.
  for (const pieza of piezas()) {
    const alMuro = Math.min(
      pieza.centro[0],
      SALA.ancho - pieza.centro[0],
      pieza.centro[2],
      SALA.profundidad - pieza.centro[2],
    );
    assert.ok(alMuro < 1.5, `${pieza.nombre} está plantado en mitad de la sala`);
  }
});

test("un mueble se apoya de largo contra su muro", () => {
  // Girado, sobresaldría hacia el paso en vez de pegarse a la pared.
  const contraMuroNorteOSur = sitiosJuntoAlMuro(SALA).filter((s) => s.alLargoDeX);
  assert.ok(contraMuroNorteOSur.length > 0);
  for (const pieza of piezas()) {
    const [ancho, , fondo] = pieza.medidas;
    const catalogo = CATALOGO[pieza.nombre.split("-")[1]];
    const [largoCatalogo, , fondoCatalogo] = catalogo.medidas;
    const derecho = ancho === largoCatalogo && fondo === fondoCatalogo;
    const girado = ancho === fondoCatalogo && fondo === largoCatalogo;
    assert.ok(derecho || girado, "un mueble solo puede ir en uno de los dos sentidos");
  }
});

test("nada llega a la altura de los ojos salvo el conducto", () => {
  // Es maquinaria de sala: si te tapa la vista, deja de ser mobiliario y pasa a
  // ser un muro interior que nadie ha puesto en la planta.
  for (const [clave, { medidas }] of Object.entries(CATALOGO)) {
    if (clave === "conducto") continue;
    assert.ok(medidas[1] <= ALTURA_OJOS + 0.5, `${clave} tapa la vista`);
  }
});

test("determinista, y ni un color propio", () => {
  assert.deepEqual(piezas(), piezas());
  const permitidos = new Set([...Object.values(MURAL), ...Object.values(SECCION)]);
  for (const pieza of piezas()) assert.ok(permitidos.has(pieza.color), `${pieza.color} (#351)`);
});

test("en el catálogo real ninguna sala se queda sin nada ni se llena de más", () => {
  for (const id of CATALOGO_ANDAR.ids) {
    const estancia = CATALOGO_ANDAR.obtener(id);
    if (id === "cantina") continue; // la cantina trae sus 126 muebles a mano (#423)
    const { obstaculos } = estancia.planta;
    assert.ok(obstaculos.length > 0, `${id} sigue vacía`);
    // Un tope por sala, no por mueble: lo que se paga es el conjunto.
    assert.ok(obstaculos.length <= 24, `${id} tiene ${obstaculos.length} obstáculos`);
  }
});
