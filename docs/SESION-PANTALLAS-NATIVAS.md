# Verificación de pantallas nativas restantes — revisión de código

Subissue [#460](https://github.com/VaroTv7/espaciokooplagunak/issues/460)
(Etapa B, punto B0 de #459). Cubre las seis pantallas nativas de EmptyEpsilon
sin sesión de playtest documentada: Science, Relay, Engineering avanzada,
Operations, Comms y Damage Control.

## Método y su limitación

A diferencia de [`SESION-FASE1.md`](SESION-FASE1.md), este documento **no es
una sesión de playtest con el binario en marcha**: se ha hecho con revisión
exhaustiva del código fuente (`src/screens/`, `src/screenComponents/`), no con
el juego compilado y ejecutado. El entorno usado para esta revisión no tenía
toolchain de compilación (`cmake`/`ninja`/`g++`) ni el repo hermano
`SeriousProton`, así que compilar y abrir la GUI no era posible — y por
disciplina del repo (`CLAUDE.md`) no se afirma que una pantalla "funciona" o
"se comporta así en juego" sin haberlo comprobado ejecutándola.

Lo que sigue es, por tanto, **qué ofrece cada pantalla según su código**: qué
acciones cambian estado real de la partida (no solo navegación de UI), qué
información asimétrica expone, y si es jugable de forma autónoma sin que el
GM tenga que actuar por el jugador. Queda pendiente una sesión real con el
binario compilado y, si es posible, más de una persona conectada — igual que
hizo `SESION-FASE1.md` — para confirmar en vivo lo que aquí se documenta por
lectura de código. Ese hueco se dedica explícitamente al final de este
documento en vez de darlo por cerrado.

## Resumen por pantalla

### Science (`src/screens/crew6/scienceScreen.{h,cpp}`)

- **Acciones:** seleccionar objetivo en el radar, iniciar escaneo
  (`SCAN_BUTTON` / tecla dedicada), zoom de radar, alternar vista desde sonda
  vinculada (`probe_view_button`), abrir la ficha de Database del objetivo
  escaneado.
- **Información asimétrica:** estado de escaneo progresivo del objetivo
  (no escaneado → IFF → simple → completo), y con él facción, tipo, escudos,
  casco, frecuencias de escudo/haz y descripción narrativa.
- **¿Autónoma?** Sí — escanear y decidir qué observar es una decisión propia
  y suficiente sin intervención del GM.
- **Solape:** es la base íntegra de Operations, que instancia `ScienceScreen`
  internamente y solo sustituye los callbacks del radar.

### Relay (`src/screens/crew6/relayScreen.{h,cpp}`)

- **Acciones:** crear/mover/borrar waypoints, lanzar sonda a una posición,
  enlazar/desenlazar una sonda propia a Science, iniciar hackeo de un
  objetivo (`GuiHackingDialog`, si la nave tiene `HackingDevice`), abrir
  comunicaciones, cambiar el **nivel de alerta de la nave**
  (`GuiAlertLevelSelect`), centrar/zoom del radar.
- **Información asimétrica:** reputación de facción del objetivo, reloj de
  misión, disponibilidad de hackeo.
- **¿Autónoma?** Sí, y es la más rica de las seis: gestión táctica, sondas,
  hackeo y alerta de nave sin depender del GM.
- **Solape:** waypoints/sondas/comms se duplican en Operations (versión
  recortada). El nivel de alerta y el hackeo son exclusivos de Relay entre
  las seis pantallas revisadas.

### Engineering avanzada (`src/screens/crew4/engineeringAdvancedScreen.{h,cpp}`, sobre `src/screens/crew6/engineeringScreen.{h,cpp}`)

- **Acciones:** ajustar potencia y refrigerante por sistema (slider por fila,
  slider lateral una vez seleccionado el sistema, o niveles fijos por
  teclado), redistribuir refrigerante no asignado arrastrando la barra
  sobrante, autodestrucción, mover tripulación de reparación por la nave
  (clic en sala o teclas de dirección), y — exclusivo de la variante
  "avanzada" — activar/desactivar escudos y fijar su frecuencia manualmente.
- **Información asimétrica:** salud/calor por sistema, efectos derivados de
  cada sistema (velocidad de giro, cadencia de disparo, recarga de salto…),
  posición y estado de cada reparador interno.
- **¿Autónoma?** Sí, plenamente — gestión de energía/calor/reparación es el
  núcleo del puesto.
- **Solape:** el control de tripulación de reparación es literalmente el
  mismo componente (`GuiShipInternalView`) que usa Damage Control en
  solitario. El propio código señala duplicación de lógica de energía con
  `src/screens/extra/powerManagement.{h,cpp}` (no revisado en detalle aquí,
  pendiente si se decide consolidar).

### Operations (`src/screens/crew4/operationsScreen.{h,cpp}`)

- **Acciones:** todas las de Science (hereda la pantalla completa) más
  waypoints (crear/borrar) y comunicaciones — sin hackeo, sin lanzamiento de
  sondas, sin enlace ciencia-sonda, sin nivel de alerta.
- **Información asimétrica:** la misma de Science más reputación/reloj de
  misión (igual que en Relay).
- **¿Autónoma?** Sí — pensada para tripulaciones reducidas (crew4) como
  combinación ligera de Science+Relay.
- **Solape:** no aporta ninguna acción propia nueva; es composición directa
  de Science + un subconjunto de Relay.

### Comms (`src/screens/extra/commsScreen.{h,cpp}`, sobre `src/screenComponents/commsOverlay.{h,cpp}`)

- **Acciones:** contestar/ignorar una llamada entrante, cancelar/cerrar un
  canal, reconocer el fin de una llamada, enviar mensaje de chat libre a otra
  nave/GM, elegir una opción de diálogo scripteado con un NPC/objeto.
- **Información asimétrica:** contenido del canal activo y las opciones de
  diálogo específicas de ese encuentro — invisible para el resto de puestos
  salvo que también incluyan `GuiCommsOverlay` (Relay con comms habilitadas,
  y Operations).
- **¿Autónoma?** Parcial — puede gestionar y responder canales ya abiertos,
  pero **no puede iniciar una comunicación por sí sola**: no tiene selector
  de objetivo (radar), así que depende de ser hailed o de que Relay/Operations
  abran el canal primero. Es reactiva, no proactiva.
- **Solape:** total con el `GuiCommsOverlay` embebido en Relay/Operations;
  Comms standalone solo añade el registro de bitácora (`ShipsLog`) sin picker
  de objetivo propio.

### Damage Control (`src/screens/extra/damcon.{h,cpp}`, sobre `src/screenComponents/shipInternalView.{h,cpp}`)

- **Acciones:** seleccionar un reparador (clic o tecla de ciclado), ordenar
  su movimiento a una sala (clic en el mapa o teclas de dirección).
- **Información asimétrica:** posición/animación de cada reparador, layout de
  salas y puertas, salud de casco y de cada subsistema con codificación de
  color por sala.
- **¿Autónoma?** Sí — es el puesto con la agencia física más directa sobre el
  estado de la nave (mover personal, no solo ajustar sliders), plenamente
  jugable sin GM.
- **Solape:** subconjunto exacto de lo que ya incluye Engineering avanzada
  (mismo componente `GuiShipInternalView`); su única razón de ser es aislar
  ese rol para configuraciones de tripulación que separan "mover reparadores"
  de "gestionar energía".

### Referencia — Database (`src/screens/extra/databaseScreen.{h,cpp}`)

No es una de las seis del alcance, pero es relevante por reutilizar el mismo
`DatabaseViewComponent` que usa Science internamente. Es pantalla completa de
consulta de la base de datos de facciones/naves/objetos ya conocidos — 100%
solo-lectura/apoyo, sin ninguna decisión que cambie el estado de la partida en
curso. Se cita como precedente de "información de apoyo sin agencia", útil de
contraste frente a las seis pantallas de arriba.

## Tabla resumen

| Pantalla | Acciones que cambian estado | ¿Autónoma? | Solape principal |
|---|---|---|---|
| Science | Escanear, seleccionar objetivo, zoom, vista de sonda | Sí | Base de Operations |
| Relay | Waypoints, sondas, enlace ciencia-sonda, hackeo, alerta, comms | Sí (la más completa) | Subconjunto duplicado en Operations |
| Engineering avanzada | Potencia/refrigerante por sistema, autodestrucción, mover reparadores, escudos manuales | Sí | Reparadores = Damage Control; posible duplicación con `powerManagement` |
| Operations | Science completo + waypoints + comms | Sí | Composición de Science+Relay, sin acción propia nueva |
| Comms | Contestar/cancelar/chatear/elegir diálogo | Parcial (no inicia comms) | Mismo `GuiCommsOverlay` que Relay/Operations |
| Damage Control | Seleccionar y mover reparadores | Sí | Subconjunto exacto de Engineering avanzada |

## Conclusiones para el resto de Etapa B

- **Ninguna de las seis pantallas está vacía de agencia** — la premisa de
  #459 de que "quizá ya hay agencia nativa que solo falta documentar" se
  confirma parcialmente: Science, Relay, Engineering, Operations y Damage
  Control ya dan decisiones reales por código. Lo que falta no es agencia
  nativa, sino **exponerla desde Foundry** (`STATION_ACTIONS` en
  `foundry-module/scripts/station-actions.mjs` solo cubre navegación,
  potencia/refrigerante y escudos — una fracción de lo que el nativo ya
  permite).
- **Comunicaciones (Comms) es la excepción real**: por diseño nativo depende
  de que otro puesto (Relay/Operations) abra el canal, no tiene agencia
  propia de iniciar contacto. Esto afecta el alcance de
  [#463](https://github.com/VaroTv7/espaciokooplagunak/issues/463) (B3):
  la acción de "iniciar comunicación" en Foundry probablemente debe salir de
  la selección de objetivo de Relay/Operations, no inventarse un picker
  nuevo en un hipotético puesto de comms aislado.
- **Sensores/ciencia (B2, [#462](https://github.com/VaroTv7/espaciokooplagunak/issues/462))**
  ya tiene una mecánica nativa completa de escaneo progresivo
  (`ScanState`) que Foundry no expone en absoluto hoy: la acción a añadir a
  `STATION_ACTIONS` es sobre todo "traducir a orden de puente" lo que ya
  existe nativo (iniciar escaneo de un objetivo, consultar su nivel actual),
  no diseñar una mecánica nueva desde cero.
- **Duplicación interna a vigilar, no a resolver en Etapa B:** Engineering
  avanzada y Damage Control comparten literalmente el mismo componente de
  gestión de reparadores, y el propio código de Engineering admite
  duplicación de lógica de energía con `extra/powerManagement.cpp`. No forma
  parte del criterio de aceptación de B0 ni de #459, se deja anotado para no
  perderlo si se toca esa área más adelante.

## Pendiente — verificación en vivo

Este documento cumple la parte de "documentar qué hace cada pantalla según su
código", pero **no sustituye una sesión real** con el binario compilado y
GUI abierta, como sí tiene `SESION-FASE1.md`. Queda pendiente, para quien
disponga de entorno gráfico y toolchain de compilación (`docs/BUILDING.md`):

- Confirmar en juego que las acciones aquí listadas se comportan como el
  código sugiere (en particular la interacción de escaneo con `Probe View`,
  la redistribución automática de refrigerante, y las opciones de diálogo
  scripteadas de Comms, que dependen de contenido del escenario).
- Repetir, si es posible, el patrón de `SESION-FASE1.md`: varias personas
  conectadas a distintos puestos, cada una narrando qué pudo decidir por sí
  misma.
- Actualizar este documento con el resultado observado si difiere de lo aquí
  documentado por código.
