import assert from "node:assert/strict";
import test from "node:test";

import { PORTE, normalizarPorte, sostener } from "../scripts/avatar/avatar-porte.mjs";
import { piezasAvatar, ALTO_BASE, GESTOS } from "../scripts/cantina-avatar.mjs";
import { anclasAvatar } from "../scripts/avatar/avatar-rig.mjs";

const MEDIDAS = { escala: ALTO_BASE, ancho: 0.46, pies: [0, 0, 0] };
const nombres = (piezas) => piezas.map((p) => p.nombre);
const buscar = (piezas, sufijo) => piezas.find((p) => p.nombre.endsWith(sufijo));

test("colgar es una resta: el agarre del objeto acaba exactamente en el anclaje", () => {
  // La jarra se coge por el asa, que está a 0,1 m de su eje. Colgada de un
  // punto, su cuerpo tiene que quedar 0,1 m al otro lado — si el agarre no se
  // restara, la jarra quedaría centrada en la mano y el asa por fuera.
  const [jarra] = sostener("jarra", [1, 2, 3]);
  assert.deepEqual(jarra.centro, [1 - 0.1, 2, 3]);
});

test("cada objeto trae su propio agarre, y por eso cuelgan distinto del mismo punto", () => {
  const punto = [0, 1, 0];
  const jarra = sostener("jarra", punto)[0].centro;
  const mango = sostener("linterna", punto)[0].centro;
  const tabla = sostener("tablilla", punto)[0].centro;
  assert.notDeepEqual(jarra, mango);
  assert.notDeepEqual(mango, tabla);
  // Y ninguno cae en el punto a pelo: si alguno lo hiciera, su agarre sería
  // cero y estaríamos otra vez centrando el objeto en la mano.
  for (const centro of [jarra, mango, tabla]) assert.notDeepEqual(centro, punto);
});

test("el desplazamiento del objeto gira con el cuerpo", () => {
  const recto = sostener("jarra", [0, 1, 0], { yaw: 0 })[0].centro;
  const girado = sostener("jarra", [0, 1, 0], { yaw: Math.PI / 2 })[0].centro;
  assert.notDeepEqual(recto, girado);
  // Media vuelta deja el asa al otro lado, no en el mismo sitio.
  const media = sostener("jarra", [0, 1, 0], { yaw: Math.PI })[0].centro;
  assert.ok(Math.abs(media[0] - 0.1) < 1e-9, `x=${media[0]}`);
});

test("un objeto desconocido no dibuja nada y no revienta", () => {
  assert.deepEqual(sostener("laser-de-plasma", [0, 1, 0]), []);
  assert.deepEqual(sostener(null, [0, 1, 0]), []);
  assert.deepEqual(normalizarPorte({ manoDerecha: "laser-de-plasma" }).manoDerecha, null);
});

test("un anclaje mal formado tampoco: no se dibuja media pieza", () => {
  assert.deepEqual(sostener("jarra", [0, 1]), []);
  assert.deepEqual(sostener("jarra", null), []);
});

test("las dos manos son anclajes independientes: llevar algo en cada una no es un caso nuevo", () => {
  const piezas = piezasAvatar({ gesto: "hombros" }, {
    pies: [0, 0, 0],
    porte: { manoDerecha: "linterna", manoIzquierda: "jarra" },
  });
  assert.ok(nombres(piezas).some((n) => n.includes("DerLinterna")));
  assert.ok(nombres(piezas).some((n) => n.includes("IzqJarra")));

  const anclas = anclasAvatar(MEDIDAS, {});
  // Cada objeto sale de SU mano, no los dos de la misma.
  const linterna = buscar(piezas, "DerLinternaMango").centro;
  const jarra = buscar(piezas, "IzqJarra").centro;
  assert.ok(linterna[0] > 0, `la derecha va al lado positivo: ${linterna[0]}`);
  assert.ok(jarra[0] < 0, `la izquierda al negativo: ${jarra[0]}`);
  assert.ok(anclas.manoDerecha.punto[0] > anclas.manoIzquierda.punto[0]);
});

test("llevar algo no es un gesto: el mismo porte vale con todos", () => {
  for (const gesto of GESTOS) {
    const piezas = piezasAvatar({ gesto }, {
      pies: [0, 0, 0],
      porte: { manoDerecha: "linterna" },
    });
    assert.ok(
      nombres(piezas).some((n) => n.includes("DerLinternaMango")),
      `la linterna desaparece con el gesto "${gesto}"`,
    );
  }
});

