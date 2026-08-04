/**
 * Espaciokoop Lagunak — módulo de integración Foundry VTT (issue #8).
 *
 * Muestra al director de juego el estado en vivo de la nave simulada,
 * consultando el puente de integración (contrato v0) por polling. El GM
 * dispone además de órdenes cerradas y tipadas como pausa/reanudación.
 *
 * Compatibilidad v11–v13 (issue #7: la mesa hostea con versiones mixtas —
 * v11.302 en un lado, más moderna en otro; en Foundry solo cuenta la
 * versión del ANFITRIÓN, los jugadores entran por navegador). La ventana
 * moderna `ApplicationV2` (v12+) se conserva EXACTAMENTE como estaba —
 * misma clase, mismas opciones, mismo ciclo de vida y misma salida — y es
 * la que se usa cuando el host la ofrece; para v11, donde
 * `foundry.applications.api` no existe, se usa una ventana `Application`
 * clásica equivalente y AISLADA (sin código compartido con la ruta v12+,
 * para no poder afectarla). Las cuatro factorías de ventana (estado de
 * nave y mapa vivo, V1/V2) viven en sus propios módulos
 * (estado-nave-app-v2.mjs, estado-nave-app-v1.mjs, mapa-vivo-app-v2.mjs,
 * mapa-vivo-app-v1.mjs); este archivo solo orquesta settings, hooks,
 * scene controls y la apertura/revocación de esas ventanas.
 *
 * Seguridad: la URL es un ajuste de ámbito "client"; el token del puente vive
 * solo en memoria durante la sesión del navegador GM. Nunca entra en la base
 * de datos del mundo, localStorage, sockets, Journal o logs.
 * El token Bearer es la autoridad del puente; `game.user.isGM` protege la UI,
 * pero el navegador no puede acreditar por sí solo un rol ante el servidor.
 */

import {
  clearLegacyBridgeToken,
  getBridgeToken,
  openBridgeTokenApp,
  registerBridgeTokenFeature,
  revokeBridgeTokenAccess,
} from "./bridge-token-session.mjs";
import { probarConexion } from "./diagnostico-conexion.mjs";
import { MOTIVOS, planificarFichas } from "./ficha-nave-aplicacion.mjs";
import { addStationControl, refrescarPuestos, registerStationFeature } from "./station-ui.mjs";
import { MINIMO_POR_DEFECTO } from "./requisitos-puesto.mjs";
import {
  addWorkspaceControl,
  openWorkspaceApp,
  registerWorkspaceFeature,
  revokeWorkspaceAccess,
} from "./station-workspace-ui.mjs";
import { registerStationOrders } from "./station-order-wiring.mjs";
import { registrarAsistencia } from "./asistencia-wiring.mjs";
import {
  abrirMesa,
  estadoPublicoVigente,
  pedirVista,
  proponerAccion,
  registrarAjustesMinijuegos,
  registrarSesionesMinijuegos,
} from "./minijuegos-wiring.mjs";
import {
  crearClaseMesaV1,
  crearClaseMesaV2,
  recordarVista,
  vistaRecordada,
} from "./minijuegos/mesa-poker-app.mjs";
import { sesionAgotada } from "./minijuegos/sesion-motor.mjs";
import { crearClaseCantinaV1, crearClaseCantinaV2 } from "./cantina-app.mjs";
import { puertaPorId } from "./cantina.mjs";
import { crearClaseSeccionV1, crearClaseSeccionV2 } from "./seccion-nave-app.mjs";
import { crearClaseAndarV1, crearClaseAndarV2 } from "./andar-nave-app.mjs";
import { salaDePuesto } from "./seccion-nave.mjs";
import { registrarPreset as registrarPresetBaraja } from "./minijuegos/baraja-preset.mjs";
import {
  crearClaseMesaDadosV1,
  crearClaseMesaDadosV2,
  recordarVista as recordarVistaDados,
} from "./minijuegos/mesa-dados-app.mjs";
import { registrarAjusteAlerta, registrarEscuchaAlerta } from "./alerta-escena.mjs";
import { AJUSTE_TELEMETRIA } from "./telemetria-difusion.mjs";
import {
  IDIOMA_AUTOMATICO,
  crearAplicadorIdioma,
  opcionesIdioma,
  rutaIdioma,
} from "./idioma-modulo.mjs";
import { crearClaseV2 } from "./estado-nave-app-v2.mjs";
import { crearClaseV1 } from "./estado-nave-app-v1.mjs";
import { crearClaseMapaV2 } from "./mapa-vivo-app-v2.mjs";
import { crearClaseMapaV1 } from "./mapa-vivo-app-v1.mjs";
import {
  MODULE_ID,
  POLL_MIN_S,
  POLL_MAX_S,
  MAPA_SEMILLA_DEFECTO,
} from "./lagunak-constantes.mjs";
import {
  AJUSTE_MUSICA,
  descripcionMando,
  normalizarMando,
  publicarOrdenMusica,
  registrarAjusteMusica,
  registrarEscuchaMusica,
  registroEfectivo,
  siguienteOrden,
} from "./musica-mando.mjs";
import { crearReproductor } from "./musica-reproductor.mjs";

registerStationFeature(MODULE_ID);
registerWorkspaceFeature(MODULE_ID);
registerBridgeTokenFeature(MODULE_ID);

let estadoApp = null;
let mapaApp = null;

