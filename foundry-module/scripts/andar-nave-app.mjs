/* Ventana de "andar por la nave" (#427). Envuelve
 * `nave-movimiento-lienzo.mjs` (el bucle) sobre `nave-catalogo-andar.mjs`,
 * que cose la nave real que se puede recorrer hoy — cantina, vestíbulo,
 * ingeniería y el pasillo del puente con sus cinco salas de estación (#508)
 * — y traduce teclado en pulsar/soltar/girar.
 *
 * Capa fina, igual que el resto del módulo: no decide colisión, cámara ni a
 * qué estancia lleva una puerta — eso ya lo resolvió el catálogo. Aquí solo
 * se cablea DOM y se reacciona a `alTocarPuerta` llamando a
 * `mando.cambiarEstancia(...)` con lo que el catálogo ya decidió, y a
 * `alAlcanzarInteraccion` traduciendo la `accion` declarada a lo que Foundry
 * sabe hacer, que hoy es abrir el espacio de puesto de una consola (#509) — de
 * nuevo, sin decidir nada que el catálogo o `openWorkspaceApp` no hayan
 * decidido ya. Dos clases hermanas (`Application` v11, `ApplicationV2`
 * v12+), sin código de ventana compartido a propósito.
 */

import { MODULE_ID } from "./lagunak-constantes.mjs";
import { arrancarAndar, RADIO_ANDAR } from "./nave-movimiento-lienzo.mjs";
import { colisiona } from "./nave-movimiento.mjs";
import { estaEnElPlano, modeloMinimapa } from "./nave-minimapa.mjs";
import { pintarMinimapa } from "./nave-minimapa-lienzo.mjs";
import { CATALOGO_ANDAR } from "./nave-catalogo-andar.mjs";
import { puntoDeLlegada, resolverArranque } from "./nave-estancias.mjs";
import { construirMuestra, debeMuestrear, programarMuestra } from "./nave-movimiento-red.mjs";
import { presentesEn } from "./nave-presencia.mjs";
import { avatarDeUsuario } from "./avatar/avatar-assignment.mjs";
import { openWorkspaceApp } from "./station-workspace-ui.mjs";
import { SECCION } from "./paleta.mjs";
import { cartelaDe, piezaPorId } from "./catalogo-piezas.mjs";
import { CATALOGO_MUSEO } from "./museo-piezas.mjs";
import { AJUSTE_TELEMETRIA, aceptarSensores, aceptarTelemetria } from "./ship-view/telemetria-difusion.mjs";
import { AJUSTE_NIVEL_ALERTA } from "./alerta-escena.mjs";

const ESTANCIA_INICIAL = "cantina";

/**
 * El lienzo no tiene fondo propio en CSS ni en la plantilla: sin uno, cada
 * hueco sin geometría —el marco de cualquier puerta, cualquier borde que no
 * llegue a cubrir el pintor— deja el `<canvas>` transparente y se ve el
 * fondo claro del propio diálogo de Foundry por debajo (QA: "un espacio
 * blanco absurdo").
 *
 * `SECCION.mamparo` y NO `SECCION.vacio`: lo que se ve por el hueco de una
 * puerta es más NAVE sin renderizar todavía (la sala vecina no se compone
 * hasta que se cruza), no el espacio exterior — `mamparo` ya es "el relleno
 * entre salas" en la sección 2D (#427) y es justo ese significado. El vacío
 * de verdad solo aparece donde de verdad hay vacío: por una VENTANA
 * (`nave-sala-caja.mjs`, que pinta su propio campo de estrellas encima de
 * este fondo).
 */
const FONDO_ENTRE_SALAS = SECCION.mamparo;

/**
 * Dónde se guarda la posición: flag del propio `User`, client-side, igual
 * que `station` (#237) — es "dónde estoy yo", no un dato de partida que
 * tenga que sobrevivir a que otro GM tome el relevo. Sirve dos propósitos a
 * la vez con la misma escritura: checkpoint para reabrir la ventana Y
 * muestra en vivo que el resto de la tripulación lee para verte moverse
 * (#453) — cualquier cliente puede LEER el `User` de cualquier otro, solo la
 * ESCRITURA está restringida al propio documento (ver cabecera de
 * `nave-movimiento-red.mjs`).
 */
