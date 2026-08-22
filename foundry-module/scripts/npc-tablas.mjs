// Tablas del generador de NPC (#676): nombres, arquetipos, elementos y líneas
// de mutación. TODO lo de aquí es PROPIO.
//
// POR QUÉ ESTÁN SEPARADAS DEL MOTOR. Ampliar el repertorio —un arquetipo más,
// una línea más— no puede obligar a tocar la matemática. El motor lee estas
// tablas y no sabe nada de su contenido; añadir una entrada es añadir una
// entrada.
//
// LA LÍNEA QUE NO SE CRUZA. El issue declara cuatro referencias y solo UNA es
// importable:
//
//   - **D&D 5e (2014)**: el SRD 5.1 está bajo CC-BY-4.0, así que sus tipos de
//     daño y su matemática se usan TAL CUAL, y se citan. Es la única capa cuyo
//     texto entra en el árbol.
//   - **Shin Megami Tensei / Persona**: se toma la IDEA de leer a un enemigo por
//     sus afinidades (débil / resiste / nulo / absorbe / repele). Ni un nombre.
//   - **Pokémon**: se toma la IDEA de etapas y de una matriz de efectividad
//     entre tipos. Ni un nombre.
//   - **Argon HUD**: se toma la FORMA del dato (acción / adicional / reacción /
//     movimiento). Ni una línea de su código, que además es GPL-3.0 y este árbol
//     es GPL-2.0: son incompatibles.
//
// Las mecánicas no se registran; los nombres y el arte sí. Y como esta frase se
// olvida en seis meses, hay una prueba que recorre estas tablas y falla si
// aparece un término de esas obras. Está codificada, no comentada.
//
// Puro: ni Foundry, ni DOM, ni red.

/**
 * Sílabas para componer nombres. No son palabras de ningún idioma real ni de
 * ninguna obra: se combinan inicio + medio? + final y suenan a tripulación de
 * una nave que lleva demasiado tiempo fuera.
 *
 * Una tabla de sílabas puede componer por accidente un nombre que sí es de
 * alguien: la primera versión de esta llevaba «Mar», y de ahí salían «Maranmir»
 * y «Marasai», que empiezan por el nombre de un demonio de la escuela SMT. Por
 * eso la puerta de limpieza recorre TAMBIÉN los nombres generados y no solo las
 * tablas: revisar la lista de sílabas a ojo no habría visto nada.
 */
export const SILABAS = Object.freeze({
  inicio: Object.freeze(["Ar", "Bel", "Cir", "Dor", "El", "Fen", "Gal", "Hir",
                         "Ith", "Kor", "Lu", "Rus", "Nev", "Or", "Ser", "Tal",
                         "Ux", "Ven", "Yr", "Zel"]),
  medio: Object.freeze(["", "", "a", "en", "ia", "or", "ur", "el", "an"]),
  final: Object.freeze(["ba", "dis", "ka", "lem", "mir", "nor", "ra", "sai",
                        "tek", "van", "xu", "za"]),
});

/**
 * Tipos de daño del SRD 5.1 (D&D 5e, 2014), CC-BY-4.0.
 * Fuente: System Reference Document 5.1, sección de tipos de daño.
 * Se listan en inglés porque son la CLAVE del dato, no la etiqueta que se pinta.
 */
export const DANO_SRD = Object.freeze([
  "acid", "bludgeoning", "cold", "fire", "force", "lightning", "necrotic",
  "piercing", "poison", "psychic", "radiant", "slashing", "thunder",
]);

/**
 * Los elementos del juego: una capa de PRESENTACIÓN sobre los tipos de daño del
 * SRD, no un sistema paralelo. Cada uno declara contra qué tipo del SRD se
 * resuelve, así que la mitad 5e de la ficha sigue siendo 5e de verdad y no una
 * imitación con otros nombres.
 *
 * `fuerte` y `debil` son NATURALEZAS, nunca otros elementos: un elemento pega
 * contra de qué está hecho algo, no contra otro elemento. Escribir ahí el id de
 * un elemento compila igual y rompe la matriz en silencio, así que hay una
 * prueba que lo comprueba entrada por entrada.
 */
export const ELEMENTOS = Object.freeze([
  Object.freeze({ id: "cinetico",   dano: "bludgeoning", fuerte: "estructural", debil: "difuso" }),
  Object.freeze({ id: "termico",    dano: "fire",        fuerte: "biotico",     debil: "estructural" }),
  Object.freeze({ id: "criogenico", dano: "cold",        fuerte: "difuso",      debil: "sintetico" }),
  Object.freeze({ id: "ionico",     dano: "lightning",   fuerte: "sintetico",   debil: "estructural" }),
  Object.freeze({ id: "corrosivo",  dano: "acid",        fuerte: "estructural", debil: "sintetico" }),
  Object.freeze({ id: "psionico",   dano: "psychic",     fuerte: "biotico",     debil: "sintetico" }),
  Object.freeze({ id: "gravitico",  dano: "force",       fuerte: "difuso",      debil: "biotico" }),
]);

