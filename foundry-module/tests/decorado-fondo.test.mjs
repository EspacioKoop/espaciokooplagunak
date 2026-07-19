import assert from "node:assert/strict";
import test from "node:test";

import {
  BIOMAS,
  INTERVALO_CACHE_PLANETA_MS,
  PALETA_DECORADO,
  componerDecorado,
  crearCacheDecorado,
  crearDecorado,
  dibujarDecorado,
} from "../scripts/decorado-fondo.mjs";

const SEMILLA = 0x4c4147; // misma que MAPA_SEMILLA en main.mjs

test("crearDecorado devuelve las capas ordenadas de lejana a cercana", () => {
  const capas = crearDecorado(SEMILLA);
  assert.deepEqual(
    capas.map((c) => c.tipo),
    ["nebulosa_lejana", "nebulosa", "planeta", "asteroide"],
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
        assert.ok(BIOMAS[el.bioma], "bioma válido");
        assert.equal(el.color, BIOMAS[el.bioma].color);
        assert.equal(el.rasgo, BIOMAS[el.bioma].rasgo);
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
    [{ tipo: "asteroide", dx: 0, dy: 0, elementos: [{ x: 319.5, y: 319.5, r: 2, brillo: 0.5, semilla: 1 }] }],
    { ancho: 320, alto: 320 },
  );
  // El peñasco (píxeles 1×1 con forma irregular) que cruza dos bordes reaparece
  // en la esquina opuesta: hay píxeles pintados en el rincón (0,0).
  assert.ok(
    rectangulos.some((r) => r.x >= 0 && r.x < 2 && r.y >= 0 && r.y < 2 && r.ancho === 1 && r.alto === 1),
    "el peñasco que cruza dos bordes reaparece en la esquina opuesta",
  );
});

test("el anillo de un planeta que cruza un borde reaparece sin costura", () => {
  const rectangulos = [];
  const ctx = {
    fillStyle: "",
    fillRect(x, y, ancho, alto) {
      rectangulos.push({ x, y, ancho, alto });
    },
    arc() { assert.fail("sin arc()"); },
    createRadialGradient() { assert.fail("sin gradientes"); },
  };
  // Caso focal del review: planeta con x=15, r=10 y anillo en un lienzo 100×100.
  // El anillo primario (hasta 1.9*r) cruza el borde izquierdo; la copia envuelta
  // debe pintar píxeles en el borde derecho (x=95..99). Antes, el culling por
  // `el.r` descartaba esa copia y el anillo se cortaba.
  const planeta = {
    x: 15, y: 50, r: 10, anillo: true,
    color: "#88aacc", color2: "#446688",
    inclinacionAnillo: 0.3, velocidadGiro: 0, semilla: 5,
  };
  dibujarDecorado(
    ctx,
    [{ tipo: "planeta", dx: 0, dy: 0, elementos: [planeta] }],
    { ancho: 100, alto: 100 },
  );
  assert.ok(
    rectangulos.some((r) => r.x >= 95 && r.x <= 99),
    "el anillo reaparece en el borde derecho (sin costura)",
  );
});

function crearFactoriaLienzos() {
  const lienzos = [];
  const crearLienzo = (ancho, alto) => {
    const rectangulos = [];
    const contexto = {
      fillStyle: "",
      imageSmoothingEnabled: true,
      fillRect(...args) { rectangulos.push(args); },
    };
    const lienzo = {
      width: ancho,
      height: alto,
      rectangulos,
      getContext(tipo) { return tipo === "2d" ? contexto : null; },
    };
    lienzos.push(lienzo);
    return lienzo;
  };
  return { crearLienzo, lienzos };
}

test("la caché rasteriza cuerpos grandes una vez y recompone cada frame con drawImage", () => {
  const factoria = crearFactoriaLienzos();
  const cache = crearCacheDecorado({ crearLienzo: factoria.crearLienzo });
  const imagenes = [];
  const ctx = {
    fillStyle: "",
    fillRect() {},
    drawImage(...args) { imagenes.push(args); },
  };
  const decorado = crearDecorado(SEMILLA, {
    ancho: 320,
    alto: 320,
    planetas: 1,
    nebulosas: 1,
    nebulosasLejanas: 1,
    asteroides: 0,
  });
  decorado.find((capa) => capa.tipo === "planeta").elementos[0].semilla = 0;
  const frame = componerDecorado(decorado, { centro: { x: 100, y: 50 } });

  dibujarDecorado(ctx, frame, { ancho: 320, alto: 320, tMs: 0, cache });
  assert.equal(factoria.lienzos.length, 3, "crea un sprite por cuerpo grande");
  assert.ok(imagenes.length >= 3, "compone los sprites en el lienzo visible");
  assert.ok(factoria.lienzos.every((lienzo) => lienzo.rectangulos.length > 0), "cada sprite contiene pixel art");

  imagenes.length = 0;
  dibujarDecorado(ctx, frame, {
    ancho: 320,
    alto: 320,
    tMs: INTERVALO_CACHE_PLANETA_MS - 1,
    cache,
  });
  assert.equal(factoria.lienzos.length, 3, "reutiliza nebulosas y planeta dentro del mismo tick");
  assert.ok(imagenes.length >= 3, "sigue dibujando el parallax en cada frame");

  dibujarDecorado(ctx, frame, {
    ancho: 320,
    alto: 320,
    tMs: INTERVALO_CACHE_PLANETA_MS,
    cache,
  });
  assert.equal(factoria.lienzos.length, 4, "solo renueva el planeta al avanzar el giro");
});