Hooks.once("init", () => {
  // La baraja de la nave, disponible como preset de cartas de Foundry (#340).
  // Es un regalo a la mesa, no parte del póker: el motor propio sigue siendo el
  // que reparte, con su barajado sembrado y su coordinador único.
  registrarPresetBaraja();

  // Idioma propio del módulo. Ajuste de CLIENTE: en qué idioma lee cada cual no
  // es una decisión de la partida, es suya, y dos personas de la misma mesa
  // pueden leer la misma consola en idiomas distintos sin dejar de ver lo mismo.
  // «Automático» sigue a Foundry, que es el comportamiento de siempre.
  game.settings.register(MODULE_ID, AJUSTE_IDIOMA, {
    name: "LAGUNAK.Ajustes.Idioma.Nombre",
    hint: "LAGUNAK.Ajustes.Idioma.Pista",
    scope: "client",
    config: true,
    type: String,
    choices: opcionesIdioma(
      game.modules?.get?.(MODULE_ID)?.languages ?? [],
      "LAGUNAK.Ajustes.Idioma.Automatico",
    ),
    default: IDIOMA_AUTOMATICO,
    // Cambiar el idioma es una acción explícita: si algo va mal, se dice.
    onChange: () => void aplicarIdiomaModulo({ avisar: true }),
  });

  game.settings.register(MODULE_ID, "bridgeUrl", {
    name: "LAGUNAK.Ajustes.Url.Nombre",
    hint: "LAGUNAK.Ajustes.Url.Pista",
    scope: "client",
    config: true,
    type: String,
    default: "http://localhost:8090",
  });

  game.settings.register(MODULE_ID, "bridgeToken", {
    name: "LAGUNAK.Ajustes.Token.Nombre",
    hint: "LAGUNAK.Ajustes.Token.Pista",
    scope: "client",
    config: false,
    type: String,
    default: "",
  });

  game.settings.register(MODULE_ID, "pollSeconds", {
    name: "LAGUNAK.Ajustes.Intervalo.Nombre",
    hint: "LAGUNAK.Ajustes.Intervalo.Pista",
    scope: "client",
    config: true,
    type: Number,
    range: { min: POLL_MIN_S, max: POLL_MAX_S, step: 1 },
    default: 2,
  });

  // Semilla del decorado de fondo del mapa vivo (issue #215, mejora pedida en
  // review): ajuste de MUNDO para que todos vean el mismo cielo. El GM puede
  // escribir un valor concreto aquí, o usar el botón "nuevo decorado
  // aleatorio" de los controles de escena (regenerarDecoradoAleatorio), que
  // guarda un valor al azar en este mismo ajuste.
  // Nivel de alerta vigente (verde/amarilla/roja). Ajuste de MUNDO: lo escribe
  // el GM y lo leen todos, así que un jugador que entra tarde ve la alerta en
  // curso sin esperar al siguiente sondeo del GM.
  registrarAjusteAlerta(MODULE_ID);

  game.settings.register(MODULE_ID, "decoradoSemilla", {
    name: "LAGUNAK.Ajustes.DecoradoSemilla.Nombre",
    hint: "LAGUNAK.Ajustes.DecoradoSemilla.Pista",
    scope: "world",
    config: true,
    type: Number,
    default: MAPA_SEMILLA_DEFECTO,
    // Único punto de regeneración del mapa abierto: Foundry lo invoca tanto
    // en el cliente que escribe el ajuste como en el resto al sincronizar el
    // valor de mundo, así que un cambio desde ajustes o desde el botón "nuevo
    // decorado aleatorio" refresca a todos por igual (issue #215 review).
    onChange: (semilla) => mapaApp?.regenerarDecorado?.(semilla),
  });

  // Requisitos de característica por puesto. Ajuste de MUNDO: es una regla de
  // la mesa entera, no una preferencia de cada cual, y tiene que valer igual
  // para quien se autoasigna. APAGADO de serie: quien no lo active no debe
  // notar ninguna diferencia.
  game.settings.register(MODULE_ID, "requisitosPuesto", {
    name: "LAGUNAK.Ajustes.Requisitos.Nombre",
    hint: "LAGUNAK.Ajustes.Requisitos.Pista",
    scope: "world",
    config: true,
    type: Boolean,
    // La ventana de puestos relee los requisitos en cada render: sin esto, una
    // ventana abierta se queda con el estado anterior y miente en las dos
    // direcciones —opciones que parecen permitidas y el guardado rechaza, u
    // opciones deshabilitadas que ya no tendrían por qué estarlo—.
    onChange: () => refrescarPuestos(),
    default: false,
  });
  game.settings.register(MODULE_ID, "requisitosPuestoMinimo", {
    name: "LAGUNAK.Ajustes.RequisitosMinimo.Nombre",
    hint: "LAGUNAK.Ajustes.RequisitosMinimo.Pista",
    scope: "world",
    config: true,
    type: Number,
    range: { min: 3, max: 20, step: 1 },
    onChange: () => refrescarPuestos(),
    default: MINIMO_POR_DEFECTO,
  });

  // Estado público de la mesa de minijuegos (#308). Ajuste de MUNDO porque la
  // mesa es compartida; `config: false` porque no se edita a mano. La sesión
  // viva del coordinador (semilla, mazo, manos) NO se guarda aquí ni en ningún
  // otro sitio persistente: vive solo en memoria del GM que coordina.
  // Telemetría de la nave propia para toda la tripulación (#331). Ajuste de
  // MUNDO porque es el único canal cuya escritura acredita Foundry: solo un GM
  // puede escribirlo, y esa comprobación la hace el servidor. `config: false`:
  // lo escribe el sondeo, no una persona.
  game.settings.register(MODULE_ID, AJUSTE_TELEMETRIA, {
    scope: "world",
    config: false,
    type: Object,
    default: null,
  });

  // Asistencia entre puestos (#309). Las dos son puertas que abre el GM y que
  // por defecto están cerradas, cada una por su motivo.
  //
  // Los enfoques que gastan hechizos o usos de clase mueven recursos de campaña
  // REALES, no efímeros: si esta puerta se abriera sola, un jugador podría
  // quemarse un espacio ayudando sin que en la mesa se hubiera hablado de que
  // eso era una opción. El motor nunca fabrica recursos; como mucho consume los
  // que el personaje ya tiene, y solo si aquí se dijo que sí.
  game.settings.register(MODULE_ID, "asistenciaPermiteRecursos", {
    name: "LAGUNAK.Ajustes.AsistenciaRecursos.Nombre",
    hint: "LAGUNAK.Ajustes.AsistenciaRecursos.Pista",
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
  });
  // Regla de la casa: el 1 y el 20 naturales como pifia y crítico automáticos en
  // pruebas de habilidad. NO es la regla de 5e —ahí solo se aplican a tiradas de
  // ataque— y por eso es opt-in en vez de estar cableada: una mesa que la da por
  // supuesta y otra que no, jugarían dos juegos distintos sin enterarse.
  game.settings.register(MODULE_ID, "asistenciaReglaCasaNatural", {
    name: "LAGUNAK.Ajustes.AsistenciaNatural.Nombre",
    hint: "LAGUNAK.Ajustes.AsistenciaNatural.Pista",
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
  });

  registrarAjustesMinijuegos(MODULE_ID);

  // Mando del GM sobre la música (#347). Ajuste de MUNDO: solo el GM escribe y
  // toda la mesa lo lee, igual que el nivel de alerta.
  registrarAjusteMusica(MODULE_ID);
});

