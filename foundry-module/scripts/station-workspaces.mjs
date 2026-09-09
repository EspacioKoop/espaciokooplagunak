import { STATIONS, normalizeStation, uncrewedStations } from "./station-assignment.mjs";
import { isActionAllowed } from "./station-actions.mjs";
import { SISTEMAS_INGENIERIA, NIVELES_POTENCIA, NIVELES_REFRIGERANTE } from "./ingenieria-control.mjs";
import { prepareDocking, prepareSystemRows } from "./ship-view/ship-view.mjs";
import { filasCrudas, filasDegradadas } from "./sensores-lista.mjs";
import { retratoTripulanteDataUri } from "./avatar/retrato-tripulante.mjs";

// Marca visible de «no hay lectura», distinta de cualquier valor real.
const SIN_DATO = "—";

const DEFINITIONS = Object.freeze({
  captain: Object.freeze({
    icon: "fa-solid fa-chess-king",
    accent: "amber",
    tasks: ["Situacion", "Prioridades", "Coordinacion"],
  }),
  navigation: Object.freeze({
    icon: "fa-solid fa-compass",
    accent: "cyan",
    tasks: ["Rumbo", "Ruta", "Llegada"],
  }),
  engineering: Object.freeze({
    icon: "fa-solid fa-screwdriver-wrench",
    accent: "lime",
    tasks: ["Potencia", "Temperatura", "Reparaciones"],
  }),
  sensors: Object.freeze({
    icon: "fa-solid fa-satellite-dish",
    accent: "violet",
    tasks: ["Barrido", "Identificacion", "Seguimiento"],
  }),
  communications: Object.freeze({
    icon: "fa-solid fa-tower-broadcast",
    accent: "blue",
    tasks: ["Canales", "Mensajes", "Bitacora"],
  }),
  relay: Object.freeze({
    icon: "fa-solid fa-map-location-dot",
    accent: "orange",
    tasks: ["Rutas", "Sondas", "Condicion"],
  }),
  // El acento NO puede repetir el de relay (#517), que ya se quedó el naranja:
  // dos consolas con el mismo color son indistinguibles de reojo, que es
  // justamente para lo que sirve el acento. De ahí el verde azulado.
  damagecontrol: Object.freeze({
    icon: "fa-solid fa-fire-extinguisher",
    accent: "teal",
    tasks: ["Prioridades", "Equipos", "Contencion"],
  }),
  weapons: Object.freeze({
    icon: "fa-solid fa-crosshairs",
    accent: "red",
    tasks: ["Seguridad", "Soluciones", "Confirmacion"],
  }),
});

export const WORKSPACE_STATIONS = STATIONS;

export function workspaceDefinition(station) {
  const normalized = normalizeStation(station);
  return normalized ? DEFINITIONS[normalized] : null;
}

// `previewStation` sigue viva aquí: la sección de la nave (#427) manda al GM
// directo a la consola de un puesto concreto al pulsar su sala
// (`abrirSeccionNave` → `openWorkspaceApp(puesto)`), un salto de UN puesto, no
// el selector de las seis pestañas. ESE selector —el branch `isGM` con
// `tabs`— es el que se migró a la consola caliente (#276, paso 4) y por eso
// ya no vive en `buildWorkspaceModel`.
export function stationForWorkspace({ user, moduleId, previewStation = null }) {
  if (user?.isGM && previewStation) {
    try {
      return normalizeStation(previewStation);
    } catch {
      return "captain";
    }
  }
  const assigned = user?.getFlag?.(moduleId, "station") ?? null;
  if (assigned) return normalizeStation(assigned);
  return user?.isGM ? "captain" : null;
}

function localize(i18n, key) {
  return i18n?.localize?.(key) ?? key;
}

function format(i18n, key, data) {
  if (typeof i18n?.format === "function") return i18n.format(key, data);
  return localize(i18n, key).replace(/\{(\w+)\}/g, (_match, name) => String(data?.[name] ?? ""));
}

const FACTION_KEYS = Object.freeze({
  Independent: "Independent",
  "Human Navy": "HumanNavy",
  Kraylor: "Kraylor",
  Arlenians: "Arlenians",
  Exuari: "Exuari",
  Ghosts: "Ghosts",
  Ktlitans: "Ktlitans",
  TSN: "TSN",
  USN: "USN",
  CUF: "CUF",
});

function localizeFaction(i18n, faction) {
  const key = FACTION_KEYS[faction];
  return localize(i18n, key ? `LAGUNAK.Facciones.${key}` : "LAGUNAK.Facciones.Desconocida");
}

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

/**
 * Lectura numérica, o `null` si está ausente o no es un número finito.
 *
 * `Number.isFinite(Number(x))` NO vale aquí: `Number(null)` y `Number("")` son
 * cero, así que la ausencia de dato se convertía en una lectura real. Ausencia
 * no es cero y por eso se comprueba el tipo antes que el valor. Se admite una
 * cadena numérica porque el puente puede entregarla, pero la vacía no lo es.
 */
