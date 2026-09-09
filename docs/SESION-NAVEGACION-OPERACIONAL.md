# Verificación: ¿satisface navegación el criterio de salida de Etapa B? (#480)

Subissue de #479, mismo patrón que B0 (#460): verificación por revisión de código, no
construcción. Contrasta lo ya implementado para el puesto `navigation` contra el criterio
de salida de Etapa B (`docs/ROADMAP_PRODUCTO.md`):

> cada puesto ocupado dispone de una decisión exclusiva que puede cambiar el resultado
> del encuentro.

## Qué hay implementado

- **Acciones autorizadas para el puesto** — `STATION_ACTIONS.navigation` en
  [`foundry-module/scripts/station-actions.mjs`](../foundry-module/scripts/station-actions.mjs)
  concede `set_target_heading`, `set_impulse` y `set_warp`, con rangos validados por el
  puente (rumbo 0..360, impulso −1..1, warp entero 0..4) en
  [`bridge/command_models.py`](../bridge/command_models.py).
- **Formularios de puesto reales** — `station-order-forms.mjs` declara las tres órdenes
  como formularios de jugador (no solo de GM), y `station-workspaces.mjs`
  (`canOrderHeading`/`canOrderImpulse`/`canOrderWarp`) las habilita para quien ocupa el
  puesto y es GM-excluido (`!isGM`) — la decisión la toma el tripulante, no el GM.
- **Autoridad y relé** — igual que el resto de puestos (#237), la orden se resuelve por
  el `User` autenticado en `station-order-relay.mjs`, no por lo que declare el payload.
- **Requisito de puesto propio** — `requisitos-puesto.mjs` liga navegación a `int`/`wis`,
  distinto del resto de puestos, reforzando que es una decisión con perfil propio y no un
  duplicado de otra estación.
- **Feedback dedicado** — `proyeccion-puesto.mjs` proyecta rumbo y vector solo para
  `navigation`, y el visor del piloto (#362,
  [`visor-piloto.mjs`](../foundry-module/scripts/visor-piloto/visor-piloto.mjs)) da lectura 3D propia
  del puesto.
- **Estado en el puente** — `/v1/state` publica `destination`/`distance_to_destination`/
  `eta_seconds` (`bridge/lua_templates.py`); es telemetría de lectura, no la decisión en
  sí — la decisión es la orden de rumbo/impulso/warp que cambia esa telemetría.
- **Probado** — cubierto en `station-actions.test.mjs`, `station-workspaces.test.mjs`,
  `station-workspace-ui.test.mjs`, `station-order-relay.test.mjs`,
  `station-assignment.test.mjs` y `proyeccion-puesto.test.mjs` (Node, sin mock de
  Foundry en la lógica pura), más registrado como probado manualmente en
  `docs/SESION-FASE1.md` para el HUD de rumbo/impulso/energía en Timón.

## Contraste con el criterio de salida

Rumbo, impulso y warp son la única vía para huir, perseguir, esquivar una amenaza de
área o llegar a tiempo a un objetivo — afectan directamente el resultado de un
encuentro, y solo puede emitirlas quien ocupa el puesto `navigation`. Eso es lo que pide
el criterio: una decisión exclusiva del puesto que puede cambiar el resultado. La
telemetría de destino/ETA en `/v1/state` no es la decisión — es la señal que informa la
decisión, igual que las lecturas de sensores informan al puesto de ciencia sin ser ellas
mismas la acción.

## Candidatos evaluados y descartados para este issue

El issue #480 proponía evaluar, sin comprometerse a construir:

- **Decisión de ruta compartida con el resto de la tripulación** — hoy destino/ETA es
  lectura para toda la tripulación (telemetría común), y la orden de rumbo es exclusiva
  de navegación; no hay ambigüedad de autoridad que resolver. Se descarta: no hace falta
  una capa de "voto" para que la decisión sea real, el resto de puestos de Etapa B (armas,
  sensores) tampoco requieren consenso previo.
- **Maniobras evasivas con compromiso, más allá de girar/acelerar** — no existe hoy una
  acción de "maniobra evasiva" con un coste o compromiso explícito distinto de fijar
  rumbo/impulso. Es una idea real de expansión (p. ej. un modificador temporal a cambio
  de vulnerabilidad), pero el criterio de salida no exige *más* decisiones por puesto,
  exige *al menos una* que importe — y esa ya existe. Se deja fuera de alcance de #480 sin
  abrir subissue: no hay demanda de playtest (#467, en curso) que la señale como hueco.
- **Coordinación de rumbo con sensores/armas durante un encuentro** — ya ocurre de forma
  orgánica hoy: el rumbo cambia qué contactos entran en alcance de sensores/armas. No es
  una decisión de puesto nueva, es una consecuencia del sistema ya existente.

## Conclusión

El criterio de salida de Etapa B para navegación **ya está satisfecho** por lo
implementado (`set_target_heading`/`set_impulse`/`set_warp` como formularios de puesto,
con autoridad, requisitos y feedback propios, y cobertura de test). No se identifica una
decisión real que falte — no se abre subissue nuevo. Queda pendiente, igual que el resto
del vertical de agencia, la validación en vivo del playtest #467 con el binario
compilado.