const AJUSTE_IDIOMA = "idioma";

/* Aplica el idioma elegido a los textos del módulo, y solo a ellos.
 *
 * Se fusionan las claves `LAGUNAK.*` del fichero pedido sobre las traducciones
 * vivas, en vez de traducir en cada punto de llamada: así el selector funciona
 * en todo el módulo —incluidos los textos que Foundry localiza por su cuenta,
 * como los títulos de ajustes— sin tocar ni una sola llamada a `localize`.
 *
 * El filtro por prefijo no es decorativo: sin él, este ajuste podría pisar
 * traducciones del core o de otros módulos, que es exactamente lo que un
 * selector propio NO debe hacer.
 */
// Aplicador del idioma del módulo. La lógica —incluida la guarda contra
// respuestas obsoletas— vive en `idioma-modulo.mjs` y se prueba en Node; aquí
// solo se le dan los cables de Foundry.
const aplicadorIdioma = crearAplicadorIdioma({
  leerEstado: () => ({
    pedido: game.settings.get(MODULE_ID, AJUSTE_IDIOMA),
    idiomaFoundry: game.i18n?.lang,
    // `languages` es una Collection de Foundry, no un array: se normaliza para
    // no depender de qué métodos traiga esa clase en cada versión.
    idiomas: [...(game.modules?.get?.(MODULE_ID)?.languages ?? [])],
  }),
  cargar: async (ruta) => {
    const respuesta = await fetch(rutaIdioma(ruta, MODULE_ID));
    if (!respuesta.ok) throw new Error(String(respuesta.status));
    return respuesta.json();
  },
  fusionar: (traducciones) =>
    foundry.utils.mergeObject(game.i18n.translations, foundry.utils.expandObject(traducciones)),
  refrescar: () => {
    // Las ventanas abiertas ya tienen texto pintado: se reconstruyen para que el
    // cambio se vea al instante y no en la próxima recarga.
    for (const app of Object.values(ui.windows ?? {})) app.render?.(false);
    for (const app of foundry.applications?.instances?.values?.() ?? []) app.render?.();
  },
  alAplicar: ({ idioma, textos }) =>
    console.log(`[lagunak] idioma "${idioma}": ${textos} textos aplicados`),
  alFallar: (motivo, datos) => {
    if (motivo === "obsoleto") return; // llegó tarde: se descarta y ya está
    console.warn(`[lagunak] idioma del módulo (${motivo})`, datos);
    if (motivo === "no_cargado" && datos?.avisar) {
      ui.notifications?.warn(game.i18n.localize("LAGUNAK.Ajustes.Idioma.NoCargado"));
    }
  },
});

function aplicarIdiomaModulo(opciones) {
  return aplicadorIdioma(opciones);
}

