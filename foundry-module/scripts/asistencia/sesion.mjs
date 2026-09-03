// Sesión de asistencia: el reductor que cose las piezas sueltas de #309.
//
// `bandas.mjs`, `enfoques.mjs`, `probabilidad.mjs`, `propuesta.mjs` y
// `temporizacion.mjs` son piezas puras que no se conocen entre sí. Este módulo
// es lo único que las ordena en el tiempo —abrir, resolver, consumir— y lo único
// que recuerda algo entre pasos. Sigue siendo puro: el estado ENTRA y SALE por
// parámetro, sin flags, sin sockets y sin reloj propio.
//
// ## Por qué la apertura reserva sitio
//
// El presupuesto de concurrencia (un asistente por puesto y ventana) ya lo sabía
// calcular `puedeAsistir`, pero comprobarlo solo al crear la propuesta llega
// tarde: dos ayudantes tirarían a la vez y el segundo descubriría que su ayuda
// no cuenta DESPUÉS de haber gastado un espacio de conjuro. Un espacio de conjuro
// es un coste de campaña real, no efímero. Por eso abrir reserva el hueco y el
// rechazo cae antes de que nadie toque su hoja.
//
// La reserva caduca sola con la misma ventana que la propuesta: quien abre un
// reto y se va a por café no bloquea el puesto para siempre.
//
// ## Lo que este módulo sigue sin hacer
//
// No emite órdenes, no habla con el puente y no toca el DOM. `consumir` devuelve
// la orden que el TITULAR emitirá por el relé bajo su identidad autenticada
// (ADR-0002, #237); quien llame es responsable de pasarla por ahí y no por otro
// sitio. El día que este archivo importe un cliente del puente, el error estará
// aquí.

import { BANDAS_ORDENADAS, bandaEsFavorable, subirBanda } from "./bandas.mjs";
import { MODOS, modoDeTarea, resolucionDisponible, validarTarea } from "./enfoques.mjs";
import { rangoDeExito } from "./probabilidad.mjs";
import { modificadorDeFicha } from "./ficha-dnd5e.mjs";
import {
  PRESUPUESTO_POR_DEFECTO,
  PROPUESTA_ERRORES,
  consumirPropuesta,
  crearPropuesta,
  propuestaVigente,
} from "./propuesta.mjs";

export const SESION_ERRORES = Object.freeze({
  ...PROPUESTA_ERRORES,
  /** La tarea es narrativa: su fruto lo adjudica el GM, no este reductor. */
  MODO_NARRATIVO: "modo-narrativo",
  /** El nonce no corresponde a ninguna reserva viva: caducada o inventada. */
  RESERVA_DESCONOCIDA: "reserva-desconocida",
  /** El nonce ya identifica algo vivo o ya gastado: abrir con él pisaría trabajo ajeno. */
  NONCE_REPETIDO: "nonce-repetido",
  /** No hay una crisis de mando abierta: fuera de ella no existe el recurso. */
  CRISIS_INACTIVA: "crisis-inactiva",
  /** La crisis ya consumió su presupuesto de órdenes de mando. */
  ORDENES_AGOTADAS: "ordenes-mando-agotadas",
  /** Una orden espera la próxima asistencia y no se puede acumular otra encima. */
  ORDEN_MANDO_PENDIENTE: "orden-mando-pendiente",
  /** El mismo gesto ya gastó una orden en esta crisis. */
  ORDEN_MANDO_REPETIDA: "orden-mando-repetida",
});

/** Valor inicial de playtest de #808; vive solo durante una crisis. */
export const ORDENES_MANDO_POR_CRISIS = 2;

function mandoInactivo() {
  return Object.freeze({
    crisisActiva: false,
    disponibles: 0,
    ventajaActiva: null,
    noncesUsados: Object.freeze([]),
  });
}

/** Estado inicial. Vacío y congelado; todo lo demás sale de aquí. */
export function crearSesion() {
  return Object.freeze({
    reservas: Object.freeze([]),
    propuestas: Object.freeze([]),
    consumidos: Object.freeze([]),
    mando: mandoInactivo(),
  });
}

/** Abre una crisis nueva y repone únicamente su recurso efímero de mando. */
export function iniciarCrisisMando(estado, ordenes = ORDENES_MANDO_POR_CRISIS) {
  if (estado?.mando?.crisisActiva) return estado;
  const disponibles = Math.max(0, Math.trunc(Number(ordenes)));
  if (!Number.isFinite(disponibles)) throw new TypeError("ordenes debe ser un número");
  return Object.freeze({
    ...estado,
    mando: Object.freeze({
      crisisActiva: true,
      disponibles,
      ventajaActiva: null,
      noncesUsados: Object.freeze([]),
    }),
  });
}

