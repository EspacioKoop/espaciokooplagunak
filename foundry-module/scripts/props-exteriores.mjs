// Los vocabularios de EXTERIOR (#589), por ambiente y mezclables.
//
// DE DÓNDE VIENEN. Estaban dentro de `playa-escena.mjs`, en una sola lista
// llamada «el vocabulario de la playa». Mirada de cerca, esa lista nunca fue un
// ambiente: era TRES metidos a la fuerza —el litoral (roca, madera, matojo), lo
// que el hombre planta en el mar (boya, manga, aerogenerador) y lo urbano (una
// farola y una cabina de teléfono)—, y solo estaban juntos porque a la playa le
// tocaban los tres a la vez.
//
// POR QUÉ IMPORTA LA DIVISIÓN. El ejemplo que da #589 es literal: «una escena de
// puerto tira del vocabulario marítimo y del urbano». Con una sola lista, esa
// escena hereda también la duna y el matojo, o vuelve a modelar una farola que
// ya existe. Con tres, pide las dos que necesita y no arrastra la tercera.
//
// Y EL CATÁLOGO SIGUE SIENDO CORTO, que es la regla de `nave-props.mjs` y no se
// relaja aquí: cortos son cada uno por separado. Lo que se ha quitado no es
// material, es el «vocabulario general de exteriores» que no habría dicho nada
// sobre qué pinta en qué sitio.
//
// Puro y sin color propio (#351): los colores salen de `PLAYA` en `paleta.mjs`.

import { PLAYA } from "./paleta.mjs";
import { definirVocabulario } from "./nave-props.mjs";

/**
 * EL LITORAL: lo que hay en una costa sin que nadie lo ponga.
 *
 * Vale para una playa, para un acantilado y para la orilla de un río. Nada de
 * esto tiene ancla: son cosas que se miran y se rodean, no que se usan.
 */
export const VOCABULARIO_COSTA = definirVocabulario({

  /**
   * Roca: tres bloques desiguales, uno de ellos con la cara al sol de otro tono.
   *
   * Tres y no uno porque una roca de una caja es una caja. Y desiguales porque
   * lo que hace que algo parezca piedra y no mueble es que ninguna medida sea
   * redonda ni repita a la anterior.
   */

  roca: {
    color: PLAYA.roca,
    partes: [
      { medidas: [1.3, 0.7, 1.1], centro: [0, 0.3, 0] },
      { medidas: [0.9, 0.5, 0.8], centro: [0.35, 0.72, -0.15], color: PLAYA.rocaClara },
      { medidas: [0.6, 0.35, 0.7], centro: [-0.42, 0.5, 0.25] },
    ],
    ancla: null,
  },

  /** Madera de deriva: un tronco tumbado y dos ramas. Marca la línea de marea. */

  madera: {
    color: PLAYA.madera,
    partes: [
      // Tumbado, que es como está la madera de deriva: eje X, no Y.
      { medidas: [2.6, 0.28, 0.3], centro: [0, 0.16, 0], lados: 6, eje: "x", punta: 0.75 },
      { medidas: [0.7, 0.14, 0.14], centro: [1.1, 0.24, 0.28], lados: 6, eje: "x", punta: 0.4 },
      { medidas: [0.5, 0.12, 0.12], centro: [-0.9, 0.22, -0.24], lados: 6, eje: "x", punta: 0.4 },
    ],
    ancla: null,
  },

  /**
   * Matojo de duna: cuatro manojos de hierba, uno seco.
   *
   * Es lo que hace que la duna sea duna y no un montón de arena: la hierba es
   * literalmente lo que la sujeta. Y en el cuadro cumple otra función —rompe la
   * pendiente lisa con verticales pequeñas, que es lo que le da escala.
   */

  matojo: {
    color: PLAYA.matojo,
    partes: [
      // TUMBADA HACIA EL ESTE. Cada manojo son dos tramos: el que sale del suelo
      // casi vertical y el que ya se ha rendido y se va con el viento. Es la
      // única forma de inclinar algo en un motor que solo compone cajas
      // alineadas con los ejes, y a este tamaño se lee perfectamente como
      // hierba peinada — que es lo que hace un terral constante.
      { medidas: [0.09, 0.38, 0.09], centro: [0, 0.19, 0] },
      { medidas: [0.34, 0.1, 0.09], centro: [0.18, 0.42, 0] },
      { medidas: [0.08, 0.3, 0.08], centro: [-0.13, 0.15, 0.12] },
      { medidas: [0.28, 0.09, 0.08], centro: [0.04, 0.33, 0.12] },
      { medidas: [0.07, 0.26, 0.07], centro: [0.14, 0.13, -0.14], color: PLAYA.matojoSeco },
      { medidas: [0.3, 0.08, 0.07], centro: [0.33, 0.29, -0.14], color: PLAYA.matojoSeco },
    ],
    ancla: null,
  },
});

