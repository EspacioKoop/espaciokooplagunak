import assert from "node:assert/strict";
import test from "node:test";

import { ALTURA_OJOS } from "../scripts/nave-camara.mjs";
import {
  OJOS_SOBRE_ASIENTO,
  definicionesDeAsientos,
  offsetSentado,
  resolverAsiento,
} from "../scripts/nave-asiento.mjs";
import { VOCABULARIO, colocarProp } from "../scripts/nave-props.mjs";
import { declararInteracciones, interaccionAlAlcance } from "../scripts/nave-interaccion.mjs";

/* ---- la altura, que es lo único que hay que hacer bien --------------------- */

test("sentarse BAJA los ojos, en cualquier mueble de la nave", () => {
  // La comprobación de cordura del signo. Un offset positivo querría decir que
  // sentarse te sube, y ese error no se ve en ninguna prueba de geometría: la
  // escena se compone igual de bien con la cámara medio metro más arriba.
  for (const clave of ["silla", "taburete"]) {
    assert.ok(offsetSentado(VOCABULARIO[clave].asiento.altura) < 0, clave);
  }
});

test("los ojos quedan a la altura del asiento más un torso, y no a una escrita a mano", () => {
  const altura = VOCABULARIO.silla.asiento.altura;
  const ojos = ALTURA_OJOS + offsetSentado(altura);
  assert.equal(ojos, altura + OJOS_SOBRE_ASIENTO);
  // Y eso cae donde caen los ojos de alguien sentado: por encima de una mesa
  // (0,77 m de tablero) y muy por debajo de estar de pie. Es la comprobación que
  // le faltaba a la cantina cuando puso los ojos a 3,35 m del suelo.
  assert.ok(ojos > 0.9 && ojos < 1.3, `ojos a ${ojos} m`);
});

test("un taburete deja los ojos más altos que una silla", () => {
  assert.ok(
    offsetSentado(VOCABULARIO.taburete.asiento.altura) > offsetSentado(VOCABULARIO.silla.asiento.altura),
  );
});

test("una altura que no es un número no pasa por alto", () => {
  // Revienta en vez de valer cero: un asiento sin altura sentaría a alguien en
  // el suelo con la escena entera correcta, que es el fallo que nadie reproduce.
  assert.throws(() => offsetSentado(undefined), RangeError);
  assert.throws(() => offsetSentado(-0.2), RangeError);
});

/* ---- dónde acabas --------------------------------------------------------- */

test("te sientas ENCIMA del asiento, no delante", () => {
  const { asiento } = colocarProp("silla", { x: 3.5, z: 1.9 });
  const pose = resolverAsiento(asiento, { yaw: 1.1 });
  assert.deepEqual([pose.x, pose.z], [3.5, 1.9]);
});

test("una silla te gira a su frente; un taburete te deja mirando a donde mirabas", () => {
  const silla = colocarProp("silla", { x: 1, z: 1 });
  assert.equal(resolverAsiento(silla.asiento, { yaw: 1.1 }).yaw, 0);

  const taburete = colocarProp("taburete", { x: 1, z: 1 });
  assert.equal(resolverAsiento(taburete.asiento, { yaw: 1.1 }).yaw, 1.1);
});

test("girar la silla gira a quien se sienta; girar el taburete no le inventa un frente", () => {
  const silla = colocarProp("silla", { x: 1, z: 1, cuartos: 1 });
  assert.ok(Math.abs(resolverAsiento(silla.asiento, { yaw: 0 }).yaw - Math.PI / 2) < 1e-12);

  const taburete = colocarProp("taburete", { x: 1, z: 1, cuartos: 3 });
  assert.equal(resolverAsiento(taburete.asiento, { yaw: 0.4 }).yaw, 0.4);
});

/* ---- el asiento como punto de interacción ---------------------------------- */

test("solo los muebles con asiento declaran punto, y el índice no se recoloca", () => {
  const colocados = [
    colocarProp("barandilla", { x: 1, z: 1 }),
    colocarProp("silla", { x: 2, z: 2 }),
    colocarProp("mesa", { x: 3, z: 3 }),
    colocarProp("taburete", { x: 4, z: 4 }),
  ];
  const definiciones = definicionesDeAsientos(colocados);
  assert.deepEqual(
    definiciones.map(({ id }) => id),
    ["asiento-asiento-1", "asiento-asiento-3"],
  );
  // El índice es el del mueble en la lista original: si se renumerase, meter una
  // barandilla al principio le cambiaría el id a todas las sillas.
});

test("un mueble con pose presta SU id, en vez de que se le numere otro", () => {
  // Un asiento con pose (`nave-pose.mjs`) es el mismo mueble por el que se le
  // cambia la pose. Dos nombres para la misma silla es cómo sentarse acabaría
  // retirando la de al lado.
  const colocado = { ...colocarProp("silla", { x: 2, z: 2 }), id: "silla-mesa-sur" };
  const [definicion] = definicionesDeAsientos([colocado]);
  assert.equal(definicion.id, "asiento-silla-mesa-sur");
  assert.equal(definicion.accion.prop, "silla-mesa-sur");
});

test("el punto responde desde fuera del mueble, que es desde donde se llega", () => {
  const silla = colocarProp("silla", { x: 3, z: 3 });
  const interacciones = declararInteracciones(definicionesDeAsientos([silla]));
  // Delante de la silla, donde uno se planta: hay que poder sentarse.
  assert.equal(interaccionAlAlcance(3, 3.7, 0.35, interacciones)?.id, "asiento-asiento-0");
  // Y a tres metros no.
  assert.equal(interaccionAlAlcance(3, 6, 0.35, interacciones), null);
});

test("la acción lleva la altura y a quién mover, y nada más", () => {
  // El resto ya lo dice el punto: `punto` y `orientacion` son campos suyos.
  const silla = colocarProp("silla", { x: 3, z: 3 });
  const [definicion] = definicionesDeAsientos([silla]);
  assert.deepEqual(definicion.accion, {
    tipo: "asiento",
    altura: VOCABULARIO.silla.asiento.altura,
    prop: "asiento-0",
  });
});
