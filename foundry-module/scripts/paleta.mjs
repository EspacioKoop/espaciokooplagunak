/**
 * Paletas del arte procedural del módulo y la frontera entre sus dos lenguajes
 * (#351).
 *
 * En el módulo conviven dos artes generadas en el cliente, y no chocan por
 * casualidad: las dos renuncian al degradado y comparten papel oscuro. Son una
 * imprenta y un CRT en la misma sala.
 *
 * ## La frontera: vivo frente a registrado
 *
 * - **GRABADO** (`TINTA`) para lo que **persiste o enmarca**: cartelas, fichas,
 *   códice, el marco cartográfico del mapa. Sombra por densidad de línea, nunca
 *   por opacidad — la opacidad es un recurso de pantalla y delata el pastiche.
 * - **PIXEL** (`PIXEL`) para lo que **se repinta con telemetría**: sprites de
 *   nave, barras, iconos de sistema, retratos, naipes. Rejilla, `crispEdges`,
 *   paleta corta.
 *
 * El eje NO es «diegético frente a papel», que fue el primer intento: bajo esa
 * regla el marco de grabado que envuelve el lienzo de píxeles del mapa vivo
 * sería una infracción, cuando es justo lo correcto — el marco es la carta y el
 * interior es la verdad que cambia en cada sondeo. Formulada como vivo/registrado
 * la regla predice bien los casos que vienen: la cartela de una lámina impresa es
 * grabado aunque cuelgue de una consola, y una barra que sigue a `/v1/state` es
 * pixel aunque viva dentro de un diario.
 *
 * Este módulo existe para que la frontera sea EXIGIBLE y no prosa: antes los
 * mismos tokens de color estaban repetidos en tres sitios sin dueño, así que
 * nada impedía que el cuarto módulo inventara su propio sepia.
 *
 * Puro: ni Foundry, ni DOM, ni red. Los valores son exactamente los que ya
 * usaban los tres módulos; este archivo los reúne, no los rediseña.
 */

/** Lenguajes disponibles, para que un consumidor pueda declarar el suyo. */
export const LENGUAJES = Object.freeze(["grabado", "pixel"]);

/**
 * Tinta sepia sobre papel envejecido: la paleta del grabado impreso, no la de
 * una pantalla. Se expone para que el consumidor pueda invertirla.
 */
export const TINTA = Object.freeze({
  linea: "#c9b48a",
  lineaSuave: "rgba(201, 180, 138, 0.45)",
  papel: "#0b0f18",
  realce: "#f0e4c4",
});

/**
 * Paleta del arte de rejilla. Reúne los acentos de los sprites de nave y la
 * baraja, que antes vivían por separado.
 */
// Crema cálido. Lo comparten el acento de cabina del sprite y la nave propia
// del mapa vivo, que es justo lo que quiere decir su comentario original
// («como la nave propia del mapa»): la relación se escribe, no se repite el
// literal en dos módulos donde nadie los ve juntos.
const CREMA = "#fdfffc";

export const PIXEL = Object.freeze({
  // Naipes (#308/#330). `cara` es pergamino claro para dar el máximo contraste
  // con ambas tintas de palo.
  cara: "#f4e8c8",
  borde: "#2a1f14",
  negro: "#1c1a2e",
  rojo: "#b3212a",
  dorsoFondo: "#141b33",
  dorsoMotivo: "#c8a24a",
  dorsoEstrella: "#8fa3d9",
  // Sprites de nave: acentos fijos que no dependen del color de facción.
  cabina: CREMA,
  motor: "#ffb703",
  // Ámbar sin propulsión: mismo tono, sin brillo. El valor está apretado entre
  // dos mínimos a la vez —≥3:1 sobre el papel y ≥3:1 frente al motor encendido—
  // y la ventana que cumple ambos es estrecha, así que no se retoca a ojo.
  motorApagado: "#836018",
  motorNucleo: "#fff3c4", // núcleo claro de la estela
  motorEstela: "#ff8c1e", // cola de la estela
  neutro: "#ffffff", // casco sin color de facción utilizable
  // Mapa vivo (#33): contactos del radar. Reservados, fuera del reparto por
  // hash de `FACCIONES`.
  naveJugador: CREMA, // la nave propia destaca
  sinFaccion: "#7d8597", // gris azulado: objetos sin facción
  // Fondo estelar del 3D retro (#362). Azul frío y no blanco puro: el blanco lo
  // tiene reservado la nave propia, y un cielo del mismo tono que el casco haría
  // competir el decorado con lo que sí importa mirar.
  estrella: "#9fb4e8",
});

/**
 * Nivel de alerta de la nave. Los mismos tonos que ya vivían sueltos en
 * `lagunak.css`, traídos aquí porque los necesitan también el tinte de escena
 * (`filtros-escena.mjs`) y las variables CSS que publica `alerta-escena.mjs`.
 *
 * BORDE Y TEXTO NO SON EL MISMO ROJO, y no es un descuido heredado. Los dos
 * pasan el 4.5:1 de WCAG AA sobre el fondo del aviso —el borde por los pelos
 * (4.59), el texto de sobra (9.22)—, así que no es una cuestión de cumplir o no:
 * es el MARGEN. El aviso es texto pequeño, en negrita y versalitas, y ahí un
 * contraste al filo se lee mal aunque el número dé; el borde es una superficie
 * ancha de 6px que no necesita ese colchón y gana con el rojo más saturado.
 * Unificarlos al del borde dejaría el aviso rozando el mínimo por comodidad.
 * En amarillo sí coinciden: ese tono ya llega a 9.55 en ambos usos.
 *
 * `verde` no tiene entrada a propósito: la nave en verde no se tiñe de nada, y
 * darle un color invitaría a pintar la pantalla cuando no pasa nada.
 */
