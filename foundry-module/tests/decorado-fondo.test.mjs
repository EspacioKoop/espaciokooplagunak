import assert from "node:assert/strict";
import test from "node:test";

import {
  PALETA_DECORADO,
  componerDecorado,
  crearDecorado,
  dibujarDecorado,
} from "../scripts/decorado-fondo.mjs";

const SEMILLA = 0x4c4147; // misma que MAPA_SEMILLA en main.mjs

test("crearDecorado devuelve las tres capas ordenadas de lejana a cercana", () => {
  const capas = crearDecorado(SEMILLA);
  assert.deepEqual(
    capas.map((c) => c.tipo),
    ["nebulosa", "planeta", "asteroide"],
  );
  // El factor de parallax crece de lejana a cercana (más lejos = se mueve menos).
  for (let i = 1; i < capas.length; i += 1) {
    assert.ok(capas[i].factor > capas[i - 1].factor, "factores crecientes");
  }
});

test("crearDecorado respeta los recuentos pedidos", () => {
  const capas = crearDecorado(SEMILLA, { planetas: 3, nebulosas: 1, asteroides: 12 });
  const porTipo = Object.fromEntries(capas.map((c) => [c.tipo, c.elementos.length]));
  assert.equal(porTipo.nebulosa, 1);
  assert.equal(porTipo.planeta, 3);
  assert.equal(porTipo.asteroide, 12);
});

test("crearDecorado es determinista: misma semilla, mismo decorado", () => {
  assert.deepEqual(crearDecorado(SEMILLA), crearDecorado(SEMILLA));
});

test("semillas distintas producen decorados distintos", () => {
  assert.notDeepEqual(crearDecorado(SEMILLA), crearDecorado(SEMILLA + 1));
});

test("los elementos caen dentro del lienzo y usan colores de la paleta", () => {
  const ancho = 320;
  const alto = 320;
  const capas = crearDecorado(SEMILLA, { ancho, alto });
  for (const capa of capas) {
    for (const el of capa.elementos) {
      assert.ok(el.x >= 0 && el.x < ancho, "x dentro del lienzo");
      assert.ok(el.y >= 0 && el.y < alto, "y dentro del lienzo");
      assert.ok(el.r > 0, "radio positivo");
    }
    if (capa.tipo === "nebulosa") {
      for (const el of capa.elementos) {
        assert.ok(PALETA_DECORADO.nebulosas.includes(el.color));
        assert.ok(el.alpha > 0 && el.alpha < 1);
      }
    }
    if (capa.tipo === "planeta") {
      for (const el of capa.elementos) {
        assert.ok(PALETA_DECORADO.planetas.includes(el.color));
        assert.ok(el.brillo > 0 && el.brillo < 1);
      }
    }
  }
});

test("componerDecorado aplica offsets de parallax en [0, tam) por capa", () => {
  const decorado = crearDecorado(SEMILLA);
  const compuesto = componerDecorado(decorado, {
    centro: { x: 12000, y: -8000 },
    ancho: 320,
    alto: 320,
  });
  assert.equal(compuesto.length, decorado.length);
  for (let i = 0; i < compuesto.length; i += 1) {
    const capa = compuesto[i];
    assert.equal(capa.tipo, decorado[i].tipo);
    assert.equal(capa.elementos, decorado[i].elementos, "reutiliza los elementos sin copiarlos");
    assert.ok(capa.dx >= 0 && capa.dx < 320, "dx envuelto");
    assert.ok(capa.dy >= 0 && capa.dy < 320, "dy envuelto");
  }
});

test("componerDecorado desplaza más las capas cercanas que las lejanas", () => {
  const decorado = crearDecorado(SEMILLA);
  const ancho = 320;
  const compuesto = componerDecorado(decorado, { centro: { x: 100, y: 0 }, ancho, alto: 320 });
  const nebulosa = compuesto.find((c) => c.tipo === "nebulosa");
  const asteroide = compuesto.find((c) => c.tipo === "asteroide");
  // offsetParallax niega y envuelve a [0, ancho): el desplazamiento efectivo
  // hacia la izquierda es (ancho - dx), mayor cuanto más cercana es la capa.
  const desplaza = (dx) => (ancho - dx) % ancho;
  assert.ok(
    desplaza(asteroide.dx) > desplaza(nebulosa.dx),
    "el cinturón de asteroides se desplaza más que la nebulosa",
  );
});

test("componerDecorado sin centro no rompe (offset 0)", () => {
  const compuesto = componerDecorado(crearDecorado(SEMILLA), {});
  for (const capa of compuesto) {
    // `=== 0` acepta también -0 (offsetParallax devuelve -0 con centro nulo).
    assert.ok(capa.dx === 0, "dx nulo");
    assert.ok(capa.dy === 0, "dy nulo");
  }
});

test("componerDecorado con lista vacía devuelve lista vacía", () => {
  assert.deepEqual(componerDecorado([], { centro: { x: 1, y: 2 } }), []);
});

test("dibujarDecorado conserva el contrato pixel art sin curvas ni gradientes", () => {
  const rectangulos = [];
  const ctx = {
    fillStyle: "",
    fillRect(x, y, ancho, alto) {
      for (const valor of [x, y, ancho, alto]) {
        assert.ok(Number.isInteger(valor), `fillRect usa entero: ${valor}`);
      }
      assert.ok(ancho > 0 && alto > 0, "rectángulo visible");
      rectangulos.push({ x, y, ancho, alto, color: this.fillStyle });
    },
    arc() {
      assert.fail("el decorado pixel art no debe usar arc()");
    },
    createRadialGradient() {
      assert.fail("el decorado pixel art no debe usar gradientes");
    },
  };
  const decorado = crearDecorado(SEMILLA, {
    ancho: 320,
    alto: 320,
    planetas: 1,
    nebulosas: 1,
    asteroides: 6,
  });
  dibujarDecorado(ctx, componerDecorado(decorado), { ancho: 320, alto: 320 });
  assert.ok(rectangulos.length > 20, "pinta cuerpos y dithering con suficientes píxeles");
  assert.ok(rectangulos.some((r) => r.ancho === 1 && r.alto === 1), "incluye detalle de un píxel");
  assert.ok(rectangulos.some((r) => r.ancho === 2 && r.alto === 2), "incluye motas/dithering 2×2");

  rectangulos.length = 0;
  dibujarDecorado(
    ctx,
    [{ tipo: "asteroide", dx: 0, dy: 0, elementos: [{ x: 319.5, y: 319.5, r: 2, brillo: 0.5 }] }],
    { ancho: 320, alto: 320 },
  );
  assert.ok(
    rectangulos.some((r) => r.x === 0 && r.y === 0 && r.ancho === 2 && r.alto === 2),
    "la mota que cruza dos bordes reaparece completa en la esquina opuesta",
  );
});
