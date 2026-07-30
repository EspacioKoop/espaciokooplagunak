import assert from "node:assert/strict";
import test from "node:test";

import { BANDAS } from "../scripts/asistencia/bandas.mjs";
import { CLASES_ENFOQUE } from "../scripts/asistencia/enfoques.mjs";
import {
  distribucionBandas,
  probabilidadFavorable,
  rangoDeExito,
} from "../scripts/asistencia/probabilidad.mjs";

const suma = (d) => Object.values(d).reduce((a, b) => a + b, 0);

test("la distribución cubre las 20 caras y nada más", () => {
  const d = distribucionBandas({ modificador: 3, dificultad: 15 });
  assert.ok(Math.abs(suma(d) - 1) < 1e-9);
});

test("un modificador mejor mueve el rango de éxito hacia arriba", () => {
  // Es la decisión táctica que el jugador debe poder leer antes de tirar:
  // «con mi Arcana +7 tengo buena banda; con Herramientas +2, no».
  const flojo = probabilidadFavorable(distribucionBandas({ modificador: 2, dificultad: 15 }));
  const bueno = probabilidadFavorable(distribucionBandas({ modificador: 7, dificultad: 15 }));
  assert.ok(bueno > flojo, `${bueno} debería superar a ${flojo}`);
  // CD 15 con +2: hace falta sacar 13 o más → 8 caras de 20.
  assert.ok(Math.abs(flojo - 8 / 20) < 1e-9);
});

test("en salvación tira el objetivo y su éxito es el fallo del enfoque", () => {
  const rango = rangoDeExito({
    enfoque: { id: "hechizo", clase: CLASES_ENFOQUE.TIRADA_CONTRA_OBJETIVO, cdSalvacion: 14 },
    tarea: { objetivo: { salvacion: "dex", modificadorSalvacion: 3 } },
  });
  assert.equal(rango.quienTira, "objetivo");
  assert.equal(rango.salvacion, true);
  // El objetivo salva con d20+3 vs CD 14: falla sacando 10 o menos → 10 de 20
  // caras a favor del ayudante.
  assert.ok(Math.abs(rango.favorable - 10 / 20) < 1e-9);
});

test("un objetivo más resistente empeora el rango del ayudante", () => {
  const contra = (mod) =>
    rangoDeExito({
      enfoque: { id: "h", clase: CLASES_ENFOQUE.TIRADA_CONTRA_OBJETIVO, cdSalvacion: 14 },
      tarea: { objetivo: { salvacion: "dex", modificadorSalvacion: mod } },
    }).favorable;
  assert.ok(contra(8) < contra(0));
});

test("la clase (c) no enseña porcentaje: enseña banda fija y coste", () => {
  // Presentar una probabilidad aquí sería inventar una tirada inexistente.
  const rango = rangoDeExito({
    enfoque: {
      id: "reparar",
      clase: CLASES_ENFOQUE.SIN_TIRADA,
      bandaFija: BANDAS.EXITO,
      coste: { tipo: "espacio-de-conjuro", nivel: 1 },
    },
  });
  assert.equal(rango.via, "banda-fija");
  assert.equal(rango.quienTira, "nadie");
  assert.equal(rango.bandaFija, BANDAS.EXITO);
  assert.deepEqual(rango.coste, { tipo: "espacio-de-conjuro", nivel: 1 });
  assert.equal(rango.distribucion, undefined);
});

test("la regla de la casa cambia el rango que el jugador está leyendo", () => {
  // Por eso es opt-in y la interfaz debe declararla junto al porcentaje.
  const enfoque = { id: "arcana", clase: CLASES_ENFOQUE.PRUEBA, cd: 25 };
  const base = rangoDeExito({ enfoque, modificador: 0 });
  const casa = rangoDeExito({ enfoque, modificador: 0, reglaCasaNatural: true });
  assert.equal(base.favorable, 0);
  assert.ok(Math.abs(casa.favorable - 1 / 20) < 1e-9);
  assert.equal(casa.distribucion[BANDAS.CRITICO], 1 / 20);
});

test("el rango expone CD y modificador en claro, no un número mágico", () => {
  const rango = rangoDeExito({
    enfoque: { id: "arcana", clase: CLASES_ENFOQUE.PRUEBA, cd: 14 },
    modificador: 5,
  });
  assert.equal(rango.dificultad, 14);
  assert.equal(rango.modificador, 5);
  assert.equal(rango.quienTira, "ayudante");
});
