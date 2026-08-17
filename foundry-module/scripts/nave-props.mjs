// El vocabulario de props de la nave (#583).
//
// DE DÓNDE VIENE. `nave-mobiliario-sala.mjs` (#560) traía un catálogo de cuatro
// piezas —bancada, armario, conducto, registro— y una tabla de qué maquinaria le
// toca a cada sistema. Esa tabla sigue siendo suya y no se toca aquí: es
// ambientación por sistema y se lee y se discute donde está.
//
// Lo que se separa es el VOCABULARIO. La cantina trae sus 126 muebles por su
// cuenta (#423) y la terraza de #579 necesita mesa, sillas, soporte y
// barandilla. Con el reparto anterior, la terraza los modelaría a medida, el
// siguiente espacio volvería a improvisar sus primitivas y la nave acabaría
// siendo un decorado montado con piezas de tres maquetas — que es exactamente lo
// que #579 dice querer evitar, pero acotado a su propio espacio. Un catálogo
// compartido tiene que existir ANTES que su primer consumidor o no será
// compartido: será el catálogo de la terraza con otros usándolo.
//
// UN PROP SON VARIAS CAJAS, NO UNA. Es la diferencia que hace útil este módulo.
// «Nada de cubos como representación final» (#579): una silla puede tener
// poquísimos polígonos, pero tiene que leerse INEQUÍVOCAMENTE como silla —
// respaldo, asiento y patas—. La lectura es el requisito; el detalle, no. Las
// cuatro piezas de maquinaria siguen siendo de una sola caja porque eso es lo
// que son: un armario cerrado ES una caja.
//
// MATERIAL DE SERIE. El catálogo es corto a propósito, por el mismo motivo que
// lo era el de #560: un catálogo largo es la vía rápida a que cada sala parezca
// de otra nave. Se amplía cuando un espacio real lo necesita, no por gusto.
//
// NADA QUE SE PUEDA LEER (#526): ni etiquetas, ni diales, ni pilotos.
//
// GIROS DE CUARTO DE VUELTA Y NO OTROS. El render de sala compone cajas
// alineadas con los ejes (`crearSalaCaja`), así que una silla a 30° no se puede
// representar: se representaría su caja envolvente, que es peor que no girarla.
// Vale más rechazarlo que dibujar algo que no es lo pedido.
//
// Puro y sin color propio (#351): devuelve piezas con la forma `mobiliario` que
// ya acepta `crearSalaCaja`.

import { CACHARROS, MURAL, SECCION } from "./paleta.mjs";
import { caja, prisma } from "./escena-primitivas.mjs";

/** Un cuarto de vuelta, la unidad en la que se gira un prop. */
const CUARTO = Math.PI / 2;

/**
 * Los props, en metros.
 *
 * Cada parte es una caja `{medidas: [ancho, alto, fondo], centro: [x, y, z]}`
 * relativa al ORIGEN del prop, que es su centro en planta y el suelo en altura
 * — así colocarlo es sumar dos números y no hay que acordarse de dividir la
 * altura por dos en cada sitio.
 *
 * El prop mira a +z, la misma convención de yaw que usa todo lo demás. El
 * `ancla` es dónde se planta y hacia dónde mira quien interactúa con él,
 * relativo también al origen: declararla aquí es lo que evita que #579 tenga que
 * deducir a ojo dónde se pesca.
 *
 * UNA PARTE PUEDE NO SER UNA CAJA. Con `lados`, se dibuja como prisma de ese
 * número de caras inscrito en sus medidas; con `punta`, además se estrecha hacia
 * arriba (0 = cono, 1 = recto). Es la corrección del inventario 3D: una caja es
 * un prisma de CUATRO lados, y cuatro es el único número que no puede parecer
 * redondo — por eso un conducto de reactor se leía como un pilar cuadrado y el
 * pie de una mesa como un ladrillo.
 *
 * Las `medidas` siguen siendo las de siempre aunque la forma cambie: son la
 * huella, y de ellas salen la colisión y la piel. Un tubo redondo ocupa el mismo
 * sitio que la caja en la que cabe.
 */
