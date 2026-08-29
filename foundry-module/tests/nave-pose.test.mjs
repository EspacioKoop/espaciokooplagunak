import assert from "node:assert/strict";
import test from "node:test";

import { colocarPoseables, declararPoseable, declararPoseables, poseDe, ponerPose } from "../scripts/nave-pose.mjs";

const SILLA = { id: "silla", clave: "silla", x: 4, z: 4, poses: { libre: {}, ocupada: { atras: 0.25 } } };

/* ---- declarar ------------------------------------------------------------- */

test("un mueble con una sola pose no es un mueble con poses", () => {
  // Declararlo así solo añadiría un punto que se acciona y no hace nada.
  assert.throws(() => declararPoseable({ ...SILLA, poses: { libre: {} } }), RangeError);
});

test("la pose inicial tiene que existir, y por defecto es la primera declarada", () => {
  assert.equal(declararPoseable(SILLA).poseInicial, "libre");
  assert.equal(declararPoseable({ ...SILLA, pose: "ocupada" }).poseInicial, "ocupada");
  assert.throws(() => declararPoseable({ ...SILLA, pose: "rota" }), RangeError);
});

test("dos muebles con el mismo id revientan al declarar el catálogo", () => {
  assert.throws(() => declararPoseables([SILLA, { ...SILLA, x: 9 }]), RangeError);
});

/* ---- el estado ------------------------------------------------------------ */

test("sin estado, cada mueble está en su pose inicial", () => {
  const poseables = declararPoseables([SILLA]);
  assert.equal(poseDe(poseables, {}, "silla"), "libre");
  assert.equal(poseDe(poseables, { silla: "inventada" }, "silla"), "libre", "una pose que no existe no se cree");
  assert.equal(poseDe(poseables, {}, "nadie"), null);
});

test("cambiar una pose devuelve un estado NUEVO y no toca el anterior", () => {
  // El estado viaja hasta el render en el mismo fotograma en el que cambia:
  // mutarlo en el sitio es cómo se pinta media escena con la pose vieja.
  const poseables = declararPoseables([SILLA]);
  const antes = {};
  const despues = ponerPose(poseables, antes, "silla", "ocupada");
  assert.deepEqual(antes, {});
  assert.equal(poseDe(poseables, despues, "silla"), "ocupada");
});

test("sin decir cuál, se pasa a la siguiente y da la vuelta", () => {
  const poseables = declararPoseables([SILLA]);
  const a = ponerPose(poseables, {}, "silla");
  assert.equal(poseDe(poseables, a, "silla"), "ocupada");
  assert.equal(poseDe(poseables, ponerPose(poseables, a, "silla"), "silla"), "libre");
});

test("un id o una pose que no existen dejan el estado como estaba", () => {
  const poseables = declararPoseables([SILLA]);
  assert.deepEqual(ponerPose(poseables, { silla: "ocupada" }, "nadie"), { silla: "ocupada" });
  assert.deepEqual(ponerPose(poseables, { silla: "ocupada" }, "silla", "rota"), { silla: "ocupada" });
});

/* ---- colocar -------------------------------------------------------------- */

test("la pose base deja el mueble donde se declaró", () => {
  const poseables = declararPoseables([SILLA]);
  const [colocado] = colocarPoseables(poseables, {});
  assert.equal(colocado.pose, "libre");
  assert.deepEqual(colocado.asiento.punto, [4, 4]);
});

test("«atrás» es hacia atrás DEL MUEBLE, y gira con él", () => {
  // Es la razón de que el desplazamiento se declare en el marco del prop: con
  // coordenadas de sala, la silla del lado oeste de una mesa se retiraría hacia
  // el norte.
  const sitio = (cuartos) => {
    const poseables = declararPoseables([{ ...SILLA, cuartos }]);
    return colocarPoseables(poseables, { silla: "ocupada" })[0].asiento.punto;
  };
  // Mirando a +z, retirarse es ir a −z.
  assert.deepEqual(sitio(0).map((n) => Number(n.toFixed(6))), [4, 3.75]);
  // Media vuelta: a +z.
  assert.deepEqual(sitio(2).map((n) => Number(n.toFixed(6))), [4, 4.25]);
  // Un cuarto y tres cuartos se van por x, uno a cada lado — con el mismo
  // convenio de giro que ya usa el `ancla` de un prop, que es el punto: si
  // divergieran, la silla se retiraría hacia un lado y su ancla hacia el otro.
  assert.deepEqual(sitio(1).map((n) => Number(n.toFixed(6))), [3.75, 4]);
  assert.deepEqual(sitio(3).map((n) => Number(n.toFixed(6))), [4.25, 4]);
});

test("una pose puede cambiar de prop, no solo de sitio", () => {
  const poseables = declararPoseables([
    { id: "asiento", clave: "silla", x: 1, z: 1, poses: { silla: {}, taburete: { clave: "taburete" } } },
  ]);
  const [conTaburete] = colocarPoseables(poseables, { asiento: "taburete" });
  // La altura del asiento delata cuál de los dos muebles se ha colocado.
  assert.equal(conTaburete.asiento.altura, 0.63);
  assert.equal(colocarPoseables(poseables, {})[0].asiento.altura, 0.48);
});

test("la orientación del mueble no cambia al cambiar de pose", () => {
  // Retirarse es moverse, no girarse: una silla retirada sigue mirando a la mesa.
  const poseables = declararPoseables([{ ...SILLA, cuartos: 1 }]);
  const libre = colocarPoseables(poseables, {})[0];
  const ocupada = colocarPoseables(poseables, { silla: "ocupada" })[0];
  assert.equal(libre.asiento.orientacion, ocupada.asiento.orientacion);
});