/** Cierra la crisis: las órdenes no gastadas y la ventaja pendiente desaparecen. */
export function cerrarCrisisMando(estado) {
  return Object.freeze({ ...estado, mando: mandoInactivo() });
}

/** Vista pública del recurso, sin exponer los nonces internos de deduplicación. */
export function estadoMando(estado) {
  const mando = estado?.mando ?? mandoInactivo();
  return Object.freeze({
    crisisActiva: Boolean(mando.crisisActiva),
    disponibles: mando.disponibles ?? 0,
    ventajaActiva: mando.ventajaActiva
      ? Object.freeze({ puestoAsistido: mando.ventajaActiva.puestoAsistido })
      : null,
  });
}

/**
 * Gasta una orden y la deja dirigida a la próxima asistencia del puesto. Solo
 * puede haber una pendiente: #808 prohíbe acumular ventajas.
 */
export function declararOrdenMando({ estado, puestoAsistido, nonce }) {
  if (!nonce) throw new TypeError("declararOrdenMando requiere nonce");
  if (!puestoAsistido) throw new TypeError("declararOrdenMando requiere puestoAsistido");
  const mando = estado?.mando ?? mandoInactivo();
  if (!mando.crisisActiva) {
    return { ok: false, error: SESION_ERRORES.CRISIS_INACTIVA, estado };
  }
  if (mando.noncesUsados.includes(nonce)) {
    return { ok: false, error: SESION_ERRORES.ORDEN_MANDO_REPETIDA, estado };
  }
  if (mando.ventajaActiva) {
    return { ok: false, error: SESION_ERRORES.ORDEN_MANDO_PENDIENTE, estado };
  }
  if (mando.disponibles <= 0) {
    return { ok: false, error: SESION_ERRORES.ORDENES_AGOTADAS, estado };
  }
  const ventajaActiva = Object.freeze({ nonce, puestoAsistido });
  const siguiente = Object.freeze({
    ...estado,
    mando: Object.freeze({
      ...mando,
      disponibles: mando.disponibles - 1,
      ventajaActiva,
      noncesUsados: Object.freeze([...mando.noncesUsados, nonce]),
    }),
  });
  return { ok: true, ventajaActiva, estado: siguiente };
}

function vivos(lista, ahora) {
  return (lista ?? []).filter((x) => ahora < x.caducaEn);
}

/**
 * Quita reservas y propuestas caducadas. Se aplica sola en cada paso, pero se
 * exporta porque una interfaz que pinta «quién está ayudando» necesita poder
 * refrescar sin provocar un cambio de juego.
 */
export function podar(estado, ahora = Date.now()) {
  const reservas = vivos(estado.reservas, ahora);
  const propuestas = vivos(estado.propuestas, ahora);
  if (reservas.length === estado.reservas.length && propuestas.length === estado.propuestas.length) {
    return estado;
  }
  return Object.freeze({
    ...estado,
    reservas: Object.freeze(reservas),
    propuestas: Object.freeze(propuestas),
  });
}

/** Ocupación actual de un puesto: reservas abiertas + propuestas sin gastar. */
function ocupantes(estado, puesto) {
  return [
    ...estado.reservas.filter((r) => r.puestoAsistido === puesto),
    ...estado.propuestas.filter((p) => p.puestoAsistido === puesto),
  ];
}

/** ¿Ese nonce ya identifica una reserva viva, una propuesta viva o algo gastado? */
function nonceOcupado(estado, nonce) {
  return (
    estado.reservas.some((r) => r.nonce === nonce) ||
    estado.propuestas.some((p) => p.nonce === nonce) ||
    (estado.consumidos ?? []).includes(nonce)
  );
}

/**
 * Abre una asistencia: comprueba el presupuesto, reserva el hueco y devuelve la
 * oferta que la interfaz pintará —qué vía hay (habilidad o destreza), qué
 * enfoques caben y, para cada uno, el rango de éxito ANTES de comprometerse.
 *
 * `nonce` lo pone quien llama (en Foundry, `foundry.utils.randomID()`): este
 * módulo no inventa identificadores porque entonces dejaría de ser reproducible.
 */