export const ALERTA = Object.freeze({
  // El fondo de la caja del aviso. Va aquí y no suelto en el CSS porque es
  // contra ESTE color contra el que se miden los dos tonos de arriba: tenerlo
  // en otro fichero es cómo se acaba retocando el fondo y descubriendo meses
  // después que el aviso ya no se lee.
  fondoAviso: "#06080e",
  niveles: Object.freeze({
    amarilla: Object.freeze({ borde: "#e2aa28", texto: "#e2aa28" }),
    roja: Object.freeze({ borde: "#d1495b", texto: "#ff8f9d" }),
  }),
});

/**
 * La cantina (#423 sobre #362): el local donde la tripulación mata el rato.
 *
 * Referencias declaradas, porque el tono no es decorativo: la cantina de Mos
 * Eisley (penumbra cálida, gente en la sombra), la estación de Solaris (metal
 * cansado, habitado) y el interior de la Discovery de 2001 (blanco clínico,
 * luz que viene de los paneles y no de bombillas). De ahí salen los tres
 * planos: un mamparo frío y sin gracia, una barra cálida que es el único foco
 * de calor de la sala, y una luz que baña por encima.
 *
 * Van juntos y aquí porque son un AMBIENTE: elegir el ámbar de la barra sin
 * ver al lado el gris del mamparo es cómo se acaba con una sala que no cierra.
 */
/**
 * La luz cálida del módulo: el ámbar claro de una lámpara encendida.
 *
 * Estaba ya dos veces con el mismo valor —la lámpara de la cantina y la sala
 * bajo el puntero en la sección— y se reúne aquí al llegar el tercer consumidor
 * (#555, las luminarias de las salas), por lo mismo que `AMBAR_SENAL`.
 *
 * NO es `AMBAR_SENAL` ni `SECCION.entrable`, y esa distancia es lo importante:
 * una lámpara ilumina, no señala. Pintarla con el acento de «esto se acciona»
 * —que es lo que hacía `lamparaTecho`— gasta en un adorno la única señal que la
 * tripulación tiene para encontrar lo accionable.
 */
export const LUZ_CALIDA = "#ffd79a";

/**
 * El fósforo de una pantalla encendida (#557). El segundo —y último— color
 * emisivo del módulo, junto a `LUZ_CALIDA`.
 *
 * Es pariente de `CANTINA.pantalla` (#1b4a5c, «monitores apagados del mamparo:
 * azul de fósforo muerto»): el mismo tubo, encendido. Esa relación es el motivo
 * de que sea un azul verdoso y no un blanco — una pantalla apagada y la misma
 * encendida tienen que reconocerse como el mismo aparato.
 *
 * Apagado de tono a propósito: es un color EMISIVO, o sea que llega al ojo tal
 * cual, sin sombrear. Un cian saturado a intensidad plena en una sala oscura no
 * se lee como un monitor encendido sino como un rectángulo de error —se probó, y
 * la primera versión parecía una pantalla azul de las malas—. La luz de un tubo
 * de fósforo es tenue; lo que la hace visible es el contraste con la sala, no su
 * saturación.
 *
 * Va ENCENDIDO Y VACÍO. Un monitor iluminado no afirma nada; un monitor con un
 * gráfico afirma una lectura que nadie ha calculado, y sería la infracción más
 * creíble posible de #526 — precisamente porque una consola es el sitio donde un
 * dato SÍ tendría sentido. El dato de verdad está en el espacio de puesto que se
 * abre al llegar; el mueble solo dice «aquí hay un puesto».
 */
export const LUZ_FOSFORO = "#2f7f8f";

/**
 * Página del libro 3D interactuable (#853). Todos los tonos son PARIENTES del
 * papel y la tinta del grabado impreso (`TINTA`), porque una página de cerca es
 * eso: papel envejecido y tinta sepia, no un panel de nave. Sin acentos vivos:
 * la mancha tipográfica no afirma lectura (#526), y un libro es adorno, no un
 * instrumento.
 *
 * `cabecera` y `tinta` se separan del `papel` por el mismo margen que exige el
 * `paleta.test.mjs` para los naipes: la mancha tiene que recortarse sobre el
 * papel, no fundirse con él.
 */
export const PAGINA = Object.freeze({
  papel: "#0b0f18", // mismo papel envejecido que TINTA.papel
  cabecera: "#c9b48a", // título sugerido, el realce del grabado
  tinta: "#6f6448", // bloques de texto sugerido: sepia apagado, nunca letra
});