const DEFINICIONES = {
  /* ---- maquinaria (#560): una caja, porque eso es lo que son ---- */

  bancada: { partes: [{ medidas: [1.8, 0.95, 0.8] }], color: SECCION.casco },
  armario: { partes: [{ medidas: [1.0, 1.9, 0.6] }], color: SECCION.mamparo },
  // Redondo: es un TUBO de servicio, va de suelo a techo y se ve entero. Era la
  // pieza que más delataba que el módulo entero se dibujaba con cajas.
  conducto: { partes: [{ medidas: [0.5, 3.8, 0.5], lados: 8 }], color: MURAL.medio },
  registro: { partes: [{ medidas: [0.7, 0.7, 0.45] }], color: SECCION.casco },

  /* ---- mobiliario de estar (#583, para #579) ---- */

  /**
   * Silla: respaldo, asiento y cuatro patas. Seis cajas es mucho al lado de un
   * armario, y es el mínimo con el que una silla se lee como silla — con menos
   * patas se lee como un taburete raro, y sin respaldo no es una silla.
   *
   * Se entra por delante (+z), que es hacia donde mira; quien se sienta acaba
   * mirando al revés, y por eso el ancla gira media vuelta.
   */
  silla: {
    color: MURAL.medio,
    partes: [
      { medidas: [0.44, 0.06, 0.44], centro: [0, 0.45, 0] },
      { medidas: [0.44, 0.46, 0.06], centro: [0, 0.71, -0.19] },
      // Patas torneadas, de seis lados: a cinco centímetros no dan para ocho, y
      // con cuatro se ven las aristas justo a la altura a la que se mira.
      { medidas: [0.05, 0.42, 0.05], centro: [-0.17, 0.21, -0.17], lados: 6, punta: 0.8 },
      { medidas: [0.05, 0.42, 0.05], centro: [0.17, 0.21, -0.17], lados: 6, punta: 0.8 },
      { medidas: [0.05, 0.42, 0.05], centro: [-0.17, 0.21, 0.17], lados: 6, punta: 0.8 },
      { medidas: [0.05, 0.42, 0.05], centro: [0.17, 0.21, 0.17], lados: 6, punta: 0.8 },
    ],
    ancla: { centro: [0, 0.7], orientacion: Math.PI },
  },

  /**
   * Taburete: asiento, pie y base. Sin respaldo y sin lado, así que tampoco
   * tiene ancla propia — se sienta uno desde donde llegue.
   */
  taburete: {
    color: MURAL.medio,
    partes: [
      // Un taburete es redondo de arriba abajo: asiento, pie y base.
      { medidas: [0.36, 0.06, 0.36], centro: [0, 0.6, 0], lados: 10 },
      { medidas: [0.09, 0.57, 0.09], centro: [0, 0.3, 0], lados: 8 },
      { medidas: [0.34, 0.04, 0.34], centro: [0, 0.02, 0], lados: 10 },
    ],
    ancla: null,
  },

  /**
   * Mesa: tablero, pie y base. De pie central y no de cuatro patas porque
   * alrededor van sillas, y cuatro patas en las esquinas se pelean con ellas a
   * esta escala.
   */
  mesa: {
    color: SECCION.casco,
    partes: [
      { medidas: [1.3, 0.07, 0.9], centro: [0, 0.74, 0] },
      // El pie sí: un pie de mesa cuadrado se lee como un ladrillo puesto de
      // canto. El tablero y la base se quedan rectos porque lo son.
      { medidas: [0.18, 0.71, 0.18], centro: [0, 0.38, 0], lados: 8 },
      { medidas: [0.7, 0.05, 0.5], centro: [0, 0.03, 0] },
    ],
    ancla: null,
  },

  /**
   * Soporte de cañas: base y dos montantes con horquilla. Las cañas NO son
   * parte del soporte —son props aparte— pero el ancla sí es suya: se coge una
   * poniéndose delante del soporte, mirándolo.
   */
  soporte: {
    color: MURAL.abrazadera,
    partes: [
      { medidas: [0.9, 0.08, 0.3], centro: [0, 0.04, 0] },
      { medidas: [0.08, 1.0, 0.08], centro: [-0.35, 0.5, 0], lados: 6 },
      { medidas: [0.08, 1.0, 0.08], centro: [0.35, 0.5, 0], lados: 6 },
      { medidas: [0.86, 0.07, 0.07], centro: [0, 1.02, 0] },
    ],
    ancla: { centro: [0, 0.75], orientacion: Math.PI },
  },

  /**
   * Barandilla: pasamanos, rodapié y tres montantes, de 2,4 m — la medida a la
   * que se encadenan varias sin dejar un tramo suelto.
   *
   * Llega a 1,05 m, por debajo de la altura de los ojos: una barandilla que
   * tapa lo que protege de mirar es un muro. Al borde del espacio (#579) eso es
   * justo el punto.
   */
  barandilla: {
    color: SECCION.casco,
    partes: [
      // El pasamanos es lo único de la nave que se AGARRA, y un pasamanos
      // cuadrado no se agarra. Los montantes, por coherencia con él.
      { medidas: [2.4, 0.08, 0.09], centro: [0, 1.01, 0] },
      { medidas: [2.4, 0.06, 0.07], centro: [0, 0.18, 0] },
      { medidas: [0.07, 1.0, 0.07], centro: [-1.15, 0.5, 0], lados: 6 },
      { medidas: [0.07, 1.0, 0.07], centro: [0, 0.5, 0], lados: 6 },
      { medidas: [0.07, 1.0, 0.07], centro: [1.15, 0.5, 0], lados: 6 },
    ],
    ancla: null,
  },

  /**
   * Caña de pescar apoyada: puño, tramo y puntera, inclinada de la única forma
   * que sabe representar el motor — tres tramos escalonados hacia arriba. No es
   * un objeto que se recoja (#579): las cañas viven en su soporte y la futura
   * pesca asigna una.
   */
  cana: {
    color: CACHARROS.cajaSuministro,
    colision: false,
    partes: [
      // Una caña ES un cono, y eran tres listones. Cada tramo se estrecha, y el
      // último acaba en punta.
      { medidas: [0.05, 0.05, 0.5], centro: [0, 0.35, -0.3], lados: 6, punta: 0.8 },
      { medidas: [0.04, 0.04, 0.6], centro: [0, 0.75, 0.15], lados: 6, punta: 0.7 },
      { medidas: [0.03, 0.03, 0.5], centro: [0, 1.1, 0.65], lados: 6, punta: 0.2 },
    ],
    ancla: null,
  },
};

