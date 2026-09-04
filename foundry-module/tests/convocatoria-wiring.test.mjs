import assert from "node:assert/strict";
import test from "node:test";

import { crearConvocatoriaCallbacks } from "../scripts/convocatoria-wiring.mjs";

test("onSubmit pasa idEstancia y rolConvocante tal cual a convocar()", () => {
  const llamadas = [];
  const { onSubmit } = crearConvocatoriaCallbacks({
    convocar: (idEstancia, rolConvocante) => llamadas.push({ idEstancia, rolConvocante }),
  });

  onSubmit({ idEstancia: "playa", rolConvocante: "GM" });

  assert.deepEqual(llamadas, [{ idEstancia: "playa", rolConvocante: "GM" }]);
});

test("dos combinaciones distintas llegan a convocar() con sus propios argumentos, sin mezclarse", () => {
  const llamadas = [];
  const { onSubmit } = crearConvocatoriaCallbacks({
    convocar: (idEstancia, rolConvocante) => llamadas.push({ idEstancia, rolConvocante }),
  });

  onSubmit({ idEstancia: "puente", rolConvocante: "GM" });
  onSubmit({ idEstancia: "museo", rolConvocante: "GM" });

  assert.deepEqual(llamadas, [
    { idEstancia: "puente", rolConvocante: "GM" },
    { idEstancia: "museo", rolConvocante: "GM" },
  ]);
});

test("no invoca convocar() antes de que se envíe el formulario", () => {
  let invocado = false;
  crearConvocatoriaCallbacks({ convocar: () => { invocado = true; } });
  assert.equal(invocado, false, "crear los callbacks no debe disparar convocar() por su cuenta");
});
