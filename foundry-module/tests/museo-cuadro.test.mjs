import assert from "node:assert/strict";
import test from "node:test";

import { CUADRO } from "../scripts/paleta.mjs";
import { CELDA, fundirRectangulos } from "../scripts/nave-mural-pixel.mjs";
import {
  ALTO_TOTAL,
  ANCHO_TOTAL,
  CELDA_LIENZO,
  COMPOSICIONES,
  LIENZO,
  MARCO,
  SALIENTE_CUADRO,
  TOPE_CUADRO,
  costeCuadro,
  piezasCuadro,
  rejillaCuadro,
} from "../scripts/museo-cuadro.mjs";
import { CATALOGO_CUADROS, MALLAS_CUADROS } from "../scripts/museo-cuadros.mjs";
import { NATURALEZAS, validarCatalogoPiezas, cartelaDe } from "../scripts/catalogo-piezas.mjs";
import {
  ANCHO,
  CUADROS_COLGADOS,
  GANCHOS,
  Z_CUADROS,
  INTERACCIONES,
  PIEZAS_COLOCADAS,
  PLANTA_MUSEO,
  colgarCuadro,
} from "../scripts/museo-escena.mjs";
import { colisiona } from "../scripts/nave-movimiento.mjs";
import { interaccionAlAlcance } from "../scripts/nave-interaccion.mjs";

const mallasDisponibles = new Set(MALLAS_CUADROS);

/* ---- el catálogo ----------------------------------------------------------- */

test("el catálogo de cuadros pasa el MISMO validador que las esculturas", () => {
  // La unificación es el punto (#598): dos validadores de licencia se
  // desincronizan, y una licencia desincronizada no es un fallo de forma.
  assert.equal(validarCatalogoPiezas(CATALOGO_CUADROS, { mallasDisponibles }), true);
  assert.equal(CATALOGO_CUADROS.piezas.length, 5, "cinco cuadros en seis ganchos");
  assert.ok(CATALOGO_CUADROS.piezas.length <= GANCHOS, "hay más cartelas que muro donde colgarlas");
});

test("cada ficha apunta a una composición que existe de verdad", () => {
  for (const pieza of CATALOGO_CUADROS.piezas) {
    assert.ok(COMPOSICIONES[pieza.malla], `${pieza.id} apunta a un dibujo que no está`);
  }
});

test("LA NORMA DE LA CASA: una cartela de obra generada dice que está generada", () => {
  // El mismo criterio que obliga al León a decir que es una reconstrucción y a
  // la Afrodita a decir que es un vaciado. Si un cuadro pintado por una máquina
  // no lo dijera, la sala estaría enseñando algo sin decir qué es.
  const generadas = CATALOGO_CUADROS.piezas.filter((p) => p.naturaleza === "obra-propia");
  assert.equal(generadas.length, 2);
  for (const pieza of generadas) {
    assert.match(pieza.cartela.es, /GENERAD/);
    assert.match(pieza.cartela.en, /GENERATED/);
  }
});

test("LA MISMA NORMA en la otra dirección: un redibujo dice de quién es lo que redibuja", () => {
  // Un cuadro interpretado es el caso en el que más fácil sería callarse: se
  // parece a la obra de alguien, no trae ni un byte suyo, y nadie lo notaría.
  // Por eso `interpretacion` existe como naturaleza y por eso la cartela tiene
  // que decir las dos cosas — que es un redibujo, y de qué.
  const interpretadas = CATALOGO_CUADROS.piezas.filter(
    (p) => p.naturaleza === "interpretacion",
  );
  assert.equal(interpretadas.length, 3);
  assert.ok(NATURALEZAS.includes("interpretacion"));
  for (const pieza of interpretadas) {
    assert.match(pieza.cartela.es, /REDIBUJO/);
    assert.match(pieza.cartela.en, /REDRAWING/);
    // El autor del original, nombrado en las dos lenguas y también en el título.
    const autor = pieza.nombre.es.match(/según (.+)\)/)[1];
    assert.ok(pieza.cartela.es.includes(autor), `${pieza.id}: la cartela no nombra a ${autor}`);
    assert.ok(pieza.cartela.en.includes(autor), `${pieza.id}: the English label omits ${autor}`);
    // Y la fuente CC0 es la PÁGINA que declara la licencia, no el fichero: es la
    // regla dura de `docs/PROCEDENCIA_ASSETS.md` y la que exige `kind: "cc"`.
    // Ojo, la página de Commons acaba en `.jpg` como acaba en `.stl` la del
    // León; lo que la distingue de un enlace al archivo es el host, no el
    // sufijo. Un `upload.wikimedia.org` sería el fichero desnudo, sin licencia
    // que leer al lado.
    assert.equal(pieza.provenance.kind, "cc");
    assert.match(pieza.provenance.source_url, /^https:\/\/commons\.wikimedia\.org\/wiki\//);
  }
});