/** Caja envolvente de un prop, `[ancho, alto, fondo]`. */
function envolvente(partes) {
  const ejes = [0, 1, 2].map((eje) => {
    const min = Math.min(...partes.map((p) => (p.centro?.[eje] ?? 0) - p.medidas[eje] / 2));
    const max = Math.max(...partes.map((p) => (p.centro?.[eje] ?? 0) + p.medidas[eje] / 2));
    return max - min;
  });
  return Object.freeze(ejes);
}

/**
 * Congela un vocabulario y le calcula la huella de cada prop.
 *
 * Se exporta porque la nave no es el único sitio con props: la playa de pruebas
 * (#587) tiene postes de luz, una cabina de teléfono y aerogeneradores, y meter
 * eso en la lista de la nave sería tener un vocabulario largo con piezas que no
 * pintan nada juntas — justo lo que este módulo dice evitar. Lo que se comparte
 * es la MAQUINARIA (partes, giro, ancla, envolvente), no la lista.
 *
 * `medidas` es la envolvente y no un dato escrito a mano: con seis cajas por
 * silla, una medida declarada aparte es una medida que se queda vieja en cuanto
 * alguien mueve una pata.
 */
export function definirVocabulario(definiciones) {
  return Object.freeze(
    Object.fromEntries(
      Object.entries(definiciones).map(([clave, prop]) => [
        clave,
        Object.freeze({
          color: prop.color,
          partes: Object.freeze(
            prop.partes.map((parte) =>
              Object.freeze({
                medidas: Object.freeze([...parte.medidas]),
                centro: Object.freeze([...(parte.centro ?? [0, parte.medidas[1] / 2, 0])]),
                lados: Number.isFinite(parte.lados) ? parte.lados : null,
                punta: Number.isFinite(parte.punta) ? parte.punta : 1,
                // Por qué eje crece la pieza. Vertical de serie —casi todo lo
                // que se planta en el suelo—, pero un tronco tumbado o una manga
                // de viento se tumban, y de pie dejan de ser lo que son.
                eje: ["x", "y", "z"].includes(parte.eje) ? parte.eje : "y",
                // Una parte puede llevar color propio (#587: los cristales de la
                // cabina no son del color de la cabina). Sin declararlo, hereda
                // el del prop, que es el caso normal.
                color: parte.color ?? prop.color,
              }),
            ),
          ),
          // Hay props que se DIBUJAN y no estorban. Una caña de pescar apoyada
          // en su soporte sobresale por encima del borde, y bloquear el sitio
          // desde el que se pesca porque «hay una caña delante» es exactamente
          // el fallo que la cantina ya resolvió con las botellas de los estantes.
          // Va en el prop y no en la escena: una caña no es un muro en ningún
          // sitio, no solo en la terraza.
          colision: prop.colision !== false,
          ancla: prop.ancla
            ? Object.freeze({
                centro: Object.freeze([...prop.ancla.centro]),
                orientacion: prop.ancla.orientacion,
              })
            : null,
          medidas: envolvente(prop.partes),
        }),
      ]),
    ),
  );
}