Hooks.once("ready", () => {
  // Antes que nada visible: si el cliente pidió otro idioma para el módulo, se
  // aplica antes de que se abra ninguna ventana.
  void aplicarIdiomaModulo();
  // Migración de #183: no se lee el valor legado; se sobrescribe con vacío.
  // El token operativo vive exclusivamente en bridge-token-session.mjs.
  void clearLegacyBridgeToken();
  // Nivel de alerta de la nave: TODOS los clientes escuchan, porque la alerta
  // es información de ambiente que la tripulación conocería de sobra. Solo el
  // GM la publica, desde el estado que solo él recibe.
  registrarEscuchaAlerta(MODULE_ID);
  // Relé de órdenes por puesto (#236): el GM registra el manejador del socket;
  // en clientes de tripulación es no-op (solo emiten).
  registerStationOrders(MODULE_ID);
  // Asistencia entre puestos (#309): el GM coordina las peticiones que llegan por
  // updateUser; cualquier cliente escucha la respuesta dirigida a él. Va DESPUÉS
  // del relé y no antes: la ayuda se cobra dentro de la orden del titular, así
  // que sin relé no habría dónde cobrarla.
  registrarAsistencia(MODULE_ID);
  // Sesiones de minijuegos (#308): el GM coordinador recoge las propuestas por
  // updateUser; cualquier cliente escucha las vistas privadas dirigidas a él.
  registrarSesionesMinijuegos(MODULE_ID);
  // La ventana de la mesa se refresca con lo que llega dirigido a este cliente:
  // la vista y las acciones que el coordinador le concede. Se guarda aunque la
  // ventana esté cerrada, para que al abrirla la mesa ya esté puesta.
  // Las dos ventanas guardan lo que llega: cuál está abierta depende de a qué
  // se juegue, y la vista dice a qué se juega. Guardarlo en las dos es más
  // barato que decidir aquí, y evita el fallo de abrir la mesa de dados con lo
  // último que se recordó de una partida de póker.
  Hooks.on("lagunakMinijuegoVistaPrivada", (vista, acciones) => {
    recordarVista(vista, acciones);
    recordarVistaDados(vista, acciones);
    refrescarMesa();
    // Sentarse desde la cantina se resuelve AQUÍ y no al pulsar la puerta: al
    // pulsarla puede que la mesa ni exista todavía —`abrirMesa` publica con un
    // `settings.set` asíncrono— y proponer contra una mesa que aún no está
    // publicada se rechaza por «esa mesa ya no existe». Se espera a la primera
    // vista, que es cuando el coordinador ya reparte acciones de verdad.
    // Y solo se propone si la mesa ESTÁ PUBLICADA. La primera vista puede
    // llegar antes de que `settings.set` haya terminado —es asíncrono— y
    // proponer contra un ajuste todavía vacío se rechaza con «esa mesa ya no
    // existe», que es exactamente lo que se veía al pulsar Sentarse. Si aún no
    // está, la intención se conserva para la vista siguiente en vez de gastarse.
    if (sentarsePendiente && acciones?.includes?.("join") && estadoPublicoVigente()) {
      sentarsePendiente = false;
      proponerAccion({ tipo: "join" });
    }
  });
  // Un rechazo tiene que verse: sin esto es indistinguible de un botón que no
  // funciona, que es exactamente lo que parece desde el otro lado.
  Hooks.on("lagunakMinijuegoPropuestaRechazada", (codigo) => {
    ui.notifications?.warn(
      game.i18n.format("LAGUNAK.Minijuegos.Mesa.Rechazada", {
        motivo: game.i18n.localize(`LAGUNAK.Minijuegos.Rechazo.${codigo ?? "desconocido"}`),
      }),
    );
  });
  // Se pide el reparto en cuanto este cliente está listo: el empujón del
  // coordinador al conectarse llega antes de que haya nadie escuchando.
  pedirVista();
  conectarMusica();
});

/* Mesa de minijuegos (#308): una sola ventana por cliente. El GM que la abre
 * crea la mesa si no había ninguna; el resto se une a la que ya existe. */
let mesaApp = null;

function refrescarMesa() {
  if (!mesaApp?.rendered) return;
  mesaApp.render(foundry.applications?.api?.ApplicationV2 ? {} : false);
}

/** A qué se juega en la mesa viva. Lo dice ella misma en su estado público. */
function juegoDeLaMesa() {
  return estadoPublicoVigente()?.juego ?? null;
}

function claseMesa(nombreJuego) {
  const esV2 = Boolean(foundry.applications?.api?.ApplicationV2);
  const inyeccion = {
    proponer: (accion) => proponerAccion(accion),
    // Solo se suelta la referencia si sigue siendo ESTA instancia: entre cerrar
    // una ventana y abrir la siguiente puede haberse creado ya otra, y ponerla
    // a null a ciegas dejaría huérfana la que está en pantalla.
    alCerrar: (app) => {
      if (mesaApp === app) mesaApp = null;
    },
  };
  if (nombreJuego === "dados") {
    return esV2 ? crearClaseMesaDadosV2(inyeccion) : crearClaseMesaDadosV1(inyeccion);
  }
  return esV2 ? crearClaseMesaV2(inyeccion) : crearClaseMesaV1(inyeccion);
}

/* Quien cruzó la puerta pidiendo asiento. Es una intención, no un estado de la
 * mesa: se consume con la primera vista que ofrezca `join` y se olvida. */
let sentarsePendiente = false;

function abrirMesaMinijuegos(idPuerta = "poker", { sentarse = false } = {}) {
  // La puerta manda, y una que no esté en el catálogo no abre nada. Caer al
  // póker "por si acaso" sería peor que no hacer nada: abriría una mesa que
  // nadie ha pedido, y taparía justo el error que hay que ver — una puerta
  // añadida al catálogo sin su mesa detrás.
  const puerta = puertaPorId(idPuerta);
  if (!puerta) {
    console.warn(`${MODULE_ID} | puerta de cantina desconocida: ${idPuerta}`);
    return;
  }
  const nombreJuego = puerta.juego;
  // Se apunta antes de abrir: la vista que resuelve la intención puede llegar
  // durante la propia apertura.
  sentarsePendiente = Boolean(sentarse);


  // Si aún no ha llegado ninguna vista dirigida, se arranca con el estado
  // público, que es un ajuste de mundo y lo lee cualquiera. Sin acciones: los
  // botones los concede el coordinador, y llegarán con la primera vista.
  if (!vistaRecordada().vista) {
    recordarVista(estadoPublicoVigente(), []);
    recordarVistaDados(estadoPublicoVigente(), []);
  }
  // Y se vuelve a pedir al abrir: si el reparto del arranque se perdió, esto lo
  // recupera sin recargar la página.
  pedirVista();
  // Abrir la mesa y sentarse son cosas distintas: esto solo pone la mesa (si
  // hace falta y si se puede) y enseña la ventana. Sentarse es una acción más,
  // con su botón, porque el GM puede querer repartir sin jugar.
  // Una mesa TERMINADA cuenta como no haber mesa. Antes bastaba con que
  // existiera un estado publicado para no crear ninguna, y la mano cerrada de
  // la sesión anterior se quedaba ahí para siempre: sin acciones que ofrecer
  // (`accionesPermitidas` devuelve [] en "terminada") y sin forma de arrancar
  // otra. Se entraba a una mesa muerta y no había salida. Con la cantina como
  // puerta única eso pasó de molesto a callejón sin salida.
  //
  // Y con dos verticales esto además DESATASCA cambiar de juego: una mesa de
  // póker terminada ya no impide que la puerta de dados ponga la suya.
  const recienPuesta =
    game.user?.isGM && sesionAgotada(estadoPublicoVigente()) ? abrirMesa({ nombreJuego }) : null;

  // Con una mesa VIVA manda ELLA, no la puerta que se cruzó: abrir la ventana
  // de dados sobre una partida de póker en curso enseñaría una mesa que no
  // existe. Cambiar de juego es cerrar la mesa y poner otra, no cambiar de
  // ventana.
  //
  // Pero la mesa que ACABA de ponerse manda por encima de las dos cosas, y hay
  // que preguntárselo a ella y no al ajuste: `abrirMesa` publica con
  // `settings.set`, que en Foundry es ASÍNCRONO, así que leer el ajuste en la
  // línea siguiente devuelve todavía la partida anterior. Ese era el fallo de
  // «no cambia bien entre minijuegos»: cruzabas la puerta de dados, se creaba
  // la mesa de dados, y se abría la ventana del juego viejo sobre ella.
  const juego = recienPuesta?.juego ?? juegoDeLaMesa() ?? nombreJuego;
  // Si la ventana abierta es la del otro juego, se cierra: solo hay una mesa.
  if (mesaApp && mesaApp.juegoMesa !== juego) {
    mesaApp.close?.();
    mesaApp = null;
  }
  // Instancia nueva en cada apertura tras un cierre: una ApplicationV2 cerrada
  // no se reutiliza —renderizarla otra vez falla— y la ruta v11 se descarta
  // igual para que las dos tengan el mismo contrato.
  if (!mesaApp) {
    mesaApp = new (claseMesa(juego))();
    mesaApp.juegoMesa = juego;
  }
  if (foundry.applications?.api?.ApplicationV2) mesaApp.render({ force: true });
  else mesaApp.render(true);
}

