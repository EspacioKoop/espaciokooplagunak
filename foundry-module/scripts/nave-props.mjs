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
import { metrosPorTextura, texturaMaterial } from "./props-materiales.mjs";

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
  litera: { partes: [{ medidas: [0.9, 1.8, 0.6] }], color: SECCION.casco },
  taquilla: { partes: [{ medidas: [0.5, 1.8, 0.5] }], color: SECCION.casco },

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
    // Dónde se sienta uno, y mirando a dónde (#582 + asientos). Va SEPARADO del
    // ancla y no es un ajuste de ella: el ancla dice dónde te PLANTAS para usar
    // el prop y mira hacia él; sentarse es ponerse ENCIMA y mirar al revés. Los
    // dos gestos ocurren en el mismo mueble, que es la misma distinción que ya
    // separaba el punto de pesca del ancla del soporte en la terraza (#579).
    //
    // `altura` es la cara de arriba del asiento (0,45 + medio canto), y de ahí
    // sale la altura de los ojos — nunca escrita a mano en la escena, que es
    // como la cantina acabó con los ojos a 3,35 m del suelo.
    asiento: { centro: [0, 0], orientacion: 0, altura: 0.48 },
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
    // Sin lado: se sienta uno desde donde llegue y mirando a donde ya miraba.
    // `orientacion: null` es eso dicho como dato, y no un olvido — un taburete
    // que te girase a un rumbo fijo al sentarte sería un taburete con frente.
    asiento: { centro: [0, 0], orientacion: null, altura: 0.63 },
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
                // DE QUÉ ESTÁ HECHA la parte (#584). Se hereda del prop, igual
                // que el color, porque lo normal es que una pieza entera sea de
                // un material y lo raro es la excepción.
                //
                // Y `material: null` EN LA PARTE SIGNIFICA LISO, no «no dicho».
                // Es la diferencia que hace falta para el cristal de la cabina:
                // la cabina entera es chapa, y sus vidrios no. Con `??` no se
                // podía expresar —null cuenta como ausente y heredaría chapa—,
                // así que se mira si la parte trae la clave.
                material: "material" in parte ? parte.material : (prop.material ?? null),
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
          // Un prop en el que se puede sentar alguien (`altura` en metros sobre
          // el suelo de la sala). Sin él, el prop no es un asiento: no hay
          // "altura por defecto" que valga, porque una altura inventada pone los
          // ojos donde no van.
          asiento: prop.asiento
            ? Object.freeze({
                centro: Object.freeze([...prop.asiento.centro]),
                orientacion: prop.asiento.orientacion ?? null,
                altura: prop.asiento.altura,
              })
            : null,
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

/**
 * Mezcla varios vocabularios en uno, para escenas que tiran de más de un ambiente.
 *
 * Es lo que hace que los vocabularios puedan ser POR AMBIENTE en vez de uno solo
 * (#589): una escena de puerto pide el marítimo y el urbano, y no hereda la duna
 * de la playa ni la maquinaria del Phobos.
 *
 * UNA CLAVE REPETIDA ES UN ERROR, no un ganador. Que el último callara al
 * primero sería la peor variante posible de este módulo: la escena pediría
 * `mesa` creyendo que es la de la cantina y saldría la de la terraza, sin fallo
 * en ningún sitio y con un cuadro sutilmente equivocado. Vale más romper al
 * mezclar —una línea, un mensaje, se renombra— que buscar eso a ojo en una
 * escena entera.
 */
export function mezclarVocabularios(...vocabularios) {
  const mezcla = {};
  const deQuien = new Map();
  vocabularios.forEach((vocabulario, indice) => {
    for (const [clave, prop] of Object.entries(vocabulario)) {
      if (clave in mezcla) {
        throw new Error(
          `mezclarVocabularios: "${clave}" está en el vocabulario ${deQuien.get(clave)} y en el ${indice}. ` +
            "Dos props distintos con el mismo nombre: renombra uno antes de mezclarlos.",
        );
      }
      deQuien.set(clave, indice);
      mezcla[clave] = prop;
    }
  });
  return Object.freeze(mezcla);
}

/** El vocabulario de la NAVE. */
export const VOCABULARIO = definirVocabulario(DEFINICIONES);

/**
 * Gira `[x, z]` un número entero de cuartos de vuelta alrededor del origen.
 *
 * Se exporta porque un prop con POSES (`nave-pose.mjs`) necesita la misma
 * cuenta para desplazar una pieza en SU propio marco —«medio metro hacia
 * atrás» tiene que seguir siendo hacia atrás cuando la silla está girada— y
 * dos copias de esta función es como una silla girada se retira hacia el lado.
 */
export function girarEnPlanta([x, z], cuartos) {
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
 *   `piezas` tiene la forma `mobiliario` que acepta `crearSalaCaja`; `ancla` y
 *   `asiento`, si el prop los declara, ya están en coordenadas de la sala y
 *   listos para convertirse en puntos de interacción (#582).
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
    // La escala de la textura la manda el MATERIAL, no la pieza: las manchas de
    // una piedra son grandes lleve el tamaño que lleve la roca.
    const escalaUV = parte.material ? metrosPorTextura(parte.material) : undefined;
    const malla = parte.lados
      ? prisma(base, {
          radioAbajo: grueso / 2,
          radioArriba: (grueso / 2) * parte.punta,
          alto: largo,
          lados: parte.lados,
          eje,
          ...(escalaUV ? { metrosPorTextura: escalaUV } : {}),
        })
      : caja(centro, medidas, escalaUV ? { metrosPorTextura: escalaUV } : undefined);
    return {
      // La textura del material, resuelta AQUÍ y no por quien dibuje: es lo
      // único que hace falta para que una escena entera se texture sin que
      // ninguna escena sepa qué es un material. Sin material declarado sale
      // `null`, y una pieza sin textura se pinta de su color plano.
      textura: parte.material ? texturaMaterial(parte.material, parte.color) : null,
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

  const asiento = prop.asiento
    ? (() => {
        const [sx, sz] = girarEnPlanta(prop.asiento.centro, cuartos);
        return {
          punto: [x + sx, z + sz],
          // `null` sobrevive al giro: girar "ninguna orientación" sigue siendo
          // ninguna. Sumarle el giro la convertiría en un rumbo concreto y un
          // taburete girado te sentaría mirando a la pared.
          orientacion:
            prop.asiento.orientacion === null ? null : prop.asiento.orientacion + cuartos * CUARTO,
          altura: prop.asiento.altura,
        };
      })()
    : null;

  return { piezas, ancla, asiento };
}