test("NINGÚN cuadro interpretado trae un fichero ajeno al árbol", () => {
  // La diferencia con las estatuas, y la que hace que estas fichas no lleven
  // `sha256`: de la fuente sale la composición, no el archivo. Si algún día una
  // ficha necesitara un hash, es que alguien ha copiado algo y esto ya no es
  // una interpretación.
  for (const pieza of CATALOGO_CUADROS.piezas) {
    assert.deepEqual(
      Object.keys(pieza.provenance).filter((k) => k === "sha256"),
      [],
    );
    assert.ok(typeof COMPOSICIONES[pieza.malla] === "function", "el dibujo es CÓDIGO, no un dato");
  }
});

test("nombre y cartela en los dos idiomas, y el crédito se deriva", () => {
  for (const pieza of CATALOGO_CUADROS.piezas) {
    for (const idioma of ["es", "en"]) {
      const cartela = cartelaDe(pieza, idioma);
      assert.equal(cartela.titulo, pieza.nombre[idioma]);
      assert.equal(cartela.texto, pieza.cartela[idioma]);
      assert.ok(cartela.credito, `${pieza.id} sin crédito derivado en ${idioma}`);
    }
  }
});

/* ---- la celda, que es el mando de escala ----------------------------------- */

test("el lienzo tiene su PROPIA celda, y la piel de la nave no se ha movido", () => {
  // Lo que #551 enseñó por las malas: bajar la celda compartida parte en
  // silencio todo lo que estaba medido en filas. La del cuadro es suya.
  assert.equal(CELDA_LIENZO, 0.0125);
  assert.equal(CELDA, 0.1, "la celda del mural de la nave NO se toca desde aquí");
  assert.ok(CELDA_LIENZO < CELDA, "un cuadro se mira más de cerca que un muro");
  assert.ok(SALIENTE_CUADRO > 0.01, "el cuadro va por delante de la piel, no dentro de ella");
});

test("la rejilla mide lo que dicen las medidas en METROS, no al revés", () => {
  const rejilla = rejillaCuadro("campo-partido");
  assert.equal(rejilla[0].length, Math.round(LIENZO.ancho / CELDA_LIENZO) + MARCO * 2);
  assert.equal(rejilla.length, Math.round(LIENZO.alto / CELDA_LIENZO) + MARCO * 2);
  assert.equal(Math.round(ANCHO_TOTAL * 1000), 1300);
  assert.equal(Math.round(ALTO_TOTAL * 1000), 900);
});

/* ---- el dibujo -------------------------------------------------------------- */

test("el marco lleva relieve y el lienzo NO", () => {
  const rejilla = rejillaCuadro("campo-partido");
  const arriba = rejilla[rejilla.length - 1];
  const abajo = rejilla[0];
  // La luz viene de arriba (`LUZ` en retro3d): canto claro arriba, oscuro
  // abajo. Invertirlo dejaría el marco hundido en vez de montado.
  // La esquina de arriba a la derecha es donde se cruzan luz y sombra, y ahí
  // manda la sombra: es el costado derecho, que es el que no ve la luz.
  assert.ok(arriba.slice(0, -1).every((color) => color === CUADRO.marcoLuz));
  assert.equal(arriba.at(-1), CUADRO.marcoSombra);
  assert.ok(abajo.every((color) => color === CUADRO.marcoSombra));
  // Y dentro del lienzo no aparece ni un tono de marco: la pintura es plana.
  const dentro = rejilla
    .slice(MARCO, rejilla.length - MARCO)
    .flatMap((fila) => fila.slice(MARCO, fila.length - MARCO));
  for (const color of dentro) {
    assert.ok(
      ![CUADRO.marco, CUADRO.marcoLuz, CUADRO.marcoSombra].includes(color),
      "una composición ha pintado encima del marco",
    );
  }
});

