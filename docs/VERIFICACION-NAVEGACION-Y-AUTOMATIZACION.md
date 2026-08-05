# Verificación — navegación operacional y automatización de puestos vacíos

Sesiones de verificación de código (sin construcción) para dos frentes de la
Etapa B trazados en #479: #480 (navegación operacional) y #481 (automatización
de puestos sin tripulación). Mismo patrón que B0 (#460): contrastar lo ya
implementado contra el criterio de salida de la etapa antes de diseñar nada.

## #480 — Navegación operacional

**Criterio de salida de Etapa B:** *"cada puesto ocupado dispone de una
decisión exclusiva que puede cambiar el resultado del encuentro."*

Lo ya implementado para `navigation`:

- `STATION_ACTIONS.navigation` (`foundry-module/scripts/station-actions.mjs`)
  autoriza `set_target_heading`, `set_impulse`, `set_warp` — las tres únicas
  decisiones exclusivas del puesto de Timón, ya validadas de extremo a extremo
  por `bridge/command_models.py` y `bridge/tests/test_commands.py`.
- La pantalla nativa de Timón ya se probó en vivo en
  [`SESION-FASE1.md`](SESION-FASE1.md): HUD de rumbo/energía/impulso, con
  `Undock` disponible como acción de puesto adicional.
- `/v1/state` (`bridge/lua_templates.py`) publica `destination`,
  `distance_to_destination` y `eta_seconds`, pero **son lectura, no una
  decisión**: `destination` es un único objeto de escenario fijo (el waypoint
  con indicativo `LAGUNAK_ROUTE_s90_argia` que coloca
  `scenario_90_lagunak_primera_guardia.lua`), no una ruta que la tripulación
  elija ni negocie. Es telemetría de apoyo al piloto, análoga al ETA de un
  GPS, no una superficie de puesto.

**Conclusión:** el criterio de salida ya está satisfecho para navegación.
Fijar rumbo, impulso y nivel de warp es exactamente el mismo tipo de decisión
exclusiva de puesto que ya se acepta como agencia real en ingeniería
(`set_system_power`/`set_system_coolant`) o armas (`set_shields`): el timonel
decide cómo posicionar la nave durante un encuentro (cerrar distancia, huir,
maniobrar), y esa decisión cambia el resultado tanto como bajar un escudo o
redirigir energía. No hace falta una "decisión de ruta compartida" adicional
para cumplir el criterio — eso sería una función de campaña (elegir destino
narrativo), no de puesto operacional, y queda fuera del alcance de Etapa B tal
como la define el propio criterio de salida.

No se abre ningún subissue nuevo. `docs/ROADMAP_PRODUCTO.md` queda actualizado
para reflejar navegación como frente satisfecho.

## #481 — Automatización nativa de puestos sin tripulación

Revisión de código en `src/` (sin verificación en vivo: no fue necesaria
porque el propio código ya es concluyente — ausencia total de lógica
condicionada a ocupación de puesto en los sistemas de la nave).

- `PlayerInfo::hasPlayerAtPosition` (`src/playerInfo.h`/`.cpp`) es el único
  punto del código que consulta si un puesto tiene jugador, y su único uso es
  en `src/menus/shipSelectionScreen.cpp:614` — pintar la pantalla de selección
  de nave, no gameplay.
- Los sistemas de la nave (`src/multiplayer/impulse.cpp`, `warp.cpp`,
  `shields.cpp`, `reactor.cpp`, `beamweapon.cpp`, `missiletubes.cpp`…) son
  componentes ECS que solo cambian de valor cuando reciben una orden
  explícita (del jugador o de un script de escenario). Ninguno consulta
  ocupación de puesto: un sistema sin nadie en su puesto simplemente se queda
  congelado en su último valor ordenado — no hay IA de respaldo, ni
  degradación automática, ni sustitución del jugador ausente.
- `commandSetAutoRepair`/`auto_repair_enabled`
  (`src/systems/internalcrew.cpp`, `src/components/internalrooms.h`) **no**
  es automatización condicionada a un puesto vacío: es un interruptor de nave
  completa que activa la tripulación interna de reparación (NPC de daños
  internos) con independencia de qué puestos de mando estén ocupados. Ya
  existe y ya está disponible hoy mismo, ocupado o no el puesto de
  Ingeniería.
- `src/ai/` gobierna naves de facción (enemigos/NPC), no sustituye puestos
  vacíos en la nave del jugador. `singlePilot` (`src/crewPosition.h`,
  `src/screens/crew1/singlePilotScreen.cpp`) es una **elección manual** de un
  jugador para fusionar varios puestos bajo su control, no un mecanismo
  automático que se active al quedar un puesto vacío.

**Conclusión:** no existe automatización nativa alguna para puestos sin
tripulación asignada, más allá del interruptor general de reparación interna
(que no distingue por puesto). Un sistema sin jugador que lo atienda queda
congelado en su último valor — escudos donde se dejaran, energía donde se
dejara, sin nadie disparando ni escaneando. Diseñar automatización propia (en
el puente/Foundry) para puestos vacíos parte de cero: tendría que decidir
explícitamente su alcance (¿se congela el valor, que es lo que ya ocurre por
defecto? ¿se aplica un valor de seguridad? ¿pasa a control del GM?) en un
subissue de diseño propio, no asumir un comportamiento nativo que no existe.

`docs/ROADMAP_PRODUCTO.md` queda actualizado para reflejar que este frente
sigue sin resolver y requiere diseño explícito antes de construirse.

## Fuera de alcance

Ninguna de las dos verificaciones implementa código nuevo, conforme al
alcance declarado en #480 y #481.