/** El vocabulario de la NAVE. */
export const VOCABULARIO = definirVocabulario(DEFINICIONES);

/** Gira `[x, z]` un número entero de cuartos de vuelta alrededor del origen. */
function girarEnPlanta([x, z], cuartos) {
  switch (((cuartos % 4) + 4) % 4) {
    case 1:
      return [z, -x];
    case 2:
      return [-x, -z];
    case 3:
      return [-z, x];
    default:
      return [x, z];
  }
}

/**
 * Coloca un prop del vocabulario en `(x, z)`, girado `cuartos` cuartos de
 * vuelta.
 *
 * @returns {{piezas:Array<{nombre:string, centro:number[], medidas:number[], color:string}>,
 *            ancla:{punto:number[], orientacion:number}|null}}
 *   `piezas` tiene la forma `mobiliario` que acepta `crearSalaCaja`; `ancla`, si
 *   el prop la declara, ya está en coordenadas de la sala y lista para
 *   convertirse en un punto de interacción (#582).
 */
export function colocarProp(clave, { x, z, cuartos = 0, nombre = clave, vocabulario = VOCABULARIO } = {}) {
  const prop = vocabulario[clave];
  if (!prop) throw new RangeError(`colocarProp: "${clave}" no está en el vocabulario`);
  if (!Number.isInteger(cuartos)) {
    throw new RangeError(`colocarProp("${clave}"): solo se gira en cuartos de vuelta enteros`);
  }
  const impar = Math.abs(cuartos % 2) === 1;

  const piezas = prop.partes.map((parte, indice) => {
    const [dx, dz] = girarEnPlanta([parte.centro[0], parte.centro[2]], cuartos);
    const [ancho, alto, fondo] = parte.medidas;
    const medidas = impar ? [fondo, alto, ancho] : [ancho, alto, fondo];
    const centro = [x + dx, parte.centro[1], z + dz];
    // La malla se construye AQUÍ, con la pieza ya colocada y girada. Quien la
    // dibuje no tiene que saber qué forma tiene: recibe una malla y ya está.
    // Un cuarto de vuelta intercambia los ejes X y Z, así que también el eje por
    // el que crece la pieza: si no, una silla girada tendría las patas bien y el
    // tronco de al lado seguiría apuntando al norte.
    const eje = impar && parte.eje !== "y" ? (parte.eje === "x" ? "z" : "x") : parte.eje;
    const indiceEje = { x: 0, y: 1, z: 2 }[eje];
    const largo = medidas[indiceEje];
    const grueso = Math.min(...medidas.filter((_, i) => i !== indiceEje));
    const base = [...centro];
    base[indiceEje] -= largo / 2;
    const malla = parte.lados
      ? prisma(base, {
          radioAbajo: grueso / 2,
          radioArriba: (grueso / 2) * parte.punta,
          alto: largo,
          lados: parte.lados,
          eje,
        })
      : caja(centro, medidas);
    return {
      // Una pieza por parte, numerada: el nombre es lo único por lo que una
      // prueba puede señalar «esta pata», y dos piezas con el mismo nombre no
      // se distinguen.
      nombre: prop.partes.length === 1 ? nombre : `${nombre}-${indice}`,
      centro,
      medidas,
      malla,
      color: parte.color,
      colision: prop.colision,
      // Lo que no es una caja no lleva piel pixelart (#550): esa piel dibuja
      // cantos y remaches suponiendo cuatro caras planas, y sobre un tubo saldría
      // pegada de cualquier manera.
      piel: parte.lados ? false : undefined,
    };
  });

  const ancla = prop.ancla
    ? (() => {
        const [ax, az] = girarEnPlanta(prop.ancla.centro, cuartos);
        return {
          punto: [x + ax, z + az],
          orientacion: prop.ancla.orientacion + cuartos * CUARTO,
        };
      })()
    : null;

  return { piezas, ancla };
}