export const CANTINA = Object.freeze({
  mamparo: "#2b3038", // gris azulado de nave: el fondo no compite con nada
  suelo: "#1d2128", // más oscuro que el mamparo: la sala tiene arriba y abajo
  barra: "#7a4a22", // madera imposible en el espacio, y por eso acogedora
  barraCanto: "#b8763a", // el borde que coge la luz de la lámpara
  lampara: LUZ_CALIDA, // cálida, la única fuente de calor del local
  ventana: "#0a0f1f", // el vacío al otro lado del cristal
  neon: "#4ad9c4", // el rótulo: verde azulado de tubo, ajeno a la madera
  // Lo que llena el local. Sin esto la sala es correcta y está vacía, que es
  // justo lo que no puede ser una cantina.
  nervio: "#3a424e", // costillas del mamparo: rompen la pared plana
  estante: "#4a3320", // la trasera de la barra, madera en sombra
  botellaVerde: "#2f7d5a", // botellería. Tres tonos, porque una fila de
  botellaAmbar: "#c98a3a", // botellas del mismo color es un peine, no una
  botellaAzul: "#41689e", // barra surtida.
  taburete: "#6b7280", // metal de nave, frío contra la madera
  mesa: "#5c4630", // las mesas del fondo: la misma madera, más apagada
  techo: "#232830", // más oscuro que el mamparo: cierra la sala por arriba
  // Lo que dice «nave» y no «taberna»: tubería vista, pantallas de servicio y
  // las balizas de suelo que marcan por dónde se anda cuando falla la luz.
  conducto: "#565f6b", // tubos por el techo, metal claro
  pantalla: "#1b4a5c", // monitores apagados del mamparo: azul de fósforo muerto
  baliza: "#ff6b35", // ámbar de emergencia, el único color que grita
  // La capa 2D que va encima del 3D tiñe con estos dos y con nada más: sombra
  // para viñeta y líneas, y el propio ámbar de las lámparas para el halo alto.
  // Están aquí y no allí porque un velo ES un color, aunque venga con alfa.
  sombra: "#000000",
  // El goblin de la barra. Verde apagado y no chillón: lleva toda la vida
  // sirviendo aquí, no acaba de salir de un cuento.
  goblinPiel: "#6f8f4a",
  goblinRopa: "#8a5a3c", // delantal de cuero gastado
  goblinVenda: "#d9cdb4", // la venda de los ojos, lo único claro que lleva
  cerveza: "#e0a33a", // la jarra: el mismo ámbar de la luz, no un color nuevo
});

/**
 * Avatares de la cantina (#423). Cajas sin cara, manos grandes y cabeza enorme:
 * FF7 original por su lado técnico y Mii por su lado social — un muñeco
 * simpático que se reconoce de un vistazo y no intenta parecerse a nadie.
 *
 * Editor tipo Hero Forge pero MUCHO más simple: cuatro decisiones y ninguna
 * más. Un configurador de treinta controles convierte «entrar a la cantina» en
 * rellenar un formulario, y lo que se busca es sentarse a jugar.
 *
 * Tonos cálidos y poco saturados a propósito: la gente tiene que verse acogedora
 * dentro del local, no destacar como un icono de interfaz sobre la madera.
 */
export const AVATAR = Object.freeze({
  // Pelo: lista corta, no selector libre. Elegir entre seis tonos que casan con
  // la sala da mejor resultado que dieciséis millones que no.
  pelos: Object.freeze([
    "#2b2119", // negro cálido
    "#5a3820", // castaño
    "#a5642a", // cobre
    "#d9c07a", // rubio ceniza
    "#8f9aa8", // canoso
    "#6a4b7a", // teñido: en una nave hay quien se lo tiñe
  ]),
  acero: "#9aa5b1", // armas y armaduras
  madera: "#7a5230", // báculos, laúdes
  simbolo: "#e8d9a0", // el símbolo sagrado del clérigo
  // Lo que se lleva en la mano según el gesto.
  jarra: "#e0a33a", // el mismo ámbar de la cerveza de la barra
  cigarro: "#e8e4d8",
  brasa: "#ff6b35", // un píxel, y es lo único claro de una silueta que fuma
  // Más clara que `brasa`, para la calada (#439): el punto sube de brillo
  // cuando se tira del cigarro y baja entre caladas, sin salir de la paleta.
  brasaCalada: "#ffd899",
});

/** Trastos que llenan el local (#423). Cosas que alguien dejó ahí: cajas de
 * suministro, una planta que aguanta, la tele del bar, la gramola. Un sitio
 * habitado tiene cosas que nadie ha colocado a propósito. */
export const CACHARROS = Object.freeze({
  cajaSuministro: "#6b5a3e", // cajas apiladas contra el mamparo
  cajaFleje: "#404a56", // sus flejes metálicos
  planta: "#3f7a45", // la planta de la esquina: lo único vivo que no habla
  maceta: "#7a4a3a",
  teleMarco: "#2f353d", // la tele colgada, apagada
  telePantalla: "#101820",
  gramola: "#8a3550", // la gramola, granate de local de carretera
  gramolaLuz: "#ffd166",
  trapo: "#c7bda6", // el trapo de la barra, el detalle más humano que hay
});

/**
 * La sección de la nave (#427): el corte transversal que se lee como un plano,
 * no como una sala.
 *
 * Por eso NO reusa los tonos de la cantina: aquella es un sitio con luz cálida
 * y esto es un esquema técnico visto desde fuera. El casco es estructura, no
 * ambiente, y las salas son huecos dentro de él. El único color que grita lo
 * pone el daño, y ese no vive aquí: sale de `COLOR_REGION` (#419), para que un
 * mismo estado del casco no tenga dos colores según qué ventana lo mire.
 */
