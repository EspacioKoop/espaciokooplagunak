const CONTEXTOS = {
  playa: {
    destino: "playa",
    actividad: "descanso",
    descripcion: "espacio de descanso y downtime entre misiones",
  },
  museo: {
    destino: "museo",
    actividad: "briefing",
    descripcion: "sala de briefing y registro de hallazgos",
  },
};

export const CONTEXTOS_CONVOCATORIA = Object.freeze(
  Object.fromEntries(
    Object.entries(CONTEXTOS).map(([id, context]) => [id, Object.freeze(context)]),
  ),
);

export function destinosConvocables() {
  return Object.keys(CONTEXTOS_CONVOCATORIA);
}

export function contextoConvocatoria(destino) {
  const context = CONTEXTOS_CONVOCATORIA[destino];
  if (!context) throw new RangeError(`destino de convocatoria desconocido: ${destino}`);
  return context;
}
