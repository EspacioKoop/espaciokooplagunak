import assert from "node:assert/strict";
import test from "node:test";

import { TECLAS_ACCION, TECLA_DIRECCION, TECLA_GIRO } from "../scripts/andar-nave-app.mjs";

// Guarda del reparto de teclas de la ventana de andar.
//
// `onKeyDown` consulta las tablas EN ORDEN y hace `return` en la primera que
// acierta, así que una tecla repetida en dos tablas deja la segunda como código
// muerto sin que nada se queje. Pasó: la cámara se ató a `c`, que ya era
// agacharse desde que se retiró "Control" (#446), y no alternaba nada — lo cazó
// el QA leyendo el commit. Esto lo convierte en un fallo de la suite.

const TABLAS = [
  ["dirección", TECLA_DIRECCION],
  ["giro", TECLA_GIRO],
  ["acción", TECLAS_ACCION],
];

test("ninguna tecla aparece en dos tablas: la segunda sería código muerto", () => {
  const dueño = new Map();
  for (const [nombre, tabla] of TABLAS) {
    for (const tecla of Object.keys(tabla)) {
      const previo = dueño.get(tecla);
      assert.equal(
        previo,
        undefined,
        `la tecla "${tecla}" está en ${previo} y en ${nombre}; solo actuaría la primera`,
      );
      dueño.set(tecla, nombre);
    }
  }
});

test("las teclas que el QA fijó siguen donde estaban", () => {
  // No es redundante con la de arriba: esa impide choques, esta impide que un
  // choque se «resuelva» quitándole la tecla a quien ya la tenía.
  assert.equal(TECLA_DIRECCION.c, "agachado", "`c` es agacharse (#446, tras retirar Control)");
  assert.equal(TECLA_DIRECCION[" "], "saltar");
  assert.equal(TECLA_DIRECCION.w, "adelante");
  assert.equal(TECLA_GIRO.q, -1);
  assert.equal(TECLA_GIRO.e, 1);
});

test("la cámara tiene tecla, y en mayúscula y minúscula", () => {
  // Con Bloq Mayús puesto el evento llega como "V": si solo se mapeara la
  // minúscula, la tecla dejaría de funcionar sin motivo aparente.
  assert.equal(TECLAS_ACCION.v, "camara");
  assert.equal(TECLAS_ACCION.V, "camara");
});

test("sentarse tiene tecla, también en las dos cajas, y no pisa a ninguna otra", () => {
  assert.equal(TECLAS_ACCION.f, "asiento");
  assert.equal(TECLAS_ACCION.F, "asiento");
  // `e` habría sido la tecla obvia y es la de girar a la derecha: ahí esta rama
  // sería código MUERTO, porque `TECLA_GIRO` se consulta antes y hace `return`.
  // Es el mismo choque que dejó la cámara sin funcionar atada a `c`.
  assert.equal(TECLA_GIRO.e, 1);
  assert.equal(TECLAS_ACCION.e, undefined);
});
