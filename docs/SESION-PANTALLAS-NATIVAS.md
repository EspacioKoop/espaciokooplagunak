# Verificación: agencia de tripulación en las pantallas nativas restantes (#460)

Subissue B0 de la Etapa B (#459). Ninguna de estas pantallas tenía verificación registrada en
[`SESION-FASE1.md`](SESION-FASE1.md), [`BETATESTING.md`](BETATESTING.md) ni
[`PRUEBA-INDIVIDUAL.md`](PRUEBA-INDIVIDUAL.md) — solo Timón, Armas y Tactical constaban.

La pregunta que este documento contesta es una sola, por pantalla: **¿puede un tripulante decidir
algo desde aquí sin que el GM lo haga por él?**

## Método y su límite

Esta primera pasada es una **auditoría de fuentes**, no una sesión de playtest: se ha leído qué
comandos de jugador (`my_player_info->command*`) emite cada pantalla, qué controles los disparan y
bajo qué condiciones se ocultan. Eso basta para responder si la agencia *existe en el código*, que
es lo que bloqueaba el alcance de los issues dependientes.

**Lo que esta pasada NO acredita**: que cada pantalla sea jugable y legible en una partida real con
varias estaciones conectadas. Eso exige compilar y sentar gente delante, y queda pendiente (ver
[Pendiente](#pendiente)). Ninguna conclusión de aquí debe leerse como "probado en partida".

Fuentes leídas: [`src/screens/crew6/`](../src/screens/crew6/),
[`src/screens/crew4/`](../src/screens/crew4/), [`src/screens/extra/`](../src/screens/extra/),
[`src/crewPosition.cpp`](../src/crewPosition.cpp),
[`src/screenComponents/shipInternalView.cpp`](../src/screenComponents/shipInternalView.cpp).

## Corrección al alcance declarado en el issue

El issue enumera seis pantallas asumiendo que "Comms" y "Damage Control" son consolas completas.
Al leer el código, el reparto real es otro:

- **Comms no es una pantalla con decisiones propias.** [`commsScreen.cpp`](../src/screens/extra/commsScreen.cpp)
  son doce líneas: monta `ShipsLog` y `GuiCommsOverlay` y nada más. Toda la agencia de
  comunicaciones (abrir canal, aceptar/rechazar, responder) vive en el *overlay*, que Relay y
  Operations también montan. Comms es una **superficie dedicada al mismo overlay**, no una consola
  aparte.
- **Engineering avanzada no es una pantalla distinta.** [`engineeringAdvancedScreen.cpp`](../src/screens/crew4/engineeringAdvancedScreen.cpp)
  hereda entera de `EngineeringScreen` y **solo añade** el control de frecuencia de escudos (o el
  botón de activar escudos, según `use_beam_shield_frequencies`). No hay que verificarla como
  pantalla propia: hereda las conclusiones de Ingeniería más ese único control.
- **Damage Control sí existe** ([`damcon.cpp`](../src/screens/extra/damcon.cpp)) y es una pantalla
  real, con su propio `CrewPosition::damageControl`.
- Aparece además una séptima pantalla que el issue no lista: **Power Management**
  ([`powerManagement.cpp`](../src/screens/extra/powerManagement.cpp)), con posición de tripulación
  propia. Se incluye aquí por coherencia.

## Science

**Decisiones del jugador**: escanear un objetivo (`commandScan`, con soporte de escaneo enlazado a
sonda vía `RadarLink`), elegir a quién apuntar el radar largo, alternar la vista de sonda
(`PROBE_VIEW`) y navegar la base de datos científica.

**Información asimétrica**: alta y es su razón de ser. Radar de largo alcance, desglose por sistemas
del objetivo escaneado, frecuencias de escudo y firmas — nada de eso lo ve Timón ni Armas.

**¿Agencia real hoy?** **Sí, y es la más sólida de las seis.** El escaneo es una decisión con coste
(tiene retardo, `ScienceScanner::delay`) que abre información que otros puestos necesitan. Es agencia
de pleno derecho, no un visor.

## Relay

**Decisiones del jugador**: colocar, mover y borrar puntos de ruta (`commandAddWaypoint`,
`commandMoveWaypoint`, `commandRemoveWaypoint`); lanzar sondas (`commandLaunchProbe`); enlazar una
sonda al radar de ciencia y desenlazarla (`commandSetScienceLink` / `commandClearScienceLink`);
**hackear** un objetivo (`GuiHackingDialog`); abrir comunicaciones; y **fijar el nivel de alerta de la
nave** (`GuiAlertLevelSelect`).

**Información asimétrica**: vista estratégica más amplia que la de nadie a bordo, más la reputación
de facción y el reloj de misión.

**¿Agencia real hoy?** **Sí, y es la más infravalorada.** Hackear es un minijuego completo con
consecuencias, y el enlace sonda→ciencia es cooperación entre puestos incorporada en el motor. El
nivel de alerta es autoridad sobre toda la nave ejercida desde aquí.

**Matiz importante**: Relay se instancia con un flag `allow_comms`. Si es falso, el puesto pasa a
`CrewPosition::altRelay`, pierde `ShipsLog` y el overlay de comunicaciones, y el botón cambia de
"Abrir comms" a "Enlazar con comms". Es decir: **la misma pantalla tiene dos niveles de agencia**
según cómo se reparta la tripulación.

## Operations

**Decisiones del jugador**: las de Science (monta una `ScienceScreen` completa con
`CrewPosition::operationsOfficer`) más un subconjunto deliberadamente recortado de Relay: abrir
comms y gestionar puntos de ruta.

**Lo que NO tiene**, y el comentario del código lo dice explícitamente (*"Limited relay functions"*):
sondas, enlace a ciencia, hackeo ni selector de nivel de alerta.

**¿Agencia real hoy?** **Sí, heredada.** Operations no es una pantalla que verificar aparte: es
Science + un recorte de Relay, pensada para mesas de cuatro. Sus conclusiones son las de esas dos.

## Engineering (y Engineering avanzada)

**Decisiones del jugador**: repartir energía y refrigerante por sistema
(`commandSetSystemPowerRequest`, `commandSetSystemCoolantRequest`), con presets por teclado y una
lógica de reparto proporcional cuando el total pedido excede el máximo; y **autodestrucción**
(`GuiSelfDestructButton`, visible solo si la nave tiene el componente `SelfDestruct`).
La avanzada añade frecuencia de escudos.

**Información asimétrica**: salud, calor, energía y refrigerante por sistema — la única vista real
del estado interno de la nave.

**¿Agencia real hoy?** **Sí, y es la más continua de todas**: no toma decisiones puntuales sino que
gestiona un presupuesto bajo presión durante todo el combate. Es el puesto con mayor densidad de
decisiones por minuto.

## Damage Control

**Decisiones del jugador**: **mover equipos de reparación por el interior de la nave**
(`commandCrewSetTargetPosition`), por arrastre con el ratón o por teclado, incluida la selección del
siguiente equipo.

**Información asimétrica**: plano interno de la nave con la posición de los equipos, casco, y salud
de cada sistema con código de color (rojo por debajo de cero, amarillo si el máximo ya está mermado).

**¿Agencia real hoy?** **Sí.** Decidir qué se repara primero mientras la nave se cae a trozos es la
decisión clásica del puesto. La agencia depende de que la nave tenga interior y equipos de
reparación —sin ellos la pantalla degrada a visor de salud—, y en el escenario del fork **los
tiene**: [`scenario_90_lagunak_primera_guardia.lua`](../scripts/scenario_90_lagunak_primera_guardia.lua)
usa la plantilla `Phobos M3P`, que declara doce salas y sus puertas en
[`shiptemplates/frigates.lua`](../scripts/shiptemplates/frigates.lua), y hereda el valor por defecto
de tres equipos (`__repair_crew_count = 3` en
[`api/shipTemplate.lua`](../scripts/api/shipTemplate.lua)) al no llamar a `setRepairCrewCount`.

## Power Management

Duplica el reparto de energía/refrigerante de Ingeniería sin la vista de salud — el propio código de
Ingeniería lo señala (*"Note the code duplication with extra/powerManagement"*). Es Ingeniería
recortada para mesas grandes. Sin conclusión propia.

## Comms

Ver la corrección de alcance: no es una consola con decisiones propias. La agencia de comunicaciones
(aceptar o rechazar un hail, elegir respuesta, escribir un mensaje) está en `GuiCommsOverlay`, y ya
se ha contabilizado en Relay y Operations. **Sí es agencia real** —elegir qué se le contesta a una
facción hostil es una decisión con consecuencias—, pero no pertenece a esta pantalla en exclusiva.

## Conclusión

**Las seis pantallas tienen agencia nativa real. Ninguna necesita desarrollo de juego para
tenerla.** El hueco de la Etapa B no era "falta construir agencia en el núcleo", como suponía el
issue: era **exponerla**.

Ordenadas por densidad de decisión: Ingeniería > Relay > Science > Damage Control > Operations
(heredada) > Comms (overlay compartido).

### Contraste con lo ya implementado en Foundry

Los issues dependientes (#462 sensores, #463 comunicaciones, #464 reparación) se cerraron **antes**
de esta verificación. Contrastando este documento con
[`station-actions.mjs`](../foundry-module/scripts/station-actions.mjs), la matriz de Foundry expone
hoy un subconjunto estricto de la agencia nativa:

| Puesto | Nativo | En `STATION_ACTIONS` | Hueco |
| --- | --- | --- | --- |
| sensors | escanear, vista de sonda, base de datos | `scan_object` | vista de sonda, base de datos |
| communications | hail, aceptar/rechazar, responder, mensaje | las cuatro | — |
| engineering | energía, refrigerante, autodestrucción, frec. escudos | energía, refrigerante, `set_auto_repair` | autodestrucción, frecuencia de escudos |
| relay | waypoints, sondas, enlace a ciencia, hackeo, nivel de alerta | *(ausente)* | **entero** |
| damagecontrol | mover equipos de reparación | *(ausente)* | **entero** |

Dos hallazgos que sí cambian el trabajo pendiente:

1. **No hay duplicación.** Lo implementado en #462/#463/#464 encamina agencia nativa existente, no
   la reinventa. `set_auto_repair` es la única acción sin equivalente nativo directo (es una
   automatización del fork, no un control de la pantalla de Ingeniería).
2. **Relay y Damage Control no existen en la matriz de autoridad.** Son, según esta auditoría, el
   segundo y el cuarto puesto en densidad de decisión — y el hueco más grande de la Etapa B. Hackeo,
   sondas, enlace sonda→ciencia y nivel de alerta son exactamente el tipo de agencia cooperativa que
   la Etapa B dice buscar, y hoy ningún tripulante de Foundry puede ejercerlos.

### Pendiente

- [ ] Playtest en partida real de las seis pantallas, con al menos dos estaciones conectadas, para
      acreditar legibilidad y jugabilidad (no solo existencia en código).
- [ ] Abrir issue para exponer Relay y Damage Control en la matriz de autoridad de Foundry.