function numeroDeLectura(valor) {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;
  if (typeof valor === "string" && valor.trim() !== "") {
    const n = Number(valor);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * "Armada, quedan 42 s" o "desarmada". Sin componente no se escribe nada: la
 * consola no debería hablar de una autodestrucción que esta nave no tiene.
 */
function textoDeAutodestruccion(selfDestruct, i18n) {
  if (!selfDestruct || typeof selfDestruct !== "object") {
    return localize(i18n, "LAGUNAK.Espacios.Orden.AutodestruccionSinLectura");
  }
  if (!selfDestruct.active) return localize(i18n, "LAGUNAK.Espacios.Orden.AutodestruccionDesarmada");
  const countdown = numeroDeLectura(selfDestruct.countdown);
  if (!Number.isFinite(countdown)) {
    return localize(i18n, "LAGUNAK.Espacios.Orden.AutodestruccionArmada");
  }
  return format(i18n, "LAGUNAK.Espacios.Orden.AutodestruccionCuenta", {
    segundos: Math.max(0, Math.round(countdown)),
  });
}

/** Los tres niveles que el puente publica, o `null` si no hay lectura. */
function nivelDeclarado(valor) {
  return valor === "normal" || valor === "yellow" || valor === "red" ? valor : null;
}

function textoDeAlerta(valor, i18n) {
  const nivel = nivelDeclarado(valor);
  if (nivel === null) return localize(i18n, "LAGUNAK.Espacios.Orden.AlertaSinLectura");
  return format(i18n, "LAGUNAK.Espacios.Orden.AlertaActual", {
    nivel: localize(i18n, `LAGUNAK.Espacios.Orden.Alerta.${nivel}`),
  });
}

/**
 * Frecuencia actual y, si está recalibrando, el aviso de que los escudos están
 * caídos mientras dura. Ese aviso es el dato que hace de esto una decisión.
 */
function textoDeFrecuencia(calibracion, i18n) {
  const frecuencia = numeroDeLectura(calibracion?.frequency);
  if (!Number.isFinite(frecuencia)) {
    return localize(i18n, "LAGUNAK.Espacios.Orden.FrecuenciaSinLectura");
  }
  const retardo = numeroDeLectura(calibracion?.calibration_delay);
  if (Number.isFinite(retardo) && retardo > 0) {
    return format(i18n, "LAGUNAK.Espacios.Orden.FrecuenciaCalibrando", {
      frecuencia,
      segundos: Math.max(0, Math.round(retardo)),
    });
  }
  return format(i18n, "LAGUNAK.Espacios.Orden.FrecuenciaActual", { frecuencia });
}

/**
 * Copia la nave quitando cualquier código de autodestrucción. Ver la nota del
 * modelo: la lista de campos que se caen es explícita a propósito, para que
 * añadir uno nuevo al puente sea una decisión y no un descuido.
 */
function sinCodigosDeAutodestruccion(ship) {
  if (!ship || typeof ship !== "object") return ship;
  const autodestruccion = ship.self_destruct;
  if (!autodestruccion || typeof autodestruccion !== "object") return ship;
  const { code, codes, confirmed, ...resto } = autodestruccion;
  return { ...ship, self_destruct: resto };
}

/**
 * "Quedan 3 de 8" o, sin lectura, que no la hay. El máximo va siempre: un
 * número de sondas suelto no dice si son muchas o pocas.
 */
function textoDeSondas(probes, i18n) {
  const stock = numeroDeLectura(probes?.stock);
  const max = numeroDeLectura(probes?.max);
  if (!Number.isFinite(stock) || !Number.isFinite(max)) {
    return localize(i18n, "LAGUNAK.Espacios.Orden.SondasSinLectura");
  }
  return format(i18n, "LAGUNAK.Espacios.Orden.SondasRestantes", { stock, max });
}

/**
 * Cuántas fichas hay, o que no se ha consultado. La diferencia importa: una
 * base de datos vacía es una respuesta, y no haberla pedido no lo es.
 */
function textoDeBaseDatos(base, i18n) {
  if (base === null) return localize(i18n, "LAGUNAK.Espacios.Sensores.BaseDatosSinConsulta");
  if ((base.entradas?.length ?? 0) === 0) {
    return localize(i18n, "LAGUNAK.Espacios.Sensores.BaseDatosVacia");
  }
  return format(i18n, "LAGUNAK.Espacios.Sensores.BaseDatosFichas", {
    total: base.entradas.length,
  });
}

/** Qué sonda está enlazada, o que no hay ninguna. */
function textoDeEnlaceSonda(enlace, i18n) {
  const callsign = typeof enlace?.callsign === "string" && enlace.callsign !== ""
    ? enlace.callsign
    : null;
  if (callsign === null) return localize(i18n, "LAGUNAK.Espacios.Sensores.SinEnlaceSonda");
  return format(i18n, "LAGUNAK.Espacios.Sensores.EnlaceSondaActivo", { sonda: callsign });
}

/**
 * Salas de la planta real, con su sistema ya traducido y un valor serializado
 * para el `<select>` de destino. La casilla que se ofrece es la ESQUINA de la
 * sala: es una casilla real del plano y no un centro calculado que podría caer
 * fuera en salas de tamaño par.
 */
function salasParaPlanta(interior, i18n) {
  const salas = Array.isArray(interior?.rooms) ? interior.rooms : [];
  return salas.map((sala) => ({
    x: sala.x,
    y: sala.y,
    ancho: sala.w,
    alto: sala.h,
    sistema: sala.system,
    etiqueta: sala.system
      ? localize(i18n, `LAGUNAK.Sistemas.${sala.system}`)
      : localize(i18n, "LAGUNAK.Espacios.Reparacion.SalaSinSistema"),
    valor: JSON.stringify({ x: sala.x, y: sala.y }),
  }));
}

/** Equipos con su casilla y, si va a algún sitio, su destino. */
function equiposParaPlanta(interior) {
  const equipos = Array.isArray(interior?.crews) ? interior.crews : [];
  return equipos.map((equipo, indice) => ({
    // El número es solo para nombrarlo en pantalla ("Equipo 1"): la ORDEN va
    // por posición, nunca por este índice, que puede bailar entre sondeos.
    numero: indice + 1,
    x: equipo.position.x,
    y: equipo.position.y,
    valor: JSON.stringify({ x: equipo.position.x, y: equipo.position.y }),
    enMovimiento: equipo.target !== null,
  }));
}

/** Cuántos equipos hay, o que no hay lectura del interior. */
function textoDeInterior(interior, i18n) {
  if (!interior?.rooms?.length) {
    return localize(i18n, "LAGUNAK.Espacios.Reparacion.SinInterior");
  }
  return format(i18n, "LAGUNAK.Espacios.Reparacion.Equipos", {
    total: interior.crews?.length ?? 0,
    salas: interior.rooms.length,
  });
}

function integer(value) {
  return Math.round(finite(value));
}

/**
 * Fracción 0..1 de la telemetría a porcentaje entero, conservando la ausencia
 * (#519). `null` significa "no hay lectura" y 0 significa "la hay, y está
 * a cero"; `percent` conserva la misma distinción al usar un máximo conocido.
 * Para la carga de maniobra esa diferencia es la que separa «no puedes
 * maniobrar» de «no sé si puedes» — y solo la primera es una afirmación que el
 * puesto puede permitirse hacer.
 */
function porcentajeDeLectura(valor) {
  const n = numeroDeLectura(valor);
  if (n === null) return null;
  return Math.max(0, Math.min(100, Math.round(n * 100)));
}

function percent(value, maximum) {
  const max = numeroDeLectura(maximum);
  const n = numeroDeLectura(value);
  if (max === null || max <= 0 || n === null) return null;
  return Math.max(0, Math.min(100, Math.round((n / max) * 100)));
}

function ratioLabel(value, maximum) {
  return `${lecturaEntera(value)} / ${lecturaEntera(maximum)}`;
}

function lecturaEntera(value) {
  const n = numeroDeLectura(value);
  return n === null ? SIN_DATO : String(Math.round(n));
}

function velocity(ship) {
  const x = numeroDeLectura(ship?.velocity?.x);
  const y = numeroDeLectura(ship?.velocity?.y);
  return x === null || y === null ? SIN_DATO : Math.round(Math.hypot(x, y));
}

function metric(i18n, key, value, tone = "normal", progress = null) {
  return {
    label: localize(i18n, `LAGUNAK.Espacios.Metrica.${key}`),
    value,
    tone,
    progress,
    hasProgress: progress !== null,
  };
}

// Promedio de salud sobre los sistemas CON lectura. Si no hay ninguna, el
// promedio no existe (null) en vez de valer cero, que se leería como
// «armamento destruido».
function promedioSalud(rows) {
  const leidos = rows.filter((row) => Number.isFinite(row.health));
  if (leidos.length === 0) return null;
  return Math.round(leidos.reduce((suma, row) => suma + row.health, 0) / leidos.length);
}

function hottestSystem(rows) {
  // Un sistema sin lectura de calor no puede ser el pico térmico: se ignora en
  // vez de competir como si estuviera frío.
  return rows
    .filter((row) => Number.isFinite(row.heat))
    .reduce((current, row) => (!current || row.heat > current.heat ? row : current), null);
}

function metricsFor(station, ship, contactsPayload, i18n, crewCount = 0) {
  const systems = prepareSystemRows(ship, i18n);
  const contacts = Array.isArray(contactsPayload?.contacts) ? contactsPayload.contacts : [];
  const externalContacts = contacts.filter((entry) => !entry?.is_player);
  const hull = percent(ship?.hull, ship?.hull_max);
  const energy = percent(ship?.energy, ship?.energy_max);
  const hot = hottestSystem(systems);
  // Atraque (#391). Sin lectura del puente no se dibuja la fila: «sin atracar»
  // sería una afirmación que nadie ha hecho —el puente publica null tanto si la
  // nave está libre como si el componente no dijo nada— y esta consola no
  // inventa el hueco (#353: ausencia no es cero).
  const atraque = prepareDocking(ship, i18n);

  switch (station) {
    case "captain":
      return [
        // Atracada, el capitán quiere ver dónde está antes que el indicativo de
        // su propia nave, que no ha cambiado desde que empezó la guardia.
        atraque.estado
          ? metric(i18n, "Atraque", atraque.etiqueta, "good")
          : metric(i18n, "Nave", String(ship?.callsign ?? "—")),
        metric(i18n, "Casco", ratioLabel(ship?.hull, ship?.hull_max), hull !== null && hull < 35 ? "danger" : "normal", hull),
        metric(i18n, "Energia", ratioLabel(ship?.energy, ship?.energy_max), energy !== null && energy < 25 ? "danger" : "normal", energy),
        metric(i18n, "Escudos", localize(i18n, ship?.shields_active ? "LAGUNAK.Espacios.Activos" : "LAGUNAK.Espacios.Inactivos"), ship?.shields_active ? "good" : "warning"),
      ];
    case "navigation":
      return [
        metric(i18n, "Rumbo", `${lecturaEntera(ship?.heading)}°`),
        metric(i18n, "Velocidad", format(i18n, "LAGUNAK.Espacios.Valor.Velocidad", { value: velocity(ship) })),
        metric(i18n, "Posicion", `${lecturaEntera(ship?.position?.x)}, ${lecturaEntera(ship?.position?.y)}`),
        ...(atraque.estado
          ? [metric(i18n, "Atraque", atraque.etiqueta, "good")]
          : [metric(i18n, "Destino", String(ship?.destination?.name ?? "—"))]),
      ];
    case "engineering":
      return [
        metric(i18n, "Energia", ratioLabel(ship?.energy, ship?.energy_max), energy !== null && energy < 25 ? "danger" : "normal", energy),
        metric(i18n, "Casco", hull === null ? SIN_DATO : `${hull}%`, hull !== null && hull < 35 ? "danger" : "normal", hull),
        metric(i18n, "Sistemas", String(systems.length)),
        metric(
          i18n,
          "PicoTermico",
          hot ? `${hot.name} · ${hot.heat}%` : SIN_DATO,
          hot?.heat > 80 ? "danger" : "normal",
        ),
      ];
    case "sensors":
      return [
        metric(i18n, "Contactos", String(externalContacts.length)),
        metric(i18n, "TotalSensor", String(integer(contactsPayload?.total ?? contacts.length))),
        metric(i18n, "Cobertura", localize(i18n, "LAGUNAK.Espacios.Valor.Cobertura")),
        metric(i18n, "Truncado", localize(i18n, contactsPayload?.truncated ? "LAGUNAK.Espacios.Si" : "LAGUNAK.Espacios.No"), contactsPayload?.truncated ? "warning" : "good"),
      ];
    case "communications":
      return [
        metric(i18n, "Indicativo", String(ship?.callsign ?? "—")),
        metric(i18n, "Tripulacion", String(crewCount)),
        metric(i18n, "CanalPuente", localize(i18n, "LAGUNAK.Espacios.SoloGM"), "warning"),
        metric(i18n, "Bitacora", localize(i18n, "LAGUNAK.Espacios.Disponible"), "good"),
      ];
    case "weapons": {
      const weaponSystems = systems.filter(({ id }) => id === "beamweapons" || id === "missilesystem");
      const average = weaponSystems.length
        ? promedioSalud(weaponSystems)
        : null;
      return [
        metric(i18n, "Escudos", localize(i18n, ship?.shields_active ? "LAGUNAK.Espacios.Activos" : "LAGUNAK.Espacios.Inactivos"), ship?.shields_active ? "good" : "warning"),
        metric(
          i18n,
          "SistemasArmas",
          average === null ? SIN_DATO : `${average}%`,
          average !== null && average < 40 ? "danger" : "normal",
          average,
        ),
        metric(i18n, "Contactos", String(externalContacts.length)),
        metric(i18n, "Autorizacion", localize(i18n, "LAGUNAK.Espacios.SinOrdenes"), "warning"),
      ];
    }
    default:
      return [];
  }
}

function crewRows(users, moduleId, i18n) {
  return Array.from(users ?? [])
    .filter((user) => !user?.isGM)
    .map((user) => {
      let station = null;
      try {
        station = normalizeStation(user.getFlag?.(moduleId, "station") ?? null);
      } catch {
        station = null;
      }
      return {
        id: user.id,
        name: user.name,
        active: Boolean(user.active),
        station,
        // Ancla visual para reconocer a alguien de un vistazo (#352). Se siembra
        // con el id y no con el nombre para que sobreviva a un renombrado. Es
        // decorativo: la fila sigue diciendo puesto y estado en texto.
        portrait: retratoTripulanteDataUri(user.id, { activo: Boolean(user.active) }),
        stationLabel: station
          ? localize(i18n, `LAGUNAK.Puestos.${station}`)
          : localize(i18n, "LAGUNAK.Puestos.SinAsignar"),
        statusLabel: localize(i18n, user.active ? "LAGUNAK.Espacios.EnLinea" : "LAGUNAK.Puestos.Desconectado"),
      };
    });
}

/**
 * La lista de contactos del puesto. Dos fuentes que NO se mezclan (#331 paso 3):
 * el GM lee su sondeo crudo con coordenadas exactas —es lo que necesita para
 * dirigir— y la tripulación, la lectura degradada por el alcance del radar, con
 * sus márgenes escritos. Fingir que son la misma tabla acabaría enseñándole a
 * alguien un número que no le corresponde.
 */
const MAXIMO_OBJETIVOS_ESCANEO = 8;

/**
 * Objetivos por lectura degradada: un `<option>` por contacto de la MISMA
 * lectura que ya ve la tripulación, nunca del sondeo crudo del GM. Compartido
 * por sensores (#462, "escanear") y armas (#465, "fijar objetivo"/"disparar")
 * porque tienen exactamente el mismo problema: un eco sin escanear no tiene
 * indicativo que el jugador pueda conocer.
 *
 * El VALOR que viaja no es un indicativo —es la doctrina que
 * `contactos-degradados.mjs` protege— sino la propia lectura degradada
 * (distancia/rumbo con su margen). Resolverla al indicativo real es cosa del
 * relé del GM (`resolver-objetivo-sensores.mjs`), que sí tiene el sondeo sin
 * degradar: aquí solo se ofrece lo que el jugador ya sabe, tal cual lo sabe.
 */
function objetivosDeLectura(sensores, i18n, { claveEco, claveIdentificado }) {
  const contactos = Array.isArray(sensores?.contactos) ? sensores.contactos : [];
  return contactos
    .filter((contacto) => !contacto?.esJugador)
    .slice()
    .sort((a, b) => Number(a?.distancia ?? 0) - Number(b?.distancia ?? 0))
    .slice(0, MAXIMO_OBJETIVOS_ESCANEO)
    .map((contacto) => {
      const eco = typeof contacto?.callsign !== "string";
      const distancia = Math.round(Number(contacto?.distancia ?? 0));
      const rumbo = Math.round(Number(contacto?.rumboDeg ?? 0));
      const etiqueta = eco
        ? format(i18n, claveEco, { distancia, rumbo })
        : format(i18n, claveIdentificado, { callsign: contacto.callsign });
      return {
        // JSON, no el indicativo: es exactamente lo que `station-order-forms.mjs`
        // debe leer y reenviar tal cual como parámetros de la orden.
        value: JSON.stringify({
          distancia: contacto.distancia,
          rumboDeg: contacto.rumboDeg,
          precision: contacto.precision ?? 0,
          rumboPrecision: contacto.rumboPrecision ?? 0,
        }),
        label: etiqueta,
      };
    });
}

function scanTargetsFor(sensores, i18n) {
  return objetivosDeLectura(sensores, i18n, {
    claveEco: "LAGUNAK.Espacios.Sensores.EscanearEco",
    claveIdentificado: "LAGUNAK.Espacios.Sensores.EscanearIdentificado",
  });
}

function weaponTargetsFor(sensores, i18n) {
  return objetivosDeLectura(sensores, i18n, {
    claveEco: "LAGUNAK.Espacios.Sensores.EscanearEco",
    claveIdentificado: "LAGUNAK.Espacios.Sensores.EscanearIdentificado",
  });
}

function visibleContacts(contactsPayload, sensores, isGM, i18n) {
  if (isGM) {
    return filasCrudas(contactsPayload, i18n, (faccion) => localizeFaction(i18n, faccion));
  }
  return filasDegradadas(sensores, i18n);
}

/**
 * Puestos que ven la lista de contactos, y con qué lectura.
 *
 * `sensors` y `weapons` es su oficio: cada uno con la fuente que le toca. En
 * `navigation` la lista existe por un motivo distinto —el visor 3D (#362) coloca
 * contactos en un cuadro que va `aria-hidden`, así que la distancia y la
 * marcación TIENEN que seguir en texto o desaparecen para quien no lo ve—, y por
 * eso pilotaje lee siempre lo degradado, también el GM: el visor pinta lo
 * degradado, y una lista de coordenadas exactas al lado no describiría lo que
 * hay en pantalla. Pilotaje no gana con esta lista ni un dato que no tuviera.
 */
function contactosDeConsola(station, contactsPayload, sensores, isGM, i18n) {
  if (station === "navigation") return filasDegradadas(sensores, i18n);
  if (station === "sensors" || station === "weapons") {
    return visibleContacts(contactsPayload, sensores, isGM, i18n);
  }
  return [];
}

export function buildWorkspaceModel({
  station,
  isGM,
  sensores = null,
  // Lectura degradada centrada en la sonda enlazada (#520). Es la MISMA
  // degradación con otro centro, no un dato nuevo. `null` cuando no hay sonda.
  sensoresSonda = null,
  // Payload ya normalizado de `/v1/database` (#520). `null` significa "no se ha
  // consultado", que no es lo mismo que una base de datos vacía.
  baseDatos = null,
  users,
  moduleId,
  i18n,
  statePayload = null,
  contactsPayload = null,
  connection = "restricted",
  error = "",
}) {
  const normalized = normalizeStation(station);
  const definition = normalized ? DEFINITIONS[normalized] : null;
  // Telemetría de la PROPIA NAVE: la ve toda la tripulación (#331).
  //
  // Estaba cerrada al GM y por eso las consolas salían vacías: `metricsFor` ya
  // tenía una lectura distinta para cada puesto, pero sin `ship` no llegaba a
  // ejecutarse. No era falta de diseño, era una llave echada.
  //
  // Y ocultarla no defendía nada: en el EmptyEpsilon del que esto es fork, cada
  // pantalla de tripulación ve casco, energía y sistemas. Una consola de Foundry
  // que esconde lo que la consola nativa enseña es un peor producto a cambio de
  // cero seguridad. Lo que se protege es el **Bearer del puente**, que nunca sale
  // del navegador del GM, no el contenido de un `/v1/state` que la tripulación
  // vería igual asomándose a su propia nave.
  const ship = statePayload?.ship ?? null;
  // Los contactos SÍ siguen siendo recurso del GM. Es la excepción del issue:
  // callsign, facción y coordenadas exactas son lo que el sistema de sensores
  // debería decidir cuánto revela, y difundirlos crudos regalaría el trabajo del
  // puesto. Se abrirán degradados por distancia y salud de sensores, con su
  // propio módulo puro y sus pruebas.
  // El GM lee su sondeo crudo; la tripulación, lo que le llegó degradado por el
  // alcance del radar (#331 paso 3). Si no llegó nada —sin lectura de radar, o
  // sin GM conectado difundiendo— la tripulación no ve contactos, que es lo
  // mismo que veía antes de este paso y nunca menos seguro.
  const safeContactsPayload = isGM
    ? contactsPayload
    : (sensores ? { contacts: sensores.contactos, degradado: true } : null);
  const crew = crewRows(users, moduleId, i18n);
  const uncrewed = uncrewedStations(users, moduleId).map((id) => ({
    id,
    label: localize(i18n, `LAGUNAK.Puestos.${id}`),
  }));
  // La misma lectura que usa `metricsFor`: si el texto y la lámina salieran de
  // dos llamadas con criterios distintos, la consola podría dibujar un atraque
  // que su propia matriz de métricas no menciona.
  const atraque = prepareDocking(ship, i18n);
  const rumbo = numeroDeLectura(ship?.heading);

  if (!definition) {
    return {
      hasStation: false,
      isGM: Boolean(isGM),
      connection,
      crew,
      hasUncrewedStations: uncrewed.length > 0,
      uncrewedStations: uncrewed,
    };
  }

  return {
    hasStation: true,
    station: normalized,
    stationLabel: localize(i18n, `LAGUNAK.Puestos.${normalized}`),
    stationCode: localize(i18n, `LAGUNAK.Espacios.${normalized}.Codigo`),
    stationIcon: definition.icon,
    accent: definition.accent,
    // Lo que la lámina 3D necesita, y NADA si no hay atraque (#391): el modelo
    // no lleva un objeto vacío que la plantilla tenga que interpretar. La clase
    // puede ser null y ahí la lámina cae en el casco de serie, como en #374 —
    // una nave genérica dice «hay algo ahí», un hueco dice «esto está roto».
    atraque: atraque.estado
      ? { estado: atraque.estado, clase: atraque.objetivo?.clase ?? null }
      : null,
    isNavigation: normalized === "navigation",
    // La lectura de sensores tal cual, SOLO para pilotaje y solo para pintar el
    // visor del piloto (#362). Va cruda —no en filas de texto— porque el visor
    // necesita distancia y marcación como números, no como etiquetas ya
    // formateadas; la lista legible de contactos sigue siendo cosa de ciencia y
    // artillería y no se duplica aquí.
    //
    // Es la MISMA lectura degradada que ve el resto de la tripulación
    // (`contactos-degradados.mjs`), así que el visor no abre ni un dato nuevo:
    // reordena en un cuadro lo que ya se difunde. Si no hay sondeo va `null`, y
    // el visor se apaga en vez de dibujar un sector vacío sin comprobar (#353).
    sensores: normalized === "navigation" ? (sensores ?? null) : null,
    // Acciones operativas por puesto (#236/#238/#240): disponibles aunque el
    // tripulante no tenga telemetría —la orden es intención, la simulación es
    // autoritativa—. Solo para tripulación (no-GM): el GM tiene sus controles
    // directos y `game.socket.emit` no se autoentrega, así que no le serviría.
    canOrderHeading: !isGM && isActionAllowed(normalized, "set_target_heading"),
    canOrderImpulse: !isGM && isActionAllowed(normalized, "set_impulse"),
    canOrderWarp: !isGM && isActionAllowed(normalized, "set_warp"),
    canOrderPower: !isGM && isActionAllowed(normalized, "set_system_power"),
    canOrderShields: !isGM && isActionAllowed(normalized, "set_shields"),
    canOrderScan: !isGM && isActionAllowed(normalized, "scan_object"),
    scanTargets: !isGM && isActionAllowed(normalized, "scan_object")
      ? scanTargetsFor(sensores, i18n)
      : [],
    // #465: fijar objetivo y disparar comparten la MISMA lista de objetivos
    // (misma lectura degradada, mismo resolvedor del GM) — dos acciones,
    // un solo <select>.
    canOrderWeaponTarget: !isGM && isActionAllowed(normalized, "set_weapon_target"),
    canOrderFireTube: !isGM && isActionAllowed(normalized, "fire_tube"),
    weaponTargets: !isGM && (isActionAllowed(normalized, "set_weapon_target") || isActionAllowed(normalized, "fire_tube"))
      ? weaponTargetsFor(sensores, i18n)
      : [],
    powerSystems: !isGM && isActionAllowed(normalized, "set_system_power")
      ? SISTEMAS_INGENIERIA.map((id) => ({ value: id, label: localize(i18n, `LAGUNAK.Sistemas.${id}`) }))
      : [],
    powerLevels: !isGM && isActionAllowed(normalized, "set_system_power")
      ? NIVELES_POTENCIA.map((value) => ({ value, label: String(value) }))
      : [],
    canOrderCoolant: !isGM && isActionAllowed(normalized, "set_system_coolant"),
    coolantSystems: !isGM && isActionAllowed(normalized, "set_system_coolant")
      ? SISTEMAS_INGENIERIA.map((id) => ({ value: id, label: localize(i18n, `LAGUNAK.Sistemas.${id}`) }))
      : [],
    coolantLevels: !isGM && isActionAllowed(normalized, "set_system_coolant")
      ? NIVELES_REFRIGERANTE.map((value) => ({ value, label: String(value) }))
      : [],
    // Auto-reparación (#464): decisión de ingeniería bajo presión — con ella
    // desactivada los sistemas dañados no se reparan solos.
    canOrderAutoRepair: !isGM && isActionAllowed(normalized, "set_auto_repair"),
    // Feedback 3D del toggle (#466): sin lectura o desactivada pintan igual —
    // el plano de siempre, ausencia no es cero (#353).
    autoRepairActivo: Boolean(ship?.auto_repair),
    // Maniobra de combate (#519). La carga sale de la telemetría
    // (`combat_maneuver.charge`), NUNCA se estima en el cliente: sin lectura va
    // `null` y la plantilla dice "sin lectura", que no es lo mismo que decir
    // que no queda maniobra. Misma regla que el visor del piloto y la sección
    // de nave (#353).
    canOrderCombatManeuver: !isGM && isActionAllowed(normalized, "combat_maneuver_boost"),
    maniobraCarga: porcentajeDeLectura(ship?.combat_maneuver?.charge),
    // El texto se arma aquí y no en la plantilla a propósito: distinguir
    // `null` de 0 con helpers de Handlebars exigiría un `eq` que no todas las
    // versiones anfitrionas traen, y esa distinción es justo la que no se
    // puede perder.
    maniobraCargaTexto:
      porcentajeDeLectura(ship?.combat_maneuver?.charge) === null
        ? localize(i18n, "LAGUNAK.Espacios.Orden.ManiobraSinLectura")
        : format(i18n, "LAGUNAK.Espacios.Orden.ManiobraCarga", {
            carga: porcentajeDeLectura(ship?.combat_maneuver?.charge),
          }),
    // Atraque (#519). `undock` y `abort_dock` son órdenes distintas del motor,
    // así que se ofrecen por separado; la plantilla usa el estado ya publicado
    // (`atraque`) para no invitar a soltar amarras de un atraque que aún no ha
    // ocurrido. La lista de objetivos es la misma lectura degradada de siempre:
    // el timón señala un sitio, no teclea un indicativo.
    canOrderDock: !isGM && isActionAllowed(normalized, "dock"),
    canOrderUndock: !isGM && isActionAllowed(normalized, "undock"),
    canOrderAbortDock: !isGM && isActionAllowed(normalized, "abort_dock"),
    dockTargets: !isGM && isActionAllowed(normalized, "dock")
      ? weaponTargetsFor(sensores, i18n)
      : [],
    // Autodestrucción (#518). Se ofrece SOLO si la nave puede: sin componente
    // `self_destruct` el puente publica `null`, y un botón que no hace nada es
    // peor que no tener botón.
    canOrderSelfDestruct:
      !isGM && isActionAllowed(normalized, "activate_self_destruct") && Boolean(ship?.self_destruct),
    // Confirmar código lo pueden tres puestos distintos —mando, ingeniería y
    // armas— porque son tres códigos y tres personas. Aquí solo se ofrece con
    // la secuencia ya armada: teclear un código antes de armar no significa
    // nada.
    canOrderDestructCode:
      !isGM
      && isActionAllowed(normalized, "confirm_self_destruct_code")
      && Boolean(ship?.self_destruct?.active),
    autodestruccionArmada: Boolean(ship?.self_destruct?.active),
    autodestruccionTexto: textoDeAutodestruccion(ship?.self_destruct, i18n),
    // Frecuencia de escudos. La lectura sale del puente; sin ella se dice que
    // no la hay, porque una nave cuyos escudos no tienen frecuencia no es una
    // nave con la frecuencia a cero.
    canOrderShieldFrequency: !isGM && isActionAllowed(normalized, "set_shield_frequency"),
    frecuenciaEscudosTexto: textoDeFrecuencia(ship?.shield_calibration, i18n),
    // Relay (#517). Rutas, sondas y condición de alerta.
    canOrderWaypoints: !isGM && isActionAllowed(normalized, "add_waypoint"),
    canOrderProbe: !isGM && isActionAllowed(normalized, "launch_probe"),
    canOrderScienceLink: !isGM && isActionAllowed(normalized, "set_science_link"),
    canOrderAlertLevel: !isGM && isActionAllowed(normalized, "set_alert_level"),
    // Objetivos para el enlace: la misma lectura degradada de siempre. Una
    // sonda propia ya lanzada aparece ahí como un contacto más, que es
    // exactamente lo que es desde el radar.
    probeTargets: !isGM && isActionAllowed(normalized, "set_science_link")
      ? weaponTargetsFor(sensores, i18n)
      : [],
    // Sondas restantes. Se LEE de la telemetría; sin lectura se dice que no la
    // hay, y cero es una lectura legítima (se han gastado todas) que no puede
    // confundirse con la ausencia.
    sondasTexto: textoDeSondas(ship?.probes, i18n),
    // Condición de alerta DECLARADA, no la derivada del daño (#338). Se
    // muestra para que el puesto que la fija pueda confirmarla en vez de
    // suponerla — la misma regla de "se lee, no se estima" del resto.
    alertaDeclarada: nivelDeclarado(ship?.alert_level),
    alertaDeclaradaTexto: textoDeAlerta(ship?.alert_level, i18n),
    // Base de datos científica (#520). CONSULTA, no orden: no entra en la
    // matriz de autoridad porque no hay nada que autorizar. Solo la ve
    // sensores, que es de quien es el trabajo.
    tieneBaseDatos: normalized === "sensors" && baseDatos !== null,
    baseDatosEntradas: normalized === "sensors" ? (baseDatos?.entradas ?? []) : [],
    baseDatosTexto: textoDeBaseDatos(normalized === "sensors" ? baseDatos : null, i18n),
    // Vista de sonda (#520). Se ofrece solo con enlace Y con lectura desde ella:
    // un botón que recentra sobre nada no recentra nada.
    hayEnlaceSonda: Boolean(ship?.science_link?.callsign),
    enlaceSondaTexto: textoDeEnlaceSonda(ship?.science_link, i18n),
    sensoresSonda: normalized === "sensors" ? (sensoresSonda ?? null) : null,
    // Control de daños (#522). La planta que se pinta es la REAL del motor,
    // publicada por el puente — NO la planta declarativa de la sección de la
    // nave (#427), que es otra cosa y para otra cosa (andar por ella). Pintar
    // equipos sobre aquella sería pintar sobre un plano que no es el de esta
    // nave; el issue lo pedía explícitamente: o se cose, o se pinta la del
    // motor, pero no se aproxima.
    canOrderRepairCrew: !isGM && isActionAllowed(normalized, "move_repair_crew"),
    // Sin lectura de interior no hay plano. Una nave sin salas no es una nave
    // con cero salas: la consola lo dice en vez de pintar un plano en blanco.
    tieneInterior: Boolean(ship?.internal?.rooms?.length),
    plantaSalas: salasParaPlanta(ship?.internal, i18n),
    equiposReparacion: equiposParaPlanta(ship?.internal),
    interiorTexto: textoDeInterior(ship?.internal, i18n),
    // Comunicaciones (#463): reactivas sobre el canal ya abierto — sin picker
    // de objetivo propio, ver `docs/SESION-PANTALLAS-NATIVAS.md`.
    canOrderCommsHail: !isGM && isActionAllowed(normalized, "answer_comm_hail"),
    canOrderCommsClose: !isGM && isActionAllowed(normalized, "close_comm"),
    canOrderCommsReply: !isGM && isActionAllowed(normalized, "send_comm_reply"),
    canOrderCommsMessage: !isGM && isActionAllowed(normalized, "send_comm_message"),
    navigationHeading: rumbo,
    navigationHeadingKnown: rumbo !== null,
    // Casco propio en 3D (#362). `null` cuando no hay lectura, que NO es lo
    // mismo que rumbo cero: el visor se queda quieto y apagado en vez de
    // enseñar una nave girando que no se corresponde con nada.
    cascoRumbo: rumbo,
    navigationAriaLabel: rumbo === null
      ? `${localize(i18n, "LAGUNAK.Espacios.Metrica.Rumbo")}: ${localize(i18n, "LAGUNAK.Espacios.Sensores.SinLectura")}`
      : format(i18n, "LAGUNAK.Espacios.RumboAccesible", { heading: Math.round(rumbo) }),
    isGM: Boolean(isGM),
    hasTelemetry: Boolean(ship),
    connection,
    connectionOk: connection === "ok",
    connectionLoading: connection === "loading",
    connectionError: connection === "error",
    connectionRestricted: connection === "restricted",
    error,
    // #518: la nave se pasa SIN los códigos de autodestrucción, aunque el
    // puente hoy no los publique (el componente no los expone a Lua). Es una
    // frontera y no una precaución sobrante: este modelo alimenta consolas de
    // tripulación, y la telemetría que el GM reparte viaja por un ajuste de
    // mundo que toda la mesa puede leer. Si algún día el juego llegara a
    // exponerlos, aparecerían aquí solos y en público.
    ship: sinCodigosDeAutodestruccion(ship),
    metrics: ship ? metricsFor(normalized, ship, safeContactsPayload, i18n, crew.length) : [],
    systems: normalized === "engineering" ? prepareSystemRows(ship, i18n) : [],
    contacts: contactosDeConsola(normalized, contactsPayload, sensores, Boolean(isGM), i18n),
    // La cabecera de la lista dice de dónde sale lo que se está leyendo: «solo
    // GM» sobre una lectura degradada sería mentir sobre su origen. En pilotaje
    // la lectura es degradada para todo el mundo, GM incluido.
    contactsDegradados: normalized === "navigation" ? true : !isGM,
    crew,
    crewCount: crew.length,
    activeCrew: crew.filter((member) => member.active).length,
    // Aviso puro de ocupación (#951): leer usuarios y flags no emite órdenes,
    // no reasigna autoridad y no altera el último estado de la simulación.
    hasUncrewedStations: uncrewed.length > 0,
    uncrewedStations: uncrewed,
    tasks: definition.tasks.map((task, index) => ({
      number: index + 1,
      label: localize(i18n, `LAGUNAK.Espacios.${normalized}.Tarea.${task}`),
    })),
  };
}
