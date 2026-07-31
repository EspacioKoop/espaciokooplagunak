// Pruebas de la fila de dados (#413). La colocación se prueba pura; el pintado,
// con un contexto 2D de mentira, igual que el resto del 3D retro.

import assert from "node:assert/strict";
import test from "node:test";

import { escenaCubilete, pintarCubilete, rodarDados } from "../scripts/minijuegos/dados-lienzo.mjs";
import { giroDeTirada, orientacionParaValor } from "../scripts/minijuegos/dados-3d.mjs";
import { EPOCAS } from "../scripts/retro3d.mjs";

// Contexto de mentira: anota lo que le piden en vez de dibujar.
function contextoFalso() {
  const registro = { rellenos: [], limpiezas: 0, caminos: 0, colores: new Set() };
  return {
    registro,
    canvas: null,
    set fillStyle(v) { registro.colores.add(v); },
    get fillStyle() { return "#000000"; },
    set strokeStyle(_v) {},
    set lineWidth(_v) {},
    fillRect: (...args) => registro.rellenos.push(args),
    clearRect: () => { registro.limpiezas += 1; },
    beginPath: () => { registro.caminos += 1; },
    moveTo: () => {},
    lineTo: () => {},
    closePath: () => {},
    fill: () => {},
    stroke: () => {},
  };
}

const lienzoFalso = (ancho, alto) => {
  const ctx = contextoFalso();
  return { width: ancho, height: alto, getContext: () => ctx, ctx };
};

test("cada dado ocupa su celda, en fila y sin salirse del búfer", () => {
  const escena = escenaCubilete({ valores: [1, 2, 3, 4, 5], ancho: 200, alto: 40 });
  assert.equal(escena.dados.length, 5);
  for (let i = 1; i < escena.dados.length; i += 1) {
    assert.ok(escena.dados[i].x > escena.dados[i - 1].x, "los dados van en fila");
  }
  for (const dado of escena.dados) {
    assert.ok(dado.x >= 0 && dado.x + dado.lado <= 200, `se sale a lo ancho: ${dado.x}`);
    assert.ok(dado.y >= 0 && dado.y + dado.lado <= 40, `se sale a lo alto: ${dado.y}`);
  }
});

test("la fila se reajusta al perder dados: siempre cabe", () => {
  let anterior = 0;
  for (const cantidad of [5, 4, 3, 2, 1]) {
    const escena = escenaCubilete({
      valores: Array.from({ length: cantidad }, () => 3),
      ancho: 120,
      alto: 30,
    });
    assert.equal(escena.dados.length, cantidad);
    const lado = escena.dados[0].lado;
    assert.ok(lado >= anterior, "con menos dados, cada uno puede ser igual o mayor");
    anterior = lado;
    // El alto manda cuando la celda es más ancha que el búfer: nunca desborda.
    assert.ok(lado <= 30);
  }
});

test("un cubilete vacío no es un error: es una fila sin dados", () => {
  const escena = escenaCubilete({ valores: [], ancho: 100, alto: 20 });
  assert.deepEqual(escena.dados, []);
  assert.deepEqual(escena.poligonos, []);
  assert.equal(escena.ancho, 100);
  // Y sin valores ni cantidad, tampoco revienta.
  assert.deepEqual(escenaCubilete({ ancho: 100, alto: 20 }).dados, []);
});

test("PRIVACIDAD: el cubilete ajeno se pinta sin valores, no tapado", () => {
  const ajeno = escenaCubilete({ cantidad: 3, ancho: 120, alto: 40 });
  assert.equal(ajeno.dados.length, 3);
  // Ningún dado declara valor: no es que se oculte, es que no llegó hasta aquí.
  assert.ok(ajeno.dados.every((d) => d.valor === null));

  // Y se pinta con menos polígonos que uno propio del mismo tamaño: le faltan
  // los puntos, que es exactamente la diferencia.
  const propio = escenaCubilete({ valores: [6, 6, 6], ancho: 120, alto: 40 });
  assert.ok(
    propio.poligonos.length > ajeno.poligonos.length,
    "el cubilete propio debería llevar puntos y el ajeno no",
  );
});

test("el dado ajeno ocupa lo mismo que el propio: no delata cuál es cuál", () => {
  const ajeno = escenaCubilete({ cantidad: 4, ancho: 160, alto: 40 });
  const propio = escenaCubilete({ valores: [1, 2, 3, 4], ancho: 160, alto: 40 });
  assert.deepEqual(
    ajeno.dados.map((d) => [d.x, d.y, d.lado]),
    propio.dados.map((d) => [d.x, d.y, d.lado]),
  );
});

