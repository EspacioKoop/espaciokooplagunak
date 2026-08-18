// La planta REAL del Phobos M3P, la nave del escenario propio (#540).
//
// Hasta ahora la ventana de andar recorría una geografía INVENTADA —vestíbulo,
// pasillo del puente, cinco salas de estación idénticas— mientras la nave ya
// declaraba su interior completo en `scripts/shiptemplates/frigates.lua`: trece
// salas sobre una rejilla, nueve de ellas con sistema. Esa planta no es un dato
// muerto: es la que pinta la pantalla nativa de Control de daños, por la que
// caminan los equipos de reparación, y la que el puente ya publica en
// `ship.internal.rooms` (#522).
//
// Dos plantas para una misma nave son dos fuentes de verdad sobre su
// distribución, y la simulación es la autoridad sobre la nave (ADR-0008). De ahí
// este archivo: la planta de andar se DERIVA de la del motor, no se inventa.
//
// ## Por qué estática y no leída del puente
//
// Decidido en #540: la distribución de una nave no cambia durante la partida, y
// leerla del puente dejaría la ventana de andar sin geografía cuando no hay
// puente — justo lo que prohíbe standalone-first. Así que las celdas se copian
// aquí como dato del módulo y el puente se reserva para lo que SÍ cambia
// (equipos de reparación, averías). El precio es explícito: si alguien edita el
// `shipTemplate`, hay que editar esto. Lo vigila una prueba que compara esta
// tabla con el .lua de verdad, para que la copia no se pudra en silencio.
//
// ## Puertas
//
// El `shipTemplate` trae también sus `addDoor`, pero aquí NO se usan: se abre
// puerta entre toda pareja de salas contiguas (decisión de #540). Es más simple
// y, sobre todo, garantiza que la nave sea conexa — el fallo de #539 era
// precisamente que las puertas declaradas a mano no conectaban.
//
// Puro: solo datos y geometría. Ni Foundry, ni DOM, ni red.

/**
 * Metros de lado de una celda de la rejilla.
 *
 * Único mando de escala de toda la nave. Elegido con la cantina (9,6 × 8,3 m)
 * como referencia de qué se siente bien andando: el QA la describió como
 * pequeña, así que la sala más chica de la rejilla —una de 1×1— tiene que
 * quedar por encima de eso. Subir o bajar este número reescala la nave entera
 * sin tocar nada más, que es la razón de que sea una constante y no un tamaño
 * repetido en cada sala.
 */
export const CELDA = 11;

/** Anchura del hueco de puerta, en metros. Dos personas de frente. */
export const ANCHO_PUERTA = 2.4;

/** Profundidad de la zona disparadora de una puerta, medida hacia dentro. */
export const GROSOR_PUERTA = 1.2;

/**
 * Las trece salas del Phobos M3P, copiadas de `addRoom`/`addRoomSystem` en
 * `scripts/shiptemplates/frigates.lua`.
 *
 * `celda` es {x, y, w, h} en la rejilla del motor, tal cual. `sistema` es el
 * nombre del sistema de EmptyEpsilon, o `null` en las cuatro salas libres.
 * `nombre` es la clave i18n del rótulo; `proposito` solo documenta por qué una
 * sala libre es lo que es — el motor no lo usa.
 */
export const SALAS_PHOBOS = Object.freeze([
  { id: "maniobra", celda: { x: 1, y: 0, w: 2, h: 1 }, sistema: "Maneuver" },
  { id: "armas-haz", celda: { x: 1, y: 1, w: 2, h: 1 }, sistema: "BeamWeapons" },
  {
    id: "pasarela-proa",
    celda: { x: 2, y: 2, w: 2, h: 1 },
    sistema: null,
    proposito: "Sala libre en el .lua. Cose la proa (maniobra y armas) con la banda central.",
  },
  { id: "escudo-popa", celda: { x: 0, y: 3, w: 1, h: 2 }, sistema: "RearShield" },
  { id: "reactor", celda: { x: 1, y: 3, w: 2, h: 2 }, sistema: "Reactor" },
  { id: "warp", celda: { x: 3, y: 3, w: 2, h: 2 }, sistema: "Warp" },
  { id: "salto", celda: { x: 5, y: 3, w: 1, h: 2 }, sistema: "JumpDrive" },
  {
    id: "acceso-cantina",
    celda: { x: 6, y: 3, w: 2, h: 1 },
    sistema: null,
    proposito: "Sala libre en el .lua. Es la que da paso a la cantina, que NO está en el interior nativo.",
  },
  {
    id: "camarotes",
    celda: { x: 6, y: 4, w: 2, h: 1 },
    sistema: null,
    proposito: "Sala libre en el .lua. Lo único de la nave que no es puesto de trabajo ni tránsito.",
  },
  { id: "escudo-proa", celda: { x: 8, y: 3, w: 1, h: 2 }, sistema: "FrontShield" },
  {
    id: "pasarela-popa",
    celda: { x: 2, y: 5, w: 2, h: 1 },
    sistema: null,
    proposito: "Sala libre en el .lua. Cose la banda central con misiles e impulso.",
  },
  { id: "misiles", celda: { x: 1, y: 6, w: 2, h: 1 }, sistema: "MissileSystem" },
  { id: "impulso", celda: { x: 1, y: 7, w: 2, h: 1 }, sistema: "Impulse" },
]);

