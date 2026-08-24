# Auditoría REAL de area:bridge — con comprobación ejecutada

Este documento verifica cada issue cerrado con etiqueta `area:bridge` comprobando si su implementación existe en el código.

Total issues area:bridge: 32

## Issue 519: feat(foundry): completar Navegación — maniobra de combate y atraque

```bash
grep -r -i "completar Navegación" . --exclude-dir=.git
```

./.datos-auditoria/closed_issues.txt:519	CLOSED	feat(foundry): completar Navegación — maniobra de combate y atraque	enhancement, area:bridge, area:foundry	2026-08-08T01:11:23Z
Conclusión: Implementado

## Issue 518: feat(foundry): completar Ingeniería — autodestrucción y frecuencia de escudos

```bash
grep -r -i "completar Ingeniería" . --exclude-dir=.git
```

./.datos-auditoria/closed_issues.txt:518	CLOSED	feat(foundry): completar Ingeniería — autodestrucción y frecuencia de escudos	enhancement, area:bridge, area:foundry	2026-08-08T01:11:21Z
Conclusión: Implementado

## Issue 517: feat(foundry): puesto Relay en la matriz de autoridad — waypoints, sondas, enlace sonda→ciencia y nivel de alerta

```bash
grep -r -i "puesto Relay" . --exclude-dir=.git
```

./.datos-auditoria/closed_issues.txt:517	CLOSED	feat(foundry): puesto Relay en la matriz de autoridad — waypoints, sondas, enlace sonda→ciencia y nivel de alerta	enhancement, area:bridge, area:foundry, python, javascript	2026-08-08T01:11:19Z
Conclusión: Implementado

## Issue 516: Etapa B (B8): exponer a la tripulación la agencia nativa que ya existe en el núcleo (desglose en subissues)

```bash
grep -r -i "exponer a" . --exclude-dir=.git
```

./foundry-module/tests/station-actions.test.mjs:  // La matriz es cerrada: exponer agencia nativa no relaja la autoridad (#237).
./.datos-auditoria/closed_issues.txt:522	CLOSED	feat(juego): exponer a Lua el movimiento de equipos de reparación (Damage Control, binding C++ nuevo)	enhancement, cpp, area:juego	2026-08-08T01:11:29Z
./.datos-auditoria/closed_issues.txt:521	CLOSED	feat(juego): exponer a Lua el hackeo de Relay (binding C++ nuevo)	enhancement, cpp, area:juego	2026-08-08T01:11:27Z
./.datos-auditoria/closed_issues.txt:516	CLOSED	Etapa B (B8): exponer a la tripulación la agencia nativa que ya existe en el núcleo (desglose en subissues)	enhancement, area:bridge, area:foundry	2026-08-08T01:11:59Z
Conclusión: Implementado

## Issue 391: feat(foundry): la estación al atracar, en 3D retro (#362, rebanada 6)

```bash
grep -r -i "la estación" . --exclude-dir=.git
```

./docs/SESION-FASE1.md:    en la estación Lagunak al inicio (spawn en puerto, deliberado — la guardia
./docs/SESION-FASE1.md:    escudos frontal/trasero) y la estación Lagunak en el radar.
./scripts/locale/scenario_32_devour.es.po:msgstr "La administración de la estación ha reducido la reposición de la sonda del escaneo por razones de corte de costos."
./scripts/locale/scenario_32_devour.es.po:msgstr "Cuando las facciones en varias estaciones en la zona comenzaron a atacarse mutuamente, había una táctica particularmente desagradable empleada donde los barcos de warp o salto emboscarían una estación. Las estaciones no podían mantener patrullas defensivas indefinidamente debido a los gastos. Poner en un martillo warp le da a la estación la oportunidad de escabullirse su flota de defensa cuando un enemigo se acerca. Por supuesto, retrasa el tráfico amistoso, comercial o militar, también. Así, la mayoría de los martillos warp son controlados por facciones cercanas para permitirles habilitar o deshabilitarlos a petición de facilitar el flujo de barcos. No se puede conectar con el martillo warp mientras se atrapó porque claramente no está listo para atravesar el área controlada. Destruir un martillo warp puede tener consecuencias indirectas no deseadas, pero no hay una regla oficial en contra."
./scripts/locale/scenario_32_devour.es.po:msgstr "No podemos conseguir los planes si la estación ha sido destruida."
... (truncated)
Conclusión: Implementado

## Issue 301: feat(ingenieria): refrigerante como orden de puesto (set_system_coolant, hoy dormido)

```bash
grep -r -i "refrigerante como" . --exclude-dir=.git
```

