// Avisos de guardia derivados del estado (#331, paso 3).
//
// Qué sustituye. Cada consola mostraba tres «tareas» fijas por puesto —Rumbo,
// Ruta, Llegada— que no cambian nunca, no dependen del estado y no dicen qué
// hacer AHORA. Ocupaban sitio en una consola que se quejaba de estar vacía y
// enseñaban a ignorar esa esquina de la pantalla, que es lo peor que puede hacer
// un panel: entrenar a la tripulación a no mirarlo.
//
// Lo que hace en su lugar: mirar el estado y decir lo que pasa. «REFRIGERANTE:
// maniobra al 91% de calor» es accionable; «Temperatura» no lo es.
//
// POR PUESTO, Y NO TODO A TODOS. Un aviso que no puedes atender es ruido: al
// piloto no le sirve saber el detalle térmico que solo ingeniería puede tocar.
// Cada aviso declara a qué puestos les incumbe, y el capitán los ve todos porque
// su trabajo es precisamente repartir la atención.
//
// LO QUE NO SE SABE NO SE AVISA. Sin telemetría no hay avisos, en vez de avisos
// tranquilizadores: un «todo en orden» inventado es peor que un panel en blanco,
// porque el panel en blanco no miente.
//
// Puro: ni Foundry, ni DOM, ni red, ni reloj. Devuelve claves de traducción y
// datos, nunca frases ya montadas.

import { leerFraccion, leerNumero } from "./lectura-puente.mjs";

export const SEVERIDADES = Object.freeze(["critico", "aviso"]);

/** Umbrales de presentación, ajustables aquí sin tocar puente ni simulación. */
export const UMBRALES_AVISO = Object.freeze({
  calorCritico: 0.9,
  calorAviso: 0.7,
  saludCritica: 0.35,
  saludAviso: 0.6,
  cascoCritico: 0.3,
  cascoAviso: 0.6,
  energiaCritica: 0.15,
  energiaAviso: 0.35,
});

// Ausencia NO es cero, y aquí la diferencia dispara una alarma falsa: una
// energía que el puente no publica se anunciaría como «ENERGÍA CRÍTICA» a toda
// la mesa. La conversión vive en `lectura-puente.mjs` para que no haya una
// versión distinta por módulo — que es exactamente cómo apareció este fallo.
const fraccion = leerFraccion;
const normal = leerNumero;

const pct = (f) => Math.round(f * 100);

/**
 * Avisos vigentes, de más grave a menos.
 *
 * @param {object|null} ship la nave tal como llega en `/v1/state`.
 * @returns {{clave:string, severidad:string, puestos:string[], datos:object}[]}
 */
export function avisosDeGuardia(ship) {
  if (!ship || typeof ship !== "object") return [];
  const avisos = [];

  const casco = fraccion(ship.hull, ship.hull_max);
  if (casco !== null && casco <= UMBRALES_AVISO.cascoCritico) {
    avisos.push({
      clave: "CascoCritico",
      severidad: "critico",
      puestos: ["captain", "engineering", "weapons"],
      datos: { valor: pct(casco) },
    });
  } else if (casco !== null && casco <= UMBRALES_AVISO.cascoAviso) {
    avisos.push({
      clave: "CascoTocado",
      severidad: "aviso",
      puestos: ["captain", "engineering"],
      datos: { valor: pct(casco) },
    });
  }

  const energia = fraccion(ship.energy, ship.energy_max);
  if (energia !== null && energia <= UMBRALES_AVISO.energiaCritica) {
    avisos.push({
      clave: "EnergiaCritica",
      severidad: "critico",
      // Navegación entra porque sin energía no hay maniobra que valga, y es
      // quien primero nota que la nave no responde.
      puestos: ["captain", "engineering", "navigation"],
      datos: { valor: pct(energia) },
    });
  } else if (energia !== null && energia <= UMBRALES_AVISO.energiaAviso) {
    avisos.push({
      clave: "EnergiaBaja",
      severidad: "aviso",
      puestos: ["captain", "engineering"],
      datos: { valor: pct(energia) },
    });
  }

  const sistemas = ship.systems && typeof ship.systems === "object" ? ship.systems : {};
  for (const [nombre, lectura] of Object.entries(sistemas)) {
    const calor = normal(lectura?.heat);
    if (calor !== null && calor >= UMBRALES_AVISO.calorCritico) {
      avisos.push({
        clave: "CalorCritico",
        severidad: "critico",
        puestos: ["engineering", "captain"],
        datos: { sistema: nombre, valor: pct(calor) },
      });
    } else if (calor !== null && calor >= UMBRALES_AVISO.calorAviso) {
      avisos.push({
        clave: "CalorAlto",
        severidad: "aviso",
        puestos: ["engineering"],
        datos: { sistema: nombre, valor: pct(calor) },
      });
    }

    const salud = normal(lectura?.health);
    if (salud !== null && salud <= UMBRALES_AVISO.saludCritica) {
      avisos.push({
        clave: "SistemaInutilizado",
        severidad: "critico",
        puestos: ["engineering", "captain"],
        datos: { sistema: nombre, valor: pct(salud) },
      });
    } else if (salud !== null && salud <= UMBRALES_AVISO.saludAviso) {
      avisos.push({
        clave: "SistemaDaniado",
        severidad: "aviso",
        puestos: ["engineering"],
        datos: { sistema: nombre, valor: pct(salud) },
      });
    }
  }

  // Los críticos primero. Dentro de cada severidad se conserva el orden en que
  // se detectaron, que es estable: casco, energía y luego sistemas en el orden
  // que publica el puente. Sin eso, la lista se reordenaría sola entre sondeos.
  return avisos.sort(
    (a, b) => SEVERIDADES.indexOf(a.severidad) - SEVERIDADES.indexOf(b.severidad),
  );
}

/**
 * Avisos que le incumben a un puesto. El capitán los ve todos: su trabajo es
 * repartir la atención, así que necesita la foto entera.
 */
export function avisosParaPuesto(ship, puesto, maximo = 3) {
  const todos = avisosDeGuardia(ship);
  const mios = puesto === "captain" ? todos : todos.filter((a) => a.puestos.includes(puesto));
  return mios.slice(0, Math.max(0, maximo));
}