test("los valores se respetan uno a uno, en su orden", () => {
  const valores = [6, 1, 4];
  const escena = escenaCubilete({ valores, ancho: 120, alto: 40 });
  assert.deepEqual(escena.dados.map((d) => d.valor), valores);
});

test("la época se propaga a toda la fila", () => {
  for (const epoca of EPOCAS) {
    const escena = escenaCubilete({ valores: [2, 5], epoca, ancho: 80, alto: 40 });
    assert.equal(escena.epoca, epoca);
    assert.ok(escena.poligonos.length > 0);
  }
});

test("las coordenadas que salen son finitas, pase lo que pase por la puerta", () => {
  const raros = [
    { valores: [3], ancho: 0, alto: 0 },
    { valores: [3, 4], ancho: NaN, alto: -5 },
    { valores: [3], ancho: "80", alto: "40" },
    { cantidad: 2.7, ancho: 90, alto: 30 },
  ];
  for (const opciones of raros) {
    const escena = escenaCubilete(opciones);
    assert.ok(Number.isFinite(escena.ancho) && escena.ancho > 0);
    for (const poligono of escena.poligonos) {
      assert.ok(poligono.puntos.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)));
    }
  }
});

test("pintar vuelca la fila entera al contexto", () => {
  const lienzo = lienzoFalso(160, 40);
  const escena = pintarCubilete(lienzo, { valores: [1, 5, 6] });
  assert.equal(escena.dados.length, 3);
  // Un camino por polígono: lo que se compuso es lo que se pintó.
  assert.equal(lienzo.ctx.registro.caminos, escena.poligonos.length);
  // Sin fondo declarado, el lienzo se limpia en vez de rellenarse: así la fila
  // se puede superponer a lo que ya haya debajo.
  assert.equal(lienzo.ctx.registro.limpiezas, 1);
  assert.deepEqual(lienzo.ctx.registro.rellenos, []);
});

test("con fondo declarado se rellena, y solo una vez", () => {
  const lienzo = lienzoFalso(160, 40);
  pintarCubilete(lienzo, { valores: [2, 2], fondo: "#101820" });
  assert.equal(lienzo.ctx.registro.rellenos.length, 1);
  assert.deepEqual(lienzo.ctx.registro.rellenos[0], [0, 0, 160, 40]);
});

test("sin lienzo utilizable no se pinta ni se revienta", () => {
  assert.equal(pintarCubilete(null, { valores: [1] }), null);
  assert.equal(pintarCubilete({}, { valores: [1] }), null);
  assert.equal(pintarCubilete({ getContext: () => null }, { valores: [1] }), null);
});

// --- La tirada: los dados se mueven ----------------------------------------

test("MOVIMIENTO: la tirada pinta muchos fotogramas y para sola", () => {
  const lienzo = lienzoFalso(160, 40);
  let reloj = 0;
  const pendientes = [];
  let terminada = false;

  rodarDados(lienzo, {
    valores: [3, 5],
    duracionMs: 1000,
    ahora: () => reloj,
    pedirFotograma: (fn) => pendientes.push(fn),
    cancelarFotograma: () => {},
    movimientoReducido: () => false,
    alTerminar: () => { terminada = true; },
  });

  let fotogramas = 1; // el primer paso se pinta ya
  while (pendientes.length > 0 && fotogramas < 200) {
    reloj += 100;
    pendientes.shift()();
    fotogramas += 1;
  }
  assert.ok(fotogramas > 5, `se movió poco: ${fotogramas} fotogramas`);
  assert.equal(terminada, true, "la tirada debería avisar de que acabó");
  assert.equal(pendientes.length, 0, "no debería quedar ningún fotograma pedido");
});

test("MOVIMIENTO: los dados se mueven de verdad entre fotograma y fotograma", () => {
  // Se mira lo que SE PINTÓ, no lo que se recompone aparte: el contexto anota
  // el primer vértice de cada fotograma y esos vértices tienen que cambiar.
  const lienzo = lienzoFalso(160, 40);
  let reloj = 0;
  const pendientes = [];
  const vertices = [];
  lienzo.ctx.moveTo = (x, y) => vertices.push(`${Math.round(x)},${Math.round(y)}`);

  rodarDados(lienzo, {
    valores: [3, 5],
    duracionMs: 1000,
    ahora: () => reloj,
    pedirFotograma: (fn) => pendientes.push(fn),
    cancelarFotograma: () => {},
    movimientoReducido: () => false,
  });

  const primerFotograma = [...vertices];
  reloj += 250;
  vertices.length = 0;
  pendientes.shift()();
  const segundoFotograma = [...vertices];

  assert.ok(primerFotograma.length > 0 && segundoFotograma.length > 0);
  assert.notDeepEqual(segundoFotograma, primerFotograma, "el dado no se movió");
});