export function abrir({
  estado,
  tarea,
  asistenteId,
  nonce,
  tieneFicha = false,
  // `system` de un Actor de dnd5e (#500), o `null`. De aquí sale el
  // modificador REAL de cada enfoque con `habilidad` declarada; sin ella —o
  // sin ficha— el enfoque sigue ofreciéndose con modificador 0, como antes de
  // leer la ficha. `modificadores` sigue existiendo aparte para quien quiera
  // forzar un número concreto (pruebas, o una mesa con su propia fuente).
  ficha = null,
  gmPermiteRecursos = false,
  modificadores = {},
  reglaCasaNatural = false,
  ahora = Date.now(),
  vigenciaMs = PRESUPUESTO_POR_DEFECTO.vigenciaMs,
  presupuesto = PRESUPUESTO_POR_DEFECTO,
}) {
  if (!asistenteId) throw new TypeError("abrir requiere asistenteId");
  if (!nonce) throw new TypeError("abrir requiere nonce");
  const validada = validarTarea(tarea);
  if (modoDeTarea(validada) !== MODOS.PROPUESTA) {
    return { ok: false, error: SESION_ERRORES.MODO_NARRATIVO, estado };
  }

  const podado = podar(estado, ahora);
  // El nonce identifica la asistencia durante toda su vida —reserva, propuesta,
  // consumo—, así que tiene que ser único dentro de la sesión y no solo
  // improbable: con dos reservas del mismo nonce, `resolver` resolvía una y
  // borraba las dos, y la segunda perdía su hueco sin haber sido resuelta. Como
  // el nonce entra desde fuera, la unicidad se comprueba aquí y no se confía a
  // `randomID()`. Se mira DESPUÉS de podar: un nonce caducado vuelve a estar
  // libre, pero uno consumido no, porque su coste ya se cobró.
  if (nonceOcupado(podado, nonce)) {
    return { ok: false, error: SESION_ERRORES.NONCE_REPETIDO, estado: podado };
  }
  const enPuesto = ocupantes(podado, validada.puestoAsistido);
  if (enPuesto.some((x) => x.asistenteId === asistenteId)) {
    return { ok: false, error: SESION_ERRORES.YA_ASISTE, estado: podado };
  }
  if (enPuesto.length >= presupuesto.asistentesPorPuesto) {
    return { ok: false, error: SESION_ERRORES.PRESUPUESTO_AGOTADO, estado: podado };
  }

  const disponible = resolucionDisponible({ tarea: validada, tieneFicha, gmPermiteRecursos });
  const oferta = Object.freeze({
    via: disponible.via,
    // Solo importa en la vía «destreza» —sin ficha o sin dnd5e—, pero viaja
    // siempre: es más simple que la interfaz lea un campo constante que uno
    // que aparece y desaparece según la vía.
    minijuegoDestreza: validada.minijuegoDestreza ?? "temporizacion",
    enfoques: Object.freeze(
      disponible.enfoques.map((enfoque) =>
        Object.freeze({
          enfoque,
          rango: rangoDeExito({
            enfoque,
            tarea: validada,
            // El override explícito manda; si no lo hay, se lee de la ficha
            // real; si tampoco hay nada que leer (sin ficha, o el enfoque no
            // declaró `habilidad`), 0 — el mismo valor de siempre.
            modificador: modificadores[enfoque.id] ?? modificadorDeFicha(ficha, enfoque.habilidad) ?? 0,
            reglaCasaNatural,
          }),
        }),
      ),
    ),
  });

  const reserva = Object.freeze({
    nonce,
    tareaId: validada.id,
    puestoAsistido: validada.puestoAsistido,
    accion: validada.accionPropuesta,
    asistenteId,
    abiertaEn: ahora,
    caducaEn: ahora + vigenciaMs,
  });
  return {
    ok: true,
    reserva,
    oferta,
    estado: Object.freeze({ ...podado, reservas: Object.freeze([...podado.reservas, reserva]) }),
  };
}

/**
 * Cierra la reserva con la banda lograda, venga de la tirada de dnd5e o del reto
 * de temporización: aquí ya da igual cuál de las dos, que es justo el punto del
 * diseño. Una banda sin fruto libera el hueco y no deja token —la ayuda es un
 * bonus, y no tenerlo nunca bloquea lo que el titular ya podía pedir.
 */
