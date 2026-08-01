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
export const CANTINA = Object.freeze({
  mamparo: "#2b3038", // gris azulado de nave: el fondo no compite con nada
  suelo: "#1d2128", // más oscuro que el mamparo: la sala tiene arriba y abajo
  barra: "#7a4a22", // madera imposible en el espacio, y por eso acogedora
  barraCanto: "#b8763a", // el borde que coge la luz de la lámpara
  lampara: "#ffd79a", // cálida, la única fuente de calor del local
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
  foco: "#ffd79a", // la sala bajo el puntero
  tripulante: "#fdfffc", // un punto por persona; el crema de la nave propia
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
