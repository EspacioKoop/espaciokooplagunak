# Verificación de pantallas nativas restantes

Subissue [#460](https://github.com/VaroTv7/espaciokooplagunak/issues/460)
(Etapa B, punto B0 de #459). Cubre las seis pantallas nativas de EmptyEpsilon
sin sesión de playtest documentada: Science, Relay, Engineering avanzada,
Operations, Comms y Damage Control.

**Estado de #460: en curso, no cerrado por este documento.** Esta sesión
confirma que cada pantalla funciona en solitario (un cliente por conexión),
pero no repite el patrón completo de `SESION-FASE1.md` (varias personas
reales conectadas a la vez narrando su experiencia) — entre otras cosas
porque, según se documenta más abajo, no se consiguió mantener dos clientes
simultáneos estables en esta build. Las conclusiones que este documento saca
para B2 ([#462](https://github.com/VaroTv7/espaciokooplagunak/issues/462)) y
B3 ([#463](https://github.com/VaroTv7/espaciokooplagunak/issues/463)) son
**alcance provisional basado en código y en esta verificación parcial**, no
un cierre definitivo — pueden cambiar si un playtest multijugador real
revela algo distinto.

## Método

Este documento combina dos pasadas:

1. **Revisión de código** (`src/screens/`, `src/screenComponents/`): qué
   acciones cambian estado real de la partida (no solo navegación de UI), qué
   información asimétrica expone cada pantalla, y si es jugable de forma
   autónoma sin que el GM tenga que actuar por el jugador.
2. **Verificación en vivo**, compilando el binario nativo en Windows
   (plataforma no validada hasta ahora — `docs/BUILDING.md` solo documenta
   Linux nativo y compilación cruzada para Windows) y conectando un cliente
   real a cada una de las seis pantallas contra un servidor headless con el
   escenario propio del fork.

### Entorno de compilación (Windows nativo, primera vez documentado)

- Windows 10 (10.0.19045), Visual Studio 2022 Community con el workload
  "Desarrollo para escritorio con C++" (MSVC 14.44.35207, CMake 3.31 y Ninja
  empaquetados con el IDE) — el workload no estaba instalado al empezar y se
  instaló con autorización explícita del usuario, dado que el propio
  `CLAUDE.md` prohíbe instalar paquetes de sistema sin ella.
- SDL2 2.30.9, paquete `SDL2-devel-2.30.9-VC.zip` (binarios oficiales de
  `libsdl-org/SDL`, variante VC), descomprimido junto al proyecto y apuntado
  con `-DSDL2_DIR=.../SDL2/cmake`.
- `SeriousProton` clonado como hermano según la estructura esperada.
- Configuración: `cmake -S . -B build -G Ninja -DSERIOUS_PROTON_DIR=../SeriousProton -DSDL2_DIR=<ruta>/SDL2/cmake -DWITH_DISCORD=OFF`,
  compilación con `cmake --build build --parallel` desde el "Developer Command
  Prompt" de VS2022 (`VsDevCmd.bat -arch=x64`). 613/613 unidades compiladas
  sin errores (solo warnings `C4530` ya presentes en el árbol de SeriousProton,
  no introducidos aquí). `SDL2.dll` debe copiarse junto al `.exe` a mano; el
  target de instalación no se ejecutó.
- Esta ruta de compilación **no está validada por CI** (que solo hace
  compilación cruzada para Windows, no build+ejecución nativa) ni por ningún
  documento previo del fork — se dilata aquí como referencia, pero no
  sustituye a `docs/BUILDING.md`; si se decide adoptarla de forma soportada
  debe documentarse allí en un PR aparte, no en este.

### Sesión en vivo

Servidor headless con el escenario propio (mismo patrón que
[`SESION-FASE1.md`](SESION-FASE1.md)):

```
EmptyEpsilon.exe headless=scenario_90_lagunak_primera_guardia.lua
```

Un cliente por pantalla, conectado con `autoconnect=<estación>` (nombres
según `crewPositionToString`/`tryParseCrewPosition` en `src/crewPosition.cpp`:
`science`, `relay`, `engineeringadvanced`, `operations`, `commsonly`,
`damagecontrol`). Cada pantalla se verificó **en conexión individual** (ver
limitación más abajo), capturando la ventana del proceso directamente
(`PrintWindow` sobre el `HWND`, no una captura de escritorio completo) para
confirmar visualmente lo que el código sugiere.

**Limitación encontrada — no se pudo validar multijugador real en esta
plataforma.** Al conectar un segundo cliente mientras el primero seguía
conectado al mismo servidor headless, el segundo cliente moría (`Segmentation
fault`) de forma reproducible, sin loguear siquiera el intento de conexión en
el servidor. Con un único cliente conectado a la vez, cada pantalla funciona
sin problema. No se ha diagnosticado la causa (podría ser específico de esta
build nativa de Windows sin validar, del hardware/GPU de esta máquina, o un
bug real de multijugador en esta plataforma) — se deja constancia aquí porque
es justo lo que `SESION-FASE1.md` sí verificó en Linux (dos clientes
simultáneos, sin problema). Si alguien retoma #29 ("smoke real multijugador")
en Windows nativo, este es el primer punto a reproducir.

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
- **Verificado en vivo:** sí. El cliente conectó y reclamó el puesto (título
  de ventana `Espaciokoop Lagunak (EmptyEpsilon) - Science`), radar con la
  nave propia (`Lagunak`) y dos contactos (`Lapur 1`, `Lapur 2`), botón
  `Scan` y sidebar de info (`Callsign`/`Distance`/`Bearing`/…) sin rellenar
  antes de escanear, botones `Radar`/`Database`/`Probe View` — tal cual
  describe el código.

### Relay (`src/screens/crew6/relayScreen.{h,cpp}`)

- **Acciones:** crear/mover/borrar waypoints, lanzar sonda a una posición,
  enlazar/desenlazar una sonda propia a Science, iniciar hackeo de un
  objetivo (`GuiHackingDialog`, si la nave tiene `HackingDevice`), abrir
  comunicaciones, cambiar el **nivel de alerta de la nave**
  (`GuiAlertLevelSelect`), centrar/zoom del radar.
- **Información asimétrica:** reputación de la **propia** facción
  (`Faction::getInfo(my_spaceship).reputation_points`, `relayScreen.cpp:334`
  — puntos globales del bando de la nave, no del objetivo), facción del
  objetivo por separado (`info_faction`, visible solo tras escaneo simple,
  `relayScreen.cpp:289-292`), reloj de misión, disponibilidad de hackeo.
- **¿Autónoma?** Sí, y es la más rica de las seis: gestión táctica, sondas,
  hackeo y alerta de nave sin depender del GM.
- **Solape:** waypoints/sondas/comms se duplican en Operations (versión
  recortada). El nivel de alerta y el hackeo son exclusivos de Relay entre
  las seis pantallas revisadas.
- **Verificado en vivo:** sí. Además de los botones (`Place waypoint`,
  `Launch probe (8)`, `Center on ship`, `Start hacking`, `Link to science`,
  `Alert level`), se vio en directo el mensaje de misión scripteado del
  escenario propio (control de Lagunak anunciando el objetivo de la primera
  guardia y el aviso de tráfico Exuari) en el panel de comunicaciones
  incrustado, con `Reputation` y `Clock` — confirma que Relay incluye comms
  completas, como documenta el código.

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
- **Verificado en vivo:** sí. `Self destruct`, tabla de sistemas
  (Reactor/Beam Weapons/Missile System/Maneuvering/Impulse Engines/Front y
  Rear Shield Generator) con barras de reparación/calor/energía/refrigerante,
  sliders `Power`/`Coolant` laterales, plano interior de la nave con los
  reparadores, y el control exclusivo de Advanced (`Calibrate`,
  `400THz`/`800THz Shields: OFF`) — todo presente y coincide con el código.

### Operations (`src/screens/crew4/operationsScreen.{h,cpp}`)

- **Acciones:** todas las de Science (hereda la pantalla completa) más
  waypoints (crear/borrar) y comunicaciones — sin hackeo, sin lanzamiento de
  sondas, sin enlace ciencia-sonda, sin nivel de alerta.
- **Información asimétrica:** la misma de Science más reputación de la propia
  facción y reloj de misión (`operationsScreen.cpp:132`, igual patrón que
  Relay — no es reputación del objetivo).
- **¿Autónoma?** Sí — pensada para tripulaciones reducidas (crew4) como
  combinación ligera de Science+Relay.
- **Solape:** no aporta ninguna acción propia nueva; es composición directa
  de Science + un subconjunto de Relay.
- **Verificado en vivo:** sí — y con un extra útil: la sesión capturó en
  directo un hail entrante (diálogo `Hailed by Lagunak` con botones
  `Answer`/`Ignore` superpuesto al radar), confirmando que Operations recibe
  y gestiona comunicaciones igual que documenta el código, junto con
  `Delete waypoint`/`Place waypoint`, `Reputation`, `Clock` y el radar
  heredado de Science.

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
- **Verificado en vivo:** sí, con una nota de proceso: la ventana del cliente
  se abrió minimizada por defecto (comportamiento de la ventana en esta
  plataforma/build, no del juego) y hubo que restaurarla para capturarla.
  Una vez visible, mostró el mismo mensaje scripteado de la misión con el
  botón `Close` y el registro de bitácora (`00:00:08: Control de Lagunak,
  corto.`) — coincide con el código: sin radar propio, solo gestión del
  canal ya abierto.

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
- **Verificado en vivo:** sí. Lista de salud por sistema (`Hull`, `Reactor`,
  `Beam Weapons`, `Missile System`, `Maneuvering`, `Impulse Engines`, `Front`
  y `Rear Shield Generator`, todos al 100%) y el plano interior con tres
  reparadores visibles en sus salas — idéntico al subconjunto que ya se vio
  dentro de Engineering avanzada, confirmando el solape documentado por
  código.

### Referencia — Database (`src/screens/extra/databaseScreen.{h,cpp}`)

No es una de las seis del alcance, pero es relevante por reutilizar el mismo
`DatabaseViewComponent` que usa Science internamente. Es pantalla completa de
consulta de la base de datos de facciones/naves/objetos ya conocidos — 100%
solo-lectura/apoyo, sin ninguna decisión que cambie el estado de la partida en
curso. Se cita como precedente de "información de apoyo sin agencia", útil de
contraste frente a las seis pantallas de arriba. No se verificó en vivo (fuera
del alcance de B0).

## Tabla resumen

| Pantalla | Acciones que cambian estado | ¿Autónoma? | Solape principal | Verificado en vivo |
|---|---|---|---|---|
| Science | Escanear, seleccionar objetivo, zoom, vista de sonda | Sí | Base de Operations | Sí |
| Relay | Waypoints, sondas, enlace ciencia-sonda, hackeo, alerta, comms | Sí (la más completa) | Subconjunto duplicado en Operations | Sí |
| Engineering avanzada | Potencia/refrigerante por sistema, autodestrucción, mover reparadores, escudos manuales | Sí | Reparadores = Damage Control; posible duplicación con `powerManagement` | Sí |
| Operations | Science completo + waypoints + comms | Sí | Composición de Science+Relay, sin acción propia nueva | Sí |
| Comms | Contestar/cancelar/chatear/elegir diálogo | Parcial (no inicia comms) | Mismo `GuiCommsOverlay` que Relay/Operations | Sí |
| Damage Control | Seleccionar y mover reparadores | Sí | Subconjunto exacto de Engineering avanzada | Sí |

## Conclusiones para el resto de Etapa B

- **Ninguna de las seis pantallas está vacía de agencia** — la premisa de
  #459 de que "quizá ya hay agencia nativa que solo falta documentar" se
  confirma: Science, Relay, Engineering, Operations y Damage Control ya dan
  decisiones reales, verificadas ahora tanto por código como en juego. Lo que
  falta no es agencia nativa, sino **exponerla desde Foundry**
  (`STATION_ACTIONS` en `foundry-module/scripts/station-actions.mjs` solo
  cubre navegación, potencia/refrigerante y escudos — una fracción de lo que
  el nativo ya permite).
- **Comunicaciones (Comms) es la excepción real**: por diseño nativo depende
  de que otro puesto (Relay/Operations) abra el canal, no tiene agencia
  propia de iniciar contacto — confirmado en vivo (Comms solo mostró el canal
  ya abierto por el escenario, sin picker propio). Esto afecta el alcance de
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
  gestión de reparadores (confirmado también en vivo: mismo plano interior en
  ambas pantallas), y el propio código de Engineering admite duplicación de
  lógica de energía con `extra/powerManagement.cpp`. No forma parte del
  criterio de aceptación de B0 ni de #459, se deja anotado para no perderlo
  si se toca esa área más adelante.
- **Multijugador real en Windows nativo queda sin validar** (ver limitación
  arriba): esta sesión solo confirmó cada pantalla con un cliente aislado. Si
  #29 (smoke real multijugador) se retoma sobre esta plataforma, reproducir
  primero el fallo del segundo cliente antes de dar la build por buena.

## Pendiente

- Diagnosticar el fallo de segundo cliente simultáneo en la build nativa de
  Windows (¿específico de esta máquina/GPU, de esta build no soportada, o un
  bug real de multijugador?) — bloquea justamente la parte de #460 que este
  documento no cierra: una sesión con varias personas conectadas a la vez,
  como sí tiene `SESION-FASE1.md`.
- Repetir esa sesión multijugador real, con más de una persona conectada
  simultáneamente narrando qué pudo decidir por sí misma, antes de dar #460
  por cerrado.
- Si se decide adoptar la compilación nativa de Windows como ruta soportada,
  documentarla en `docs/BUILDING.md` (dependencias exactas, script de
  configuración, y cómo obtener/colocar `SDL2.dll`) en un PR dedicado — aquí
  solo se registra como lo que permitió esta verificación, no como guía
  oficial.