/** Medidas en metros de una sala. */
export function medidasSala(sala) {
  return { ancho: sala.celda.w * CELDA, profundidad: sala.celda.h * CELDA };
}

/** Rango [min, max) que ocupa una sala en la rejilla, por eje. */
function rango(celda) {
  return {
    x0: celda.x,
    x1: celda.x + celda.w,
    y0: celda.y,
    y1: celda.y + celda.h,
  };
}

/**
 * Solapamiento de dos salas contiguas, o `null` si no lo son.
 *
 * Contiguas = comparten una arista con longitud > 0. Tocarse solo por una
 * esquina NO cuenta: por un vértice no se pasa, y poner ahí una puerta daría
 * una nave conexa sobre el papel y atascada al andar.
 *
 * @returns {{lado:"norte"|"sur"|"este"|"oeste", desde:number, hasta:number}|null}
 *   `lado` es el muro de `a` donde va la puerta; `desde`/`hasta` es el
 *   solapamiento en coordenadas de REJILLA del eje que corre a lo largo de ese
 *   muro.
 */
export function contacto(a, b) {
  const ra = rango(a.celda);
  const rb = rango(b.celda);

  const solapeY = { desde: Math.max(ra.y0, rb.y0), hasta: Math.min(ra.y1, rb.y1) };
  if (solapeY.hasta > solapeY.desde) {
    if (ra.x1 === rb.x0) return { lado: "este", ...solapeY };
    if (rb.x1 === ra.x0) return { lado: "oeste", ...solapeY };
  }

  const solapeX = { desde: Math.max(ra.x0, rb.x0), hasta: Math.min(ra.x1, rb.x1) };
  if (solapeX.hasta > solapeX.desde) {
    // En la rejilla del motor, `y` crece hacia popa; en el mundo 3D es `z`.
    if (ra.y1 === rb.y0) return { lado: "sur", ...solapeX };
    if (rb.y1 === ra.y0) return { lado: "norte", ...solapeX };
  }

  return null;
}

/** Centro del solapamiento, en metros locales de `sala` sobre el eje del muro. */
function centroLocal(sala, contactoAB, eje) {
  const origen = eje === "x" ? sala.celda.x : sala.celda.y;
  const medio = (contactoAB.desde + contactoAB.hasta) / 2;
  return (medio - origen) * CELDA;
}

/**
 * Rect de la puerta en el muro `lado` de `sala`, centrada en el solapamiento.
 *
 * Va pegada al muro y hacia DENTRO, con la misma forma que ya usaban las
 * puertas escritas a mano: `crearSalaCaja` abre el hueco a partir de este rect
 * y `nave-movimiento.puertaTocada` lo usa como disparador.
 */
export function rectPuerta(sala, contactoAB) {
  const { ancho, profundidad } = medidasSala(sala);
  const mitad = ANCHO_PUERTA / 2;
  if (contactoAB.lado === "este" || contactoAB.lado === "oeste") {
    const cz = centroLocal(sala, contactoAB, "y");
    return {
      x: contactoAB.lado === "oeste" ? 0 : ancho - GROSOR_PUERTA,
      z: Math.min(Math.max(cz - mitad, 0), profundidad - ANCHO_PUERTA),
      ancho: GROSOR_PUERTA,
      profundidad: ANCHO_PUERTA,
    };
  }
  const cx = centroLocal(sala, contactoAB, "x");
  return {
    x: Math.min(Math.max(cx - mitad, 0), ancho - ANCHO_PUERTA),
    z: contactoAB.lado === "norte" ? 0 : profundidad - GROSOR_PUERTA,
    ancho: ANCHO_PUERTA,
    profundidad: GROSOR_PUERTA,
  };
}

/** Muro opuesto: por donde se ENTRA en el vecino. */
const OPUESTO = Object.freeze({ este: "oeste", oeste: "este", norte: "sur", sur: "norte" });