test("ninguna composición se sale del lienzo ni deja un hueco sin pintar", () => {
  for (const id of Object.keys(COMPOSICIONES)) {
    const rejilla = rejillaCuadro(id);
    for (const fila of rejilla) {
      assert.equal(fila.length, rejilla[0].length);
      assert.ok(fila.every((color) => color !== null), `${id} deja el muro a la vista`);
    }
  }
});

/* ---- el presupuesto, que es la condición ----------------------------------- */

test("EL PRESUPUESTO: cada composición cabe en el tope, y con margen", () => {
  // Un cuadro no se recorta al tope como se recorta un muro: media pintura se
  // lee como un fallo. Por eso el módulo revienta al importar si no cabe, y por
  // eso esta prueba mide la cifra en vez de comprobar que no ha explotado.
  const costes = Object.fromEntries(
    Object.keys(COMPOSICIONES).map((id) => [id, costeCuadro(id)]),
  );
  assert.deepEqual(costes, {
    "campo-partido": 48,
    "contratiempo-de-verdin": 53,
    "frente-al-mar": 170,
    "viento-del-sur": 162,
    "sobre-la-niebla": 149,
  });
  for (const [id, coste] of Object.entries(costes)) {
    assert.ok(coste <= TOPE_CUADRO, `${id} se pasa del tope`);
  }
});

test("LA GUARDA mide ANTES del tope: chapasDeRejilla ya recorta, así que costeCuadro no basta", () => {
  // Revisión de #878: `costeCuadro` pasa por `chapasDeRejilla`, que aplica
  // `.slice(0, tope)` antes de devolver las chapas — así que su cifra NUNCA
  // puede superar `TOPE_CUADRO` y una guarda que solo mirara `costeCuadro`
  // sería inalcanzable. Un tablero de ajedrez no funde ningún par de celdas
  // vecinas, así que cada celda es su propio rectángulo: 21×21 da 441, muy por
  // encima de `TOPE_CUADRO` (200).
  const lado = 21;
  const rejillaAjedrezada = Array.from({ length: lado }, (_, fila) =>
    Array.from({ length: lado }, (_, columna) =>
      (fila + columna) % 2 === 0 ? CUADRO.ocre : CUADRO.bermellon,
    ),
  );
  const sinTope = fundirRectangulos(rejillaAjedrezada).length;
  assert.equal(sinTope, 441);
  assert.ok(sinTope > TOPE_CUADRO, "el tablero de prueba debe superar el tope para que la guarda tenga algo que atrapar");
});

test("fundir es lo que hace que esto quepa: 7.488 celdas caben en decenas de caras", () => {
  const celdas = rejillaCuadro("campo-partido").flat().length;
  assert.equal(celdas, 7488);
  assert.ok(
    costeCuadro("campo-partido") < celdas / 50,
    "sin fundir rectángulos este dibujo no cabría en un fotograma",
  );
});

/* ---- colgado en la sala ----------------------------------------------------- */

test("los cuadros cuelgan de los muros laterales, hacia DENTRO de la sala", () => {
  assert.equal(CUADROS_COLGADOS.length, 5);
  const xs = (colgado) => colgado.chapas.flatMap(({ malla }) => malla.vertices.map(([x]) => x));
  for (const colgado of CUADROS_COLGADOS) {
    const enOeste = xs(colgado).every((x) => x > 0 && x < 0.1);
    const enEste = xs(colgado).every((x) => x < ANCHO && x > ANCHO - 0.1);
    assert.ok(enOeste || enEste, `${colgado.pieza.id} no está en ningún muro lateral`);
  }
});