const FLAG_POSICION = "posicionNave";

const PLANTILLA = `modules/${MODULE_ID}/templates/andar-nave.hbs`;

/** La posición guardada, o `null` si no hay ninguna o apunta a una estancia
 *  que ya no existe (p. ej. tras cambiar el catálogo entre sesiones). */
function leerPosicionGuardada() {
  try {
    const guardada = game.user?.getFlag?.(MODULE_ID, FLAG_POSICION);
    // `y` (salto/agachado) se ignora a propósito al RESTAURAR, aunque la
    // muestra en vivo lo incluya: es inercia de un fotograma, no una postura
    // que tenga sentido recuperar al reabrir la ventana — reaparecer a media
    // zancadilla en el aire sería más raro que simplemente reaparecer de pie.
    if (guardada && CATALOGO_ANDAR.tiene(guardada.estancia)) return guardada;
  } catch {
    // Sin ajuste registrado, o sin `game.user` resuelto todavía: se cae al
    // arranque de serie, que es la lectura segura.
  }
  return null;
}

/**
 * Publica la posición actual como muestra en vivo, respetando el throttle
 * de `debeMuestrear` — salvo que `forzar` sea cierto (cruzar una puerta es
 * un evento discreto real, se publica siempre). Devuelve el sello de la
 * última publicación, para que el llamador seleccione el siguiente throttle.
 * Sin esperar la promesa de `setFlag`: es una comodidad de sesión, no una
 * escritura de la que dependa nada más — si falla, el siguiente intento (a
 * lo sumo 150ms después) lo intenta de nuevo.
 */
function publicarPosicion(estanciaId, mando, ultimoSelloEnviado, forzar = false) {
  const ahoraMs = Date.now();
  if (!debeMuestrear({ ahoraMs, ultimoSelloEnviado, cambioDeEstancia: forzar })) {
    return ultimoSelloEnviado;
  }
  const muestra = construirMuestra({ ...mando.posicion(), estancia: estanciaId }, ahoraMs);
  game.user?.setFlag?.(MODULE_ID, FLAG_POSICION, muestra);
  return muestra.sello;
}

/** Tecla física → dirección lógica. WASD y flechas de traslación hacen lo
 *  mismo: cada persona tiene su preferencia y ninguna de las dos es "la
 *  correcta". Girar va aparte, en Q/E, para no pisar ArrowLeft/ArrowRight que
 *  aquí se dejan libres por si alguien los espera para trasladarse también.
 *
 * SIN "Control" PARA AGACHARSE (QA: "crashea al agacharse", investigado con
 * el registro de sucesos de Windows y los volcados de fallo del navegador —
 * ninguno de los dos tenía nada, la señal de que NO era una excepción de
 * JS). Agacharse mientras se avanza es el combo más natural del mundo:
 * mantener W y pulsar Control. Pero Ctrl+W es "cerrar la pestaña" en todo
 * navegador Chromium/Firefox, y es un atajo RESERVADO — ni `preventDefault`
 * ni `stopPropagation` en la página pueden interceptarlo, por diseño de
 * seguridad del navegador (una página no puede impedir que el usuario cierre
 * su propia pestaña). El navegador cierra la ventana antes de que llegue a
 * verse ni un error: eso explica que no quedara nada ni en la consola ni en
 * ningún volcado de fallo. "c" solo, sin ese choque, es la tecla de
 * agacharse que queda. */
export const TECLA_DIRECCION = Object.freeze({
  w: "adelante",
  s: "atras",
  a: "izquierda",
  d: "derecha",
  ArrowUp: "adelante",
  ArrowDown: "atras",
  " ": "saltar",
  c: "agachado",
});

