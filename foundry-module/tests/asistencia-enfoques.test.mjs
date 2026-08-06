import assert from "node:assert/strict";
import test from "node:test";

import { BANDAS } from "../scripts/asistencia/bandas.mjs";
import {
  ASISTENCIA_ERRORES,
  AsistenciaError,
  CLASES_ENFOQUE,
  MODOS,
  modoDeTarea,
  resolucionDisponible,
  validarEnfoque,
  validarTarea,
} from "../scripts/asistencia/enfoques.mjs";

const prueba = (extra = {}) => ({
  id: "reparar-en-caliente",
  clase: CLASES_ENFOQUE.PRUEBA,
  habilidad: "tool:tinker",
  cd: 14,
  ...extra,
});

const tareaIngenieria = (extra = {}) => ({
  id: "estabilizar-sistema-caliente",
  puestoAsistido: "engineering",
  accionPropuesta: "set_system_coolant",
  enfoques: [prueba()],
  ...extra,
});

const codigo = (fn) => {
  try {
    fn();
  } catch (error) {
    assert.ok(error instanceof AsistenciaError, `esperaba AsistenciaError, vino ${error}`);
    return error.codigo;
  }
  return null;
};

test("la rebanada mínima valida: ingeniería, propuesta, clase (a)", () => {
  const tarea = validarTarea(tareaIngenieria());
  assert.equal(tarea.modo, MODOS.PROPUESTA);
  assert.equal(tarea.enfoques.length, 1);
});

test("una tarea no puede proponer una orden que su puesto no podría emitir", () => {
  // La regla dura de #309: ayudar no puede hacer nada que el puesto asistido no
  // pudiera pedir por sí mismo.
  assert.equal(
    codigo(() => validarTarea(tareaIngenieria({ accionPropuesta: "set_shields" }))),
    ASISTENCIA_ERRORES.ACCION_NO_AUTORIZADA,
  );
});

test("los puestos sin vía de control solo rinden en modo narrativo", () => {
  // Capitán, sensores y comunicaciones pueden asistir, pero no hay orden suya
  // que prestarles: el GM adjudica el fruto.
  for (const puesto of ["captain", "sensors", "communications"]) {
    assert.equal(modoDeTarea({ puestoAsistido: puesto, accionPropuesta: null }), MODOS.NARRATIVO);
  }
});

test("la clase (b) no es declarable en una tarea sin objetivo", () => {
  // Estabilizar un sistema no tiene a quién atacar: meterlo en un d20 vs CD
  // sería inventar una tirada que 5e no pide ahí. El hechizo entra por (c) o no
  // entra.
  const enfoqueB = { id: "rayo", clase: CLASES_ENFOQUE.TIRADA_CONTRA_OBJETIVO };
  assert.equal(
    codigo(() => validarEnfoque(enfoqueB, tareaIngenieria())),
    ASISTENCIA_ERRORES.SIN_OBJETIVO,
  );
  // Con objetivo declarado, sí.
  const conObjetivo = { ...tareaIngenieria(), objetivo: { ca: 15 } };
  assert.equal(validarEnfoque(enfoqueB, conObjetivo).id, "rayo");
});

test("la clase (c) exige banda fija y nunca puede ser crítico", () => {
  const sinBanda = { id: "reparar", clase: CLASES_ENFOQUE.SIN_TIRADA };
  assert.equal(codigo(() => validarEnfoque(sinBanda, {})), ASISTENCIA_ERRORES.SIN_BANDA_FIJA);
  // Un efecto garantizado no compra además el tier alto.
  assert.equal(
    codigo(() => validarEnfoque({ ...sinBanda, bandaFija: BANDAS.CRITICO }, {})),
    ASISTENCIA_ERRORES.BANDA_FIJA_CRITICA,
  );
  assert.equal(validarEnfoque({ ...sinBanda, bandaFija: BANDAS.EXITO }, {}).bandaFija, BANDAS.EXITO);
});

test("la habilidad es opcional: sin ella, el enfoque sigue validando (#500)", () => {
  const { habilidad, ...sinHabilidad } = prueba();
  const validado = validarEnfoque(sinHabilidad, tareaIngenieria());
  assert.equal(validado.habilidad, undefined);
});

test("con habilidad declarada, tiene que apuntar a un tipo real de la ficha", () => {
  for (const tipo of ["skill", "tool", "ability"]) {
    const validado = validarEnfoque(prueba({ habilidad: `${tipo}:x` }), tareaIngenieria());
    assert.equal(validado.habilidad, `${tipo}:x`);
  }
});

test("una habilidad con un tipo inventado no se declara: falla al cargar, no en mesa", () => {
  assert.equal(
    codigo(() => validarEnfoque(prueba({ habilidad: "hechizo:bola-de-fuego" }), tareaIngenieria())),
    ASISTENCIA_ERRORES.HABILIDAD_DESCONOCIDA,
  );
  assert.equal(
    codigo(() => validarEnfoque(prueba({ habilidad: "arc" }), tareaIngenieria())),
    ASISTENCIA_ERRORES.HABILIDAD_DESCONOCIDA,
  );
});

test("no hay cuarta vía: una clase inventada no se declara", () => {
  assert.equal(
    codigo(() => validarEnfoque({ id: "x", clase: "magia-libre" }, {})),
    ASISTENCIA_ERRORES.CLASE_DESCONOCIDA,
  );
});

test("sin ficha la asistencia se degrada al minijuego de destreza, no se rompe", () => {
  // dnd5e es enriquecimiento, no dependencia dura: un mundo con otro sistema
  // sigue pudiendo ayudar.
  const via = resolucionDisponible({ tarea: tareaIngenieria(), tieneFicha: false });
  assert.equal(via.via, "destreza");
  assert.deepEqual(via.enfoques, []);
});

test("los enfoques que gastan recursos solo aparecen si el GM abre esa vía", () => {
  const conCoste = tareaIngenieria({
    enfoques: [prueba({ id: "arcana", habilidad: "skill:arc" }), {
      id: "reparar",
      clase: CLASES_ENFOQUE.SIN_TIRADA,
      bandaFija: BANDAS.EXITO,
      coste: { tipo: "espacio-de-conjuro", nivel: 1 },
    }],
  });
  const cerrado = resolucionDisponible({ tarea: conCoste, tieneFicha: true });
  assert.deepEqual(cerrado.enfoques.map((e) => e.id), ["arcana"]);

  const abierto = resolucionDisponible({
    tarea: conCoste,
    tieneFicha: true,
    gmPermiteRecursos: true,
  });
  assert.deepEqual(abierto.enfoques.map((e) => e.id), ["arcana", "reparar"]);
});

test("si el GM no abre recursos y TODO cuesta, queda la destreza", () => {
  const soloCoste = tareaIngenieria({
    enfoques: [{
      id: "reparar",
      clase: CLASES_ENFOQUE.SIN_TIRADA,
      bandaFija: BANDAS.EXITO,
      coste: { tipo: "uso-limitado" },
    }],
  });
  assert.equal(resolucionDisponible({ tarea: soloCoste, tieneFicha: true }).via, "destreza");
});
