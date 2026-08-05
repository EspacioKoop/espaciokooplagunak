# ADR-0009 — Modelo de permisos por puesto v1: formaliza sin migrar, no unifica con el motor nativo

- Estado: Aceptada
- Fecha: registrada 2026-08-05 (Etapa B, issue #461)
- Fuentes: `docs/PERMISOS_PUESTO.md`, `foundry-module/scripts/station-actions.mjs`,
  `src/crewPosition.h`

## Contexto

El único contrato de autoridad por puesto en Foundry era `STATION_ACTIONS`
(`foundry-module/scripts/station-actions.mjs`): una matriz cerrada de
acciones sin un documento que formalizara, en un solo sitio, qué ve y qué
puede ordenar cada puesto, ni su relación con el modelo de puestos del juego
nativo (`enum class CrewPosition`, `src/crewPosition.h`). #216 (panel de
energía solo-GM) quedó explícitamente bloqueado a la espera de este modelo.
Sin él, cada subissue de Etapa B (#462-#465) corría el riesgo de inventar su
propio vocabulario de permisos.

## Decisión

`docs/PERMISOS_PUESTO.md` formaliza v1: generaliza lo ya vigente
(`STATION_ACTIONS` + el patrón de resolución de identidad de #237) en tres
preguntas reutilizables (qué ve / qué ordena / cómo se resuelve el puesto),
sin migrar código ni cambiar comportamiento. Se decide explícitamente **no
unificar** el modelo de puestos de Foundry con `CrewPosition` del motor
nativo: son dos autoridades independientes por construcción — el puente
ejecuta Lua fijo directamente contra la simulación sin pasar por ninguna
posición de tripulación nativa, así que `CrewPosition` no gatea nada de lo
que Foundry ordena. La correspondencia entre los 6 puestos de Foundry y los
15 `CrewPosition` nativos queda documentada como orientativa, no normativa.

## Consecuencias

- B2-B5 (#462-#465) no quedan bloqueados: siguen usando `STATION_ACTIONS`
  tal cual existe y pueden migrar a un modelo más formal después, si
  procede, como trabajo aparte.
- Cualquier acción o puesto nuevo se da de alta primero en
  `docs/PERMISOS_PUESTO.md` (tabla de acciones) para que el documento no
  quede desactualizado en silencio; si diverge del código, gana el código.
- Una futura generalización de `STATION_ACTIONS` (p. ej. hacia una
  superficie de permisos compartida con el núcleo standalone-first,
  ADR-0008) es un ADR y un issue propios — este documento no la implementa.
