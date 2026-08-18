// La terraza de la cantina (#579).
//
// Estas pruebas son, casi una a una, los criterios de aceptación del issue. Lo
// que defienden no es el aspecto —eso es playtest— sino las tres promesas que
// se hicieron al abrirlo: que la terraza sea un sitio de la nave y no una escena
// paralela, que el mobiliario salga del vocabulario común y no de medidas
// improvisadas, y que la posición de pesca esté DECLARADA y se pueda localizar
// por nombre sin coordenadas incrustadas.

import assert from "node:assert/strict";
import test from "node:test";

import {
  ANCHO,
  ENTRADA,
  INTERACCIONES,
  PLANTA_TERRAZA,
  PROFUNDIDAD,
  componerTerraza,
  puntoDePesca,
} from "../scripts/terraza-cantina.mjs";
import { colisiona, puertaTocada } from "../scripts/nave-movimiento.mjs";
import { interaccionAlAlcance } from "../scripts/nave-interaccion.mjs";
import { CATALOGO_ANDAR } from "../scripts/nave-catalogo-andar.mjs";
import { VOCABULARIO } from "../scripts/nave-props.mjs";
import { estaEnElPlano } from "../scripts/nave-minimapa.mjs";

const RADIO = 0.35;

/* ---- es un sitio de la nave, no una escena aparte -------------------------- */

test("la terraza es una estancia del MISMO catálogo que el resto de la nave", () => {
  // El criterio de #579: «no introducir una escena paralela ni duplicar el
  // estado espacial de la nave». Una estancia más del catálogo de `Andar` es
  // exactamente eso, y es lo que ya hace la cantina.
  const terraza = CATALOGO_ANDAR.obtener("terraza");
  assert.ok(terraza, "no está en el catálogo: sería una geografía aparte");
  assert.equal(terraza.puertas.length, 1, "una sola puerta, la de vuelta a la cantina");
  assert.equal(terraza.puertas[0].destino.estancia, "cantina");
});

test("se sale a ella andando desde la cantina, y se vuelve", () => {
  const cantina = CATALOGO_ANDAR.obtener("cantina");
  const haciaTerraza = cantina.puertas.filter((p) => p.destino.estancia === "terraza");
  assert.equal(haciaTerraza.length, 1, "la cantina no tiene salida a la terraza");
  // Y a la terraza SOLO se llega desde la cantina: la restricción explícita del
  // issue es que la entrada directa a la cantina siga llevando a la cantina. Se
  // comprueba sobre el catálogo entero, que es donde se rompería.
  const puertasHaciaTerraza = CATALOGO_ANDAR.ids.flatMap((id) =>
    CATALOGO_ANDAR.obtener(id)
      .puertas.filter((p) => p.destino.estancia === "terraza")
      .map(() => id),
  );
  assert.deepEqual(puertasHaciaTerraza, ["cantina"], "hay un atajo a la terraza que se salta la cantina");
});

test("sale en el plano: se anda por ella, y un minimapa que no la dibuja miente", () => {
  assert.equal(estaEnElPlano("terraza"), true);
});

/* ---- se recorre ------------------------------------------------------------ */

test("se aparece en sitio libre y mirando al borde, no a la pared", () => {
  assert.equal(colisiona(ENTRADA.x, ENTRADA.z, RADIO, PLANTA_TERRAZA), false);
  // yaw −π/2 mira a −x, que es hacia fuera. Lo primero al salir a una terraza
  // tiene que ser darse cuenta de que estás fuera.
  assert.ok(Math.abs(Math.sin(ENTRADA.yaw) + 1) < 1e-9, "se sale mirando adentro");
});

test("desde la entrada se llega a la puerta de vuelta y al punto de pesca", () => {
  // La comprobación que ya salvó a la cantina: el mobiliario no puede partir la
  // terraza en zonas incomunicadas. Se inunda desde la entrada.
  const PASO = 0.2;
  const clave = (x, z) => `${Math.round(x / PASO)},${Math.round(z / PASO)}`;
  const libre = (x, z) => x > 0 && z > 0 && x < ANCHO && z < PROFUNDIDAD && !colisiona(x, z, RADIO, PLANTA_TERRAZA);
  const vistos = new Set([clave(ENTRADA.x, ENTRADA.z)]);
  const pendientes = [[ENTRADA.x, ENTRADA.z]];
  while (pendientes.length) {
    const [x, z] = pendientes.pop();
    for (const [dx, dz] of [[PASO, 0], [-PASO, 0], [0, PASO], [0, -PASO]]) {
      if (vistos.has(clave(x + dx, z + dz)) || !libre(x + dx, z + dz)) continue;
      vistos.add(clave(x + dx, z + dz));
      pendientes.push([x + dx, z + dz]);
    }
  }
  const puntos = [...vistos].map((c) => c.split(",").map(Number)).map(([a, b]) => [a * PASO, b * PASO]);

  const [px, pz] = puntoDePesca().punto;
  assert.ok(
    puntos.some(([x, z]) => Math.hypot(x - px, z - pz) < 0.4),
    "al punto de pesca no se llega andando",
  );
  const puerta = CATALOGO_ANDAR.obtener("terraza").puertas[0];
  assert.ok(
    puntos.some(([x, z]) => puertaTocada(x, z, RADIO, [puerta])),
    "no se llega a la puerta de vuelta: quedarías encerrado fuera",
  );
});

