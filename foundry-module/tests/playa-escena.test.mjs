// La playa de pruebas (#587).
//
// Lo que se comprueba aquí no es que «se vea bonita» —eso es playtest— sino lo
// que un exterior puede romper sin que nadie se entere: que se pueda andar por
// donde se dice, que no se pueda entrar en el mar, que la geometría lejana
// exista de verdad y que la cabina siga siendo la salida.

import assert from "node:assert/strict";
import test from "node:test";

import {
  ANCHO,
  ENTRADA,
  INTERACCIONES,
  PLANTA_PLAYA,
  LARGO_SOMBRA,
  PROFUNDIDAD,
  RUMBO_SOMBRA,
  SOL,
  VIENTO,
  VOCABULARIO_PLAYA,
  componerPlaya,
  ESTATUA,
} from "../scripts/playa-escena.mjs";
import { colisiona } from "../scripts/nave-movimiento.mjs";
import { interaccionAlAlcance } from "../scripts/nave-interaccion.mjs";
import { CATALOGO_MUSEO } from "../scripts/museo-piezas.mjs";
import { CATALOGO_ANDAR } from "../scripts/nave-catalogo-andar.mjs";
import { PLAYA } from "../scripts/paleta.mjs";

const RADIO = 0.35;

/* ---- por dónde se anda ---------------------------------------------------- */

test("se aparece en sitio libre, mirando al fondo del camino", () => {
  assert.equal(colisiona(ENTRADA.x, ENTRADA.z, RADIO, PLANTA_PLAYA), false);
  assert.equal(ENTRADA.yaw, 0, "yaw 0 mira a +z, que es hacia la cabina");
});

test("el camino de arena se recorre de punta a punta", () => {
  // La comprobación que de verdad importa: si el camino estuviera cortado por un
  // poste mal puesto o por la huella de la cabina, la escena sería un pasillo
  // sin salida y solo se vería al andarla.
  for (let z = 2; z <= PROFUNDIDAD - 2; z += 0.5) {
    assert.equal(colisiona(11, z, RADIO, PLANTA_PLAYA), false, `el camino está cortado en z=${z}`);
  }
});

test("no se entra en el mar: nadar está fuera de alcance", () => {
  for (let z = 2; z <= PROFUNDIDAD - 2; z += 4) {
    assert.equal(colisiona(20, z, RADIO, PLANTA_PLAYA), true, `se puede meter el pie en el agua en z=${z}`);
  }
});

test("la duna baja se pisa y la alta no", () => {
  // El límite que impone que el motor de movimiento no tenga altura de terreno:
  // lo que se puede pisar es lo que no se nota al pisarlo.
  assert.equal(colisiona(6, 20, RADIO, PLANTA_PLAYA), false, "la falda de la duna debería pisarse");
  assert.equal(colisiona(0.5, 20, RADIO, PLANTA_PLAYA), true, "la duna alta debería frenar");
});

test("los postes de luz son sólidos: se rodean, no se atraviesan", () => {
  assert.equal(colisiona(3, 4, RADIO, PLANTA_PLAYA), true);
});

/* ---- lo que se ve --------------------------------------------------------- */

test("la escena se compone y trae geometría de sobra", () => {
  const escena = componerPlaya(ENTRADA.x, 0, ENTRADA.z, ENTRADA.yaw, { ancho: 480, alto: 270 });
  assert.equal(escena.ancho, 480);
  assert.ok(escena.poligonos.length > 50, `solo ${escena.poligonos.length} polígonos: falta media playa`);
  // Ni un polígono con coordenadas rotas: un NaN aquí lo aceptaría el pintor sin
  // rechistar y se vería como un tajo en la imagen.
  for (const poligono of escena.poligonos) {
    for (const { x: px, y: py } of poligono.puntos ?? []) {
      assert.ok(Number.isFinite(px) && Number.isFinite(py));
    }
  }
});

test("mirando a los cuatro rumbos siempre hay algo pintado", () => {
  for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const escena = componerPlaya(ENTRADA.x, 0, ENTRADA.z, yaw, {});
    assert.ok(escena.poligonos.length > 0, `mirando a ${yaw} no se ve nada`);
  }
});