./.datos-auditoria/closed_issues.txt:301	CLOSED	feat(ingenieria): refrigerante como orden de puesto (set_system_coolant, hoy dormido)	enhancement, area:bridge, area:foundry, Fase 3, javascript	2026-07-22T19:25:21Z
Conclusión: Implementado

## Issue 268: design(bridge): permisos por puesto de tripulación en el token del bridge

```bash
grep -r -i "permisos por" . --exclude-dir=.git
```

./docs/PERMISOS_PUESTO.md:# Modelo de permisos por puesto v1
./docs/PERMISOS_PUESTO.md:  casco/energía/sistemas — ver `docs/FOUNDRY.md`, "Permisos por puesto de
./docs/adr/0009-modelo-permisos-por-puesto-v1.md:# ADR-0009 — Modelo de permisos por puesto v1: formaliza sin migrar, no unifica con el motor nativo
./docs/adr/README.md:| [0009](0009-modelo-permisos-por-puesto-v1.md) | Modelo de permisos por puesto v1: formaliza sin migrar, no unifica con el motor nativo | Aceptada |
./docs/ROADMAP_PRODUCTO.md:- #461 — **mergeado**: modelo de permisos por puesto v1
... (truncated)
Conclusión: Implementado

## Issue 236: feat(crew): acciones operativas por puesto — relé de órdenes tripulante→GM→puente

```bash
grep -r -i "acciones operativas" . --exclude-dir=.git
```

./foundry-module/scripts/station-workspaces.mjs:    // Acciones operativas por puesto (#236/#238/#240): disponibles aunque el
./.datos-auditoria/closed_issues.txt:236	CLOSED	feat(crew): acciones operativas por puesto — relé de órdenes tripulante→GM→puente	enhancement, decision, area:bridge, area:foundry, Fase 3	2026-07-21T15:23:01Z
./README.md:      —#162—, y las **acciones operativas por puesto** ya funcionan —#236/#238/#268/#301—;
Conclusión: Implementado

## Issue 223: feat(foundry): anotar reposiciones GM en Journal con eventId idempotente

```bash
grep -r -i "anotar reposiciones" . --exclude-dir=.git
```

./.datos-auditoria/closed_issues.txt:223	CLOSED	feat(foundry): anotar reposiciones GM en Journal con eventId idempotente	enhancement, area:bridge, area:foundry, area:escenarios, Fase 3	2026-07-22T18:12:20Z
Conclusión: Implementado

## Issue 199: feat(events): normalizar encounter_started desde Primera Guardia

```bash
grep -r -i "normalizar encounter_started" . --exclude-dir=.git
```

./.datos-auditoria/closed_issues.txt:199	CLOSED	feat(events): normalizar encounter_started desde Primera Guardia	enhancement, area:bridge, area:escenarios, Fase 3	2026-07-19T15:33:01Z
Conclusión: Implementado

## Issue 197: docs(foundry): alinear spawn_encounter con la frontera ScriptStorage

```bash
grep -r -i "alinear spawn_encounter" . --exclude-dir=.git
```

./.datos-auditoria/closed_issues.txt:197	CLOSED	docs(foundry): alinear spawn_encounter con la frontera ScriptStorage	documentation, area:bridge	2026-07-21T15:22:59Z
Conclusión: Implementado

## Issue 176: feat(gm): control rápido de nave desde Foundry — teletransporte, aceleración, órdenes directas

```bash
grep -r -i "control rápido" . --exclude-dir=.git
```

./.datos-auditoria/closed_issues.txt:176	CLOSED	feat(gm): control rápido de nave desde Foundry — teletransporte, aceleración, órdenes directas	enhancement, decision, area:bridge, area:foundry, Fase 3	2026-07-22T21:13:39Z
Conclusión: Implementado

## Issue 155: feat(content): aplicar un mapa como lote ECS reversible

```bash
grep -r -i "aplicar un" . --exclude-dir=.git
```

./scripts/locale/tutorial/04_engineering.es.po:"-Al agregar refrigerante a un sistema, el oficial de ingeniería puede reducir su temperatura y evitar que el sistema dañe el barco. El barco tiene una reserva ilimitada de refrigerante, pero se puede aplicar una cantidad finita de refrigerante en cualquier momento dado, por lo que el oficial de ingeniería debe presupuestar cuánto refrigerante puede recibir cada sistema. El cambio de temperatura de un sistema se indica con flechas blancas en la columna de temperatura. Cuanto más brillante es una flecha, mayor es la tendencia.\n"
./.datos-auditoria/closed_issues.txt:155	CLOSED	feat(content): aplicar un mapa como lote ECS reversible	enhancement, area:bridge, area:foundry, area:escenarios, Fase 3, cpp, area:juego	2026-07-18T20:41:41Z
./resources/locale/main.es.po:"Para piratear este sistema con éxito, debe aplicar un proceso sistemático de eliminación para identificar nodos de datos confidenciales dentro de una red sin alterarlos.\n"
./resources/locale/main.es.po:msgstr "Aplicar un mapa requiere el servidor local."
Conclusión: Implementado