/* Cantina (#423): la puerta única de la barra a las mesas sociales. Una
 * ventana nueva por apertura, igual que la mesa — no hay estado que
 * conservar entre una visita y la siguiente. */
function abrirCantina() {
  const Clase = foundry.applications?.api?.ApplicationV2
    ? crearClaseCantinaV2({ alSeleccionar: abrirMesaMinijuegos })
    : crearClaseCantinaV1({ alSeleccionar: abrirMesaMinijuegos });
  const app = new Clase();
  if (foundry.applications?.api?.ApplicationV2) app.render({ force: true });
  else app.render(true);
}

/* La sección de la nave (#427): el corte con todas las salas a la vez.
 *
 * La ve TODA la mesa, como la cantina. No es la vista agregada de estado —esa
 * sigue siendo del GM y sigue estando bajo su candado—: aquí no hay telemetría
 * de ruta, ni energía, ni mandos. Hay dónde están las salas, cómo de rota está
 * cada una y quién anda por ellas, que es información de estar a bordo.
 *
 * La lectura de daño solo la tiene quien tiene el puente conectado, y por eso
 * un jugador ve el plano SIN LECTURA en vez de un plano falso: la sección no
 * inventa un casco intacto para rellenar el hueco. */
function leerSistemasNave() {
  if (!game.user?.isGM) return [];
  const sistemas = estadoApp?.ultimoEstado?.ship?.systems;
  return Array.isArray(sistemas) ? sistemas : [];
}

/* Quién está dónde. Hoy se deriva del puesto asignado y de nada más: no hay
 * posición propia de tripulante todavía, y un avatar que se mueve es la
 * rebanada siguiente. Quien no tiene puesto no aparece — y eso es correcto, no
 * una carencia: no está en ningún sitio concreto de la nave. */
function leerPresenciasNave() {
  const usuarios = game.users?.contents ?? game.users ?? [];
  return [...usuarios]
    .filter((usuario) => usuario?.active)
    .map((usuario) => ({
      id: usuario.id,
      nombre: usuario.name,
      sala: salaDePuesto(usuario.getFlag?.(MODULE_ID, "station")),
    }))
    .filter((presencia) => presencia.sala);
}

function abrirSeccionNave() {
  const opciones = {
    leerSistemas: leerSistemasNave,
    leerPresencias: leerPresenciasNave,
    alEntrar: ({ destino, sala, puesto }) => {
      // La sección no sabe abrir nada: traduce «entra ahí» a un sitio que ya
      // existe. Hoy la cantina tiene interior y los puestos tienen consola;
      // el resto de salas son de mirar, y por eso ni siquiera ofrecen entrar.
      if (destino === "cantina") abrirCantina();
      else if (destino === "puesto") openWorkspaceApp(puesto);
      else console.warn(`${MODULE_ID} | sala sin vista propia todavía: ${sala}`);
    },
  };
  const Clase = foundry.applications?.api?.ApplicationV2
    ? crearClaseSeccionV2(opciones)
    : crearClaseSeccionV1(opciones);
  const app = new Clase();
  if (foundry.applications?.api?.ApplicationV2) app.render({ force: true });
  else app.render(true);
}

/* Prototipo de "andar por la nave" (#427): una sola instancia, igual que la
 * sección o la cantina — no hay estado que conservar entre una apertura y la
 * siguiente. La ve toda la mesa: no toca autoridad ni información privada,
 * es un banco de pruebas del motor de movimiento sobre una sala inventada. */
let andarApp = null;

function abrirAndarNave() {
  if (andarApp?.rendered) {
    andarApp.render({ force: true });
    return;
  }
  const Clase = foundry.applications?.api?.ApplicationV2 ? crearClaseAndarV2() : crearClaseAndarV1();
  andarApp = new Clase();
  if (foundry.applications?.api?.ApplicationV2) andarApp.render({ force: true });
  else andarApp.render(true);
}