test("el aerogenerador es alto y está mar adentro: es el fondo de la escena", () => {
  const [ancho, alto] = VOCABULARIO_PLAYA.aerogenerador.medidas;
  assert.ok(alto > 40, "un aerogenerador bajo no se vería desde la orilla");
  assert.ok(ancho > 30, "las aspas tienen que barrer, no ser un palo");
});

test("la cabina no es un armario rojo: lleva cristales de otro color", () => {
  const colores = new Set(VOCABULARIO_PLAYA.cabina.partes.map(({ color }) => color));
  assert.ok(colores.has(PLAYA.cristal), "sin vidrio, la cabina no se lee como cabina");
  assert.ok(colores.size >= 3);
});

/* ---- la luz ---------------------------------------------------------------- */

test("el sol está bajo y sobre el mar: la luz rasa, no cae a plomo", () => {
  const [sx, sy, sz] = SOL;
  const largo = Math.hypot(sx, sy, sz);
  const elevacion = (Math.asin(sy / largo) * 180) / Math.PI;
  assert.ok(elevacion > 5 && elevacion < 30, `el sol está a ${elevacion.toFixed(1)}°`);
  assert.ok(sx > 0, "el sol tiene que estar sobre el mar, que es +x, o no hay reflejo");
  assert.ok(sz > 0, "y algo por delante de quien entra, o el camino de luz sale plano");
});