test("sin porte declarado no cambia nada de lo que ya había", () => {
  const antes = piezasAvatar({ gesto: "brindis" }, { pies: [0, 0, 0] });
  assert.ok(nombres(antes).some((n) => n.endsWith("Jarra")), "el brindis sigue sacando su jarra");
  const fumando = piezasAvatar({ gesto: "fumar" }, { pies: [0, 0, 0] });
  assert.ok(nombres(fumando).some((n) => n.endsWith("Brasa")), "y fumar, su brasa");
});

test("una mano ocupada no saca además la jarra del brindis", () => {
  const piezas = piezasAvatar({ gesto: "brindis" }, {
    pies: [0, 0, 0],
    porte: { manoDerecha: "linterna" },
  });
  const jarras = nombres(piezas).filter((n) => n.endsWith("Jarra"));
  assert.deepEqual(jarras, [], `la mano lleva ya una linterna: ${jarras.join(", ")}`);
  assert.ok(nombres(piezas).some((n) => n.includes("DerLinternaMango")));
});

test("se puede fumar con algo en la mano: el cigarro cuelga de la boca, no del puño", () => {
  const piezas = piezasAvatar({ gesto: "fumar" }, {
    pies: [0, 0, 0],
    porte: { manoDerecha: "tablilla" },
  });
  assert.ok(nombres(piezas).some((n) => n.endsWith("Brasa")), "el cigarro sigue ahí");
  assert.ok(nombres(piezas).some((n) => n.includes("DerTablilla")), "y la tablilla también");
});

test("el estado activo cambia el tono y la emisión, no el inventario", () => {
  const apagada = sostener("linterna", [0, 1, 0], { encendida: false });
  const encendida = sostener("linterna", [0, 1, 0], { encendida: true });
  assert.equal(apagada.length, encendida.length, "encender no añade ni quita piezas");

  const cristalOff = apagada.at(-1);
  const cristalOn = encendida.at(-1);
  assert.deepEqual(cristalOff.centro, cristalOn.centro, "ni la mueve de sitio");
  assert.equal(cristalOn.emisivo, true);
  assert.equal(cristalOff.emisivo, false);
  assert.notEqual(cristalOff.color, cristalOn.color);
});

test("el catálogo es cerrado y todas sus entradas se pueden colgar", () => {
  for (const nombre of PORTE) {
    const piezas = sostener(nombre, [0, 1, 0]);
    assert.ok(piezas.length > 0, `"${nombre}" no dibuja nada`);
    for (const pieza of piezas) {
      assert.equal(typeof pieza.color, "string");
      assert.equal(pieza.centro.length, 3);
      assert.ok(pieza.centro.every(Number.isFinite), `centro no finito en ${pieza.nombre}`);
      // Una pieza es caja O malla, nunca ninguna de las dos: si no trae medidas
      // ni malla, no hay nada que dibujar y el fallo aparecería en pantalla.
      const esCaja = Array.isArray(pieza.medidas) && pieza.medidas.length === 3;
      const esMalla = pieza.malla && Array.isArray(pieza.malla.vertices) && Array.isArray(pieza.malla.caras);
      assert.ok(esCaja || esMalla, `${pieza.nombre} no es ni caja ni malla`);
      if (esMalla) {
        assert.ok(pieza.malla.vertices.length >= 3, `malla vacía en ${pieza.nombre}`);
        for (const v of pieza.malla.vertices) {
          assert.ok(v.every(Number.isFinite), `vértice no finito en ${pieza.nombre}`);
        }
      }
    }
  }
});

test("una pieza de malla se traslada al anclaje igual que una caja", () => {
  const espada = sostener("espada", [1, 2, 3]);
  const hoja = espada.find((p) => p.nombre.endsWith("EspadaHoja"));
  assert.ok(hoja.malla, "la hoja es malla, no caja: con un ortoedro no hay punta");
  // El agarre de la espada es [0, -0.165, 0], así que su origen acaba 0,165 m
  // por encima de la mano y el puño cae en el mango.
  assert.deepEqual(hoja.centro, [1, 2 + 0.165, 3]);
});

test("la espada convive con las cajas en el mismo catálogo", () => {
  const conMalla = sostener("espada", [0, 1, 0]).some((p) => p.malla);
  const conCaja = sostener("jarra", [0, 1, 0]).every((p) => !p.malla && p.medidas);
  assert.ok(conMalla && conCaja, "el catálogo admite las dos formas sin ramificar en quien cuelga");
});