export const TECLA_GIRO = Object.freeze({ q: -1, e: 1, ArrowLeft: -1, ArrowRight: 1 });

/**
 * Teclas que NO son ni dirección ni giro, con lo que hacen.
 *
 * Existe para que el reparto de teclas sea comprobable: `onKeyDown` consulta
 * `TECLA_DIRECCION` primero y hace `return`, así que una tecla repetida aquí
 * queda como CÓDIGO MUERTO en silencio. Pasó de verdad — la cámara se ató a `c`,
 * que ya era agacharse, y no alternaba nada; lo cazó el QA leyendo el commit y no
 * una prueba. `andar-nave-app.test.mjs` compara las tres tablas y falla si un
 * mapa pisa a otro.
 */
export const TECLAS_ACCION = Object.freeze({ v: "camara", V: "camara" });

/**
 * Engancha teclado a un mando de `arrancarAndar`. Vive fuera de las dos
 * clases a propósito, igual que `encenderSala` en `cantina-app.mjs`: es
 * cableado de DOM, no comportamiento de ventana.
 */
function engancharTeclado(raiz, mando) {
  const lienzo = raiz?.querySelector?.(".lagunak-andar-lienzo");
  if (!lienzo) return () => {};

  const girando = new Set();
  const actualizarGiro = () => {
    let sentido = 0;
    for (const s of girando) sentido += s;
    mando.girar(Math.sign(sentido));
  };

  // `stopPropagation` y no solo `preventDefault`: sin ella, la tecla sigue
  // subiendo por el DOM hasta el gestor de atajos GLOBAL de Foundry (o de
  // cualquier módulo que escuche en `document`), que puede reaccionar a la
  // misma tecla esperando un contexto —token seleccionado, escena activa—
  // que este lienzo no tiene. `preventDefault` solo evita la acción por
  // defecto del NAVEGADOR sobre teclas que el navegador deja interceptar; no
  // aísla el evento de otros listeners de la propia página, que es justo lo
  // que este lienzo necesita: sus teclas son suyas mientras tiene el foco, y
  // de nadie más. NO basta contra atajos RESERVADOS del navegador (Ctrl+W
  // cierra la pestaña, Ctrl+T abre una nueva...): esos ni preventDefault ni
  // stopPropagation los paran nunca, por diseño — la única defensa real es
  // no usar esas combinaciones, ver por qué "Control" ya no es tecla de
  // agacharse más abajo.
  const onKeyDown = (ev) => {
    const direccion = TECLA_DIRECCION[ev.key];
    if (direccion) {
      ev.preventDefault();
      ev.stopPropagation();
      mando.pulsar(direccion);
      return;
    }
    const giro = TECLA_GIRO[ev.key];
    if (giro) {
      ev.preventDefault();
      ev.stopPropagation();
      girando.add(giro);
      actualizarGiro();
      return;
    }
    // Punto de vista (QA 2026-08-08). En el flanco de PULSACIÓN y no mantenida:
    // es un interruptor, no una dirección.
    //
    // `V` de vista, y NO `C`: `c` ya es agacharse desde que "Control" se retiró
    // por el cierre de ventana que investigó #446. Peor aún, con `C` esta rama
    // era código MUERTO —`TECLA_DIRECCION` se consulta antes y hace `return`—,
    // así que la cámara no alternaba nada. Lo cazó el QA leyendo el commit, no
    // una prueba: de ahí `TECLAS_RESERVADAS` abajo, para que el próximo choque
    // lo cace la suite.
    if (TECLAS_ACCION[ev.key] === "camara") {
      ev.preventDefault();
      ev.stopPropagation();
      mando.alternarCamara();
    }
  };
  const onKeyUp = (ev) => {
    const direccion = TECLA_DIRECCION[ev.key];
    if (direccion) {
      ev.stopPropagation();
      mando.soltar(direccion);
      return;
    }
    const giro = TECLA_GIRO[ev.key];
    if (giro) {
      ev.stopPropagation();
      girando.delete(giro);
      actualizarGiro();
    }
  };
  // Al perder el foco (Tab fuera, o el usuario cambia de ventana) se sueltan
  // todas las teclas: sin esto, un Alt+Tab con "adelante" pulsado deja al
  // personaje andando solo contra una pared para siempre.
  const onBlur = () => {
    for (const direccion of new Set(Object.values(TECLA_DIRECCION))) mando.soltar(direccion);
    girando.clear();
    mando.girar(0);
  };

  lienzo.tabIndex = 0;
  lienzo.addEventListener("keydown", onKeyDown);
  lienzo.addEventListener("keyup", onKeyUp);
  lienzo.addEventListener("blur", onBlur);
  lienzo.focus();

  return () => {
    lienzo.removeEventListener("keydown", onKeyDown);
    lienzo.removeEventListener("keyup", onKeyUp);
    lienzo.removeEventListener("blur", onBlur);
  };
}