/* Música de a bordo (#347): el GM manda, todos los clientes obedecen.
 *
 * El reproductor se crea aquí pero NO suena hasta que alguien pulsa el botón de
 * audio: los navegadores exigen un gesto del usuario, y saltárselo solo produce
 * una consola llena de avisos y una mesa en silencio sin saber por qué. */
let reproductorMusica = null;

/** Nivel de alerta vigente, si la función está instalada (#338). */
function nivelAlertaVigente() {
  try {
    const aviso = game.settings.get(MODULE_ID, "nivelAlertaNave");
    return typeof aviso === "string" ? aviso : (aviso?.nivel ?? "verde");
  } catch {
    // El ajuste de alerta puede no existir en este mundo: la música en
    // automático se queda en el registro de cotidianidad y no falla.
    return "verde";
  }
}

function conectarMusica() {
  const Contexto = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  if (!Contexto) return; // Navegador sin Web Audio: el resto del módulo sigue igual.
  reproductorMusica = crearReproductor({
    contexto: new Contexto(),
    // La semilla de mundo hace que toda la mesa sintetice exactamente la misma
    // música sin enviar ni un byte de audio por la red.
    semilla: String(game.settings.get(MODULE_ID, "decoradoSemilla") ?? "lagunak"),
  });
  registrarEscuchaMusica(MODULE_ID, {
    nivelAlerta: nivelAlertaVigente,
    alCambiar: (registro) => reproductorMusica?.poner(registro),
  });
}

/** Botón del GM: un clic avanza el ciclo y anuncia qué suena ahora. */
async function ciclarMusica() {
  if (!game.user?.isGM) return;
  const actual = normalizarMando(game.settings.get(MODULE_ID, AJUSTE_MUSICA));
  const mando = await publicarOrdenMusica({ moduleId: MODULE_ID, orden: siguienteOrden(actual) });
  const { clave, registro } = descripcionMando(mando, nivelAlertaVigente());
  const nombre = registro ? game.i18n.localize(`LAGUNAK.Musica.Registro.${registro}`) : "";
  const etiqueta = game.i18n.localize(clave);
  ui.notifications?.info(nombre && etiqueta !== nombre ? `${etiqueta} · ${nombre}` : etiqueta);
}

/** Botón de todos: habilita el audio en ESTE cliente, o lo calla. */
async function alternarAudioLocal() {
  if (!reproductorMusica) return;
  if (!reproductorMusica.habilitado) {
    // Se reaplica el mando vigente: quien cortó el audio y vuelve a activarlo
    // debe engancharse a lo que la mesa está oyendo, no esperar a la próxima
    // orden del GM.
    const mando = normalizarMando(game.settings.get(MODULE_ID, AJUSTE_MUSICA));
    reproductorMusica.poner(registroEfectivo(mando, nivelAlertaVigente()));
    await reproductorMusica.habilitar();
    ui.notifications?.info(game.i18n.localize("LAGUNAK.Musica.AudioActivado"));
    return;
  }
  reproductorMusica.detener();
  ui.notifications?.info(game.i18n.localize("LAGUNAK.Musica.AudioCortado"));
}

Hooks.on("updateUser", (user, changes) => {
  if (user?.id !== game.user?.id) return;
  // Solo un cambio de ROL rearma el relé y revoca privilegios. Cualquier otro
  // updateUser del propio usuario (cambiar de puesto escribe un flag) pasaba
  // por aquí y a un no-GM le revocaba y cerraba sus consolas en plena sesión:
  // ventana en blanco hasta recargar (#263). Las propuestas de minijuegos, que
  // también viajan por updateUser, tienen su propio oyente en
  // minijuegos-wiring.mjs y no pasan por aquí.
  if (!("role" in (changes ?? {}))) return;
  // El GM entrante gana el manejador, el saliente lo pierde
  // (registerStationOrders comprueba isGM).
  registerStationOrders(MODULE_ID);
  // Mismo relevo para la asistencia: el coordinador es el GM activo, y si cambia
  // sin recargar, el nuevo tiene que quedarse escuchando las peticiones.
  registrarAsistencia(MODULE_ID);
  registrarSesionesMinijuegos(MODULE_ID);
  if (!user.isGM) void revokePrivilegedBridgeAccess();
});

function wipePrivilegedWindow(app) {
  const root = app?.element?.[0] ?? app?.element;
  root?.replaceChildren?.();
}

async function revokePrivilegedApp(app) {
  if (!app) return;
  app.bridgeAccessRevoked = true;
  app.ultimoEstado = null;
  app.contactos = [];
  app.destino = null;
  wipePrivilegedWindow(app);
  try {
    await app.close();
  } catch {
    // La frontera ya está revocada y el DOM vacío aunque Foundry no cierre.
  }
}

async function revokePrivilegedBridgeAccess() {
  await Promise.allSettled([
    revokeBridgeTokenAccess(),
    revokeWorkspaceAccess(),
    revokePrivilegedApp(estadoApp),
    revokePrivilegedApp(mapaApp),
  ]);
}

/* Grupo PROPIO en los controles de escena, con icono de nave, solo GM
 * (issue #125: las herramientas del módulo no se mezclan con Token Controls).
 * Rama v11/v12: array de grupos con `tools` array; rama v13: record de grupos
 * con `tools` record. En ambas, el grupo usa la capa "controls" (existe en
 * todas las versiones soportadas) porque sus herramientas son botones puros:
 * activar el grupo no debe tocar ninguna capa de fichas. */