export const SECCION = Object.freeze({
  vacio: "#070a12", // el espacio alrededor del corte
  casco: "#3b444f", // la estructura seccionada: metal frío y grueso
  mamparo: "#222932", // el relleno entre salas, más oscuro que el casco
  sala: "#151b24", // el suelo de una sala sin lectura de daño
  salaBorde: "#4d5a68", // el canto que separa una sala de la siguiente
  rotulo: "#c3ceda", // los nombres de sala
  puerta: "#6f8296", // los tránsitos entre salas
  entrable: "#4ad9c4", // el realce de una sala en la que SÍ se puede entrar:
  // el mismo verde azulado del neón de la cantina, porque señala lo mismo.
  foco: LUZ_CALIDA, // la sala bajo el puntero: la misma luz cálida
  tripulante: "#fdfffc", // un punto por persona; el crema de la nave propia
});

/**
 * Piel de los muros por dentro (#548). Todos los tonos son PARIENTES de
 * `SECCION.casco`, el color del muro pelado: el mural es chapa sobre chapa, no
 * un mural pintado, y en cuanto un tono se despega del casco deja de leerse como
 * la misma pared y pasa a leerse como un cartel.
 *
 * Por eso no hay aquí ningún acento vivo —ni el ámbar de señalización ni el
 * verde azulado de «esto se acciona»—: esos dos colores ya SIGNIFICAN en esta
 * misma sala (marco de puerta, ventana, consola), y repetirlos como adorno de
 * pared gastaría la única señal que la tripulación tiene para encontrarlos.
 *
 * La piel de una PUERTA (#550) sí lleva el ámbar, y no es una excepción a lo
 * anterior sino su consecuencia: allí el ámbar no adorna, dice lo mismo que ya
 * dice el marco de esa puerta. Lo toma de `AMBAR_SENAL`, no como tono nuevo.
 */
/**
 * El ámbar de señalización del módulo: «esto se acciona» o «cuidado aquí». Vivía
 * como literal repetido en `nave-sala-caja.mjs` (marco de puerta y franja de la
 * hoja) y se recoge aquí al llegar el tercer consumidor (#550, la piel de las
 * puertas), que es justo cuando un literal repetido deja de ser un literal y
 * pasa a ser una decisión de color sin dueño.
 */
export const AMBAR_SENAL = "#ffb703";


export const MURAL = Object.freeze({
  // --- La rampa. Seis pasos de un mismo metal, del brillo al fondo de un
  // hueco. Es lo que convierte un dibujo plano en chapa con VOLUMEN: un panel
  // no es un rectángulo de color, es un canto claro arriba, una base que es el
  // muro y un canto oscuro abajo. Sin rampa no hay bisel, y sin bisel el mural
  // es un plano con rayas por muy denso que se ponga (#551).
  //
  // Seis y no tres: en la época que se toma de referencia —Neo Geo, PSX— las
  // naves no eran pobres, eran de paleta CORTA y muy bien repartida, y lo que
  // hace ese trabajo son los pasos intermedios. Con tres, el bisel se lee como
  // un borde dibujado; con seis, como luz.
  brillo: "#8492a3", // el filo que da a la luz: solo cantos, nunca superficies
  claro: "#657386", // cara iluminada de un relieve
  medio: "#4a5462", // metal a media luz — el tono de las piezas montadas
  sombra: "#333b46", // cara en sombra de un relieve
  junta: "#252c35", // la línea entre dos planchas
  hueco: "#161b22", // el fondo de una rendija o de un hueco recortado

  // --- Los papeles. Nombres de lo que se dibuja, no de tonos, para que el
  // dibujo se lea al escribirlo y se pueda recolorear sin tocar el motivo.
  remache: "#8492a3", // el punto que coge la luz
  conducto: "#4a5462", // el tubo de servicio
  abrazadera: "#333b46", // lo que lo sujeta al mamparo
  parche: "#4a5462", // chapa remachada encima: la misma plancha, más nueva
  ventilacion: "#161b22", // las lamas de una rejilla: hueco, no pieza
});

/**
 * Paleta arcade saturada de las facciones en el mapa vivo. Es una lista y no un
 * objeto porque el color se reparte por hash del nombre de facción: importa el
 * orden, no el nombre de cada entrada.
 *
 * El ámbar coincide a propósito con `PIXEL.motor`: es el mismo ámbar de
 * propulsión del sprite, y por eso se toma de ahí en vez de repetirlo.
 */
export const FACCIONES = Object.freeze([
  "#ff2e88", // magenta
  "#00e5ff", // cian
  PIXEL.motor, // ámbar
  "#38b000", // verde
  "#9d4edd", // púrpura
  "#ef233c", // rojo
  "#3a86ff", // azul
  "#f15bb5", // rosa
]);

/**
 * Retratos de tripulación (#352). Listas cortas y no objetos porque el rasgo se
 * sortea por índice desde la semilla: importa cuántos hay, no cómo se llama
 * cada uno.
 *
 * Los tonos de casco son materiales de traje, no tonos de piel: el retrato
 * codifica presencia y nada más, y una rejilla de 12x12 no puede representar a
 * una persona sin caricaturizarla.
 */
export const RETRATO = Object.freeze({
  // Tonos medios: tienen que separarse del papel oscuro del panel, que es
  // contra lo que se recorta la silueta.
  cascos: Object.freeze(["#8a94a6", "#b6743f", "#5f7a6a", "#9a5f6f", "#c3b184"]),
  // Cristal OSCURO, no brillante. El primer intento fueron visores luminosos y
  // se quedaban en 1.15:1 contra el casco — invisibles, justo el rasgo que más
  // se mira. Un cristal oscuro sobre casco claro llega a 3.3:1 y además es lo
  // que hace un visor de verdad. No compite con el papel porque nunca lo toca:
  // va siempre rodeado de casco.
  visores: Object.freeze(["#0d1a2e", "#241026", "#08231d"]),
  acentos: Object.freeze(["#ff6f8f", "#5fffc0", "#ffd166", "#8fa3d9"]),
});

