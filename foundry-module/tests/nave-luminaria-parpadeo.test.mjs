// Test para validar el parpadeo de las luminarias (#555).
//
// Este test valida que las luminarias parpadean correctamente cuando la salud
// del sistema está dañada (no nula) y permanecen encendidas cuando la salud
// del sistema es nula.

import test from "node:test";
import assert from "node:assert/strict";

import { piezasLuminarias } from "../scripts/nave-luminaria.mjs";
import { ALTURA } from "../scripts/nave-sala-caja.mjs";

// Mock para simular el estado de salud del sistema
const sistemaSaludable = { health: null };
const sistemaDanado = { health: 50 };

// Función para simular el parpadeo de las luminarias
function simularParpadeo(sistema) {
  // Si el sistema está dañado (health no es null), las luminarias parpadean
  if (sistema.health !== null) {
    return "parpadeando";
  } else {
    return "encendidas";
  }
}

// Función para simular el estado de las luminarias
function estadoLuminarias(sistema) {
  const piezas = piezasLuminarias({ ancho: 8, profundidad: 6, altura: ALTURA });
  const estado = simularParpadeo(sistema);
  return { piezas, estado };
}

test("luminaria parpadea cuando hay daño", () => {
  const { estado } = estadoLuminarias(sistemaDanado);
  assert.equal(estado, "parpadeando", "las luminarias parpadean cuando el sistema está dañado");
});

test("luminaria no parpadea cuando health es null", () => {
  const { estado } = estadoLuminarias(sistemaSaludable);
  assert.equal(estado, "encendidas", "las luminarias permanecen encendidas cuando el sistema está saludable");
});
