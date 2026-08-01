// Iconos 3D animados de las puertas (#423 sobre #362).
//
// La animación es una función del tiempo, así que se puede afirmar de ella lo
// que no se puede afirmar de un estado que va acumulando: que el ciclo cierra,
// que el fotograma 1234 no depende de haber pintado los 1233 anteriores, y que
// una puerta sin arte propio sigue teniendo algo que enseñar.

import assert from "node:assert/strict";
import test from "node:test";

import {
  FACTOR_FOCO,
  ICONOS,
  PERIODO_MS,
  componerIcono,
  disco,
  faseEn,
  piezasDe,
} from "../scripts/cantina-icono.mjs";
import { puertasCantina } from "../scripts/cantina.mjs";

test("el disco cierra su costado: tantos cuadriláteros como lados, más dos tapas", () => {
  const malla = disco({ lados: 10 });
  assert.equal(malla.vertices.length, 20);
  assert.equal(malla.caras.length, 12);
  const tapas = malla.caras.filter((cara) => cara.length === 10);
  assert.equal(tapas.length, 2, "faltan las dos tapas");
});

test("el giro de reposo cierra el ciclo en un periodo", () => {
  assert.equal(faseEn(0), 0);
  assert.ok(Math.abs(faseEn(PERIODO_MS) - Math.PI * 2) < 1e-9);
});

test("enfocar acelera el giro, no lo reinicia", () => {
  // Con tolerancia: el orden de las multiplicaciones no es el mismo dentro y
  // fuera, y exigir igualdad exacta a dos flotantes es una prueba frágil.
  assert.ok(Math.abs(faseEn(1000, { enfocado: true }) - faseEn(1000) * FACTOR_FOCO) < 1e-9);
});

test("un tiempo roto no rompe la animación: se queda quieta en el origen", () => {
  assert.equal(faseEn(NaN), 0);
  assert.equal(faseEn(undefined), 0);
});

test("el fotograma no depende de la historia: mismo ms, misma escena", () => {
  const a = componerIcono("poker", { ms: 1234 });
  const b = componerIcono("poker", { ms: 1234 });
  assert.deepEqual(a.poligonos, b.poligonos);
  const otro = componerIcono("poker", { ms: 1234 + PERIODO_MS / 4 });
  assert.notDeepEqual(otro.poligonos, a.poligonos, "el icono no se mueve");
});

test("cada objeto del catálogo de iconos pinta algo", () => {
  for (const id of Object.keys(ICONOS)) {
    const escena = componerIcono(id, { ms: 500 });
    assert.ok(escena.poligonos.length > 0, `el objeto ${id} no pinta nada`);
  }
});

test("una puerta sin objeto propio cae en el respaldo, no en un hueco", () => {
  assert.ok(piezasDe("no-existe").length > 0);
  assert.ok(componerIcono("no-existe", { ms: 0 }).poligonos.length > 0);
});

// El acoplamiento que importa entre las dos listas: si una puerta declara un
// objeto que el pintor no conoce, se ve el respaldo neutro y nadie se entera.
test("toda puerta del catálogo declara un objeto que existe", () => {
  for (const puerta of puertasCantina()) {
    assert.ok(puerta.objeto, `la puerta ${puerta.id} no declara objeto`);
    assert.ok(ICONOS[puerta.objeto], `la puerta ${puerta.id} apunta a un objeto inexistente`);
  }
});

test("las mallas del catálogo son compartidas y nadie las mueve al pintar", () => {
  // Las piezas están congeladas y se reutilizan entre puertas: si `componerIcono`
  // desplazara los vértices en el sitio, el segundo icono saldría descolocado.
  const antes = JSON.stringify(ICONOS.poker[0].malla.vertices);
  componerIcono("poker", { ms: 10 });
  componerIcono("poker", { ms: 20 });
  assert.equal(JSON.stringify(ICONOS.poker[0].malla.vertices), antes);
});