/**
 * Iconos de daño por sistema (#353). El estado se dibuja con forma —grietas,
 * píxeles apagados, contorno discontinuo—, así que estos colores acompañan a
 * la forma en vez de sustituirla: quien no distinga los tonos sigue leyendo el
 * estado, y el texto de la fila sigue siendo la verdad.
 */
export const SISTEMA = Object.freeze({
  // El marco no es un gris nuevo: es el mismo de lo que no tiene facción en el
  // mapa. Se toma de ahí en vez de repetirlo, que es la regla de este archivo.
  marco: PIXEL.sinFaccion,
  nucleo: "#8df06f", // verde de sistema respondiendo
  // No hay color de grieta: la grieta es un hueco, no un tono. Un ámbar sobre
  // el verde del núcleo daba 1,48:1 y habría dejado el estado viajando en el
  // color justo en el módulo que existe para evitarlo.
  apagado: "#3a2b2f", // núcleo muerto: presente pero sin responder
  sinLectura: "#5b6472", // ni bueno ni malo: no se sabe
  // Región dañada bajo reparación automática activa (#464/#466). Azul
  // eléctrico: el único tono de esa familia en todo `SISTEMA`, no compite con
  // el verde de `nucleo` ni el ámbar/granate de daño/crítico.
  reparando: "#4fd3ff",
});

/**
 * La playa de pruebas (#587).
 *
 * El primer EXTERIOR del módulo, y por eso paleta propia: todo lo demás es
 * interior de nave —metal frío, mamparo, fósforo— y meter arena y mar en
 * `SECCION` haría que «casco» y «duna» convivieran en el mismo grupo sin tener
 * nada que ver.
 *
 * De día y con el sol bajo, que es la hora a la que se leen las referencias
 * (Kingdom Hearts, Digimon Adventure): la arena tira a cálida, el mar a frío, y
 * el cielo es lo bastante claro como para que una silueta a contraluz —un poste,
 * un aerogenerador— se recorte contra él sin necesitar contorno dibujado.
 *
 * La niebla del motor funde hacia `cielo`, así que ese color hace dos trabajos a
 * la vez: es el fondo del lienzo y es hacia donde se apaga lo que está lejos. Si
 * se cambia uno hay que cambiar el otro, o el horizonte deja de cerrar.
 */
export const PLAYA = Object.freeze({
  cielo: "#bcd4e0", // claro y desaturado: es fondo, no protagonista
  mar: "#3f7a91", // el agua cerca, todavía con color
  marLejos: "#6f9fb0", // hacia el horizonte el agua se lava y se acerca al cielo
  espuma: "#d8e6ea", // la lengua de agua que sube y baja
  arenaMojada: "#8f8168", // los cinco metros lisos: arena que acaba de dejar el mar
  arena: "#c9b48c", // el camino de arena fina, la superficie por la que se anda
  duna: "#d8c69e", // más clara que el camino: le da la luz de lleno
  dunaSombra: "#a89673", // el canto de cada terraza, o la duna sería un plano
  poste: "#6e6152", // madera vieja de un poste de la luz
  cable: "#3a352e", // casi silueta: un cable es una línea oscura contra el cielo
  cabina: "#a83a32", // el rojo de la cabina, el único acento saturado de la escena
  cabinaTecho: "#82291f", // su remate, un paso más oscuro
  cristal: "#7fa7ae", // los vidrios: agua reflejada, no transparencia (no la hay)
  torre: "#e4e7e2", // el blanco roto de un aerogenerador
  aspa: "#f2f4f0", // un punto más claro: las aspas cogen el sol antes que la torre

  // --- La luz. Los dos colores que hacen que la escena no sea plana: el sol
  // baja tiñe de cálido lo que ilumina, y lo que queda en sombra lo rellena el
  // cielo, que es frío. Sin esa OPOSICIÓN, sombrear es solo bajar el brillo del
  // mismo color y todo se lee como cartón recortado.
  luzSol: "#ffd9a0", // el cálido que se suma a lo iluminado
  sombraCielo: "#5f7f9c", // el frío con el que el cielo rellena la sombra
  sol: "#fff2cf", // el disco, casi blanco: es lo más claro del cuadro
  destello: "#ffe7b8", // el camino de sol sobre el agua

  // --- Lo que llena la playa. Un sitio sin nada suelto no es una playa, es una
  // rampa: lo que la hace creíble son las cosas que nadie ha colocado.
  roca: "#7d7566",
  rocaClara: "#9b9182", // la cara que da al sol, para que una roca sea redonda
  madera: "#8a7458", // madera de deriva, descolorida por el sal y el sol
  matojo: "#6f7a4e", // la hierba que agarra la duna
  matojoSeco: "#9a9463", // la que ya no
  boya: "#d9683c", // naranja de señal: los únicos puntos vivos del agua
  sombra: "#6a6252", // la que proyectan las cosas sobre la arena

  // --- El cielo de una playa que NO es de la Tierra. Es lo que recuerda, sin
  // decirlo, que esto lo mira gente que vive en una nave. Colores lavados y de
  // poco contraste entre sí: un planeta saturado en el cielo se lee como un
  // globo pintado encima, no como un cuerpo a doscientos kilómetros.
  planetaOcre: "#c2a486",
  planetaPalido: "#b9c3cc",
  planetaRojizo: "#b07f6e",
  anillo: "#cfc3ae",
  luna: "#cdd3d6",

  // --- El agua, por bandas. Un mar de un solo color no tiene ni profundidad ni
  // superficie: lo que se lee como hondo es que el bajío sea distinto.
  marBajio: "#5d9aab", // donde se ve el fondo
  cresta: "#a9cdd6", // el filo de una ola antes de romper
  marMarca: "#7b6e58", // la lengua que dejó la marea al bajar
  alga: "#4f5a3c", // lo que trae el agua y se queda en la raya de restos
  rizo: "#b6a37c", // la cresta de un rizo de arena, con el sol rasante
  rizoDuna: "#c3b088", // el mismo rizo, en la arena más clara de la duna
  manga: "#e07a3a", // la manga de viento: naranja de señal, se ve de lejos
  mangaFranja: "#f0e6d8", // sus franjas claras
  arenaVolada: "#e2d3ae", // la lengua de arena que cruza corriendo a ras de suelo

  // --- El reloj varado. Latón y esmalte: los dos materiales que no son ni
  // arena ni agua ni casco, y por eso el objeto salta a la vista sin gritar.
  relojCara: "#e8e0cc", // el esmalte de la esfera
  relojCerco: "#b08a3e", // el latón del cerco, ya sin brillo
  relojAguja: "#2d2a24", // las agujas: casi negro, para que se lean a distancia
  relojMarca: "#6b6047", // las marcas de las horas
});

