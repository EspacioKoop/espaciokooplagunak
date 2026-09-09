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

import { BOSQUE, PLAYA, PUERTO } from "./paleta.mjs";
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
    material: "piedra",
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
    material: "veta",
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
    material: "chapa",
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
    material: "tela",
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
    material: "chapa",
    partes: [
      // La torre se estrecha, como todas: es lo primero que se ve de lejos.
      { medidas: [3.2, 44, 3.2], centro: [0, 22, 0], lados: 8, punta: 0.55 },
      { medidas: [3.0, 3.2, 6.0], centro: [0, 44.5, 0] },
      { medidas: [1.4, 34, 0.6], centro: [0, 44.5, -3.2], color: PLAYA.aspa },
      { medidas: [34, 1.4, 0.6], centro: [0, 44.5, -3.2], color: PLAYA.aspa },
    ],
    ancla: null,
  },

  /**
   * Noray: la peana, el fuste y la cabeza en seta.
   *
   * Es LA pieza que dice «esto es un muelle y no una acera junto al agua», y
   * cuesta cuatro cajas. La cabeza vuela sobre el fuste a propósito: sin ese
   * vuelo un noray es un bolardo de tráfico, y lo que impide que la estacha se
   * salte por arriba es justo el reborde.
   *
   * La coronilla va en `hierroPulido` porque en un noray de verdad está pulida:
   * es el único sitio por el que rozan todos los cabos. Un detalle de USO vale
   * más que un detalle de forma.
   */
  noray: {
    color: PUERTO.hierro,
    material: "chapa",
    partes: [
      { medidas: [0.62, 0.1, 0.62], centro: [0, 0.05, 0], lados: 8 },
      { medidas: [0.34, 0.52, 0.34], centro: [0, 0.34, 0], lados: 8, punta: 1.25 },
      { medidas: [0.52, 0.16, 0.52], centro: [0, 0.66, 0], lados: 8, punta: 0.8 },
      { medidas: [0.4, 0.06, 0.4], centro: [0, 0.75, 0], lados: 8, color: PUERTO.hierroPulido },
    ],
    ancla: null,
  },

  /**
   * Pilote: el poste clavado en el agua, con su banda de marea y el remate.
   *
   * La BANDA OSCURA es la mitad del prop. Un pilote de un solo tono es un palo;
   * con la franja de lo que moja la marea, el mismo palo dice a qué altura está
   * el agua ahora y a cuál estuvo — que es información de escena gratis, y de
   * las pocas que puede dar un objeto quieto.
   */
  pilote: {
    color: PUERTO.pilote,
    material: "veta",
    partes: [
      { medidas: [0.26, 2.6, 0.26], centro: [0, 1.3, 0], lados: 8, punta: 0.85 },
      { medidas: [0.28, 0.55, 0.28], centro: [0, 0.28, 0], lados: 8, color: PUERTO.piloteFango },
      { medidas: [0.34, 0.12, 0.34], centro: [0, 2.66, 0], lados: 8 },
    ],
    ancla: null,
  },

  /**
   * Barca varada: casco, dos bancadas y el interior en sombra.
   *
   * El INTERIOR EN SOMBRA es lo que la convierte en barca. Un casco macizo se
   * lee como una cuña de madera; una lámina oscura hundida entre las bordas dice
   * que hay hueco dentro, y el ojo completa el resto sin que haya que modelar
   * cuadernas que a esta escala no se verían.
   *
   * Tumbada en X, como está una barca en seco. Y con ancla: es de los pocos
   * props de exterior a los que uno se acerca A algo — a mirar dentro.
   */
  barca: {
    color: PUERTO.casco,
    material: "veta",
    partes: [
      { medidas: [3.4, 0.62, 1.15], centro: [0, 0.31, 0], lados: 6, eje: "x", punta: 0.45 },
      { medidas: [2.6, 0.08, 0.8], centro: [0, 0.6, 0], color: PUERTO.interiorBarca },
      { medidas: [3.5, 0.12, 0.16], centro: [0, 0.62, -0.5], eje: "x", color: PUERTO.cascoDesconchado },
      { medidas: [3.5, 0.12, 0.16], centro: [0, 0.62, 0.5], eje: "x", color: PUERTO.cascoDesconchado },
      { medidas: [0.14, 0.1, 0.9], centro: [-0.7, 0.63, 0], color: PUERTO.tablazon },
      { medidas: [0.14, 0.1, 0.9], centro: [0.75, 0.63, 0], color: PUERTO.tablazon },
    ],
    ancla: { centro: [0, 1.15], orientacion: Math.PI },
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
    material: "veta",
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
   * Cabina de teléfono: la caja, la puerta, los cristales cuarteados y el rótulo.
   *
   * ES EL ELEMENTO QUE CONVIERTE LA PLAYA EN UN SITIO —viene de Digimon, y no es
   * un chiste interno: sin ella esto es un degradado de arena; con ella, alguien
   * pregunta qué hace ahí—. O sea que es el prop de la escena que más se mira,
   * y el que menos podía permitirse ser un armario rojo con tres cristales, que
   * es lo que era.
   *
   * QUÉ SE LE HA AÑADIDO Y POR QUÉ, que es donde está el trabajo:
   *
   *  - UN ZÓCALO. Estaba apoyada en el suelo por su propia base y flotaba: una
   *    cabina de verdad va sobre una peana de hormigón que sobresale, y ese
   *    reborde es lo que la ATA al suelo aunque ya haya sombra.
   *  - MONTANTES CON CANTO. Cuatro palos de sección cuadrada leen como andamio.
   *    Doblando cada uno en dos piezas —el perfil y su canto más claro— aparece
   *    el chaflán, que es lo que dice «carpintería metálica» sin un polígono de
   *    más en la silueta.
   *  - LA PUERTA SE LEE COMO PUERTA. Antes había un cristal donde debería haber
   *    una puerta. Ahora hay marco, hoja retranqueada y tirador vertical: es el
   *    único sitio donde el ojo busca escala humana, y una hoja de 1,7 m con
   *    tirador dice el tamaño de la cabina entera.
   *  - CRISTALES CUARTEADOS. Un paño liso de color frío se lee como plástico.
   *    Partidos por un peinazo horizontal y dos montantes finos, se leen como
   *    vidrio en carpintería — y de paso cada trozo coge la luz distinta.
   *  - EL RÓTULO Y LA CORNISA. La banda de arriba es lo que remata la silueta
   *    contra el cielo. Sin ella la cabina termina en un canto y parece cortada.
   *
   * NADA QUE SE PUEDA LEER (#526): el rótulo es una banda de color, no letras.
   * La puerta mira a +z; el ancla se planta delante, mirándola.
   */
  cabina: {
    color: PLAYA.cabina,
    material: "chapa",
    partes: [
      // --- La peana, en dos escalones: el de hormigón y el rodapié de la cabina.
      { medidas: [1.32, 0.1, 1.32], centro: [0, 0.05, 0], color: PUERTO.hormigon },
      { medidas: [1.16, 0.06, 1.16], centro: [0, 0.13, 0], color: PUERTO.hormigonSombra },
      { medidas: [1.0, 0.14, 1.0], centro: [0, 0.23, 0] },

      // --- Los cuatro montantes, cada uno con su canto a la luz.
      { medidas: [0.13, 2.2, 0.13], centro: [-0.44, 1.4, -0.44] },
      { medidas: [0.05, 2.2, 0.05], centro: [-0.47, 1.4, -0.47], color: PLAYA.cabinaTecho },
      { medidas: [0.13, 2.2, 0.13], centro: [0.44, 1.4, -0.44] },
      { medidas: [0.05, 2.2, 0.05], centro: [0.47, 1.4, -0.47], color: PLAYA.cabinaTecho },
      { medidas: [0.13, 2.2, 0.13], centro: [-0.44, 1.4, 0.44] },
      { medidas: [0.05, 2.2, 0.05], centro: [-0.47, 1.4, 0.47], color: PLAYA.cabinaTecho },
      { medidas: [0.13, 2.2, 0.13], centro: [0.44, 1.4, 0.44] },
      { medidas: [0.05, 2.2, 0.05], centro: [0.47, 1.4, 0.47], color: PLAYA.cabinaTecho },

      // --- Los paños laterales y el trasero, cuarteados: peinazo a media altura
      //     y un montante fino que parte el vidrio en dos hojas.
      { medidas: [0.76, 0.9, 0.05], centro: [0, 0.92, -0.47], color: PLAYA.cristal, material: null },
      { medidas: [0.76, 0.85, 0.05], centro: [0, 1.92, -0.47], color: PLAYA.cristal, material: null },
      { medidas: [0.8, 0.09, 0.07], centro: [0, 1.44, -0.47] },
      { medidas: [0.06, 1.8, 0.07], centro: [0, 1.4, -0.47] },
      { medidas: [0.05, 0.9, 0.76], centro: [-0.47, 0.92, 0], color: PLAYA.cristal, material: null },
      { medidas: [0.05, 0.85, 0.76], centro: [-0.47, 1.92, 0], color: PLAYA.cristal, material: null },
      { medidas: [0.07, 0.09, 0.8], centro: [-0.47, 1.44, 0] },
      { medidas: [0.07, 1.8, 0.06], centro: [-0.47, 1.4, 0] },
      { medidas: [0.05, 0.9, 0.76], centro: [0.47, 0.92, 0], color: PLAYA.cristal, material: null },
      { medidas: [0.05, 0.85, 0.76], centro: [0.47, 1.92, 0], color: PLAYA.cristal, material: null },
      { medidas: [0.07, 0.09, 0.8], centro: [0.47, 1.44, 0] },
      { medidas: [0.07, 1.8, 0.06], centro: [0.47, 1.4, 0] },

      // --- LA PUERTA, a +z: marco, hoja retranqueada, vidrio partido y tirador.
      { medidas: [0.9, 0.1, 0.08], centro: [0, 2.45, 0.46] },
      { medidas: [0.1, 2.1, 0.08], centro: [-0.4, 1.35, 0.46] },
      { medidas: [0.1, 2.1, 0.08], centro: [0.4, 1.35, 0.46] },
      // La hoja es un MARCO, no un panel. Maciza tapaba su propio vidrio desde
      // fuera —se vio en la primera vista previa: una puerta ciega en una cabina
      // de teléfono, que es justo lo contrario de lo que una cabina es—. Con
      // largueros, peinazo y travesaños el hueco queda abierto y el cristal se
      // ve por él.
      { medidas: [0.09, 1.9, 0.05], centro: [-0.32, 1.3, 0.43] },
      { medidas: [0.09, 1.9, 0.05], centro: [0.32, 1.3, 0.43] },
      { medidas: [0.72, 0.1, 0.05], centro: [0, 2.2, 0.43] },
      { medidas: [0.72, 0.14, 0.05], centro: [0, 0.42, 0.43] },
      { medidas: [0.72, 0.09, 0.05], centro: [0, 1.42, 0.43] },
      { medidas: [0.58, 0.9, 0.03], centro: [0, 0.94, 0.44], color: PLAYA.cristal, material: null },
      { medidas: [0.58, 0.7, 0.03], centro: [0, 1.82, 0.44], color: PLAYA.cristal, material: null },
      // El tirador, por delante de todo: es lo que da la escala humana.
      { medidas: [0.05, 0.44, 0.05], centro: [0.24, 1.2, 0.48], color: PLAYA.cabinaTecho },

      // --- La cornisa y el rótulo: lo que remata la silueta contra el cielo.
      { medidas: [1.12, 0.14, 1.12], centro: [0, 2.57, 0] },
      { medidas: [1.02, 0.2, 1.02], centro: [0, 2.74, 0], color: PLAYA.cabinaTecho },
      { medidas: [0.86, 0.13, 1.06], centro: [0, 2.74, 0], color: PLAYA.cristal, material: null },
      { medidas: [1.06, 0.13, 0.86], centro: [0, 2.74, 0], color: PLAYA.cristal, material: null },
      { medidas: [1.16, 0.09, 1.16], centro: [0, 2.88, 0] },
      // El remate de arriba, más pequeño: una cabina no acaba en plano.
      { medidas: [0.5, 0.1, 0.5], centro: [0, 2.97, 0], lados: 8, color: PLAYA.cabinaTecho },
    ],
    ancla: { centro: [0, 1.3], orientacion: Math.PI },
  },

  banco: {
    color: PUERTO.tablazon,
    material: "veta",
    partes: [
      { medidas: [0.18, 0.42, 0.5], centro: [-0.7, 0.21, 0], color: PUERTO.hormigon },
      { medidas: [0.18, 0.42, 0.5], centro: [0.7, 0.21, 0], color: PUERTO.hormigon },
      { medidas: [1.8, 0.07, 0.14], centro: [0, 0.45, -0.17] },
      { medidas: [1.8, 0.07, 0.14], centro: [0, 0.45, 0] },
      { medidas: [1.8, 0.07, 0.14], centro: [0, 0.45, 0.17] },
      { medidas: [1.8, 0.09, 0.12], centro: [0, 0.62, 0.22], color: PUERTO.tablazonSombra },
      { medidas: [1.8, 0.09, 0.12], centro: [0, 0.76, 0.28], color: PUERTO.tablazonSombra },
    ],
    ancla: { centro: [0, -0.75], orientacion: 0 },
  },

  /**
   * Papelera: el cuerpo de chapa, el aro y el pie.
   *
   * Es el prop más humilde del catálogo y el que más trabajo hace: una calle sin
   * papeleras, sin bancos y sin farolas no es una calle, es un pasillo al aire
   * libre. Lo que llena un sitio no son los monumentos.
   */
  papelera: {
    color: PUERTO.chapa,
    material: "chapa",
    partes: [
      { medidas: [0.44, 0.62, 0.44], centro: [0, 0.5, 0], lados: 8, punta: 1.15 },
      { medidas: [0.5, 0.06, 0.5], centro: [0, 0.83, 0], lados: 8, color: PUERTO.hierroPulido },
      { medidas: [0.12, 0.22, 0.12], centro: [0, 0.11, 0], lados: 6, color: PUERTO.hierro },
      { medidas: [0.34, 0.05, 0.34], centro: [0, 0.02, 0], lados: 8, color: PUERTO.hierro },
    ],
    ancla: null,
  },

  /**
   * Cajas de carga: tres apiladas, las de arriba descuadradas.
   *
   * DESCUADRADAS A PROPÓSITO. Tres cajas perfectamente alineadas se leen como
   * una torre de un solo objeto; movidas un poco, la pila se lee como cosas que
   * alguien dejó ahí. Es la misma razón por la que la roca son tres bloques
   * desiguales: lo que delata a un decorado es la simetría.
   */
  cajas: {
    color: PUERTO.caja,
    material: "veta",
    partes: [
      { medidas: [0.9, 0.62, 0.8], centro: [0, 0.31, 0] },
      { medidas: [0.95, 0.06, 0.85], centro: [0, 0.34, 0], color: PUERTO.cajaFleje },
      { medidas: [0.82, 0.55, 0.74], centro: [0.06, 0.9, -0.05] },
      { medidas: [0.87, 0.05, 0.79], centro: [0.06, 0.92, -0.05], color: PUERTO.cajaFleje },
      { medidas: [0.6, 0.42, 0.66], centro: [-0.12, 1.38, 0.08] },
    ],
    ancla: null,
  },
});

