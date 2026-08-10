// La consola de puesto (#557).
//
// El riesgo de este módulo es que un mueble sólido se plante encima del
// rectángulo que lo activa: la consola bloquearía su propio disparador y el
// puesto se volvería inalcanzable andando. Eso es lo que más se prueba aquí, y
// sobre el CATÁLOGO REAL, no sobre una sala inventada.

import test from "node:test";
import assert from "node:assert/strict";

import { ladoDeApoyo, piezasConsola } from "../scripts/nave-consola.mjs";
import { CATALOGO_ANDAR } from "../scripts/nave-catalogo-andar.mjs";
import { colisiona } from "../scripts/nave-movimiento.mjs";
import { RADIO_ANDAR } from "../scripts/nave-movimiento-lienzo.mjs";
import { LUZ_FOSFORO, MURAL, SECCION } from "../scripts/paleta.mjs";
import { MINIMO_ALTO, MINIMO_LADO } from "../scripts/nave-piel-objeto.mjs";

const SALA = { ancho: 10, profundidad: 8 };
const ZONA = { x: 6.6, z: 5.2, ancho: 1.6, profundidad: 1.6 };

/** Las salas del catálogo real que tienen puesto, con su consola. */
function salasConConsola() {
  return CATALOGO_ANDAR.ids
    .map((id) => ({ id, estancia: CATALOGO_ANDAR.obtener(id) }))
    .filter(({ estancia }) => (estancia.consolas ?? []).length > 0);
}

test("en TODA sala con consola queda sitio para plantarse dentro de su zona", () => {
  // La invariante que sostiene el módulo: el rect de la consola es donde te
  // pones, así que el mueble no puede llenarlo. Se comprueba barriendo la zona,
  // porque de qué lado queda el hueco depende de contra qué pared se arrimó.
  const salas = salasConConsola();
  assert.ok(salas.length >= 9, "el Phobos tiene nueve salas con sistema, más las pasarelas");
  for (const { id, estancia } of salas) {
    const { rect } = estancia.consolas[0];
    let hueco = false;
    for (let fx = 0.1; fx <= 0.9 && !hueco; fx += 0.1) {
      for (let fz = 0.1; fz <= 0.9 && !hueco; fz += 0.1) {
        const x = rect.x + rect.ancho * fx;
        const z = rect.z + rect.profundidad * fz;
        if (!colisiona(x, z, RADIO_ANDAR, estancia.planta)) hueco = true;
      }
    }
    assert.ok(hueco, `en ${id} la consola tapa su propio disparador`);
  }
});

test("solo el cuerpo estorba; lo demás se mira, no se choca", () => {
  const piezas = piezasConsola({ zona: ZONA, sala: SALA });
  const solidas = piezas.filter((p) => p.colision !== false);
  assert.equal(solidas.length, 1, "una mesa, no un mueble por pieza");
  assert.equal(solidas[0].nombre, "consolaCuerpo");
});

test("el cuerpo es lo bastante grande para vestirse con la piel de objeto", () => {
  // Con 0,55 de fondo se quedaba por debajo de `MINIMO_LADO` y salía una caja
  // negra en la sala más trabajada de la nave. Antes de bajar el mínimo hay que
  // preguntarse si la pieza es grande: una mesa de 62 cm de fondo lo es.
  const cuerpo = piezasConsola({ zona: ZONA, sala: SALA }).find((p) => p.nombre === "consolaCuerpo");
  const [ancho, alto, fondo] = cuerpo.medidas;
  assert.ok(Math.min(ancho, fondo) >= MINIMO_LADO, "se queda sin piel por poco");
  assert.ok(alto >= MINIMO_ALTO);
  assert.notEqual(cuerpo.piel, false, "y no renuncia a ella");
});