export function resolver({ estado, nonce, banda, ahora = Date.now() }) {
  const podado = podar(estado, ahora);
  const reserva = podado.reservas.find((r) => r.nonce === nonce);
  if (!reserva) {
    return { ok: false, error: SESION_ERRORES.RESERVA_DESCONOCIDA, estado: podado };
  }
  const ventaja = podado.mando?.ventajaActiva;
  const ordenMandoAplicada = Boolean(
    ventaja &&
    ventaja.puestoAsistido === reserva.puestoAsistido &&
    BANDAS_ORDENADAS.includes(banda),
  );
  // La ventaja y la reserva se consumen en la MISMA transición. Un segundo
  // `resolver` no encuentra reserva ni ventaja y no puede aplicar dos veces la
  // misma orden aunque repita exactamente el mismo evento.
  const conMandoConsumido = ordenMandoAplicada
    ? Object.freeze({
        ...podado,
        mando: Object.freeze({ ...podado.mando, ventajaActiva: null }),
      })
    : podado;
  const bandaResuelta = ordenMandoAplicada ? subirBanda(banda) : banda;
  const sinReserva = Object.freeze({
    ...conMandoConsumido,
    reservas: Object.freeze(conMandoConsumido.reservas.filter((r) => r.nonce !== nonce)),
  });

  if (!bandaEsFavorable(bandaResuelta)) {
    return {
      ok: false,
      error: SESION_ERRORES.BANDA_SIN_FRUTO,
      banda: bandaResuelta,
      ordenMandoAplicada,
      estado: sinReserva,
    };
  }
  const creada = crearPropuesta({
    tareaId: reserva.tareaId,
    puestoAsistido: reserva.puestoAsistido,
    accion: reserva.accion,
    banda: bandaResuelta,
    asistenteId: reserva.asistenteId,
    // El nonce de la reserva se reutiliza como el de la propuesta: es el mismo
    // acto de ayuda de principio a fin, y así el registro de quién apoyó a quién
    // no se parte en dos identificadores que hay que volver a casar.
    nonce: reserva.nonce,
    ahora,
    vigenciaMs: reserva.caducaEn - reserva.abiertaEn,
  });
  if (!creada.ok) return { ...creada, estado: sinReserva };
  return {
    ok: true,
    propuesta: creada.propuesta,
    ordenMandoAplicada,
    estado: Object.freeze({
      ...sinReserva,
      propuestas: Object.freeze([...sinReserva.propuestas, creada.propuesta]),
    }),
  };
}

/**
 * El titular gasta la propuesta. Devuelve la orden lista para `buildStationOrder`.
 *
 * `emisorPuesto` DEBE venir del `User` autenticado que resuelve el relé, jamás de
 * un campo que mande el cliente: si esto aceptara un puesto declarado, cualquiera
 * podría cobrar la ayuda de un puesto que no ocupa.
 */
export function consumir({
  estado,
  nonce,
  emisorId,
  emisorPuesto,
  accion,
  params = {},
  base,
  ahora = Date.now(),
}) {
  const podado = podar(estado, ahora);
  const propuesta = podado.propuestas.find((p) => p.nonce === nonce);
  if (!propuesta) {
    // Una propuesta que existió y caducó ya no está: para quien la gasta, «se te
    // pasó la ventana» y «eso nunca existió» son el mismo desenlace.
    const error = podado.consumidos.includes(nonce)
      ? SESION_ERRORES.YA_CONSUMIDA
      : SESION_ERRORES.CADUCADA;
    return { ok: false, error, estado: podado };
  }
  const resultado = consumirPropuesta({
    propuesta,
    emisorId,
    emisorPuesto,
    // La acción que se está emitiendo viaja hasta el fondo: la ayuda es para
    // una acción concreta, no para el puesto entero.
    accion,
    params,
    base,
    consumidos: [...podado.consumidos],
    ahora,
  });
  if (!resultado.ok) return { ...resultado, estado: podado };
  return {
    ok: true,
    orden: resultado.orden,
    credito: resultado.credito,
    estado: Object.freeze({
      ...podado,
      propuestas: Object.freeze(podado.propuestas.filter((p) => p.nonce !== nonce)),
      consumidos: resultado.consumidos,
    }),
  };
}

/**
 * Lo que la interfaz necesita para pintar el estado de un puesto sin tener que
 * entender el reductor: quién ayuda ahora y qué propuestas esperan al titular.
 */
export function asistenciasDe(estado, puesto, ahora = Date.now()) {
  const podado = podar(estado, ahora);
  return Object.freeze({
    reservas: Object.freeze(podado.reservas.filter((r) => r.puestoAsistido === puesto)),
    propuestas: Object.freeze(podado.propuestas.filter((p) => propuestaVigente(p, ahora) && p.puestoAsistido === puesto)),
  });
}