/**
 * EL MAR TRABAJADO: lo que el hombre planta en el agua o junto a ella.
 *
 * Es el que comparte una playa con un puerto, y por eso está aparte del litoral:
 * un muelle tiene boyas y mangas de viento, y no tiene matojos de duna.
 */
export const VOCABULARIO_MARITIMO = definirVocabulario({

  /** Boya: el cuerpo naranja, el mástil y el remate. Puntos vivos en el agua. */

  boya: {
    color: PLAYA.boya,
    partes: [
      { medidas: [0.8, 0.6, 0.8], centro: [0, 0.3, 0], lados: 8 },
      { medidas: [0.12, 1.1, 0.12], centro: [0, 1.1, 0], lados: 6 },
      { medidas: [0.3, 0.16, 0.3], centro: [0, 1.7, 0], lados: 6 },
    ],
    ancla: null,
  },

  /**
   * Manga de viento: el mástil y el cono, que se estrecha hacia el este.
   *
   * Es el prop que dice el viento SIN que haya que deducirlo. Todo lo demás
   * —hierba tumbada, rizos, espuma a sotavento— es coherente con él, pero
   * requiere saber mirar; una manga hinchada la lee cualquiera de un vistazo, y
   * además dice la dirección exacta, que es justo lo que un dato ambiental
   * debería hacer.
   *
   * El cono va en tres tramos que se estrechan: es la única forma de que un
   * motor de cajas dibuje algo que se afila.
   */

  manga: {
    color: PLAYA.manga,
    partes: [
      { medidas: [0.16, 3.6, 0.16], centro: [0, 1.8, 0], lados: 8, punta: 0.8 },
      // El cono, en tres tramos de sección REDONDA. Una manga es una manga de
      // tela: en cajas parecían tres cajones enfilados.
      { medidas: [1.0, 0.7, 0.7], centro: [0.62, 3.3, 0], lados: 8, eje: "x", punta: 0.8, color: PLAYA.mangaFranja },
      { medidas: [1.0, 0.55, 0.55], centro: [1.58, 3.28, 0], lados: 8, eje: "x", punta: 0.75 },
      { medidas: [1.0, 0.38, 0.38], centro: [2.5, 3.24, 0], lados: 8, eje: "x", punta: 0.8, color: PLAYA.mangaFranja },
    ],
    ancla: null,
  },

  /**
   * Aerogenerador: torre, góndola y aspas en cruz.
   *
   * EN CRUZ Y NO EN TRES ASPAS, que es como son de verdad. El motor compone
   * cajas alineadas con los ejes y no sabe girar una pieza 120°: unas aspas «a
   * 120°» saldrían como sus cajas envolventes, o sea, tres bloques gordos. Una
   * cruz de cuatro aspas finas es geometría honesta, se lee inequívocamente como
   * aerogenerador a la distancia a la que está, y no finge una precisión que el
   * motor no tiene. La alternativa correcta —rotación libre— es #573/#556, no
   * esto.
   */

  aerogenerador: {
    color: PLAYA.torre,
    partes: [
      // La torre se estrecha, como todas: es lo primero que se ve de lejos.
      { medidas: [3.2, 44, 3.2], centro: [0, 22, 0], lados: 8, punta: 0.55 },
      { medidas: [3.0, 3.2, 6.0], centro: [0, 44.5, 0] },
      { medidas: [1.4, 34, 0.6], centro: [0, 44.5, -3.2], color: PLAYA.aspa },
      { medidas: [34, 1.4, 0.6], centro: [0, 44.5, -3.2], color: PLAYA.aspa },
    ],
    ancla: null,
  },
});

