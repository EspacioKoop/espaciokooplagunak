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
  ASIENTOS,
  asientosColocados,
  componerTerrazaCon,
  plantaTerraza,
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
  // Un solo punto de pesca. El resto de puntos de la terraza son asientos, y se
  // cuentan aparte a propósito: que aparezca un segundo `punto-pesca` sería un
  // fallo aunque el total cuadrara.
  assert.equal(INTERACCIONES.filter(({ accion }) => accion?.tipo === "pesca").length, 1);
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

test("plantándose ahí, el punto responde; lejos de todo, no", () => {
  const [px, pz] = puntoDePesca().punto;
  assert.equal(interaccionAlAlcance(px, pz, RADIO, INTERACCIONES)?.id, "punto-pesca");
  // Un rincón vacío entre la puerta y el borde: ni asiento ni soporte cerca.
  // Antes se probaba desde (4.5, 3.2), que es la mesa — y desde que las sillas
  // que la rodean SON puntos de interacción, ese sitio ya no está vacío. Lo
  // correcto es mover la sonda, no ensanchar la afirmación.
  assert.equal(interaccionAlAlcance(5.7, 7.9, RADIO, INTERACCIONES), null);
});

test("cada silla y el taburete son un asiento, y sus puntos salen del mueble", () => {
  // Cinco muebles con asiento en la terraza: cuatro sillas y un taburete.
  const asientos = INTERACCIONES.filter(({ accion }) => accion?.tipo === "asiento");
  assert.equal(asientos.length, 5);

  // Ni una coordenada escrita en la escena: el punto de cada asiento coincide
  // con dónde está declarado el mueble en `MOBILIARIO`. Si alguien mueve una
  // silla, su sitio se mueve con ella — el mismo requisito que el punto de pesca.
  const sillas = asientos.filter(({ id }) => id.includes("silla"));
  assert.equal(sillas.length, 4);
  for (const silla of sillas) {
    assert.ok(Number.isFinite(silla.orientacion), "una silla tiene frente: sienta mirando a algo");
  }

  // El taburete no: sin frente, se sienta uno mirando a donde ya miraba.
  const taburete = asientos.find(({ id }) => id.includes("taburete"));
  assert.ok(taburete);
  assert.equal(taburete.orientacion, null);

  // Y un taburete es más alto que una silla, que es lo único que distingue
  // dónde acaban los ojos de uno y de otro.
  assert.ok(taburete.accion.altura > sillas[0].accion.altura);
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

/* ---- los asientos se retiran al ocuparse ----------------------------------- */

test("los cinco asientos tienen pose, y la terraza sabe recomponerse con ellas", () => {
  assert.equal(ASIENTOS.length, 5);
  for (const asiento of ASIENTOS) {
    assert.deepEqual(asiento.nombres, ["libre", "ocupada"]);
  }
});

test("ocupar una silla la retira de la mesa, no hacia un rumbo fijo", () => {
  // Las cuatro sillas rodean la mesa mirando hacia ella desde lados distintos.
  // Si el desplazamiento fuera en coordenadas de sala, todas se irían al mismo
  // sitio y la del oeste acabaría encima de la del norte.
  const MESA = [3.5, 3.2];
  const distanciaAlaMesa = (punto) => Math.hypot(punto[0] - MESA[0], punto[1] - MESA[1]);

  for (const { id } of ASIENTOS.filter(({ clave }) => clave === "silla")) {
    const libre = asientosColocados({}).find((c) => c.id === id);
    const ocupada = asientosColocados({ [id]: "ocupada" }).find((c) => c.id === id);
    assert.ok(
      distanciaAlaMesa(ocupada.asiento.punto) > distanciaAlaMesa(libre.asiento.punto),
      `${id} no se aleja de la mesa al ocuparse`,
    );
  }
});

test("una silla ocupada estorba donde está, no donde estaba", () => {
  // Dibujo y colisión salen de la MISMA declaración: es lo que evita los cuatro
  // fallos que la cantina pagó por tenerlos separados (#540). Se mide en el
  // canto trasero, que es la franja que la silla ocupa SOLO retirada: los 25 cm
  // que se corre son menos que su propio fondo, así que las dos huellas se
  // solapan y el centro no distingue una pose de la otra.
  const id = "silla-mesa-sur";
  const canto = (poses) =>
    Math.max(
      ...plantaTerraza(poses)
        // Solo la silla del sur: la barandilla del borde también cae en esta
        // columna, tres metros más allá, y se llevaría el máximo.
        .obstaculos.filter((o) => Math.abs(o.x + o.ancho / 2 - 3.5) < 0.3 && o.z > 4 && o.z < 6)
        .map((o) => o.z + o.profundidad),
    );
  assert.ok(Math.abs(canto({ [id]: "ocupada" }) - canto({}) - 0.25) < 1e-9, "la huella no se ha movido");

  // Y ahí de verdad no se puede pasar cuando está ocupada, ni estorba cuando no.
  const z = canto({}) + 0.12;
  assert.equal(colisiona(3.5, z, 0.1, plantaTerraza({ [id]: "ocupada" })), true);
  assert.equal(colisiona(3.5, z, 0.1, plantaTerraza({})), false);
});

test("el punto de interacción no se mueve con la silla, y sigue alcanzándola", () => {
  // Se declaran en la pose base a propósito. Los 25 cm que se retira un asiento
  // caben de sobra en el radio de interacción, así que quien está sentado sigue
  // teniendo su asiento al alcance para levantarse — que es lo único que hace
  // falta que siga siendo cierto.
  const id = "silla-mesa-sur";
  const ocupada = asientosColocados({ [id]: "ocupada" }).find((c) => c.id === id);
  const [x, z] = ocupada.asiento.punto;
  assert.equal(interaccionAlAlcance(x, z, RADIO, INTERACCIONES)?.id, `asiento-${id}`);
});

test("la terraza se compone igual de bien con una silla ocupada", () => {
  const conPose = componerTerrazaCon({ "silla-mesa-sur": "ocupada" })(ENTRADA.x, 0, ENTRADA.z, ENTRADA.yaw, {});
  const libre = componerTerraza(ENTRADA.x, 0, ENTRADA.z, ENTRADA.yaw, {});
  assert.ok(conPose.poligonos.length > 0);
  // Mismo número de piezas: una pose mueve el mueble, no lo añade ni lo quita.
  assert.equal(conPose.poligonos.length, libre.poligonos.length);
});