test("las fases de giro reparten la renovación de planetas entre frames", () => {
  const factoria = crearFactoriaLienzos();
  const cache = crearCacheDecorado({ crearLienzo: factoria.crearLienzo, intervaloPlanetaMs: 200 });
  const ctx = { fillStyle: "", fillRect() {}, drawImage() {} };
  const base = {
    x: 80,
    y: 80,
    r: 12,
    anillo: false,
    color: "#88aacc",
    color2: "#446688",
    velocidadGiro: 0.00005,
  };
  const frame = [{
    tipo: "planeta",
    dx: 0,
    dy: 0,
    elementos: [
      { ...base, semilla: 10, faseGiro: 0 },
      { ...base, x: 200, semilla: 20, faseGiro: 0.5 },
    ],
  }];

  dibujarDecorado(ctx, frame, { tMs: 0, cache });
  assert.equal(factoria.lienzos.length, 2);
  dibujarDecorado(ctx, frame, { tMs: 100, cache });
  assert.equal(factoria.lienzos.length, 3, "solo se renueva el planeta con fase 100");
  dibujarDecorado(ctx, frame, { tMs: 200, cache });
  assert.equal(factoria.lienzos.length, 4, "el planeta con fase cero se renueva después");
});

test("un salto temporal renueva como máximo un planeta por frame", () => {
  const factoria = crearFactoriaLienzos();
  const cache = crearCacheDecorado({ crearLienzo: factoria.crearLienzo, intervaloPlanetaMs: 200 });
  const ctx = { fillStyle: "", fillRect() {}, drawImage() {} };
  const base = {
    y: 80,
    r: 12,
    anillo: false,
    color: "#88aacc",
    color2: "#446688",
    velocidadGiro: 0.00005,
    faseGiro: 0,
  };
  const frame = [{
    tipo: "planeta",
    dx: 0,
    dy: 0,
    elementos: [40, 120, 200].map((x, i) => ({ ...base, x, semilla: i + 1 })),
  }];

  dibujarDecorado(ctx, frame, { tMs: 0, cache });
  assert.equal(factoria.lienzos.length, 3, "el primer frame construye todos los sprites");
  dibujarDecorado(ctx, frame, { tMs: 200, cache });
  assert.equal(factoria.lienzos.length, 4, "solo renueva uno tras el salto");
  dibujarDecorado(ctx, frame, { tMs: 201, cache });
  assert.equal(factoria.lienzos.length, 5, "renueva el segundo en el frame siguiente");
  dibujarDecorado(ctx, frame, { tMs: 202, cache });
  assert.equal(factoria.lienzos.length, 6, "termina la cola sin picos múltiples");
});

test("los planetas grandes usan escala entera para conservar el pixel art", () => {
  const factoria = crearFactoriaLienzos();
  const cache = crearCacheDecorado({ crearLienzo: factoria.crearLienzo });
  const imagenes = [];
  const ctx = { fillStyle: "", fillRect() {}, drawImage(...args) { imagenes.push(args); } };
  const planeta = {
    x: 160,
    y: 160,
    r: 80,
    anillo: true,
    inclinacionAnillo: 0.3,
    color: "#88aacc",
    color2: "#446688",
    velocidadGiro: 0.00005,
    semilla: 0,
  };

  dibujarDecorado(ctx, [{ tipo: "planeta", dx: 0, dy: 0, elementos: [planeta] }], {
    ancho: 320,
    alto: 320,
    cache,
  });
  const ampliada = imagenes.find((args) => args.length === 5);
  assert.ok(ampliada, "usa drawImage con tamaño de destino explícito");
  assert.equal(ampliada[3], ampliada[0].width * 2);
  assert.equal(ampliada[4], ampliada[0].height * 2);
  assert.ok(Number.isInteger(ampliada[1]) && Number.isInteger(ampliada[2]), "alinea el sprite a píxeles enteros");
});

test("limpiar la caché libera sprites y fuerza una rasterización nueva", () => {
  const factoria = crearFactoriaLienzos();
  const cache = crearCacheDecorado({ crearLienzo: factoria.crearLienzo });
  const ctx = { fillStyle: "", fillRect() {}, drawImage() {} };
  const decorado = crearDecorado(SEMILLA, {
    planetas: 0,
    nebulosas: 1,
    nebulosasLejanas: 0,
    asteroides: 0,
  });
  const frame = componerDecorado(decorado);

  dibujarDecorado(ctx, frame, { cache });
  assert.equal(factoria.lienzos.length, 1);
  cache.limpiar();
  dibujarDecorado(ctx, frame, { cache });
  assert.equal(factoria.lienzos.length, 2);
});

test("si no puede crear canvas auxiliar conserva el pintor directo", () => {
  const cache = crearCacheDecorado({ crearLienzo: () => null });
  let rectangulos = 0;
  let imagenes = 0;
  const ctx = {
    fillStyle: "",
    fillRect() { rectangulos += 1; },
    drawImage() { imagenes += 1; },
  };
  const decorado = crearDecorado(SEMILLA, {
    planetas: 1,
    nebulosas: 0,
    nebulosasLejanas: 0,
    asteroides: 0,
  });
  dibujarDecorado(ctx, componerDecorado(decorado), { cache });
  assert.ok(rectangulos > 0, "el fallback conserva los píxeles del planeta");
  assert.equal(imagenes, 0);
});