/**
 * LO URBANO: mobiliario de calle, que no sabe si la calle da al mar.
 *
 * Son las dos piezas que menos tienen que ver con una playa y las que más lejos
 * llegarán: una farola y una cabina valen en un puerto, en una colonia y en un
 * callejón. Que estuvieran en «el vocabulario de la playa» es justo el síntoma
 * que este módulo corrige.
 */
export const VOCABULARIO_URBANO = definirVocabulario({

  /**
   * Poste de luz: mástil, dos travesaños y la luminaria colgada.
   *
   * El travesaño superior es el que lleva los cables y por eso está donde está;
   * la luminaria cuelga hacia el camino (+z al declararla, se gira al colocarla).
   */

  poste: {
    color: PLAYA.poste,
    partes: [
      // El mástil es un TRONCO descortezado: redondo y más fino arriba. Era una
      // caja, y con cuatro aristas vivas se leía como una viga.
      { medidas: [0.22, 5.4, 0.22], centro: [0, 2.7, 0], lados: 8, punta: 0.7 },
      { medidas: [1.5, 0.1, 0.1], centro: [0, 5.1, 0] },
      { medidas: [1.1, 0.09, 0.09], centro: [0, 4.6, 0] },
      { medidas: [0.12, 0.5, 0.12], centro: [0, 4.15, 0.55], lados: 6 },
      // La pantalla de la luminaria, cónica y abierta hacia abajo.
      { medidas: [0.4, 0.16, 0.4], centro: [0, 3.85, 0.55], lados: 8, punta: 1.6 },
    ],
    ancla: null,
  },

  /**
   * Cabina de teléfono: cuatro montantes, techo, base y tres cristales.
   *
   * Los cristales son parte con COLOR PROPIO, no una cabina de un solo tono: sin
   * ellos la cabina es un armario rojo. El motor no dibuja transparencias, así
   * que el vidrio se resuelve como lo resolvía la época — un color frío que se
   * lee como reflejo del cielo.
   *
   * La puerta mira a +z; el ancla se planta delante, mirándola.
   */

  cabina: {
    color: PLAYA.cabina,
    partes: [
      { medidas: [1.0, 0.12, 1.0], centro: [0, 0.06, 0] },
      { medidas: [0.12, 2.3, 0.12], centro: [-0.44, 1.2, -0.44] },
      { medidas: [0.12, 2.3, 0.12], centro: [0.44, 1.2, -0.44] },
      { medidas: [0.12, 2.3, 0.12], centro: [-0.44, 1.2, 0.44] },
      { medidas: [0.12, 2.3, 0.12], centro: [0.44, 1.2, 0.44] },
      { medidas: [1.1, 0.22, 1.1], centro: [0, 2.44, 0] },
      { medidas: [1.05, 0.1, 1.05], centro: [0, 2.62, 0], color: PLAYA.cabinaTecho },
      { medidas: [0.8, 1.7, 0.06], centro: [0, 1.35, -0.46], color: PLAYA.cristal },
      { medidas: [0.06, 1.7, 0.8], centro: [-0.46, 1.35, 0], color: PLAYA.cristal },
      { medidas: [0.06, 1.7, 0.8], centro: [0.46, 1.35, 0], color: PLAYA.cristal },
    ],
    ancla: { centro: [0, 1.3], orientacion: Math.PI },
  },
});