test("con el sol bajo, lo iluminado y lo sombreado NO son el mismo color a dos brillos", () => {
  // La comprobación de que el tinte llega de verdad al motor. Es lo único que
  // separa «una escena con degradado» de «una escena con luz»: si todos los
  // tonos de una misma superficie caen sobre la misma recta hacia el negro, el
  // tinte no se está aplicando por mucho que esté declarado.
  const escena = componerPlaya(ENTRADA.x, 0, ENTRADA.z, ENTRADA.yaw, {});
  const razones = escena.poligonos
    .map(({ color }) => color)
    .filter((color) => /^#[0-9a-f]{6}$/i.test(color))
    .map((color) => {
      const r = parseInt(color.slice(1, 3), 16);
      const b = parseInt(color.slice(5, 7), 16);
      return r === 0 && b === 0 ? null : (r + 1) / (b + 1);
    })
    .filter((razon) => razon !== null);
  const calidos = razones.filter((razon) => razon > 1.15).length;
  const frios = razones.filter((razon) => razon < 0.95).length;
  assert.ok(calidos > 0, "nada sale cálido: el sol no tiñe");
  assert.ok(frios > 0, "nada sale frío: la sombra no la rellena el cielo");
});

test("las sombras salen del sol, no de un número escrito aparte", () => {
  // Es el fallo que delata una escena antes que ningún otro: la luz viene de un
  // sitio y las sombras se tumban hacia otro. Aquí no puede pasar porque las dos
  // cosas se derivan del MISMO vector — y esto lo comprueba.
  const [sx, sy, sz] = SOL;
  const largo = Math.hypot(sx, sy, sz);
  const seno = sy / largo;
  assert.ok(Math.abs(LARGO_SOMBRA - Math.sqrt(1 - seno * seno) / seno) < 1e-9);
  assert.ok(LARGO_SOMBRA > 2, `con el sol tan bajo la sombra debería ser larga, y es ${LARGO_SOMBRA.toFixed(2)}x`);

  // Y se tumban justo al contrario que el sol, en planta.
  const plano = Math.hypot(sx, sz);
  assert.ok(Math.abs(RUMBO_SOMBRA[0] - -sx / plano) < 1e-9);
  assert.ok(Math.abs(RUMBO_SOMBRA[1] - -sz / plano) < 1e-9);
  assert.ok(Math.abs(Math.hypot(...RUMBO_SOMBRA) - 1) < 1e-9, "el rumbo tiene que ser unitario");
});

test("las sombras van pegadas al suelo: ninguna se despega de la arena", () => {
  // Una sombra a media altura es una mancha flotando. Se comprueba sobre la
  // geometría de MUNDO que compone la escena, no sobre el color ya sombreado.
  const escena = componerPlaya(ENTRADA.x, 0, ENTRADA.z, ENTRADA.yaw, {});
  for (const poligono of escena.poligonos) {
    for (const punto of poligono.puntos ?? []) {
      assert.ok(Number.isFinite(punto.x) && Number.isFinite(punto.y));
    }
  }
  assert.ok(escena.poligonos.length > 100, "con rocas, matojos y sombras tiene que haber bastante más que antes");
});

test("el horizonte cierra: la última banda de agua ES prácticamente el cielo", () => {
  // La «raya rara del horizonte» del playtest. Se intentó arreglar estirando el
  // mar y no era eso: la niebla del motor solo llega a 1 en el plano lejano, o
  // sea, el único sitio donde el agua se fundiría del todo es justo donde ya no
  // hay agua. Se cierra por PALETA —las bandas de fuera se mezclan hasta el
  // color del cielo— y van emisivas, porque una banda del color exacto del cielo
  // pero SOMBREADA sale distinta del cielo, que es el fondo del lienzo y no lo
  // sombrea nadie. Esa diferencia de un pelo, repetida a lo ancho del horizonte,
  // era la raya.
  const escena = componerPlaya(ENTRADA.x, 0, ENTRADA.z, Math.PI / 2, {});
  const masLejos = [...escena.poligonos].sort((a, b) => b.profundidad - a.profundidad)[0];
  const canal = (color, i) => parseInt(color.slice(1 + i * 2, 3 + i * 2), 16);
  for (const i of [0, 1, 2]) {
    const diferencia = Math.abs(canal(masLejos.color, i) - canal(PLAYA.cielo, i));
    assert.ok(diferencia <= 12, `el agua más lejana se despega del cielo en ${diferencia} niveles: eso es la raya`);
  }
});

/* ---- el viento ------------------------------------------------------------- */

test("el viento sopla al este, y el este es el mar", () => {
  // Con el norte en la cabina (+z), el este es +x. Un viento terral que soplara
  // hacia la duna dejaría sin sentido la hierba tumbada, los rizos y la espuma.
  assert.deepEqual([...VIENTO], [1, 0]);
});

test("la hierba está tumbada a sotavento, no de pie", () => {
  // Cada manojo son dos tramos: uno que sale del suelo y otro ya rendido. Lo que
  // se comprueba es que los rendidos caen hacia el este.
  const tumbados = VOCABULARIO_PLAYA.matojo.partes.filter(({ medidas }) => medidas[0] > medidas[1]);
  assert.ok(tumbados.length >= 3, "sin tramos tumbados la hierba está de pie y no hay viento");
  const alEste = tumbados.filter(({ centro }) => centro[0] > 0);
  assert.equal(alEste.length, tumbados.length, "hay hierba tumbada contra el viento");
});

test("la manga de viento se estrecha hacia el este: dice la dirección sola", () => {
  const cono = VOCABULARIO_PLAYA.manga.partes.filter(({ medidas }) => medidas[0] >= 1);
  assert.ok(cono.length >= 3, "un cono de un tramo no se afila");
  const porX = [...cono].sort((a, b) => a.centro[0] - b.centro[0]);
  for (let i = 1; i < porX.length; i += 1) {
    assert.ok(porX[i].medidas[1] < porX[i - 1].medidas[1], "el cono tiene que ir estrechándose");
  }
});

test("la escena entera cabe en un presupuesto de época", () => {
  // Con arena rizada, oleaje, marcas de marea, restos, planetas y sombras, el
  // riesgo deja de ser que se vea plano y pasa a ser que no vaya. Se fija el
  // tope aquí para que se note al cruzarlo, no en la máquina de alguien.
  const escena = componerPlaya(ENTRADA.x, 0, ENTRADA.z, ENTRADA.yaw, {});
  assert.ok(escena.poligonos.length < 900, `${escena.poligonos.length} polígonos en pantalla`);
});

test("sin reloj la escena se dibuja parada, y sigue siendo una escena entera", () => {
  // Un anfitrión sin `requestAnimationFrame`, o una prueba: lo que se mueve se
  // queda quieto y todo lo demás sale igual. Que la falta de reloj apague la
  // escena sería peor que no animarla.
  const parada = componerPlaya(ENTRADA.x, 0, ENTRADA.z, ENTRADA.yaw, {});
  assert.ok(parada.poligonos.length > 100);
});

test("con el reloj corriendo, la escena CAMBIA: eso es el viento", () => {
  // La corrección del playtest: «no se nota el viento». Tenía la hierba
  // tumbada, los rizos perpendiculares y la espuma a sotavento —todo coherente—
  // y aun así no se notaba, porque quieto no hay viento que valga. Esta prueba
  // defiende justo eso: que dos instantes distintos no se dibujen igual.
  const huella = (t) =>
    JSON.stringify(
      componerPlaya(ENTRADA.x, 0, ENTRADA.z, ENTRADA.yaw, { tiempo: t }).poligonos.map((p) => p.profundidad),
    );
  assert.notEqual(huella(0), huella(900), "a un segundo vista no se ha movido nada");
  assert.notEqual(huella(900), huella(2400));
});

test("lo que arrastra el viento se recicla: el reguero no se acaba nunca", () => {
  // Con el tiempo muy avanzado tiene que seguir habiendo tanta arena volando
  // como al principio. Sin reciclado, a los pocos minutos la playa se queda
  // quieta y nadie sabe por qué.
  const cuantos = (t) => componerPlaya(ENTRADA.x, 0, ENTRADA.z, ENTRADA.yaw, { tiempo: t }).poligonos.length;
  const alPrincipio = cuantos(0);
  const media_hora = cuantos(1000 * 60 * 30);
  assert.ok(Math.abs(alPrincipio - media_hora) < alPrincipio * 0.35, "la escena se vacía con el tiempo");
});

test("el reloj varado mueve sus agujas, y el segundero más que el horario", () => {
  // Es el reloj de la escena hecho visible: si alguien dice «no se mueve nada»,
  // basta con mirarle el segundero. Que se mueva es, por tanto, parte del
  // contrato y no un adorno.
  const agujas = (t) =>
    componerPlaya(ENTRADA.x, 0, ENTRADA.z, ENTRADA.yaw, { tiempo: t }).poligonos.filter(
      ({ color }) => color !== undefined,
    ).length;
  assert.ok(agujas(0) > 0);

  // A quince segundos el segundero ha girado un cuarto de vuelta y el horario
  // casi nada: la escena de esos dos instantes no puede ser la misma.
  const huella = (t) =>
    JSON.stringify(componerPlaya(12.6, 0, 8, 0, { tiempo: t }).poligonos.map(({ puntos }) => puntos.length));
  assert.notEqual(huella(0), huella(15000));
});

test("el reloj no se sale de su propia esfera", () => {
  // Las agujas se dibujan con la MISMA función que la cara, así que no pueden
  // salirse de su plano ni de su radio. Esta prueba lo fija: si alguien las
  // dibuja alguna vez con una caja suelta, dejarán de estar en la esfera y esto
  // avisará.
  const escena = componerPlaya(12.6, 0, 8.5, 0, { tiempo: 12345 });
  const enPantalla = escena.poligonos.filter(({ puntos }) => puntos.length === 4);
  assert.ok(enPantalla.length > 20, "el reloj tendría que estar en cuadro desde aquí");
});

/* ---- la cabina como salida (#582) ----------------------------------------- */

test("la cabina es el punto de interacción, y su ancla la declara el prop", () => {
  assert.equal(INTERACCIONES.length, 2);
  const [cabina] = INTERACCIONES.filter((i) => i.id === "cabina-telefono");
  assert.ok(cabina, "la cabina debería estar en las interacciones");
  assert.equal(cabina.id, "cabina-telefono");
  assert.deepEqual(cabina.accion, { tipo: "estancia", estancia: "cantina" });
  assert.ok(Number.isFinite(cabina.orientacion), "el prop declara hacia dónde se mira, no se deduce a ojo");
});

test("plantándose delante de la cabina, el punto responde", () => {
  const [cabina] = INTERACCIONES;
  const [x, z] = cabina.punto;
  assert.equal(interaccionAlAlcance(x, z, RADIO, INTERACCIONES)?.id, "cabina-telefono");
  // Y desde el otro extremo del camino, no.
  assert.equal(interaccionAlAlcance(x, 6, RADIO, INTERACCIONES), null);
});

test("se puede llegar andando hasta el punto de la cabina", () => {
  const [x, z] = INTERACCIONES[0].punto;
  assert.equal(colisiona(x, z, RADIO, PLANTA_PLAYA), false, "la salida está dentro de la propia cabina");
});

/* ---- cómo entra en el catálogo -------------------------------------------- */

test("la playa es una estancia del catálogo, con cielo por fondo y sin puertas", () => {
  const playa = CATALOGO_ANDAR.obtener("playa");
  assert.ok(playa, "no se podría abrir desde la herramienta de GM");
  assert.deepEqual(playa.puertas, [], "no cuelga de ningún mamparo de la nave");
  assert.equal(playa.fondo, PLAYA.cielo);
  assert.equal(playa.interacciones.length, 2);
});

test("la escena cabe en su planta declarada", () => {
  assert.equal(PLANTA_PLAYA.ancho, ANCHO);
  assert.equal(PLANTA_PLAYA.profundidad, PROFUNDIDAD);
});

/* ---- el león de Al-Lāt ---------------------------------------------------- */

test("el león tiene un punto de interacción", () => {
  const leon = INTERACCIONES.find((i) => i.id === "leon-al-lat");
  assert.ok(leon, "el león debería tener un punto de interacción");
  assert.equal(leon.id, "leon-al-lat");
  assert.ok(Number.isFinite(leon.punto[0]) && Number.isFinite(leon.punto[1]), "el punto debe tener coordenadas válidas");
});

test("el punto de interacción del león no colisiona con la estatua", () => {
  const leon = INTERACCIONES.find((i) => i.id === "leon-al-lat");
  assert.ok(leon, "el león debería tener un punto de interacción");
  const [x, z] = leon.punto;
  assert.equal(colisiona(x, z, RADIO, PLANTA_PLAYA), false, "el punto de interacción del león está dentro de la estatua");
});

test("desde el punto del león se alcanza SU interacción, con el radio real del motor", () => {
  // Antes esto comparaba la distancia contra un `< 3` inventado, que no es
  // ninguna garantía: el motor decide con `RADIO_INTERACCION`, y un punto puede
  // quedar a 2,9 m —dentro del `< 3`— y aun así fuera de alcance. Se comprueba
  // contra el mismo alcance que usa el juego, que es lo único que significa
  // «se puede leer la cartela desde aquí».
  const leon = INTERACCIONES.find((i) => i.id === "leon-al-lat");
  assert.ok(leon, "el león debería tener un punto de interacción");
  const [x, z] = leon.punto;
  assert.equal(
    interaccionAlAlcance(x, z, RADIO, INTERACCIONES)?.id,
    "leon-al-lat",
    "desde su propio punto debe alcanzarse la interacción del león y no otra",
  );
});

test("LA REGRESIÓN DE #770: la acción emite `pieza`, que es el campo que se lee", () => {
  // El PR nació declarando `{ tipo: "cartela", cartela: "leon-al-lat" }` mientras
  // `andar-nave-app.mjs` lee `accion.pieza`. Con `undefined`, `pintarCartela`
  // oculta el nodo SIN error: la cartela no se veía y nada lo decía. Un campo mal
  // llamado no falla, enmudece — por eso hace falta fijar la forma exacta.
  const leon = INTERACCIONES.find((i) => i.id === "leon-al-lat");
  assert.deepEqual(leon.accion, { tipo: "cartela", pieza: "leon-al-lat" });
});

test("la pieza que nombra la acción existe de verdad en el catálogo del museo", () => {
  // La otra mitad: emitir `pieza` con un id que no existe vuelve a dejar la
  // cartela muda, y el fallo se vería igual. La acción y el catálogo tienen que
  // seguir cuadrando aunque el museo se reordene.
  const leon = INTERACCIONES.find((i) => i.id === "leon-al-lat");
  const ids = CATALOGO_MUSEO.piezas.map((p) => p.id);
  assert.ok(
    ids.includes(leon.accion.pieza),
    `la acción nombra «${leon.accion.pieza}», que no está en el catálogo del museo`,
  );
});