function arrancar(raiz, estanciaPedida = null) {
  const lienzo = raiz?.querySelector?.(".lagunak-andar-lienzo");
  if (!lienzo) return null;

  // Qué manda entre «entra ahí» (#508) y el checkpoint guardado lo decide
  // `resolverArranque`, que es lógica pura del catálogo y está probada aparte.
  const arranque = resolverArranque(CATALOGO_ANDAR, {
    pedida: estanciaPedida,
    guardada: leerPosicionGuardada(),
    porDefecto: ESTANCIA_INICIAL,
  });
  const guardada = arranque.guardada;
  const inicial = CATALOGO_ANDAR.obtener(arranque.estancia);
  // Vive fuera del mando a propósito: `arrancarAndar` sabe de planta/render/
  // posición, pero nunca supo que existen "estancias" con nombre — ese
  // conocimiento es de este archivo y del catálogo, no del bucle.
  let estanciaActual = arranque.estancia;

  /**
   * Rotula en qué sala estás (QA: «no sé en qué sala estoy»).
   *
   * El nombre sale de i18n por id de estancia, y si falta la clave se enseña el
   * id crudo en vez de dejar el rótulo vacío: saber que estás en «warp» es peor
   * que leer «Motor de warp» y muchísimo mejor que no saber nada.
   */
  function rotularSala(estanciaId) {
    pintarSituacion(estanciaId);
    const nodo = raiz?.querySelector?.("[data-andar-sala]");
    if (!nodo) return;
    const clave = ["LAGUNAK", "AndarNave", "Sala", estanciaId].join(".");
    const nombre = game.i18n?.has?.(clave) ? game.i18n.localize(clave) : estanciaId;
    nodo.textContent = game.i18n?.format?.("LAGUNAK.AndarNave.EstasEn", { sala: nombre }) ?? nombre;
  }
  /**
   * Pinta —o retira— la cartela de la pieza que se tiene delante (#598).
   *
   * `textContent` y nunca HTML: el texto viene de un catálogo de datos, y una
   * cartela que interpretara etiquetas sería una superficie de inyección a
   * cambio de nada.
   */
  function pintarCartela(piezaId) {
    const nodo = raiz?.querySelector?.("[data-andar-cartela]");
    if (!nodo) return;
    const pieza = piezaId ? piezaPorId(CATALOGO_MUSEO, piezaId) : null;
    if (!pieza) {
      nodo.hidden = true;
      return;
    }
    const cartela = cartelaDe(pieza, game.i18n?.lang);
    const escribir = (selector, texto) => {
      const destino = nodo.querySelector?.(selector);
      if (destino) destino.textContent = texto;
    };
    escribir("[data-cartela-titulo]", cartela.titulo);
    escribir(
      "[data-cartela-naturaleza]",
      game.i18n?.has?.(cartela.claveNaturaleza)
        ? game.i18n.localize(cartela.claveNaturaleza)
        : "",
    );
    escribir("[data-cartela-texto]", cartela.texto);
    escribir("[data-cartela-credito]", cartela.credito);
    nodo.hidden = false;
  }

  let ultimoSelloEnviado = null;

  // Muestras en vivo de los demás jugadores (#453), acumuladas por
  // `updateUser`.
  const otrosJugadores = new Map();

  /** Quién está aquí y dónde: presencia pura, sin nada de cómo se dibuja
   *  (`nave-presencia.mjs`, revisión externa de Odiseo en #498). Es el
   *  contrato que se expone hacia fuera y el que reutilizaría un indicador
   *  de minimapa, una lista de ocupación o la interacción por proximidad. */
  function presentes() {
    return presentesEn(otrosJugadores, {
      estanciaPropia: estanciaActual,
      miUserId: game.user?.id,
      ahoraMs: Date.now(),
    });
  }

  /** UNA vista de esa presencia: la que pinta avatares. Decora cada
   *  tripulante con el aspecto que eligió (#450, mismo molde que la
   *  cantina) para dárselo a `poligonosOtrosJugadores`
   *  (`nave-avatares-render.mjs`). El avatar entra AQUÍ, en el borde del
   *  render, y no aguas arriba: otra vista de lo mismo (marcador, silueta,
   *  punto en un plano) no tendría por qué arrastrarlo. */
  function jugadoresParaRender() {
    return presentes().map((jugador) => ({
      ...jugador,
      avatar: avatarDeUsuario(game.users?.get?.(jugador.userId), MODULE_ID),
    }));
  }

  /**
   * Minimapa: dónde estás dentro del plano real de la nave.
   *
   * Estando FUERA de la nave (#587: la playa de pruebas) se limpia y no se
   * dibuja nada. Pintar el plano del Phobos sin nadie marcado en él sería peor
   * que no pintarlo: un plano sin «estás aquí» se lee como que el minimapa se ha
   * roto, no como que no estás en la nave.
   */
  function pintarSituacion(estanciaId) {
    const lienzoMapa = raiz?.querySelector?.("[data-andar-minimapa]");
    const ctx = lienzoMapa?.getContext?.("2d");
    if (!ctx) return;
    if (!estaEnElPlano(estanciaId)) {
      ctx.clearRect?.(0, 0, lienzoMapa.width ?? 0, lienzoMapa.height ?? 0);
      return;
    }
    pintarMinimapa(ctx, modeloMinimapa(estanciaId));
  }

  /**
   * Posición de arranque utilizable: la guardada si hoy sigue siendo válida, y la
   * entrada de la estancia si no. Devuelve `{x, z, yaw}` para volcarlo tal cual.
   */
  function arranqueValido(guardadaPosible, estancia) {
    const x = guardadaPosible?.x;
    const z = guardadaPosible?.z;
    const sirve =
      typeof x === "number" && typeof z === "number" &&
      !colisiona(x, z, RADIO_ANDAR, estancia.planta);
    if (sirve) return { x, z, yaw: guardadaPosible?.yaw ?? estancia.entrada.yaw };
    return { x: estancia.entrada.x, z: estancia.entrada.z, yaw: estancia.entrada.yaw };
  }

  /**
   * Lo que se ve por las ventanas (#541): la MISMA lectura degradada que el
   * puente ya difunde a toda la tripulación, la que alimenta el visor del
   * piloto. No abre ningún dato nuevo — un tripulante ve por la ventana lo que
   * ya podía saber— y sin telemetría devuelve `null`, que es lo que baja la
   * persiana en vez de inventar un cielo.
   *
   * Se lee del ajuste en cada fotograma en vez de suscribirse: es una lectura en
   * memoria, y así una telemetría nueva se ve sin coordinar dos relojes.
   */
  function sobreTelemetria() {
    return game.settings?.get?.(MODULE_ID, AJUSTE_TELEMETRIA) ?? null;
  }

  // Rótulo inicial: el resto de llamadas van en los cambios de estancia.
  const mando = arrancarAndar(lienzo, {
    sensores: () => aceptarSensores(sobreTelemetria()),
    rumboNave: () => {
      const ship = aceptarTelemetria(sobreTelemetria());
      return typeof ship?.heading === "number" ? ship.heading : null;
    },
    // La luminaria se tiñe por alerta y parpadea por sistema dañado (#765): la
    // MISMA alerta que ya se difunde a toda la mesa (`alerta-escena.mjs`) y la
    // MISMA telemetría que ya llega por el puente — no se abre ningún dato
    // nuevo, solo se conecta lo que ya circulaba.
    aviso: () => game.settings?.get?.(MODULE_ID, AJUSTE_NIVEL_ALERTA) ?? null,
    saludSistemas: () => aceptarTelemetria(sobreTelemetria())?.systems ?? null,
    componer: inicial.componer,
    planta: inicial.planta,
    puertas: inicial.puertas,
    interacciones: inicial.interacciones,
    // El checkpoint se VALIDA antes de usarse (QA 2026-08-08: «sigue el bug de
    // no poder moverse»). Un flag guardado en una sesión anterior puede caer hoy
    // dentro de un mueble —la cantina cambió de sistema de coordenadas Y de
    // colisión al pasar por la fábrica— y con el punto de partida bloqueado el
    // motor rechaza todos los pasos: no hay error, simplemente no te mueves.
    // Confiar en un dato persistido es confiar en la geometría de ayer.
    ...arranqueValido(guardada, inicial),
    // La costura entre salas: el catálogo ya decidió a qué estancia lleva
    // cada puerta y con qué posición/orientación se llega. Esta ventana solo
    // aplica lo que `puntoDeLlegada` ya resolvió — no vuelve a decidir nada.
    alTocarPuerta: (destino) => {
      const llegada = puntoDeLlegada(CATALOGO_ANDAR, destino);
      if (!llegada) return;
      estanciaActual = llegada.estancia;
      rotularSala(estanciaActual);
      mando.cambiarEstancia(llegada);
      // Se publica AQUÍ y no solo al cerrar/cada 150ms: un refresco de página
      // no debería devolver a quien cruzó una puerta a la estancia de la que
      // salió, y el resto de la tripulación no debería esperar hasta 150ms
      // para saber que alguien cambió de sala.
      ultimoSelloEnviado = publicarPosicion(estanciaActual, mando, ultimoSelloEnviado, true);
    },
    // Qué significa cada punto de interacción se decide AQUÍ y no en el bucle
    // (#582): el lienzo transporta la `accion` declarada por el catálogo y esta
    // ventana la traduce a lo que Foundry sabe hacer. Un tipo nuevo —el punto de
    // pesca de #579, la mesa de #553— se añade a este reparto, sin tocar ni el
    // motor de movimiento ni el de render.
    //
    // #509: acercarse a la consola de un puesto abre su espacio de trabajo —
    // el MISMO que ya se abre por botón (`openWorkspaceApp`, #276). Un
    // atajo, no autoridad nueva: para quien no es GM, `openWorkspaceApp`
    // ignora el `puesto` que se le pasa y abre el propio (#237, ver la
    // cabecera de `station-workspace-ui.mjs`) — caminar hasta una consola
    // ajena no enseña nada que el relé no dejara ver igualmente por botón.
    alAlcanzarInteraccion: ({ accion }) => {
      if (accion?.tipo === "consola") openWorkspaceApp(accion.puesto);
      // La cartela de una pieza de museo (#598). Es LECTURA y nada más: no
      // abre ventana, no marca la pieza como vista y no toca ningún documento.
      // El texto sale del catálogo —que es el dato— y solo el nombre de la
      // naturaleza sale de i18n, que es interfaz.
      else if (accion?.tipo === "cartela") pintarCartela(accion.pieza);
      // Un punto que lleva a otra estancia (#587: la cabina de teléfono de la
      // playa devuelve a la nave). Reusa EXACTAMENTE el camino de una puerta en
      // vez de tener su propio salto: cambiar de estancia ya está resuelto, y
      // dos formas de hacerlo es como se desincronizan el rótulo de sala y la
      // posición publicada.
      else if (accion?.tipo === "estancia") irAEstancia(accion.estancia);
      // Y cualquier otro punto retira la cartela anterior: quedarse puesta al
      // pasar a la pieza de al lado sería atribuirle el texto equivocado.
      else pintarCartela(null);
    },
    // Alejarse la retira (#598). Va por el flanco de SALIDA del bucle y no por
    // un temporizador: una cartela se deja de leer cuando te apartas, no cuando
    // pasan unos segundos.
    alSalirDeInteraccion: () => pintarCartela(null),
    // El de la estancia de ARRANQUE, no el de la nave (#587). Sin esto, abrir
    // directamente en un exterior pintaba su cielo con el gris de entre salas y
    // solo se corregía al cambiar de estancia — que en la playa no pasa nunca,
    // porque se entra por herramienta y no por una puerta.
    fondo: inicial.fondo ?? FONDO_ENTRE_SALAS,
    pedirFotograma: (cb) => globalThis.requestAnimationFrame?.(cb),
    cancelarFotograma: (id) => globalThis.cancelAnimationFrame?.(id),
    // Se evalúa en cada fotograma pintado (#498): el bucle nunca ve un Map,
    // solo la lista ya resuelta de ese instante.
    otrosJugadores: jugadoresParaRender,
  });
  const desenganchar = engancharTeclado(raiz, mando);

  // Publicación periódica mientras la ventana está abierta: `debeMuestrear`
  // hace el throttle real (~150ms), este intervalo solo ofrece la
  // oportunidad de comprobarlo con más frecuencia de la que hace falta
  // publicar, no al revés.
  const intervaloPublicacion = globalThis.setInterval?.(() => {
    ultimoSelloEnviado = publicarPosicion(estanciaActual, mando, ultimoSelloEnviado);
  }, 50);

  // Recepción: cualquier cliente puede leer el `User` de cualquier otro (solo
  // la escritura está restringida al propio documento), así que no hace
  // falta relé del GM — se escucha `updateUser` directamente, mismo patrón
  // de lectura que `station-order-relay.mjs` usa para la identidad del
  // emisor, aplicado aquí a la posición en vez de a una orden.
  const alCambiarUsuario = (userDoc, changes) => {
    if (userDoc?.id === game.user?.id) return; // la propia muestra no se recibe de vuelta
    if (!(FLAG_POSICION in (changes?.flags?.[MODULE_ID] ?? {}))) return; // cambio ajeno a la posición
    const muestra = userDoc?.getFlag?.(MODULE_ID, FLAG_POSICION);
    if (!muestra) return;
    const anterior = otrosJugadores.get(userDoc.id) ?? null;
    otrosJugadores.set(userDoc.id, programarMuestra(anterior, muestra, Date.now()));
  };
  Hooks.on("updateUser", alCambiarUsuario);

  /**
   * Aparecer en otra estancia sin cruzar su puerta (#508).
   *
   * Función declarada —y no un método del objeto de vuelta— porque tiene DOS
   * llamadores y uno de ellos la necesita antes de que ese objeto exista: el
   * reparto de interacciones (#582) se pasa a `arrancarAndar` más arriba. Que
   * los dos pasen por aquí es justo lo que evita que el rótulo de sala y la
   * muestra publicada se desincronicen.
   */
  function irAEstancia(estanciaId) {
    const llegada = puntoDeLlegada(CATALOGO_ANDAR, { estancia: estanciaId });
    if (!llegada) return false;
    estanciaActual = llegada.estancia;
    rotularSala(estanciaActual);
    mando.cambiarEstancia(llegada);
    ultimoSelloEnviado = publicarPosicion(estanciaActual, mando, ultimoSelloEnviado, true);
    return true;
  }

  return {
    /** Quién está aquí y dónde, ya interpolado y filtrado por sala. El
     *  contrato de presencia, DELIBERADAMENTE sin avatar: quien necesite
     *  dibujar decide su propia representación, como hace el pintor de
     *  avatares de esta misma ventana. */
    presentes,
    /**
     * Aparecer en otra estancia sin cruzar su puerta (#508): lo que necesita
     * la sección de la nave cuando se pulsa una sala con la ventana de andar
     * YA abierta. Es exactamente el mismo camino que cruzar una puerta
     * —`puntoDeLlegada` sobre el mismo catálogo, `cambiarEstancia`, y la
     * muestra se publica en el acto— así que el resto de la tripulación te ve
     * cambiar de sala igual que si hubieras llegado andando.
     *
     * Devuelve `false` si esa estancia no existe, en vez de dejar al jugador
     * en un sitio que nadie ha declarado.
     */
    irA: irAEstancia,
    detener() {
      publicarPosicion(estanciaActual, mando, ultimoSelloEnviado, true);
      globalThis.clearInterval?.(intervaloPublicacion);
      Hooks.off("updateUser", alCambiarUsuario);
      desenganchar();
      mando.detener();
    },
  };
}

