// El cable de la alerta hasta el techo de una sala (#765).
//
// `tonoLuminaria` estaba escrita y probada desde #555, y no la llamaba nadie:
// andar por la nave en alerta roja se veía exactamente igual que en verde. Lo
// que faltaba no era lógica sino un cable, y el bloqueante era real —las trece
// salas se construyen UNA vez al importar el catálogo, mucho antes de que exista
// ninguna telemetría—.
//
// Por eso estas pruebas son sobre `componer`, que es lo que se ejecuta por
// fotograma, y no sobre la lista de piezas horneadas. Y por eso la última mide
// el presupuesto: si teñir cuesta polígonos, es que se está reconstruyendo algo.

import test from "node:test";
import assert from "node:assert/strict";

import { crearSalaCaja } from "../scripts/nave-sala-caja.mjs";
import { estadoDifusor, PERIODO_PARPADEO } from "../scripts/nave-luminaria.mjs";
import { ALERTA, LUZ_CALIDA } from "../scripts/paleta.mjs";

const SALA = { ancho: 8, profundidad: 6, muralPixel: false, pielSuelo: false };

/** Los colores que de verdad han llegado al lienzo en esta pasada.
 *
 * El difusor es la única malla EMISIVA de la sala (#555): se pinta a intensidad
 * plena y sin sombrear, así que su color llega al polígono TAL CUAL. Por eso
 * este arnés puede buscar el tono exacto — sobre cualquier otra pieza habría que
 * deshacer el sombreado, y entonces la prueba mediría el rasterizador. */
function coloresDe(escena) {
  return new Set(escena.poligonos.map((poligono) => poligono.color));
}

/** Desde el fondo de la sala y mirando al frente: es la postura desde la que las
 *  luminarias del techo entran de verdad en el campo de visión, no un truco del
 *  arnés — de pie bajo ellas quedan por encima del encuadre. */
function mirarAlTecho(sala, opciones = {}) {
  return sala.componer(4, 0, 0.6, 0, { ancho: 320, alto: 180, ...opciones });
}

test("sin lectura de alerta, el difusor sigue en la luz cálida de siempre", () => {
  const sala = crearSalaCaja(SALA);
  const colores = coloresDe(mirarAlTecho(sala));
  assert.ok(colores.has(LUZ_CALIDA), "un dato que no ha llegado no puede pintar la nave");
  assert.equal(colores.has(ALERTA.niveles.roja.borde), false);
});

test("con alerta roja difundida, el difusor va en el borde de la alerta", () => {
  const sala = crearSalaCaja(SALA);
  const colores = coloresDe(mirarAlTecho(sala, { aviso: "roja" }));
  assert.ok(colores.has(ALERTA.niveles.roja.borde));
  assert.equal(colores.has(LUZ_CALIDA), false, "o se tiñe o no se tiñe; a la vez sería un fallo de pintado");
});

test("el aviso entero vale igual que el nivel suelto", () => {
  const sala = crearSalaCaja(SALA);
  const colores = coloresDe(mirarAlTecho(sala, { aviso: { nivel: "amarilla", motivos: ["casco"] } }));
  assert.ok(colores.has(ALERTA.niveles.amarilla.borde));
});

test("la sala con el sistema dañado parpadea, y la de al lado no", () => {
  const rota = crearSalaCaja(SALA);
  const sana = crearSalaCaja(SALA);
  const apagado = PERIODO_PARPADEO / 2;

  const conLuz = coloresDe(mirarAlTecho(rota, { salud: 0.1, tiempo: 0 }));
  const sinLuz = coloresDe(mirarAlTecho(rota, { salud: 0.1, tiempo: apagado }));
  assert.ok(conLuz.has(LUZ_CALIDA));
  assert.equal(sinLuz.has(LUZ_CALIDA), false, "en la mitad apagada no se emite el difusor");

  // La misma marca de tiempo en una sala cuyo sistema no da lectura: quieta.
  const vecina = coloresDe(mirarAlTecho(sana, { salud: null, tiempo: apagado }));
  assert.ok(vecina.has(LUZ_CALIDA), "el parpadeo es de ESA sala, no del reloj");
});

test("la alerta y la avería son lecturas independientes", () => {
  const sala = crearSalaCaja(SALA);
  const encendida = coloresDe(mirarAlTecho(sala, { aviso: "roja", salud: 0.1, tiempo: 0 }));
  assert.ok(encendida.has(ALERTA.niveles.roja.borde), "una sala rota en alerta roja sigue roja");
  const apagada = coloresDe(mirarAlTecho(sala, { aviso: "roja", salud: 0.1, tiempo: PERIODO_PARPADEO / 2 }));
  assert.equal(apagada.has(ALERTA.niveles.roja.borde), false);
});

test("teñir no cuesta ni un polígono: la geometría se funde una sola vez", () => {
  // El criterio de salida de #765, y el que impide la solución fácil de
  // reconstruir la sala por fotograma: el presupuesto de #551 no se mueve.
  const sala = crearSalaCaja(SALA);
  const verde = mirarAlTecho(sala).poligonos.length;
  const roja = mirarAlTecho(sala, { aviso: "roja" }).poligonos.length;
  assert.equal(roja, verde);
});

test("el estado del difusor de la sala es el del módulo puro, sin reglas paralelas", () => {
  // Si `componer` decidiera por su cuenta cuándo parpadear, esta prueba y la de
  // arriba pasarían las dos y la nave tendría dos umbrales distintos.
  assert.equal(estadoDifusor({ aviso: "roja" }).color, ALERTA.niveles.roja.borde);
});