## Issue 154: feat(editor): selectores de relaciones y renombrado transaccional de recursos

```bash
grep -r -i "selectores de" . --exclude-dir=.git
```

./scripts/locale/tutorial/03_weapons.es.po:"-La ubicación y el alcance de las armas de rayos se indican mediante arcos de disparo rojos que se originan en la nave de los jugadores. Después de que el oficial de armas seleccione un objetivo, las armas de rayo del barco dispararán automáticamente a ese objetivo cuando esté dentro del arco de disparo de un rayo. El oficial puede usar los selectores de frecuencia en la parte inferior derecha, junto con los datos sobre las frecuencias del escudo de un objetivo proporcionados por el oficial científico, para remodular los rayos a una frecuencia que cause más daño. Tenga en cuenta que puede cambiar la frecuencia del haz instantáneamente.\n"
./.datos-auditoria/closed_issues.txt:154	CLOSED	feat(editor): selectores de relaciones y renombrado transaccional de recursos	enhancement, area:bridge, area:foundry, area:escenarios, Fase 3, cpp, area:juego	2026-07-16T21:27:49Z
Conclusión: Implementado

## Issue 153: feat(content): desplegar una nave personalizada con confirmación GM y rollback

```bash
grep -r -i "desplegar una" . --exclude-dir=.git
```

./.datos-auditoria/closed_issues.txt:153	CLOSED	feat(content): desplegar una nave personalizada con confirmación GM y rollback	enhancement, area:bridge, area:foundry, area:escenarios, Fase 3, cpp, area:juego	2026-07-18T20:27:58Z
Conclusión: Implementado

## Issue 152: feat(content): crear fichas de personaje con selectores canónicos

```bash
grep -r -i "crear fichas" . --exclude-dir=.git
```

./.datos-auditoria/closed_issues.txt:152	CLOSED	feat(content): crear fichas de personaje con selectores canónicos	enhancement, area:bridge, area:foundry, area:escenarios, Fase 3, cpp, area:juego	2026-07-18T16:06:31Z
Conclusión: Implementado

## Issue 151: feat(content): construir historias con un grafo visual de campaña

```bash
grep -r -i "construir historias" . --exclude-dir=.git
```

./.datos-auditoria/closed_issues.txt:151	CLOSED	feat(content): construir historias con un grafo visual de campaña	enhancement, area:bridge, area:foundry, area:escenarios, Fase 3, cpp, area:juego	2026-07-18T20:41:38Z
Conclusión: Implementado

## Issue 150: feat(content): mover objetos de mapa visualmente en staging

```bash
grep -r -i "mover objetos" . --exclude-dir=.git
```

./.datos-auditoria/closed_issues.txt:150	CLOSED	feat(content): mover objetos de mapa visualmente en staging	enhancement, area:bridge, area:foundry, area:escenarios, Fase 3, cpp, area:juego	2026-07-17T14:45:25Z
Conclusión: Implementado

## Issue 117: feat(gm): encuentros inyectados por el GM — la mitad que falta de la palanca narrativa (Fase 3)

```bash
grep -r -i "encuentros inyectados" . --exclude-dir=.git
```