test("la pantalla es lo único emisivo, y va apagada de tono", () => {
  const piezas = piezasConsola({ zona: ZONA, sala: SALA });
  const emisivas = piezas.filter((p) => p.emisivo === true);
  assert.equal(emisivas.length, 1);
  assert.equal(emisivas[0].nombre, "consolaPantalla");
  assert.equal(emisivas[0].color, LUZ_FOSFORO);
  // Emisivo significa que llega al ojo SIN sombrear, así que su tono es el que
  // se ve: un cian saturado se lee como un error de pantalla, no como un tubo.
  const canal = (i) => parseInt(LUZ_FOSFORO.slice(1 + i * 2, 3 + i * 2), 16);
  assert.ok(Math.max(canal(0), canal(1), canal(2)) < 200, "una pantalla no es una linterna");
});

test("la pantalla está VACÍA: una sola pieza, sin nada dibujado encima", () => {
  // La regla de #526 donde más creíble sería saltársela. No se puede testear «no
  // parece un gráfico», pero sí que no hay con qué dibujarlo: una única cara de
  // color plano, sin sub-piezas dentro del rectángulo de la pantalla.
  const piezas = piezasConsola({ zona: ZONA, sala: SALA });
  const pantalla = piezas.find((p) => p.nombre === "consolaPantalla");
  // Lo que se busca es algo DELANTE de la pantalla, no detrás: el marco del
  // monitor comparte su recuadro y está por detrás sosteniéndola, que es su
  // trabajo.
  const encima = piezas.filter(
    (p) =>
      p !== pantalla &&
      p.nombre !== "consolaMonitor" &&
      Math.abs(p.centro[1] - pantalla.centro[1]) < pantalla.medidas[1] / 2 &&
      Math.abs(p.centro[0] - pantalla.centro[0]) < pantalla.medidas[0] / 2 &&
      Math.abs(p.centro[2] - pantalla.centro[2]) < pantalla.medidas[2] / 2,
  );
  assert.deepEqual(encima, [], "nada pintado sobre la pantalla");
});

test("se arrima a la pared más cercana, sea cual sea", () => {
  const sala = { ancho: 10, profundidad: 10 };
  // Solo eje y sentido: la distancia es un intermedio del cálculo y compararla
  // exacta sería probar la aritmética en coma flotante.
  const lado = (zona) => {
    const { eje, sentido } = ladoDeApoyo(zona, sala);
    return { eje, sentido };
  };
  assert.deepEqual(lado({ x: 8, z: 4, ancho: 1.6, profundidad: 1.6 }), { eje: "x", sentido: 1 });
  assert.deepEqual(lado({ x: 4, z: 0.2, ancho: 1.6, profundidad: 1.6 }), { eje: "z", sentido: -1 });
});

test("una sala sin puesto no tiene consola", () => {
  // Camarotes y la cantina no alojan sistema: plantarles una consola sería
  // ofrecer un puesto que no existe.
  const camarotes = CATALOGO_ANDAR.obtener("camarotes");
  assert.deepEqual(camarotes.consolas, []);
  // Y tampoco su mueble. No se comprueba que la sala esté VACÍA —desde #560
  // lleva maquinaria—, sino que no hay nada con la huella del cuerpo de una
  // consola: eso es lo que significaba la comprobación original.
  const cuerpo = piezasConsola({ zona: ZONA, sala: SALA }).find((p) => p.nombre === "consolaCuerpo");
  const [anchoCuerpo, , fondoCuerpo] = cuerpo.medidas;
  for (const obstaculo of camarotes.planta.obstaculos) {
    const comoConsola =
      Math.abs(obstaculo.ancho - anchoCuerpo) < 1e-6 && Math.abs(obstaculo.profundidad - fondoCuerpo) < 1e-6;
    assert.ok(!comoConsola, "hay un mueble con la huella de una consola en una sala sin puesto");
  }
});

test("ni un color propio", () => {
  const permitidos = new Set([...Object.values(MURAL), ...Object.values(SECCION), LUZ_FOSFORO]);
  for (const pieza of piezasConsola({ zona: ZONA, sala: SALA })) {
    assert.ok(permitidos.has(pieza.color), `${pieza.color} fuera de paleta (#351)`);
  }
});