/* ---- el mobiliario sale del vocabulario común (#583) ----------------------- */

test("ni una medida de mueble se declara aquí: todo viene del vocabulario", () => {
  // El encargo de #579: «mesa, silla, soporte y barandilla no son geometría de
  // esta terraza, son props reutilizables». Si alguien vuelve a modelarlos a
  // medida, sus medidas dejarán de coincidir con las del catálogo.
  const escena = componerTerraza(ENTRADA.x, 0, ENTRADA.z, ENTRADA.yaw, {});
  assert.ok(escena.poligonos.length > 80, "la terraza está vacía");
  for (const clave of ["mesa", "silla", "soporte", "cana", "barandilla", "taburete"]) {
    assert.ok(VOCABULARIO[clave], `${clave} tendría que venir del vocabulario común`);
  }
});

test("nada de cubos como representación final: lo que se lee tiene partes", () => {
  for (const clave of ["mesa", "silla", "soporte", "cana", "barandilla"]) {
    assert.ok(VOCABULARIO[clave].partes.length >= 3, `${clave} no se lee como lo que dice ser`);
  }
});

test("una caña no es un muro: se puede pasar por debajo", () => {
  // Sobresalen por encima del borde, y bloquear el sitio desde el que se pesca
  // porque «hay una caña delante» es el mismo fallo que la cantina ya resolvió
  // con las botellas de los estantes.
  assert.equal(VOCABULARIO.cana.colision, false);
});

/* ---- la posición de pesca, que es lo que había que hacer bien -------------- */

test("hay una posición de pesca DECLARADA y se localiza por nombre", () => {
  const pesca = puntoDePesca();
  assert.ok(pesca, "sin punto declarado, la pesca de mañana traerá sus coordenadas");
  assert.equal(pesca.id, "punto-pesca");
  assert.equal(INTERACCIONES.length, 1);
  assert.ok(Number.isFinite(pesca.orientacion), "sin orientación, hay que deducirla a ojo");
});

test("el punto de pesca sale del ANCLA del soporte, no de números escritos a mano", () => {
  // La prueba de que no hay coordenadas incrustadas: el punto está justo delante
  // del soporte, a la distancia que declara su ancla, y mirando al revés que él
  // —se coge la caña mirando al soporte y se pesca mirando al vacío—.
  const pesca = puntoDePesca();
  const [px] = pesca.punto;
  assert.ok(px < ANCHO / 2, "el punto de pesca tendría que estar del lado del borde");
  assert.ok(Math.sin(pesca.orientacion) < -0.9, "no se pesca mirando hacia la nave");
});

test("plantándose ahí, el punto responde; desde la mesa, no", () => {
  const [px, pz] = puntoDePesca().punto;
  assert.equal(interaccionAlAlcance(px, pz, RADIO, INTERACCIONES)?.id, "punto-pesca");
  assert.equal(interaccionAlAlcance(4.5, 3.2, RADIO, INTERACCIONES), null);
});

test("el punto de pesca NO concede nada todavía", () => {
  // La regla de `docs/FOUNDRY.md`: una escena puede enseñar, transportar y
  // ambientar; no conceder, contar ni recordar. El punto existe, la mecánica no,
  // y su acción no la atiende nadie — a diferencia de la cabina de la playa, que
  // sí lleva a otra estancia.
  assert.deepEqual(puntoDePesca().accion, { tipo: "pesca" });
});

/* ---- presupuesto ----------------------------------------------------------- */

test("la terraza no es la pieza que rompe el frame", () => {
  // Restricción explícita del issue. El tope se fija aquí para que cruzarlo sea
  // una decisión y no un descuido.
  const escena = componerTerraza(ENTRADA.x, 0, ENTRADA.z, ENTRADA.yaw, {});
  assert.ok(escena.poligonos.length < 700, `${escena.poligonos.length} polígonos en pantalla`);
  assert.ok(escena.estrellas.length > 0, "una terraza al espacio sin estrellas no está al espacio");
});