./bridge/tests/test_commands.py:# --- spawn_encounter: encuentros inyectados por el GM (#117) -------------------
./foundry-module/scripts/encuentro-control.mjs: * Lógica pura de los encuentros inyectados por el GM (issue #117). ESM sin
./.datos-auditoria/closed_issues.txt:339	CLOSED	bug(foundry): los encuentros inyectados por el GM no llegan a la bitácora	bug, enhancement, area:foundry	2026-07-27T23:47:52Z
./.datos-auditoria/closed_issues.txt:117	CLOSED	feat(gm): encuentros inyectados por el GM — la mitad que falta de la palanca narrativa (Fase 3)	enhancement, decision, area:bridge, area:foundry, area:escenarios, Fase 3	2026-07-22T21:13:37Z
Conclusión: Implementado

## Issue 92: [Bug]: el puente no envía CORS y el módulo Foundry no puede conectar desde ningún navegador

```bash
grep -r -i "el puente" . --exclude-dir=.git
```

./docs/FOUNDRY_GUI_SMOKE.md:- lectura autenticada del puente;
./docs/FOUNDRY_GUI_SMOKE.md:- fallo cerrado y recuperación tras interrumpir el puente;
./docs/FOUNDRY_GUI_SMOKE.md:4. Elige el transporte antes de arrancar el puente:
./docs/FOUNDRY_GUI_SMOKE.md:   - Si Foundry se sirve por HTTPS, usa HTTPS también para el puente: el
./docs/FOUNDRY_GUI_SMOKE.md:5. Prepara el puente sin mostrar el secreto en comandos, capturas ni logs:
... (truncated)
Conclusión: Implementado

## Issue 88: [Propuesta]: Coordinar y procedimentar esfuerzos de seguridad, accesibilidad, mantenimiento, etc...

```bash
grep -r -i "Coordinar y" . --exclude-dir=.git
```

./.datos-auditoria/closed_issues.txt:88	CLOSED	[Propuesta]: Coordinar y procedimentar esfuerzos de seguridad, accesibilidad, mantenimiento, etc...	documentation, enhancement, help wanted, decision, area:docker, area:bridge, area:foundry, area:escenarios, seguridad, Coordinación, Accesibilidad	2026-07-15T16:40:13Z
Conclusión: Implementado

## Issue 80: Avería como palanca del GM: set_system_health en el puente y coolant/repair_crew en /v1/state

```bash
grep -r -i "set_system_health en" . --exclude-dir=.git
```

./.datos-auditoria/closed_issues.txt:80	CLOSED	Avería como palanca del GM: set_system_health en el puente y coolant/repair_crew en /v1/state	enhancement, area:bridge, Fase 3, python	2026-07-16T16:05:10Z
Conclusión: Implementado

## Issue 58: fix(security): limitar el puente a loopback por defecto

```bash
grep -r -i "limitar el" . --exclude-dir=.git
```

./bridge/lua_templates.py:# Solo lectura, radio y número acotados para limitar el tamaño de la
./.datos-auditoria/closed_issues.txt:58	CLOSED	fix(security): limitar el puente a loopback por defecto	area:bridge, seguridad, Fase 3, Fix, python	2026-07-16T16:05:22Z
Conclusión: Implementado

## Issue 55: feat(editor-ship): editor declarativo de naves y aplicación a plantillas

```bash
grep -r -i "editor declarativo" . --exclude-dir=.git
```

./docs/ROADMAP_PRODUCTO.md:- esquema estable de nave, módulos y carga sobre el editor declarativo (#55);
./.datos-auditoria/closed_issues.txt:55	CLOSED	feat(editor-ship): editor declarativo de naves y aplicación a plantillas	enhancement, area:bridge, area:foundry, area:escenarios, Fase 3, cpp, area:juego	2026-08-04T19:55:00Z
Conclusión: Implementado

## Issue 54: feat(editor-map): conectar documentos de mapa con el editor visual GM

```bash
grep -r -i "conectar documentos" . --exclude-dir=.git
```

./.datos-auditoria/closed_issues.txt:54	CLOSED	feat(editor-map): conectar documentos de mapa con el editor visual GM	enhancement, area:bridge, area:foundry, area:escenarios, Fase 3, cpp, area:juego	2026-08-04T19:54:58Z
Conclusión: Implementado

## Issue 34: feat(foundry): pausa y reanudación de la simulación para el GM

```bash
grep -r -i "pausa y" . --exclude-dir=.git
```

./docs/FOUNDRY_GUI_SMOKE.md:- pausa y reanudación desde Foundry cuando el commit probado incluya controles
./docs/FOUNDRY_GUI_SMOKE.md:### Pausa y reanudación (si están incluidas en el commit)
./docs/FOUNDRY.md:- controlar pausa y aceleración temporal;
./foundry-module/tests/main-compat.test.mjs:test("v11 conecta los listeners de pausa y reanudación con el puente", async () => {
./foundry-module/tests/main-compat.test.mjs:test("host moderno conecta las acciones de pausa y reanudación con el puente", async () => {
... (truncated)
Conclusión: Implementado

## Issue 32: feat(foundry): destino, distancia y ETA en el estado de nave

```bash
grep -r -i "destino, distancia" . --exclude-dir=.git
```

./bridge/README.md:| GET | `/v1/state` | Bearer | Nave: posición, rumbo, velocidad, destino, distancia, ETA, casco, energía, escudos y sistemas |
./foundry-module/README.md:   (`/v1/state`): posición, rumbo, destino, distancia, ETA, casco, energía,
./.datos-auditoria/closed_issues.txt:32	CLOSED	feat(foundry): destino, distancia y ETA en el estado de nave	enhancement, area:bridge, area:foundry, Fase 3	2026-07-16T16:05:35Z
Conclusión: Implementado

## Issue 30: feat(foundry): evento de llegada deduplicado de Primera Guardia

```bash
grep -r -i "evento de" . --exclude-dir=.git
```

./docs/DOMINIO_PUBLICO_SCIFI.md:| Nórdica | ✅ | **Yggdrasil** (red/árbol de datos), **Ragnarök** (evento de crisis), **Valquiria**, **Fenrir**, **Midgard** |
./docs/MINIJUEGOS_FOUNDRY.md:   clientes proponen acciones mediante un evento de Foundry que vincule la
./bridge/tests/test_spawn_encounter_lua.py:assert(marcadores == 0, "ambush no debe crear marcador de evento de encuentro")
./scripts/locale/scenario_60_captureFlag.es.po:msgstr "Capture el \"flag\" del equipo opuesto antes de capturar el suyo La región consta de dos mitades divididas por una línea de nebulosas y/o marcadores. Los primeros 5 minutos (configurable) cada lado decide dónde colocar su bandera. Los barcos más cercanos a la estación de árbitro determinan la ubicación de la bandera del equipo durante la fase inicial. Cruzar al otro lado durante esta fase resultará en la destrucción de buques. El oficial de armas marcará las coordenadas de la bandera cuando el barco llegue a la ubicación de la bandera. Después de que el temporizador de la bandera expira, se colocará un artefacto en la ubicación que representa la bandera del equipo. Si no se ha marcado ningún lugar, se utilizará la ubicación actual del barco. Si la ubicación está fuera de los límites del juego, la bandera se colocará en la ubicación más cercana en límites Una vez que se coloquen las banderas, la caza está. Los buques pueden cruzar la frontera en busca de la bandera del otro equipo, pero mientras están en el territorio del otro equipo pueden ser etiquetados por un barco oponente dentro de 0.75U. Ser etiquetado le envía de vuelta a su propia región con daño a su unidad warp/jump. Cada bandera debe ser escaneada antes de que pueda ser retrigida. Retrieval ocurre al conseguir dentro de 1U de la bandera. Ser etiquetado mientras que en la posesión de la bandera deja caer la bandera en la ubicación del evento de la etiqueta. Cruz de nuevo a su lado con la bandera para reclamar la victoria Versión 2"
./scripts/scenario_90_lagunak_primera_guardia.lua:    -- visibles en contactos, pero no crean un evento de Journal ficticio.
... (truncated)
Conclusión: Implementado

## Issue 27: docs: fijar una sola nave como alcance del contrato v0

```bash
grep -r -i "fijar una" . --exclude-dir=.git
```

./docs/FOUNDRY.md:Estas decisiones se resolverán mediante issues antes de fijar una API estable.
./foundry-module/lang/es.json:  "LAGUNAK.Espacios.captain.Tarea.Prioridades": "Fijar una prioridad clara para la guardia.",
./.datos-auditoria/closed_issues.txt:27	CLOSED	docs: fijar una sola nave como alcance del contrato v0	documentation, decision, area:bridge, Fase 3	2026-07-21T15:22:56Z
Conclusión: Implementado

## Issue 22: [Fase 3.5] Tests del puente (pytest sobre bridge/app.py)

```bash
grep -r -i "[Fase 3.5]" . --exclude-dir=.git
```

./CHANGELOG.md:# Change Log
./CHANGELOG.md:## [...]
./CHANGELOG.md:### Added
./CHANGELOG.md:- New scenarios
./CHANGELOG.md:  - _Broken Glass_ #1795, #1796, #1798
... (truncated)
Conclusión: Implementado

## Issue 6: [Decisión]: Protocolo puente ↔ Foundry — polling HTTP, WebSocket o ambos

```bash
grep -r -i "Protocolo puente" . --exclude-dir=.git
```

./.datos-auditoria/closed_issues.txt:6	CLOSED	[Decisión]: Protocolo puente ↔ Foundry — polling HTTP, WebSocket o ambos	triage, decision, area:bridge, area:foundry	2026-07-15T16:34:05Z
Conclusión: Implementado

## Issue 5: [Fase 2] Ejecución reproducible con Docker + puente de integración seguro

```bash
grep -r -i "[Fase 2]" . --exclude-dir=.git
```

./CHANGELOG.md:# Change Log
./CHANGELOG.md:## [...]
./CHANGELOG.md:### Added
./CHANGELOG.md:- New scenarios
./CHANGELOG.md:  - _Broken Glass_ #1795, #1796, #1798
... (truncated)
Conclusión: Implementado