test("SE ALTERNA de muro en muro: la colección no se amontona a un lado", () => {
  // Con cinco cuadros seguidos, llenar el oeste antes que el este dejaría a
  // quien entra viéndolo todo a la izquierda. Alternando, el reparto aguanta
  // sea cual sea el número de fichas.
  const muros = CUADROS_COLGADOS.map((colgado) => (colgado.centro[0] === 0 ? "oeste" : "este"));
  assert.deepEqual(muros, ["oeste", "este", "oeste", "este", "oeste"]);
  const zs = CUADROS_COLGADOS.map((colgado) => colgado.centro[2]);
  assert.deepEqual(zs.map((z) => Number(z.toFixed(2))), [1.5, 1.5, 3.2, 3.2, 4.9]);
});

test("dos cuadros del mismo muro no se tocan: entre marco y marco hay hueco", () => {
  // Sin esto una pared es un friso y no dos obras. Se mide sobre las z ya
  // repartidas, que es donde se vería el fallo.
  const separacion = Z_CUADROS.slice(1).map((z, i) => z - Z_CUADROS[i]);
  for (const hueco of separacion) {
    assert.ok(hueco > ANCHO_TOTAL + 0.3, `dos cuadros a ${hueco.toFixed(2)} m se leen como uno`);
  }
});

test("cuelga a la altura del ojo, no en la mitad del muro", () => {
  for (const colgado of CUADROS_COLGADOS) {
    const ys = colgado.chapas.flatMap(({ malla }) => malla.vertices.map(([, y]) => y));
    assert.ok(Math.min(...ys) > 1.0, `${colgado.pieza.id} cuelga demasiado bajo`);
    assert.ok(Math.max(...ys) < 2.2, `${colgado.pieza.id} cuelga por encima de la mirada`);
    assert.ok(Math.abs(colgado.centro[1] - 1.6) < 0.01, "el centro del cuadro va a 1,60 m");
  }
});

test("desde el mirador de cada cuadro se alcanza SU cartela, mirando al muro", () => {
  for (const colgado of CUADROS_COLGADOS) {
    const [x, z] = colgado.mirador;
    assert.equal(colisiona(x, z, 0.35, PLANTA_MUSEO), false, "no se puede llegar al mirador");
    const alcanzada = interaccionAlAlcance(x, z, 0.35, INTERACCIONES);
    assert.equal(alcanzada?.accion?.tipo, "cartela");
    assert.equal(alcanzada?.accion?.pieza, colgado.pieza.id);
    // El frente es (sen yaw, cos yaw): mirar al muro es mirar en x, no en z.
    assert.ok(Math.abs(Math.sin(colgado.yaw)) > 0.99, "el mirador no mira al muro");
  }
});

test("un cuadro NO se puede tocar andando: lo que frena es el muro", () => {
  // Chocarse con un cuadro es de las cosas que rompen un sitio, igual que
  // chocarse con una cartela.
  for (const colgado of CUADROS_COLGADOS) {
    const [, , z] = colgado.centro;
    const dentro = colgado.centro[0] === 0 ? 0.45 : ANCHO - 0.45;
    assert.equal(colisiona(dentro, z, 0.35, PLANTA_MUSEO), false, "el cuadro estorba al andar");
  }
});

test("ningún cuadro se cuelga detrás de una escultura", () => {
  // El muro del fondo es el de los pedestales: un cuadro ahí le disputa la
  // lectura a la pieza que tiene delante.
  for (const colgado of CUADROS_COLGADOS) {
    for (const colocada of PIEZAS_COLOCADAS) {
      const dx = colgado.centro[0] - colocada.centro[0];
      const dz = colgado.centro[2] - colocada.centro[2];
      assert.ok(Math.hypot(dx, dz) > 1.5, `${colgado.pieza.id} pisa a ${colocada.pieza.id}`);
    }
  }
});

test("colgar más cuadros que ganchos no se apaña en silencio", () => {
  assert.equal(GANCHOS, 6, "tres ganchos por muro lateral");
  assert.throws(
    () => colgarCuadro(CATALOGO_CUADROS.piezas[0], GANCHOS),
    /decisión de diseño/,
    "el cuadro que ya no cabe tiene que reventar, no aparecer solo",
  );
});