/**
 * EL PUERTO: obra portuaria y mobiliario de calle (#589).
 *
 * Paleta aparte de `PLAYA` por el mismo motivo por el que los vocabularios se
 * separaron: los props de puerto y de calle no son de la playa, están EN la
 * playa. Meterlos en `PLAYA` habría vuelto a atar a un sitio concreto lo que
 * acaba de dejar de estarlo — y una farola no es más de arena que de asfalto.
 *
 * Colores de cosa USADA, no de cosa nueva. Un noray recién pintado no existe: lo
 * que hay en un muelle es hierro comido de sal, madera gris de intemperie y
 * pintura desconchada. Es lo que separa un puerto de un decorado de puerto, y
 * cuesta lo mismo que elegir los colores bonitos.
 */
export const PUERTO = Object.freeze({
  // El hierro de los norays y las bitas: oscuro, mate, con la coronilla pulida
  // por las estachas que rozan siempre por el mismo sitio.
  hierro: "#4a4f55",
  hierroPulido: "#7d8288",
  // Madera de muelle y de barca: gris de intemperie, no marrón de mueble.
  tablazon: "#8b8375",
  tablazonSombra: "#6a6357",
  // El pilote clavado en el agua, con la banda oscura de lo que moja la marea.
  pilote: "#6f6558",
  piloteFango: "#4b4238",
  // La barca: casco pintado y desconchado, e interior en sombra.
  casco: "#9a5f4a",
  cascoDesconchado: "#b98a70",
  interiorBarca: "#5c4a41",
  // Mobiliario de calle: hormigón, y la chapa pintada de una papelera.
  hormigon: "#9b9994",
  hormigonSombra: "#77756f",
  chapa: "#4f6b5e",
  // Cajas de carga apiladas, y sus flejes.
  caja: "#a98a5c",
  cajaFleje: "#6b5a3e",
});

/**
 * La sala del museo (#598).
 *
 * Paleta propia y no `SECCION` por el mismo motivo que la playa tiene la suya:
 * un museo no es interior de nave. Aquí el color hace un trabajo concreto y
 * medible — que la PIEDRA se despegue del muro. Si el yeso de un vaciado y el
 * mamparo tuvieran el mismo valor, tres estatuas de metro y medio se leerían
 * como bultos pegados a la pared, que es exactamente lo que pasa cuando una
 * sala de exposición se pinta del color de lo que expone.
 *
 * Por eso el muro va OSCURO y la pieza CLARA, que es como se cuelga de verdad:
 * el fondo se retira y la pieza avanza. Y por eso el pedestal queda en medio de
 * los dos, ni fundido con el suelo ni compitiendo con lo que sostiene.
 */