test("MOVIMIENTO: aterriza exactamente en la orientación legible", () => {
  // No se «para cerca» y se corrige: en t = 1 el giro ES el de reposo, así que
  // ningún dado puede quedarse de canto porque la animación acabó a destiempo.
  for (const valor of [1, 2, 3, 4, 5, 6]) {
    const parado = giroDeTirada(valor, 1);
    const reposo = orientacionParaValor(valor);
    assert.equal(parado.yaw, reposo.yaw, `yaw del ${valor}`);
    assert.equal(parado.pitch, reposo.pitch, `pitch del ${valor}`);
    assert.equal(parado.roll, 0, `roll del ${valor}`);
  }
});

test("MOVIMIENTO: al principio rueda y luego frena", () => {
  // Desaceleración: el primer tercio recorre mucho más que el último.
  const alPrincipio = Math.abs(giroDeTirada(4, 0).yaw - giroDeTirada(4, 0.33).yaw);
  const alFinal = Math.abs(giroDeTirada(4, 0.66).yaw - giroDeTirada(4, 1).yaw);
  assert.ok(alPrincipio > alFinal, "un dado no acelera al pararse");
});

test("ACCESIBILIDAD: con movimiento reducido se pinta el resultado, quieto", () => {
  const lienzo = lienzoFalso(160, 40);
  const pendientes = [];
  let terminada = false;
  rodarDados(lienzo, {
    valores: [6, 6],
    ahora: () => 0,
    pedirFotograma: (fn) => pendientes.push(fn),
    cancelarFotograma: () => {},
    movimientoReducido: () => true,
    alTerminar: () => { terminada = true; },
  });
  // Ni un fotograma pedido, pero el cubilete SÍ está pintado: el resultado no
  // depende de haber visto la animación.
  assert.equal(pendientes.length, 0);
  assert.ok(lienzo.ctx.registro.caminos > 0, "debería haberse pintado el resultado");
  assert.equal(terminada, true);
});

test("ACCESIBILIDAD: la preferencia se consulta en cada fotograma, no al arrancar", () => {
  const lienzo = lienzoFalso(160, 40);
  let reloj = 0;
  const pendientes = [];
  let reducido = false;
  rodarDados(lienzo, {
    valores: [2, 4],
    duracionMs: 5000,
    ahora: () => reloj,
    pedirFotograma: (fn) => pendientes.push(fn),
    cancelarFotograma: () => {},
    movimientoReducido: () => reducido,
  });
  reloj += 100;
  pendientes.shift()();
  assert.equal(pendientes.length, 1, "debería seguir animando");
  // Alguien cambia la preferencia del sistema con la ventana abierta.
  reducido = true;
  reloj += 100;
  pendientes.shift()();
  assert.equal(pendientes.length, 0, "los dados deberían haberse parado en el acto");
});

test("la tirada se puede cortar, y cortarla dos veces no hace daño", () => {
  const lienzo = lienzoFalso(160, 40);
  const pendientes = [];
  let cancelados = 0;
  const parar = rodarDados(lienzo, {
    valores: [1, 1, 1],
    duracionMs: 5000,
    ahora: () => 0,
    pedirFotograma: (fn) => { pendientes.push(fn); return pendientes.length; },
    cancelarFotograma: () => { cancelados += 1; },
    movimientoReducido: () => false,
  });
  parar();
  parar();
  assert.equal(cancelados, 1, "solo se cancela una vez");
  // Y un fotograma que llegue tarde no repinta nada.
  const antes = lienzo.ctx.registro.caminos;
  pendientes.shift()?.();
  assert.equal(lienzo.ctx.registro.caminos, antes);
});

test("una tirada sin dados no se queda pidiendo fotogramas", () => {
  const lienzo = lienzoFalso(160, 40);
  const pendientes = [];
  const parar = rodarDados(lienzo, {
    valores: [],
    ahora: () => 0,
    pedirFotograma: (fn) => pendientes.push(fn),
    movimientoReducido: () => false,
  });
  assert.equal(pendientes.length, 0);
  assert.doesNotThrow(() => parar());
});