/**
 * `yaw` con el que se aparece al entrar por un muro, mirando hacia dentro de la
 * sala. `yaw` 0 mira a +z (ver `nave-movimiento.mjs`), así que +x es π/2.
 */
const MIRANDO_ADENTRO = Object.freeze({
  oeste: Math.PI / 2,
  este: -Math.PI / 2,
  norte: 0,
  sur: Math.PI,
});

/**
 * Punto de llegada dentro de `sala` al entrar por el muro `lado`.
 *
 * Se separa del muro más que el grosor de la puerta a propósito: aparecer
 * ENCIMA del rect disparador de vuelta reactivaría la puerta y rebotaría al
 * jugador entre dos salas. Es el mismo cuidado que tenían escritas a mano las
 * puertas del vestíbulo, aquí resuelto de una vez para todas.
 */
export function llegada(sala, contactoAB) {
  const lado = OPUESTO[contactoAB.lado];
  const { ancho, profundidad } = medidasSala(sala);
  const separacion = GROSOR_PUERTA + 1.4;
  const cz = centroLocal(sala, contactoAB, "y");
  const cx = centroLocal(sala, contactoAB, "x");
  if (lado === "oeste") return { x: separacion, z: cz, yaw: MIRANDO_ADENTRO.oeste };
  if (lado === "este") return { x: ancho - separacion, z: cz, yaw: MIRANDO_ADENTRO.este };
  if (lado === "norte") return { x: cx, z: separacion, yaw: MIRANDO_ADENTRO.norte };
  return { x: cx, z: profundidad - separacion, yaw: MIRANDO_ADENTRO.sur };
}

/**
 * Todas las conexiones de la nave, una por pareja contigua y en los dos
 * sentidos. Es lo único que necesita el catálogo para coser la planta.
 */
export function conexiones(salas = SALAS_PHOBOS) {
  const pares = [];
  for (const a of salas) {
    for (const b of salas) {
      if (a === b) continue;
      const toca = contacto(a, b);
      if (toca) pares.push({ de: a, a: b, contacto: toca });
    }
  }
  return pares;
}

/** Índice por id, para no recorrer la lista en cada consulta. */
export function porId(salas = SALAS_PHOBOS) {
  return new Map(salas.map((sala) => [sala.id, sala]));
}

/**
 * La cantina no está en el interior nativo: cuelga del muro norte de
 * `acceso-cantina` (#540). Para cualquier PLANO de la nave —minimapa, sección—
 * se le da la celda inmediatamente encima, que es donde está de verdad respecto
 * al resto.
 *
 * Vive aquí y no en cada plano porque hay dos que la necesitan, y tener la nave
 * declarada en dos sitios es exactamente el problema que resolvió #540. Las
 * celdas salen normalizadas a (0,0): la fila de la cantina es negativa en la
 * rejilla nativa, y eso obligaría a cada pintor a conocer el caso raro.
 */
export const ID_CANTINA = "cantina";
const SOSTIENE_LA_CANTINA = "acceso-cantina";

export const ID_TERRAZA = "terraza";

export function celdasConCantina(salas = SALAS_PHOBOS) {
  const sostiene = salas.find((sala) => sala.id === SOSTIENE_LA_CANTINA);
  const celdas = salas.map((sala) => ({ id: sala.id, ...sala.celda, sistema: sala.sistema ?? null }));
  if (sostiene) {
    celdas.push({
      id: ID_CANTINA,
      x: sostiene.celda.x,
      y: sostiene.celda.y - 1,
      w: sostiene.celda.w,
      h: 1,
      sistema: null,
    });
    // Y la terraza (#579), colgada del costado OESTE de la cantina. Va en el
    // plano por lo mismo que la cantina: se anda por ella, y un minimapa que no
    // dibuja un sitio por el que se anda miente justo cuando más se necesita —al
    // perderse. Media celda, porque es media sala: un balcón, no un cuarto.
    celdas.push({
      id: ID_TERRAZA,
      x: sostiene.celda.x - 1,
      y: sostiene.celda.y - 1,
      w: 1,
      h: 1,
      sistema: null,
    });
  }
  const minX = Math.min(...celdas.map((c) => c.x));
  const minY = Math.min(...celdas.map((c) => c.y));
  return celdas.map((c) => ({ ...c, x: c.x - minX, y: c.y - minY }));
}

/** Tamaño de la rejilla que ocupan esas celdas. */
export function rejillaDelPlano(salas = SALAS_PHOBOS) {
  const celdas = celdasConCantina(salas);
  return {
    columnas: Math.max(...celdas.map((c) => c.x + c.w)),
    filas: Math.max(...celdas.map((c) => c.y + c.h)),
  };
}