export const MUSEO = Object.freeze({
  muro: "#2e3138", // gris de sala de exposición: oscuro, neutro, sin tirar a azul
  zocalo: "#23262b", // un paso más abajo, para que el muro no toque el suelo a pelo
  suelo: "#3a3d43", // el que se pisa: entre el muro y el pedestal
  pedestal: "#5a5d63", // el bloque que sostiene, claramente más claro que el muro
  pedestalCanto: "#6d7076", // su coronilla, o el pedestal es una silueta plana
  yeso: "#d9d2c4", // el vaciado en yeso: crema, cálido, lo más claro de la sala
  piedra: "#b8ae9c", // la reconstrucción, que no es yeso y no debe parecerlo
  cartel: "#cdb894", // la cartela junto a cada pieza: papel viejo bajo luz cálida
  // La piel del muro (#838). Cinco tonos y no más, y todos MUY cerca de `muro`:
  // una pared de galería es el fondo contra el que se lee la obra, así que su
  // contraste interno tiene que ser menor que el de cualquier pieza colgada. Si
  // el muro se lee antes que el cuadro, el muro está mal.
  pano: "#33373e", // el paño de yeso, un punto por encima del muro que lo sostiene
  panoJunta: "#2a2d33", // la junta entre paños: una sombra fina, no una línea negra
  riel: "#4a4e56", // el riel de cuelgue, la única pieza clara y a una sola altura
  rodapie: "#282b31", // el rodapié, donde se roza la pared al pasar
  // El friso y su cornisa (boiserie, ver `museo-mural.mjs`) suben más carpintería
  // por debajo y por encima del paño, pero NO son el riel de cuelgue: ese es el
  // único punto de la sala donde una prueba confía en que "hay un tono claro
  // aquí" significa "aquí cuelga un cuadro". Prestarle `riel` a la moldura del
  // friso rompería esa lectura la primera vez que alguien contara filas del
  // color equivocado, así que la luz de moldura tiene su propio tono.
  molduraLuz: "#43474e", // la luz que coge el canto de un panel embutido o de la cornisa
});

/**
 * El pasillo de los recuerdos (tercer nivel del campo de pruebas): un mármol
 * blanco que se pierde en niebla y una alfombra negra por el centro, con
 * estatuas propias —la Guardiana y sus centinelas— alternando con piezas
 * reaprovechadas del museo (memorias de otros mundos que ella conserva).
 *
 * NUEVE tonos, no más: el mármol claro es la superficie que más cuadro ocupa
 * (paredes, suelo, techo), así que su contraste interno tiene que quedar por
 * debajo del negro de la alfombra o el pasillo deja de leerse como un pasillo
 * y pasa a leerse como una pared. Los grises de la Guardiana son fríos y
 * apagados a propósito: es de luto, no de piedra — mezclarla con `MUSEO.piedra`
 * confundiría "reconstrucción arqueológica" con "personaje de esta ficción".
 */
export const PASILLO = Object.freeze({
  marmol: "#e4e1da", // el paño claro: mármol, no yeso — más frío que MUSEO.yeso
  marmolJunta: "#c9c5ba", // la junta entre losas, un paso por debajo y no una sombra dura
  marmolVeta: "#d3cfc4", // la veta del mármol: apenas un tono, nunca una línea que se cuente
  zocalo: "#b9b4a7", // el rodapié y el marco de las columnas, más oscuro que el paño
  alfombra: "#0c0b10", // la alfombra: negro de verdad, el único tono oscuro del suelo
  alfombraOrla: "#1c1a22", // el filo de la alfombra, un paso por encima del negro
  cuervo: "#3a2e33", // el motivo bordado: visible sobre el negro, nunca un color que grite
  guardiana: "#4b4d54", // la tela de la Guardiana: gris frío, de luto, no piedra
  guardianaSombra: "#2e2f34", // el pliegue en sombra de su tela
});

/**
 * Los CUADROS colgados de los muros del museo (#836).
 *
 * Van aparte de `MUSEO` y no dentro por dos motivos, y el segundo es el que
 * manda: `MUSEO` es plano —cada clave, un color— y una prueba de la sala lo
 * comprueba clave por clave; y sobre todo, un pigmento no es un material de la
 * sala. `MUSEO.yeso` dice de qué está hecha una pieza; esto es con qué se pintó
 * otra. Mezclarlos invitaría a pintar un lienzo del color de un pedestal.
 *
 * EL MARCO SÍ LLEVA RELIEVE Y EL LIENZO NO, y esa es toda la razón de que haya
 * tres tonos de marco y ninguno de pigmento. Un marco es un OBJETO de la sala,
 * así que se ilumina como todo lo demás (luz de arriba, `LUZ` en `retro3d.mjs`)
 * y necesita su canto claro y su canto en sombra, igual que `panelBiselado`.
 * La pintura de un lienzo es PLANA: biselarla la convertiría en chapa
 * remachada, que es el material equivocado — la misma frontera por la que la
 * cantina apaga la piel de casco en sus muebles de madera (#550).
 *
 * Los cinco pigmentos son tierras y no neones a propósito: sobre el muro
 * oscuro de la sala (`MUSEO.muro`) un color saturado se despegaría tanto que el
 * cuadro competiría con las esculturas, y la sala está montada para que gane la
 * piedra. `hueso` es el único claro y hace de luz dentro del lienzo.
 */