test("una composición que no existe falla al pedirla, no al pintarla", () => {
  assert.throws(() => rejillaCuadro("no-existe"), /composición/);
  assert.throws(() => piezasCuadro({
    cara: { eje: "z", plano: 0, sentido: 1 },
    u: 0,
    cota: 1,
    composicion: "no-existe",
  }), /composición/);
});

test("NADA de lo que añaden los cuadros concede, cuenta ni recuerda", () => {
  const deCuadros = INTERACCIONES.filter((punto) => punto.id.startsWith("cuadro-"));
  assert.equal(deCuadros.length, 5);
  for (const punto of deCuadros) {
    assert.deepEqual(Object.keys(punto.accion).sort(), ["pieza", "tipo"]);
    assert.equal(punto.accion.tipo, "cartela");
  }
});

/* ---- la gramática que no puede volver (#838) -------------------------------- */

test("«contratiempo-de-verdin» no puede volver a leerse como un gráfico de barras", () => {
  // La revisión de #838 rechazó la versión anterior de este cuadro: cuatro
  // columnas sobre la misma base, de paso constante, altura estrictamente
  // creciente y un remate claro en el mismo costado de cada una. Eso no es un
  // fallo de color ni de presupuesto, así que ninguna de las pruebas de arriba
  // podía verlo. Esta mide la GRAMÁTICA, que es lo que se leía como telemetría:
  // si vuelve a haber una base común y una serie ordenable, esto falla.
  const rejilla = rejillaCuadro("contratiempo-de-verdin");
  const pintura = rejilla
    .slice(MARCO, rejilla.length - MARCO)
    .map((fila) => fila.slice(MARCO, fila.length - MARCO));
  const filas = pintura.length;

  // La fila de abajo del lienzo: cuántas manchas se apoyan en ella. Un gráfico
  // de barras las apoya TODAS; aquí no debe apoyarse ninguna.
  const apoyadas = pintura[0].filter((color) => color !== CUADRO.fondo).length;
  assert.equal(apoyadas, 0, "hay masas apoyadas en una base común: eso es un eje");

  // Altura de pintura por columna. En un gráfico de barras la serie de alturas
  // por bloque es monótona; aquí ni siquiera puede serlo el perfil columna a
  // columna en un solo sentido.
  const alturas = pintura[0].map((_, u) => {
    let cuenta = 0;
    for (let v = 0; v < filas; v += 1) if (pintura[v][u] !== CUADRO.fondo) cuenta += 1;
    return cuenta;
  });
  const sube = alturas.some((alto, i) => i > 0 && alto > alturas[i - 1]);
  const baja = alturas.some((alto, i) => i > 0 && alto < alturas[i - 1]);
  assert.ok(sube && baja, "el perfil es monótono: se lee como una serie ordenada");

  // Y el hueso es UN acento, no un tic por elemento.
  const trazos = pintura.flat().filter((color) => color === CUADRO.hueso).length;
  assert.ok(trazos > 0, "el acento de hueso ha desaparecido del dibujo");
  const columnasConHueso = new Set();
  pintura.forEach((fila) => fila.forEach((color, u) => {
    if (color === CUADRO.hueso) columnasConHueso.add(u);
  }));
  assert.equal(
    trazos,
    columnasConHueso.size,
    "el hueso ocupa más de una fila por columna: son remates verticales, o sea ticks",
  );
});





/* ---- la gramática, también en la ola (#838) --------------------------------- */

test("«frente-al-mar» tiene VOLADIZO: la cresta vuela sobre el agua de delante", () => {
  // La revisión de #838 bloqueó por el verdín, pero la ola de la misma tanda
  // caía en la misma gramática con la coartada de ser una ola: bloques de
  // distinta altura con la cresta plana encima y marcas cortas casi iguales.
  // Lo que ninguna barra puede hacer es VOLAR: una barra nace en su base y
  // sube. Si la espuma deja de sobresalir por encima de aire, este cuadro ha
  // vuelto a ser un gráfico.
  const rejilla = rejillaCuadro("frente-al-mar");
  const pintura = rejilla
    .slice(MARCO, rejilla.length - MARCO)
    .map((fila) => fila.slice(MARCO, fila.length - MARCO));

  let voladizo = 0;
  for (let v = 1; v < pintura.length; v += 1) {
    for (let u = 0; u < pintura[v].length; u += 1) {
      // Espuma con cielo justo debajo: no se apoya en nada, cuelga.
      if (pintura[v][u] === CUADRO.espuma && pintura[v - 1][u] === CUADRO.azulPalido) voladizo += 1;
    }
  }
  // Hoy son 16 celdas de espuma sin nada debajo. El umbral va holgado por
  // abajo a propósito: lo que se vigila es que el voladizo EXISTA, no su tamaño
  // exacto, que es una decisión de dibujo y puede moverse.
  assert.ok(voladizo >= 10, `la cresta ya no vuela sobre el vacío (${voladizo} celdas)`);
});