Hooks.on("getSceneControlButtons", (controls) => {
  const isGM = Boolean(game.user?.isGM);

  // Herramientas solo-GM del grupo (estado, mapa, token, diagnóstico). Los
  // botones de puesto (asignación y consola) los añaden addStationControl y
  // addWorkspaceControl para TODOS los usuarios, más abajo.
  const gmTools = isGM
    ? [
        {
          name: "lagunak-estado",
          title: "LAGUNAK.Controles.AbrirEstado",
          icon: "fa-solid fa-gauge-high",
          button: true,
          onClick: () => abrirEstadoNave(),
        },
        {
          name: "lagunak-mapa",
          title: "LAGUNAK.Controles.AbrirMapa",
          icon: "fa-solid fa-satellite-dish",
          button: true,
          onClick: () => abrirMapaVivo(),
        },
        {
          name: "lagunak-token",
          title: "LAGUNAK.Controles.ConfigurarToken",
          icon: "fa-solid fa-key",
          button: true,
          onClick: () => openBridgeTokenApp(),
        },
        {
          name: "lagunak-diagnostico",
          title: "LAGUNAK.Controles.ProbarConexion",
          icon: "fa-solid fa-stethoscope",
          button: true,
          onClick: () => diagnosticarConexion(),
        },
        {
          name: "lagunak-musica",
          title: "LAGUNAK.Controles.CambiarMusica",
          icon: "fa-solid fa-music",
          button: true,
          onClick: () => ciclarMusica(),
        },
        {
          name: "lagunak-decorado-aleatorio",
          title: "LAGUNAK.Controles.DecoradoAleatorio",
          icon: "fa-solid fa-dice",
          button: true,
          onClick: () => regenerarDecoradoAleatorio(),
        },
        {
          name: "lagunak-ficha-nave",
          title: "LAGUNAK.Controles.FichaNave",
          icon: "fa-solid fa-image-portrait",
          button: true,
          onClick: () => aplicarFichaNave(),
        },
      ]
    : [];

  // El grupo propio es visible para TODOS: los jugadores ven sus botones de
  // puesto aquí, no en Token Controls (issue #125). Solo el GM ve además
  // estado/mapa/token/diagnóstico. activeTool apunta a una herramienta que
  // exista para el rol actual.
  const activeTool = isGM ? "lagunak-estado" : "lagunak-puestos";

  // El audio lo habilita CADA cliente por su cuenta: el navegador exige un
  // gesto del usuario y ese gesto no se puede delegar en el GM. Por eso este
  // botón lo ven todos, a diferencia del mando, que es solo del GM.
  const tools = [
    ...gmTools,
    {
      // La cantina la ve todo el mundo: es la capa social, y un minijuego al
      // que solo pudiera entrar el GM no sería un minijuego (#423). Sustituye
      // al botón de mesa suelto por una única puerta; de ahí para dentro
      // decide el catálogo de `cantina.mjs`, no un botón nuevo por mesa. El GM
      // sigue siendo quien CREA la mesa elegida si no hay ninguna abierta; a
      // un jugador la puerta le lleva a la mesa puesta, o al aviso de que
      // todavía no hay ninguna.
      name: "lagunak-cantina",
      title: "LAGUNAK.Controles.AbrirCantina",
      icon: "fa-solid fa-mug-saucer",
      button: true,
      // Los dos verticales entran por AQUÍ. #413 nació con su propio botón de
      // escena porque entonces la alternativa era un menú dentro de la mesa de
      // póker, que habría hecho de los dados un modo del otro juego. La cantina
      // resuelve lo mismo sin gastar barra: elegir a qué se juega sigue siendo
      // lo primero que se decide, solo que en una sala y no en un control.
      onClick: () => abrirCantina(),
    },
    {
      // La sección la ve toda la mesa por la misma razón que la cantina: saber
      // qué forma tiene la nave en la que vives no es información privilegiada
      // (#427). La lectura de daño sí lo es, y por eso a quien no tiene puente
      // el plano le sale sin lectura en vez de mentirle.
      name: "lagunak-seccion",
      title: "LAGUNAK.Controles.AbrirSeccion",
      icon: "fa-solid fa-diagram-project",
      button: true,
      onClick: () => abrirSeccionNave(),
    },
    {
      // Prototipo técnico de #427, visible a toda la mesa: no toca autoridad
      // ni datos privados, es un banco de pruebas del motor de movimiento.
      name: "lagunak-andar-nave",
      title: "LAGUNAK.Controles.AbrirAndarNave",
      icon: "fa-solid fa-person-walking",
      button: true,
      onClick: () => abrirAndarNave(),
    },
    {
      name: "lagunak-musica-audio",
      title: "LAGUNAK.Controles.AudioMusica",
      icon: "fa-solid fa-headphones",
      button: true,
      onClick: () => alternarAudioLocal(),
    },
  ];

  if (Array.isArray(controls)) {
    controls.push({
      name: "lagunak",
      title: "LAGUNAK.Controles.Grupo",
      icon: "fa-solid fa-shuttle-space",
      layer: "controls",
      visible: true,
      activeTool,
      tools,
    });
  } else if (controls && typeof controls === "object") {
    const registro = {};
    tools.forEach((tool, order) => {
      registro[tool.name] = { ...tool, order, onChange: tool.onClick };
    });
    controls.lagunak = {
      name: "lagunak",
      title: "LAGUNAK.Controles.Grupo",
      icon: "fa-solid fa-shuttle-space",
      layer: "controls",
      visible: true,
      activeTool,
      order: Object.keys(controls).length,
      onChange: () => {},
      onToolChange: () => {},
      tools: registro,
    };
  }

  // Botones de puesto para TODOS los usuarios, dentro del grupo propio.
  addStationControl(controls);
  addWorkspaceControl(controls);
});

/* Diagnóstico de conexión (issue #183): comprueba /healthz y después
 * /v1/state con el token configurado, y comunica el resultado con una
 * notificación en el lenguaje del GM. Nunca muestra el token. */