export const CUADRO = Object.freeze({
  marco: "#4a3f34", // madera oscura, un paso por encima del muro y no más
  marcoLuz: "#6b5c4c", // el canto que coge la luz de arriba
  marcoSombra: "#2f2820", // el que queda debajo; sin él el marco es un plano
  fondo: "#1d2a33", // el fondo del lienzo: más oscuro que el muro, para hundirlo
  ocre: "#c08a3e",
  bermellon: "#a33b2a",
  verdin: "#4f7a5e",
  hueso: "#e2dccb", // el claro que hace de luz dentro del cuadro
  // Los cinco de abajo llegan con los cuadros interpretados de #836 (la ola, el
  // Fuji, el mar de nubes). No son un capricho de variedad: los tres originales
  // son PAISAJES, y con los cuatro pigmentos de arriba —dos tierras, un verde y
  // un hueso— no hay forma de decir «agua», «cielo» ni «niebla» sin mentir de
  // color. Siguen siendo tonos rotos y no neones, por el mismo motivo que los
  // otros: sobre el muro oscuro de la sala, un saturado le disputaría la lectura
  // a la piedra.
  azulProfundo: "#1f3f6b", // el mar, y las masas de agua en sombra
  azulPalido: "#8fa9c4", // el cielo; también la niebla lejana
  espuma: "#f0f3f5", // el blanco de la cresta y de la nieve, más frío que el hueso
  niebla: "#b9c3c9", // el gris del vapor, entre el cielo y el blanco
  roca: "#3a3d42", // la piedra oscura y las siluetas a contraluz
  // Y los tres de abajo, con el detalle de #838. Son TONOS INTERMEDIOS de tres
  // pigmentos que ya estaban, y solo existen porque la celda del lienzo bajó a
  // la mitad: a 48 x 32 no había sitio para una transición y un tono más era
  // ruido; a 96 x 64 una ladera cabe en dos tonos y sin ellos se lee como un
  // recorte de cartulina. Ojo con la frontera: esto es PINTURA, donde una masa
  // puede tener luz y sombra, y NO la piel del casco, que sigue siendo de paleta
  // corta y sin degradados por contrato. Tres tonos no son un degradado.
  azulMedio: "#2f5f86", // el cuerpo del agua, entre el fondo y el cielo
  bermellonSombra: "#7a2a1e", // la ladera del cono que no da al sol
  nieblaClara: "#d2d9dd", // el vapor de arriba, donde la luz lo atraviesa
});

/**
 * Fichas de la mesa de minijuegos (#308). Pixel, no grabado: la pila se repinta
 * en cuanto alguien apuesta.
 *
 * El valor de una ficha NO viaja solo en su color —eso lo hace el número de
 * cuñas del canto, que se cuenta sin distinguir tonos—, así que estos colores
 * acompañan a la forma igual que en `SISTEMA`. Lo que sí tiene que cumplirse es
 * que la ficha se despegue del tapete y del disco claro de su cara, y eso lo
 * vigila `paleta.test.mjs`.
 *
 * `tapete` está aquí, y no solo en el CSS, porque es el fondo contra el que se
 * mide todo lo anterior: una comprobación de contraste contra un valor que vive
 * en otro archivo no es una comprobación.
 */
/**
 * Fichas de la mesa de minijuegos (#308). Pixel, no grabado: la pila se repinta
 * en cuanto alguien apuesta.
 *
 * El valor de una ficha NO viaja solo en su color —eso lo hace el número de
 * cuñas del canto, que se cuenta sin distinguir tonos—, así que estos colores
 * acompañan a la forma igual que en `SISTEMA`. Lo que sí tiene que cumplirse es
 * que la ficha se despegue del tapete y del disco claro de su cara, y eso lo
 * vigila `paleta.test.mjs`.
 *
 * `tapete` está aquí, y no solo en el CSS, porque es el fondo contra el que se
 * mide todo lo anterior: una comprobación de contraste contra un valor que vive
 * en otro archivo no es una comprobación.
 */
export const FICHA = Object.freeze({
  tapete: "#0f3d2a", // fieltro de la mesa
  canto: CREMA, // cuñas y cara de la ficha: el mismo crema del resto del arte
  // Un color por denominación, de menor a mayor. Son los tonos de una mesa
  // real (blanco-azul, rojo, verde, azul, púrpura) menos el negro del 100:
  // sobre fieltro oscuro una ficha negra desaparece, y aquí la ficha tiene que
  // verse antes de leerse.
  valores: Object.freeze({
    1: "#5a6b8c",
    5: PIXEL.rojo,
    25: "#2f9e5a",
    100: "#3a86ff",
    500: "#9d4edd",
  }),
});

/**
 * Qué lenguaje toca. Se responde con una pregunta y no con una lista de
 * superficies, para que valga también para la superficie que aún no existe.
 *
 * @param {boolean} seRepintaConTelemetria ¿el dibujo cambia cuando cambia el
 *   estado de la nave, o es un marco que se queda quieto?
 */
export function lenguajePara(seRepintaConTelemetria) {
  return seRepintaConTelemetria ? "pixel" : "grabado";
}

// ---- Contraste -------------------------------------------------------------

/** Canales 0–1 de un color `#rgb` o `#rrggbb`. `null` si no es hexadecimal. */
export function canales(color) {
  if (typeof color !== "string") return null;
  const crudo = color.trim().replace(/^#/, "");
  const hex =
    crudo.length === 3
      ? [...crudo].map((c) => c + c).join("")
      : crudo.length === 6
        ? crudo
        : null;
  if (!hex || !/^[0-9a-fA-F]{6}$/.test(hex)) return null;
  return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
}

/**
 * Luminancia relativa de WCAG 2.x. No es el promedio de los canales: el ojo
 * pesa mucho más el verde que el azul, y usar un promedio daría por legibles
 * combinaciones que no lo son.
 */
export function luminancia(color) {
  const rgb = canales(color);
  if (!rgb) return null;
  const [r, g, b] = rgb.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Razón de contraste entre dos colores, de 1 (idénticos) a 21 (negro sobre
 * blanco). WCAG 1.4.3 pide 4.5 para texto normal y 3 para texto grande o para
 * los elementos gráficos que portan información (1.4.11).
 */
export function contraste(a, b) {
  const la = luminancia(a);
  const lb = luminancia(b);
  if (la === null || lb === null) return null;
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