/* ---- el marco, moldura PINTADA (#838) --------------------------------------- */

test("el marco es una MOLDURA y no un borde de color", () => {
  // El perfil, de fuera adentro: un canto que sube, el cuerpo del listón y un
  // rebaje que baja hacia el lienzo. Lo que lo hace moldura es que el rebaje
  // lleva la luz AL REVÉS que el canto exterior; sin esa inversión el lienzo
  // parece pegado encima del listón en vez de encajado detrás.
  const rejilla = rejillaCuadro("campo-partido");
  const filas = rejilla.length;
  const columnas = rejilla[0].length;
  const d = MARCO - 1;

  // Canto exterior: arriba y a la izquierda cogen la luz.
  assert.equal(rejilla[filas - 1][columnas >> 1], CUADRO.marcoLuz);
  assert.equal(rejilla[filas >> 1][0], CUADRO.marcoLuz);
  assert.equal(rejilla[0][columnas >> 1], CUADRO.marcoSombra);
  assert.equal(rejilla[filas >> 1][columnas - 1], CUADRO.marcoSombra);

  // Rebaje interior: exactamente al revés.
  assert.equal(rejilla[filas - 1 - d][columnas >> 1], CUADRO.marcoSombra);
  assert.equal(rejilla[filas >> 1][d], CUADRO.marcoSombra);
  assert.equal(rejilla[d][columnas >> 1], CUADRO.marcoLuz);
  assert.equal(rejilla[filas >> 1][columnas - 1 - d], CUADRO.marcoLuz);

  // Y entre los dos, el cuerpo del listón sin tocar.
  assert.equal(rejilla[filas - 2][columnas >> 1], CUADRO.marco);
});

test("la moldura CABE porque la celda del lienzo es fina, no por suerte", () => {
  // Cuatro celdas de listón son 5 cm. A la celda del muro (10 cm) el listón
  // entero sería media celda y no habría perfil que dibujar: la moldura existe
  // porque el cuadro tiene celda propia, que es la misma razón por la que el
  // dibujo tiene detalle.
  assert.ok(MARCO * CELDA_LIENZO < CELDA, "el listón mide menos que una celda de muro");
  assert.ok(MARCO >= 3, "con menos de tres celdas no hay canto, cuerpo y rebaje");
});

test("EL LIENZO SIGUE PLANO: la moldura es cosa del marco", () => {
  // Es la regla del módulo y no cambia: biselar la pintura la convertiría en
  // chapa remachada. Dentro del lienzo no puede aparecer ningún tono de marco.
  for (const id of Object.keys(COMPOSICIONES)) {
    const rejilla = rejillaCuadro(id);
    const dentro = rejilla
      .slice(MARCO, rejilla.length - MARCO)
      .flatMap((fila) => fila.slice(MARCO, fila.length - MARCO));
    for (const color of dentro) {
      assert.ok(![CUADRO.marco, CUADRO.marcoLuz, CUADRO.marcoSombra].includes(color), id);
    }
  }
});

test("la moldura no se come el presupuesto: son ocho tiradas, no un dibujo", () => {
  // Ocho llamadas de una celda de ancho sobre un marco macizo. Si esto empieza
  // a crecer es que alguien está dibujando dentro del listón.
  const conMarco = fundirRectangulos(rejillaCuadro("campo-partido")).length;
  assert.ok(conMarco < 60, `el marco se está llenando: ${conMarco} rectángulos`);
});