/**
 * Los seis grados de afinidad. Es la mecánica que se toma de la escuela SMT: un
 * enemigo no se lee por sus números, se lee por sus huecos.
 *
 * `factor` es lo que multiplica al daño; `absorbe` cura y `repele` devuelve, así
 * que su factor es negativo y quien lo consuma decide a quién se lo aplica.
 */
export const AFINIDADES = Object.freeze({
  debil:   Object.freeze({ factor: 2,    peso: 12 }),
  neutral: Object.freeze({ factor: 1,    peso: 55 }),
  resiste: Object.freeze({ factor: 0.5,  peso: 20 }),
  nulo:    Object.freeze({ factor: 0,    peso: 8 }),
  absorbe: Object.freeze({ factor: -1,   peso: 3 }),
  repele:  Object.freeze({ factor: -1,   peso: 2 }),
});

/**
 * Naturalezas: la casilla que la matriz de efectividad cruza. Es lo que se toma
 * de la escuela de los tipos, sin un solo nombre suyo.
 */
export const NATURALEZAS = Object.freeze([
  "biotico", "sintetico", "estructural", "difuso",
]);

/**
 * Arquetipos. Cada uno fija talla (y con ella el dado de golpe del SRD), el
 * reparto de atributos y las acciones que sabe hacer.
 */
export const ARQUETIPOS = Object.freeze([
  Object.freeze({
    id: "estibador", talla: "mediana", naturaleza: "biotico",
    sesgo: Object.freeze({ fue: 3, con: 2, des: 0, int: -1, sab: 0, car: -1 }),
    acciones: Object.freeze(["golpe-de-carga", "empujon", "aguantar"]),
  }),
  Object.freeze({
    id: "sonda-de-mantenimiento", talla: "pequena", naturaleza: "sintetico",
    sesgo: Object.freeze({ des: 3, int: 2, fue: -2, con: 0, sab: 1, car: -3 }),
    acciones: Object.freeze(["soldadura", "diagnostico", "replegarse"]),
  }),
  Object.freeze({
    id: "contramaestre", talla: "mediana", naturaleza: "biotico",
    sesgo: Object.freeze({ car: 3, sab: 2, fue: 1, con: 0, des: 0, int: 0 }),
    acciones: Object.freeze(["dar-orden", "reprender", "cubrir"]),
  }),
  Object.freeze({
    id: "eco-de-casco", talla: "grande", naturaleza: "estructural",
    sesgo: Object.freeze({ con: 4, fue: 2, des: -2, int: -3, sab: 1, car: -2 }),
    acciones: Object.freeze(["embestida", "resonar", "asentarse"]),
  }),
  Object.freeze({
    id: "polizon", talla: "mediana", naturaleza: "biotico",
    sesgo: Object.freeze({ des: 3, car: 1, sab: 1, int: 0, fue: -1, con: -1 }),
    acciones: Object.freeze(["puntada", "escabullirse", "distraer"]),
  }),
  Object.freeze({
    id: "nube-de-esporas", talla: "grande", naturaleza: "difuso",
    sesgo: Object.freeze({ con: 3, sab: 2, des: 1, car: -1, fue: -3, int: -3 }),
    acciones: Object.freeze(["dispersarse", "envolver", "condensar"]),
  }),
]);

/**
 * Dado de golpe por talla — SRD 5.1 (CC-BY-4.0), tabla de dados de golpe por
 * tamaño de criatura.
 */
export const DADO_POR_TALLA = Object.freeze({
  minuscula: 4, pequena: 6, mediana: 8, grande: 10, enorme: 12, gargantuesca: 20,
});

/**
 * Líneas de mutación: tres etapas, cada una con su nombre propio. Es la idea de
 * una criatura que es la MISMA a lo largo de varias formas, no tres criaturas
 * distintas — de ahí que la línea sea el dato y la etapa un índice dentro.
 */
export const LINEAS = Object.freeze([
  Object.freeze({ id: "lastre",  etapas: Object.freeze(["Lastrilla", "Lastrón", "Contralastre"]) }),
  Object.freeze({ id: "vaho",    etapas: Object.freeze(["Vahíllo", "Vaharada", "Nimbo"]) }),
  Object.freeze({ id: "remache", etapas: Object.freeze(["Remachín", "Remache", "Roblón"]) }),
  Object.freeze({ id: "salmuera", etapas: Object.freeze(["Salino", "Salmuero", "Salobre"]) }),
]);