let diagnosticoEnCurso = false;
async function diagnosticarConexion() {
  if (!game.user?.isGM || diagnosticoEnCurso) return;
  diagnosticoEnCurso = true;
  try {
    const token = getBridgeToken();
    const res = await probarConexion({
      url: game.settings.get(MODULE_ID, "bridgeUrl"),
      token,
      canUseToken: () => Boolean(game.user?.isGM) && getBridgeToken() === token,
    });
    if (!game.user?.isGM) return;
    const mensaje = game.i18n.localize(res.claveI18n);
    if (res.exito) ui.notifications.info(mensaje);
    else ui.notifications.warn(mensaje);
  } finally {
    diagnosticoEnCurso = false;
  }
}

/* Nuevo decorado aleatorio (issue #215, mejora pedida en review): el GM puede
 * cambiar el cielo/decorado del mapa vivo a uno nuevo con un clic, en vez de
 * teclear una semilla a mano en los ajustes del módulo. Se guarda como ajuste
 * de MUNDO para que quede igual para todos y sobreviva a recargas; el
 * `onChange` del ajuste (arriba) es el único punto que reconstruye el mapa
 * abierto, así que aquí no se llama a mapaApp directamente: evita
 * regenerarlo dos veces en este mismo cliente y cubre también a los demás. */
async function regenerarDecoradoAleatorio() {
  if (!game.user?.isGM) return;
  const nuevaSemilla = Math.floor(Math.random() * 0x100000000); // 32 bits, mismo rango que rngSemilla
  await game.settings.set(MODULE_ID, "decoradoSemilla", nuevaSemilla);
  ui.notifications.info(
    game.i18n.format("LAGUNAK.Notificaciones.DecoradoRegenerado", { semilla: nuevaSemilla }),
  );
}

/* Arte de ficha para naves narrativas (#354). El GM selecciona en el lienzo los
 * tokens de las naves que quiere ilustrar y pulsa el botón: se genera un PNG
 * por Actor y se escribe en su token PROTOTIPO.
 *
 * El clic es la única vía. No hay hook que regenere la ficha cuando cambia la
 * clase de la nave, ni sondeo que la mantenga «al día», porque eso convertiría
 * un documento persistente del mundo en espejo de un estado efímero — lo que
 * el issue descartó explícitamente al rechazar los tokens de contacto vivos.
 *
 * Se escribe el prototipo y NO los tokens ya colocados: el prototipo es la
 * decisión editorial, mientras que un token colocado puede llevar retoques del
 * GM que no hay por qué pisar. */
async function aplicarFichaNave() {
  const actores = [...new Set((canvas?.tokens?.controlled ?? []).map((t) => t.actor).filter(Boolean))];
  const { ok, motivo, parches } = planificarFichas({ actores, isGM: Boolean(game.user?.isGM) });
  if (!ok) {
    if (motivo === MOTIVOS.sinSeleccion) {
      ui.notifications.warn(game.i18n.localize("LAGUNAK.Ficha.SinSeleccion"));
    }
    return;
  }
  try {
    for (const { actor, datos } of parches) await actor.update(datos);
    ui.notifications.info(
      game.i18n.format("LAGUNAK.Ficha.Hecha", { total: parches.length }),
    );
  } catch (error) {
    // Generar es puro y no falla por su cuenta; lo que puede fallar es la
    // escritura en la base del mundo, y callarlo dejaría al GM creyendo que
    // el token cambió cuando no lo hizo.
    console.error("Espaciokoop Lagunak | no se pudo escribir la ficha de nave", error);
    ui.notifications.error(game.i18n.localize("LAGUNAK.Ficha.Fallo"));
  }
}

/* La pausa de Foundry (game.paused) se muestra como dato informativo en la
 * ventana de estado; este hook solo refresca la vista abierta. NO se propaga
 * en ninguna dirección (decisión de #125, ver docs/FOUNDRY.md). */
Hooks.on("pauseGame", () => {
  if (estadoApp?.rendered) {
    estadoApp.render(foundry.applications?.api?.ApplicationV2 ? {} : false);
  }
});

function abrirEstadoNave() {
  // Candado explícito, no solo el del botón: la vista agregada de la nave es
  // del GM. Mostrarla a un jugador rompería la asimetría de puestos que el
  // reparto de pantallas del juego fragmenta a propósito.
  if (!game.user?.isGM) return;
  if (!estadoApp || estadoApp.bridgeAccessRevoked) estadoApp = new (claseEstadoNave())();
  if (foundry.applications?.api?.ApplicationV2) {
    estadoApp.render({ force: true });
  } else {
    estadoApp.render(true);
  }
}

function abrirMapaVivo() {
  // Mismo candado que el estado de nave: el mapa agrega los contactos de los
  // sensores sin filtrar por puesto — es una vista de GM.
  if (!game.user?.isGM) return;
  if (!mapaApp || mapaApp.bridgeAccessRevoked) mapaApp = new (claseMapaVivo())();
  if (foundry.applications?.api?.ApplicationV2) {
    mapaApp.render({ force: true });
  } else {
    mapaApp.render(true);
  }
}

/**
 * Elige la ventana según lo que ofrezca el ANFITRIÓN: `ApplicationV2`
 * moderna (v12+) o la clásica `Application` (v11). Se construye al primer
 * uso, no al importar, para no tocar `foundry.applications.api` en v11.
 */
function claseEstadoNave() {
  return foundry.applications?.api?.ApplicationV2 ? crearClaseV2() : crearClaseV1();
}

/** Misma regla de selección perezosa para la ventana del mapa vivo. */
function claseMapaVivo() {
  return foundry.applications?.api?.ApplicationV2 ? crearClaseMapaV2() : crearClaseMapaV1();
}
