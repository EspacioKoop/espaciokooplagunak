import assert from "node:assert/strict";
import test from "node:test";

import { BANDAS, FRACCION_CRITICO, MARGEN_PIFIA, resolverAproximacion } from "../scripts/interaccion-3d/resolucion.mjs";

test("una tirada muy por debajo de la dificultad es crítico", () => {
  const { banda } = resolverAproximacion({ dificultad: 0.6, tirada: 0.05 });
  assert.equal(banda, BANDAS.CRITICO);
});

test("una tirada justo por debajo de la dificultad es éxito raspado, no crítico", () => {
  const { banda } = resolverAproximacion({ dificultad: 0.6, tirada: 0.59 });
  assert.equal(banda, BANDAS.EXITO);
});

test("una tirada justo por encima de la dificultad es fallo raso, no pifia", () => {
  const { banda } = resolverAproximacion({ dificultad: 0.6, tirada: 0.61 });
  assert.equal(banda, BANDAS.FALLO);
});

test("una tirada muy por encima de la dificultad es pifia", () => {
  const { banda } = resolverAproximacion({ dificultad: 0.6, tirada: 0.99 });
  assert.equal(banda, BANDAS.PIFIA);
});

test("el umbral de crítico cae en FRACCION_CRITICO de la tirada, no del margen", () => {
  const dificultad = 0.6;
  // Un tercio de los ÉXITOS (tirada en [0, dificultad]) son críticos: el
  // umbral es la propia tirada por debajo de dificultad * FRACCION_CRITICO,
  // no un margen medido desde la dificultad hacia abajo.
  const umbralCritico = dificultad * FRACCION_CRITICO;
  const enElUmbralCritico = resolverAproximacion({ dificultad, tirada: umbralCritico });
  assert.equal(enElUmbralCritico.banda, BANDAS.CRITICO);

  const justoFueraDelUmbralCritico = resolverAproximacion({
    dificultad,
    tirada: umbralCritico + 0.01,
  });
  assert.equal(justoFueraDelUmbralCritico.banda, BANDAS.EXITO);

  const enElUmbralPifia = resolverAproximacion({ dificultad, tirada: dificultad + MARGEN_PIFIA });
  assert.equal(enElUmbralPifia.banda, BANDAS.FALLO);

  const justoFueraDelUmbralPifia = resolverAproximacion({
    dificultad,
    tirada: dificultad + MARGEN_PIFIA + 0.001,
  });
  assert.equal(justoFueraDelUmbralPifia.banda, BANDAS.PIFIA);
});

test("dos representaciones en coma flotante del mismo umbral caen en la misma banda", () => {
  // 0.6 + 0.3 !== 0.9 en coma flotante de doble precisión (da
  // 0.8999999999999999). Sin tolerancia, esto podía caer en una banda
  // distinta que la tirada literal 0.9 para la misma dificultad.
  const dificultad = 0.6;
  const literal = resolverAproximacion({ dificultad, tirada: 0.9 });
  const calculada = resolverAproximacion({ dificultad, tirada: 0.6 + 0.3 });

  assert.notEqual(0.9, 0.6 + 0.3, "la premisa del test: ambos valores deben diferir a nivel de bits");
  assert.equal(literal.banda, calculada.banda);
  assert.equal(literal.banda, BANDAS.FALLO);
});

test("valida que dificultad y tirada estén en [0, 1]", () => {
  assert.throws(() => resolverAproximacion({ dificultad: 1.5, tirada: 0.5 }), RangeError);
  assert.throws(() => resolverAproximacion({ dificultad: 0.5, tirada: -0.1 }), RangeError);
  assert.throws(() => resolverAproximacion({ dificultad: NaN, tirada: 0.5 }), RangeError);
});

test("el resultado viaja congelado", () => {
  const resultado = resolverAproximacion({ dificultad: 0.5, tirada: 0.5 });
  assert.ok(Object.isFrozen(resultado));
});
