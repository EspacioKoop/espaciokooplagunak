# Modelo de permisos por puesto v1

Diseño del issue [#461](https://github.com/VaroTv7/espaciokooplagunak/issues/461)
(B1 de la [Etapa B](../README.md), coordinada en
[#459](https://github.com/VaroTv7/espaciokooplagunak/issues/459)). Este
documento **formaliza en un solo sitio** lo que hoy ya rige en el módulo
Foundry — qué ve y qué puede ordenar cada puesto de tripulación, y cómo se
resuelve esa identidad — y explica su relación con el modelo de puestos del
juego nativo. **No migra código ni añade acciones**: es la referencia contra
la que #216 (panel de energía solo-GM) y cualquier subissue de Etapa B
(#462-#465, comunicaciones/sensores/ingeniería/armas) pueden alinearse sin
esperar a un sistema de permisos genérico nuevo — ver ADR-0009.

## Qué formaliza y qué no

Generaliza el patrón que ya usan `foundry-module/scripts/station-actions.mjs`
y su relé en tres preguntas reutilizables por cualquier puesto o acción
futura:

- **¿Qué ve?** — telemetría accesible a ese puesto.
- **¿Qué ordena?** — acciones del contrato del puente que ese puesto puede
  emitir.
- **¿Cómo se resuelve?** — de dónde sale la identidad "este usuario es este
  puesto ahora mismo".

No es una reescritura ni un esquema de datos nuevo: el código
(`station-actions.mjs`, `station-order-relay.mjs`, `station-assignment.mjs`)
sigue siendo la fuente de verdad ejecutable. Este documento es el sitio único
donde esas tres preguntas se responden en prosa, para no tener que
reconstruirlas leyendo media docena de comentarios de código o de issues
cerrados cada vez que alguien se pregunta "¿puede sensores hacer esto?".

## Qué ve cada puesto

La asimetría de información real hoy es **puesto vs. GM**, no puesto contra
puesto — con una única excepción de presentación:

- **Telemetría de la nave propia** (posición, casco, energía, sistemas,
  atraque, escudos) se difunde **idéntica a toda la tripulación**, GM
  incluido (#331). Ocultarla por puesto no defendería nada: en el
  EmptyEpsilon del que este es fork, cualquier pantalla de tripulación ve
  casco/energía/sistemas — ver `docs/FOUNDRY.md`, "Permisos por puesto de
  tripulación".
- **Contactos** son la única lectura que sí se degrada, y se degrada **por
  banda de sensor, no por puesto**: dentro del alcance corto del radar se
  identifica (indicativo, facción); entre corto y largo es un eco sin
  nombre; más allá del largo no se publica ni se cuenta. La misma
  degradación llega a todos los puestos de tripulación por igual —
  `foundry-module/scripts/contactos-degradados.mjs`, puro, sin red, es el
  precedente de "degradar en origen, no al pintar" que cualquier lectura
  nueva por puesto debería seguir si algún día existe.
- **Lo único que sí varía por puesto** es qué panel se muestra —
  `station-workspaces.mjs`, `workspaceDefinition(station)` y `metricsFor`
  eligen qué métricas resumidas ve cada consola (rumbo para navegación,
  potencia/calor para ingeniería, contactos para sensores…) — pero es una
  cuestión de qué se resalta, no de qué dato existe solo para ese puesto: la
  telemetría cruda de nave propia sigue siendo la misma para todos.

Un modelo de visibilidad **por puesto** de verdad (p. ej. "solo sensores ve
tal campo") no existe hoy más allá de esto. Si se necesita en el futuro, este
documento es el sitio donde se declararía la regla antes de escribir código.

## Qué puede ordenar cada puesto

Contrato ejecutable: `STATION_ACTIONS` en
`foundry-module/scripts/station-actions.mjs`. Tabla a fecha de este
documento — **la fuente de verdad sigue siendo el código**; si diverge,
gana el código y este documento queda desactualizado hasta que se corrija
(mismo criterio de mantenimiento de documentación que ya fija `CLAUDE.md`):

| Puesto | Acciones (`STATION_ACTIONS`) |
|---|---|
| `captain` | ninguna — observación/narrativa |
| `navigation` | `set_target_heading`, `set_impulse`, `set_warp` |
| `engineering` | `set_system_power`, `set_system_coolant` |
| `sensors` | ninguna — observación/narrativa |
| `communications` | ninguna — observación/narrativa |
| `weapons` | `set_shields` |

`captain`, `sensors` y `communications` no emiten órdenes de control de nave
hoy, coherente con el género bridge-sim (ratificado en #268) — no es una
laguna, es la superficie actual antes de que B2-B5 la amplíen.

Cada entrada de la tabla es reproducible en dos capas, nunca solo una:

1. **UI** — `station-workspaces.mjs` calcula flags `canOrder*` con
   `isActionAllowed(puesto, accion)` para ocultar controles que el puesto no
   puede usar.
2. **Servidor (GM)** — `station-order-relay.mjs` revalida cada orden con
   `resolveStationOrder` antes de encaminarla al puente. La UI oculta el
   control; el relé es quien de verdad impide la orden. Un puesto
   desconocido o una acción no permitida se rechazan con un error tipado
   (`UNKNOWN_STATION` / `ACTION_NOT_ALLOWED`) — nunca en silencio.

## Cómo se resuelve el puesto

Patrón fijado en #237, generalizable a cualquier orden futura:

- El tripulante escribe su orden en su **propio** flag de `User`
  (`emitWorkspaceOrder` → `buildStationOrder`, en
  `foundry-module/scripts/station-order-relay.mjs`) — Foundry solo permite a
  un usuario escribir su propio documento.
- El GM la recoge en el hook `updateUser` y **resuelve el puesto desde el
  `User` autenticado que emitió el cambio**, nunca desde un campo `station`
  que la propia orden pudiera declarar. Un cliente no puede hacerse pasar
  por otro puesto: tendría que escribir el documento de otro usuario, y el
  servidor de Foundry lo rechaza.
- Esto impide **suplantación**, pero no convierte el puesto en un rol fijo:
  es autoasignación mutable — cada jugador puede cambiar su propio flag
  `station` en cualquier momento (`station-assignment.mjs`). La garantía es
  «acción permitida para el puesto que declara ahora mismo el usuario
  autenticado», no «este usuario es permanentemente artillero». Un puesto
  impuesto por el GM (no autoasignable) requeriría una restricción aparte
  que hoy no existe.
- `requisitos-puesto.mjs` (ajuste de mundo, apagado de serie) es una
  **puerta de interfaz**, no de seguridad: exige una característica mínima
  del personaje para sentarse en un puesto, pero el flag lo sigue
  escribiendo el propio usuario — alguien con la consola del navegador
  abierta puede saltársela. Organiza la mesa, no defiende contra quien hace
  trampas.

## Relación con el juego nativo

El motor tiene su **propio** modelo de puestos, más fino y con otro
propósito: `enum class CrewPosition` (`src/crewPosition.h`), quince valores
(`helmsOfficer`, `weaponsOfficer`, `engineering`, `scienceOfficer`,
`relayOfficer`, `tacticalOfficer`, `engineeringAdvanced`,
`operationsOfficer`, `singlePilot`, `damageControl`, `powerManagement`,
`databaseView`, `altRelay`, `commsOnly`, `shipLog`), que gobierna qué
pantalla ve un **cliente nativo** conectado a la simulación
(`commandSetCrewPosition`).

**Son dos sistemas de autoridad independientes por construcción, no una
réplica el uno del otro:**

- `CrewPosition` gatea qué GUI carga un cliente nativo — es un control de
  presentación del lado del cliente que se conecta directamente al
  servidor de EmptyEpsilon.
- El puente **no se autentica como ninguna posición de tripulación
  nativa**. `/exec.lua` ejecuta Lua fijo generado por el servidor del
  puente (`ship:commandX(...)`, o globales `commandX(ship, ...)` como
  `commandAnswerCommHail`) directamente contra la simulación, sin pasar por
  ninguna pantalla ni por el `CrewPosition` de ningún cliente conectado.
- **Consecuencia directa: el filtro de `CrewPosition` nativo no gatea nada
  de lo que Foundry ordena.** `STATION_ACTIONS` es la única autoridad real
  sobre qué puede ordenar un puesto de Foundry. Generalizar o "sincronizar"
  ambos modelos no es necesario ni deseable: resuelven problemas distintos
  (qué ve un cliente nativo vs. qué puede pedir un jugador de mesa a través
  del puente).

La correspondencia entre los 6 puestos de Foundry
(`foundry-module/scripts/station-assignment.mjs`: `captain`, `navigation`,
`engineering`, `sensors`, `communications`, `weapons`) y los 15
`CrewPosition` nativos es una **simplificación narrativa deliberada** para
una mesa reducida — agrupa roles que en una tripulación de 6-5 jugadores
nativos estarían más repartidos — y no un mapeo formal que haya que mantener
sincronizado si el motor añade o renombra un `CrewPosition`:

| Puesto Foundry | `CrewPosition` nativos relacionados (orientativo, no normativo) |
|---|---|
| `captain` | ninguno directo — coordinación, no una pantalla nativa concreta |
| `navigation` | `helmsOfficer`, `singlePilot` |
| `engineering` | `engineering`, `engineeringAdvanced`, `powerManagement`, `damageControl` |
| `sensors` | `scienceOfficer` |
| `communications` | `relayOfficer`, `commsOnly`, `operationsOfficer` |
| `weapons` | `weaponsOfficer`, `tacticalOfficer` |

## Lo que deliberadamente NO se expone

**El hackeo de Relay** (ADR-0010). No es un hueco pendiente: el minijuego vive
entero en el cliente nativo y el servidor no valida su resultado, así que una
orden de puente sería «este sistema queda hackeado» sin coste ni destreza. Se
juega en la pantalla nativa de Relay. Si alguna vez se expone, el orden es
primero la validación en el servidor (upstream, ADR-0007), después el binding y
solo entonces la orden.

Es también el criterio general para cualquier candidato futuro: **una acción
entra en esta matriz si el juego valida su efecto server-side.** Si el único
control está en la GUI que la pide, exponerla no traslada la agencia, la borra.

## Migración futura

Si `STATION_ACTIONS` se generaliza más allá de la matriz cerrada actual
(por ejemplo, para expresar visibilidad por puesto de verdad, o compartir
vocabulario entre el bridge y una futura superficie de permisos en el
núcleo standalone-first, ADR-0008), ese trabajo es posterior y con su propio
issue — este documento es la referencia de partida, no la implementación.
B2-B5 no esperan a esa migración: siguen usando `STATION_ACTIONS` tal cual
existe hoy.