/**
 * EL BOSQUE: lo que cierra un claro por los cuatro lados.
 *
 * POR QUÉ ES UN AMBIENTE Y NO TRES ÁRBOLES SUELTOS EN LA COSTA. Un litoral y
 * una arboleda no comparten casi nada —el matojo de duna no crece bajo un pino,
 * y un árbol de cuatro metros no pinta en una playa abierta—, así que meterlos
 * juntos repetiría el error que #589 deshizo al partir «el vocabulario de la
 * playa» en tres.
 *
 * Y SIRVE PARA UN TRABAJO CONCRETO: cerrar el borde de un exterior. Un claro de
 * combate tiene un límite por el que no se pasa, y ese límite tiene que ser algo
 * que el sitio ya tendría. Con árbol, tocón y helecho se hace una linde que se
 * densifica hacia fuera; con una nube pintada, no.
 */
/** Las tres iteraciones de árbol normal, para repartirlas por rotación en vez
 *  de plantar siempre la misma clave. */
export const VARIANTES_ARBOL = Object.freeze(["arbol", "arbol-b", "arbol-c"]);

export const VOCABULARIO_BOSQUE = definirVocabulario({

  /**
   * Árbol: tronco y tres copas que se estrechan hacia arriba.
   *
   * TRES COPAS Y NO UNA. Una sola copa cónica es una seta, y a esta distancia se
   * lee como un objeto de atrezo; tres discos superpuestos con distinto tono
   * —sol arriba, sombra abajo— se leen como masa vegetal. Es el mismo argumento
   * de la roca de tres bloques y de la pila de cajas descuadrada.
   *
   * El tronco lleva `punta` menor que 1 porque un tronco se estrecha: uno recto
   * es un poste, y el bosque entero se lee como una valla.
   */
  arbol: {
    color: BOSQUE.tronco,
    material: "veta",
    // Más alto que la versión de #757 (5,2 m de copa, no 4,35) y con dos ramas
    // que asoman del tronco antes de la copa: sin ellas la transición de
    // tronco recto a fronda esférica es demasiado limpia para un árbol de
    // verdad, que siempre tiene algo rompiendo esa línea.
    partes: [
      { medidas: [0.42, 2.9, 0.42], centro: [0, 1.45, 0], lados: 8, eje: "y", punta: 0.6 },
      // La banda de tronco que coge luz, un poco más arriba y a un lado: sin
      // ella el tronco es una silueta plana contra la copa.
      { medidas: [0.2, 1.7, 0.2], centro: [0.14, 1.1, 0.12], lados: 6, eje: "y", punta: 0.68, color: BOSQUE.troncoSol },
      // Dos ramas bajas, cada una con su propio penacho: es lo que rompe la
      // silueta de "palo con una bola encima" antes de llegar a la copa.
      { medidas: [0.11, 0.85, 0.11], centro: [0.5, 2.15, 0.1], lados: 5, eje: "x", punta: 0.4 },
      { medidas: [0.85, 0.6, 0.85], centro: [0.82, 2.5, 0.16], lados: 6, eje: "y", punta: 0.6, color: BOSQUE.follajeSombra },
      { medidas: [0.1, 0.7, 0.1], centro: [-0.45, 2.35, -0.22], lados: 5, eje: "x", punta: 0.4 },
      { medidas: [0.72, 0.5, 0.72], centro: [-0.72, 2.65, -0.34], lados: 6, eje: "y", punta: 0.6, color: BOSQUE.follaje },
      { medidas: [2.6, 1.2, 2.6], centro: [0, 3.1, 0], lados: 8, eje: "y", punta: 0.7, color: BOSQUE.follajeSombra },
      { medidas: [2.2, 1.1, 2.2], centro: [0, 3.9, 0], lados: 8, eje: "y", punta: 0.58, color: BOSQUE.follaje },
      { medidas: [1.5, 1.0, 1.5], centro: [0, 4.65, 0], lados: 8, eje: "y", punta: 0.24, color: BOSQUE.follajeSol },
    ],
    ancla: null,
  },

  /**
   * Dos iteraciones simples de `arbol`, para que una arboleda no se vea como el
   * mismo árbol clonado doscientas veces. La diferencia es la que un árbol de
   * verdad tiene con otro de su misma especie: una rama de menos, la copa un
   * punto más alta o más ancha — no una silueta distinta.
   */
  "arbol-b": {
    color: BOSQUE.tronco,
    material: "veta",
    partes: [
      { medidas: [0.42, 2.9, 0.42], centro: [0, 1.45, 0], lados: 8, eje: "y", punta: 0.6 },
      { medidas: [0.2, 1.7, 0.2], centro: [0.14, 1.1, 0.12], lados: 6, eje: "y", punta: 0.68, color: BOSQUE.troncoSol },
      // Solo la rama derecha, y algo más arriba que en `arbol`.
      { medidas: [0.11, 0.9, 0.11], centro: [0.48, 2.45, -0.14], lados: 5, eje: "x", punta: 0.4 },
      { medidas: [0.9, 0.62, 0.9], centro: [0.8, 2.82, -0.22], lados: 6, eje: "y", punta: 0.6, color: BOSQUE.follajeSombra },
      { medidas: [2.35, 1.15, 2.35], centro: [0, 3.3, 0], lados: 8, eje: "y", punta: 0.7, color: BOSQUE.follajeSombra },
      { medidas: [1.95, 1.05, 1.95], centro: [0, 4.05, 0], lados: 8, eje: "y", punta: 0.56, color: BOSQUE.follaje },
      { medidas: [1.3, 0.95, 1.3], centro: [0, 4.75, 0], lados: 8, eje: "y", punta: 0.24, color: BOSQUE.follajeSol },
    ],
    ancla: null,
  },
  "arbol-c": {
    color: BOSQUE.tronco,
    material: "veta",
    partes: [
      { medidas: [0.42, 2.7, 0.42], centro: [0, 1.35, 0], lados: 8, eje: "y", punta: 0.6 },
      { medidas: [0.2, 1.6, 0.2], centro: [0.14, 1.05, 0.12], lados: 6, eje: "y", punta: 0.68, color: BOSQUE.troncoSol },
      // Solo la rama izquierda, y la copa un pelo más ancha y más baja que en
      // `arbol`: un árbol viejo que ha crecido más a lo ancho que a lo alto.
      { medidas: [0.1, 0.65, 0.1], centro: [-0.42, 2.05, -0.2], lados: 5, eje: "x", punta: 0.4 },
      { medidas: [0.68, 0.48, 0.68], centro: [-0.68, 2.32, -0.32], lados: 6, eje: "y", punta: 0.6, color: BOSQUE.follaje },
      { medidas: [2.85, 1.1, 2.85], centro: [0, 2.9, 0], lados: 8, eje: "y", punta: 0.72, color: BOSQUE.follajeSombra },
      { medidas: [2.35, 1.0, 2.35], centro: [0, 3.65, 0], lados: 8, eje: "y", punta: 0.6, color: BOSQUE.follaje },
      { medidas: [1.5, 0.85, 1.5], centro: [0, 4.35, 0], lados: 8, eje: "y", punta: 0.26, color: BOSQUE.follajeSol },
    ],
    ancla: null,
  },

  /**
   * Árbol GRANDE: el veterano del claro, con la copa ancha de verdad.
   *
   * No es el árbol normal escalado — escalar un tronco de 0,42 m a lo bestia lo
   * deja pareciendo un poste de teléfono. Este tiene su propia proporción:
   * tronco más grueso en relación a su altura, copa mucho más ancha (4,6 m de
   * diámetro, para que ocupe de verdad el par de casillas que se le da como
   * obstáculo) y tres ramas en vez de dos.
   */
  "arbol-grande": {
    color: BOSQUE.tronco,
    material: "veta",
    partes: [
      { medidas: [0.7, 3.6, 0.7], centro: [0, 1.8, 0], lados: 8, eje: "y", punta: 0.66 },
      { medidas: [0.3, 2.1, 0.3], centro: [0.2, 1.4, 0.16], lados: 6, eje: "y", punta: 0.72, color: BOSQUE.troncoSol },
      { medidas: [0.16, 1.15, 0.16], centro: [0.75, 2.75, 0.15], lados: 5, eje: "x", punta: 0.42 },
      { medidas: [1.15, 0.8, 1.15], centro: [1.25, 3.25, 0.24], lados: 6, eje: "y", punta: 0.6, color: BOSQUE.follajeSombra },
      { medidas: [0.15, 1.0, 0.15], centro: [-0.68, 2.9, -0.3], lados: 5, eje: "x", punta: 0.42 },
      { medidas: [1.0, 0.7, 1.0], centro: [-1.05, 3.35, -0.46], lados: 6, eje: "y", punta: 0.6, color: BOSQUE.follaje },
      { medidas: [0.14, 0.9, 0.14], centro: [-0.1, 2.7, 0.62], lados: 5, eje: "z", punta: 0.42 },
      { medidas: [0.9, 0.65, 0.9], centro: [-0.16, 3.15, 1.0], lados: 6, eje: "y", punta: 0.6, color: BOSQUE.follajeSombra },
      { medidas: [4.2, 1.7, 4.2], centro: [0, 4.05, 0], lados: 10, eje: "y", punta: 0.7, color: BOSQUE.follajeSombra },
      { medidas: [3.5, 1.5, 3.5], centro: [0, 5.15, 0], lados: 10, eje: "y", punta: 0.56, color: BOSQUE.follaje },
      { medidas: [2.3, 1.3, 2.3], centro: [0, 6.1, 0], lados: 8, eje: "y", punta: 0.22, color: BOSQUE.follajeSol },
    ],
    ancla: null,
  },

  /**
   * Árbol LEJANO: el mismo árbol con la mitad de caras, para el fondo.
   *
   * No es un árbol distinto ni un árbol más pequeño — es el mismo, dibujado con
   * menos. A veinte metros no se distingue la banda de tronco iluminada ni los
   * tres pisos de copa: lo que llega es una silueta y un tono. Mantener ahí el
   * árbol completo cuesta 43 caras por pieza para no enseñar ninguna de ellas.
   *
   * Cinco lados en vez de ocho y dos pisos de copa en vez de tres: sigue
   * leyéndose redondo contra el cielo, que es todo lo que tiene que hacer.
   *
   * La regla de cuándo usar cuál es de quien coloca, no de aquí: la linde que
   * cierra el paso lleva el árbol entero porque se mira de cerca; los anillos
   * de fondo llevan este.
   */
  "arbol-lejano": {
    color: BOSQUE.tronco,
    material: "veta",
    partes: [
      { medidas: [0.42, 2.3, 0.42], centro: [0, 1.15, 0], lados: 5, eje: "y", punta: 0.62 },
      { medidas: [2.5, 1.5, 2.5], centro: [0, 2.5, 0], lados: 5, eje: "y", punta: 0.7, color: BOSQUE.follajeSombra },
      { medidas: [1.8, 1.3, 1.8], centro: [0, 3.5, 0], lados: 5, eje: "y", punta: 0.3, color: BOSQUE.follaje },
    ],
    ancla: null,
  },

  /**
   * Tocón: el corte de un árbol caído, con una raíz asomando.
   *
   * Lo que hace que una arboleda no parezca plantada ayer. Y en el suelo cumple
   * lo que el matojo cumple en la duna: rompe el plano con algo bajo, para que
   * la escala del claro se lea sin tener que mirar un árbol entero.
   */
  tocon: {
    color: BOSQUE.tronco,
    material: "veta",
    partes: [
      { medidas: [0.7, 0.5, 0.7], centro: [0, 0.25, 0], lados: 8, eje: "y", punta: 0.92 },
      { medidas: [0.6, 0.07, 0.6], centro: [0, 0.5, 0], lados: 8, eje: "y", punta: 0.95, color: BOSQUE.tocon },
      { medidas: [0.7, 0.16, 0.16], centro: [0.42, 0.1, 0.14], lados: 6, eje: "x", punta: 0.5 },
    ],
    ancla: null,
  },

  /**
   * Helecho: tres frondas abiertas y una seca.
   *
   * El sotobosque, que es lo que separa un bosque de un parque: sin nada entre
   * los troncos se ve el suelo hasta el fondo y la linde deja de cerrar. La
   * fronda seca está por lo mismo que el matojo seco de la duna — un verde
   * continuo se lee como césped artificial.
   */
  helecho: {
    color: BOSQUE.follaje,
    partes: [
      { medidas: [0.1, 0.44, 0.1], centro: [0, 0.22, 0], lados: 6, eje: "y", punta: 0.5 },
      { medidas: [0.52, 0.1, 0.14], centro: [0.22, 0.46, 0], lados: 6, eje: "x", punta: 0.3 },
      { medidas: [0.46, 0.1, 0.13], centro: [-0.2, 0.4, 0.14], lados: 6, eje: "x", punta: 0.3, color: BOSQUE.follajeSombra },
      { medidas: [0.4, 0.09, 0.12], centro: [0.06, 0.34, -0.18], lados: 6, eje: "x", punta: 0.3, color: BOSQUE.seco },
    ],
    ancla: null,
  },
});