function contexto() {
  return {};
}

/* ---- v12+ --------------------------------------------------------------- */

export function crearClaseAndarV2() {
  const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

  return class AndarNaveAppV2 extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
      id: "lagunak-andar-nave",
      classes: ["lagunak-andar-nave"],
      window: { title: "LAGUNAK.AndarNave.Titulo", icon: "fa-solid fa-person-walking" },
      // El lienzo interno sigue siendo pequeño a propósito (la resolución baja
      // ES el efecto retro, ver espacios-puesto.css) pero se mostraba a tamaño
      // NATIVO por no tener ni una regla de CSS que lo escalara (QA: "el marco
      // tiene que ser mucho más grande") — la ventana crece para acompañar el
      // lienzo ya escalado ×2 en `lagunak.css`.
      position: { width: 1020, height: "auto" },
    };

    static PARTS = { main: { template: PLANTILLA } };

    async _prepareContext(_options) {
      return contexto();
    }

    /** Adónde entrar en el PRÓXIMO render, si alguien lo ha pedido (#508).
     *  Se consume al usarlo: reabrir la ventana más tarde sin pedir nada debe
     *  volver a donde se quedó, no al último sitio que pidió la sección. */
    estanciaPedida = null;

    /** Con la ventana ya abierta, ir a esa estancia en caliente. */
    irA(estanciaId) {
      if (this.mando) return this.mando.irA(estanciaId);
      this.estanciaPedida = estanciaId;
      return false;
    }

    _onRender(context, options) {
      super._onRender?.(context, options);
      this.mando?.detener();
      const pedida = this.estanciaPedida;
      this.estanciaPedida = null;
      this.mando = arrancar(this.element, pedida);
    }

    _onClose(options) {
      super._onClose?.(options);
      this.mando?.detener();
      this.mando = null;
    }
  };
}

/* ---- v11 ------------------------------------------------------------------ */

export function crearClaseAndarV1() {
  return class AndarNaveAppV1 extends Application {
    static get defaultOptions() {
      return foundry.utils.mergeObject(super.defaultOptions, {
        id: "lagunak-andar-nave",
        classes: ["lagunak-andar-nave"],
        title: game.i18n.localize("LAGUNAK.AndarNave.Titulo"),
        template: PLANTILLA,
        width: 1020,
        height: "auto",
      });
    }

    getData(_options) {
      return contexto();
    }

    /** Ver la gemela v12+: mismo contrato, sin código compartido. */
    estanciaPedida = null;

    irA(estanciaId) {
      if (this.mando) return this.mando.irA(estanciaId);
      this.estanciaPedida = estanciaId;
      return false;
    }

    activateListeners(html) {
      super.activateListeners(html);
      this.mando?.detener();
      const pedida = this.estanciaPedida;
      this.estanciaPedida = null;
      this.mando = arrancar(html?.[0], pedida);
    }

    async close(options) {
      this.mando?.detener();
      this.mando = null;
      return super.close(options);
    }
  };
}
