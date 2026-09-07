# Lote B — Trabajo que aparece solo (misiones generadas)

**Issue:** #840 · **Lote:** B · **Fichero:** `docs/inspiracion/lote-b-misiones.md`

**Fuente declarada:** documentación oficial y wikis de diseño de cada proyecto
(Naev *Mission Scripting*, Endless Sky *CreatingMissions*, Wesnoth *CampaignWML*), más los
ficheros `LICENSE` reales vía API de GitHub. **No he jugado a ninguno de los tres**; lo que
digo de sus mecánicas viene de leer su documentación de autoría, no de partidas propias.

**Licencias verificadas (API de GitHub + `LICENSE` real):**

- Endless Sky — **GPL-3.0** ✔ (API: `GPL-3.0`).
- Wesnoth (motor) — **GPL-2.0** ✔ (API: `GPL-2.0`); el *contenido* de campañas/arte va por
  separado bajo CC-BY-SA y no se toca.
- Naev — **GPL-3.0** para el código fuente; **CC-BY-SA-4.0** para los demás ficheros (incluido
  el XML de metadatos de misión); los gráficos van aparte en `gfx/ARTWORK_LICENSE.yaml`. La API
  de GitHub devuelve `NOASSERTION` porque Naev usa un `LICENSE` combinado propio, no la plantilla
  estándar; el texto del `LICENSE` confirma GPL-3.0-or-later para el código.

---

## La pregunta de este lote

> ¿Qué tiene que declarar el GM para que salga una misión jugable, y qué se sortea?

Toca el **editor de contenido del GM** (`foundry-module/scripts/contenido-externo/**`) y
`scripts/scenario_90_lagunak_primera_guardia.lua`. El ancla actual es `scenario_90`: el GM
escribe un bloque de cabecera declarativa (`-- Name`, `-- Description`, `-- Setting[Modo]`,
`-- Modo[...]`) y luego **Lua a mano** para el cuerpo. Eso es "el GM programa", no "el GM
declara". Los tres juegos de abajo resuelven la misma tensión desde ángulos distintos, y todos
coinciden en una idea: **la misión es datos, y el motor es quien la ofrece y la sortea**.

La frontera que el fork ya decidió importa aquí igual que en el Lote A (ver corrección de
eGurucharri a A en #840): `docs/FOUNDRY.md` dice que una escena **no concede, no cuenta ni
recuerda**, y ADR-0008 pone la autoridad de campaña en el núcleo ([#766](https://github.com/EspacioKoop/espaciokooplagunak/issues/766)
persistencia, [#767](https://github.com/EspacioKoop/espaciokooplagunak/issues/767) bestiario). Por
tanto, en cada entrada separo lo que es **datos/plantilla/presentación** (barato: puro/Node o
Lua de escenario) de lo que es **autoridad de oferta** (recordar qué misiones están disponibles
según estado persistente → núcleo, bloqueado por #766).

---

## Endless Sky — misión como bloque de datos declarativo

**1. Juego y licencia:** Endless Sky — GPL-3.0 (verificada).

**2. Qué mecánica resuelve:** una misión es un bloque de texto plano `mission "Nombre"` con
campos declarativos —`description`, `cargo`, `passengers`, `payment`, `destination`,
`deadline [<días> [<multiplicador>]]`, `repeat`, `blocked <mensaje>`— y un bloque de
*disponibilidad* (`to offer/complete/fail/accept` con condiciones; filtros de
planeta/sistema/gobierno/atributos; `near`/`distance`). El motor presenta en el tablón solo las
misiones cuyas condiciones se cumplen **ahora**, y sortea dentro de los rangos declarados:
cantidad de carga/pasajeros con probabilidad, y jitter del plazo por el `<multiplicador>`. El GM
no escribe código: declara el contrato y el motor lo materializa.

**3. Qué problema nuestro toca:** es la respuesta más directa a la pregunta del lote. Nuestro
`scenario_90` escribiría hoy a mano la lógica que Endless Sky delega al formato: el GM declararía
`origen`, `destino`, `plazo`, `recompensa`; el **núcleo** autorizaría qué misiones están
disponibles según el estado de campaña, y el tablón de la estación presentaría esa lista ya
autorizada. Encaja con el editor de contenido del GM
(`contenido-externo/`) y con la regla de cadena de la crisis multipuesto
([#484](https://github.com/EspacioKoop/espaciokooplagunak/issues/484)): una misión puede requerir
que tres puestos la resuelvan sin que el GM cablee la cadena.

**4. Coste:** **puro/Node** para el modelo de misión (datos + rangos + plantillas de texto) y la
presentación en el tablón. **Núcleo** para la *autoridad de oferta*: decidir qué misiones están
disponibles según reputación, misiones completadas o bestiario es *recordar y conceder acceso*,
y ADR-0008 lo reserva al núcleo. Vive con [#766](https://github.com/EspacioKoop/espaciokooplagunak/issues/766);
el puente solo proyecta la lista que el núcleo autoriza. El `<multiplicador>` de `deadline` y el
sorteo de cantidades son Node y no tocan núcleo.

**5. Veredicto:** **`adoptar`**, bloqueado por
[#766](https://github.com/EspacioKoop/espaciokooplagunak/issues/766) para la autoridad de oferta.
Tarjeta: un formato declarativo de misión (`mission`) que el editor del GM consume, con
`availability`/`deadline`/`repeat`/`blocked`, y un motor de oferta en núcleo que lo filtra por
estado de campaña. Sin dónde guardar el estado, esto es un tablón que se borra al reiniciar.

---

## Naev — tablón con filtro por condiciones + plantillas para no-programadores

**1. Juego y licencia:** Naev — GPL-3.0 (código); CC-BY-SA-4.0 (XML y demás); arte aparte.

**2. Qué mecánica resuelve:** las misiones viven en `dat/missions/` como *scripts Lua* con una
**cabecera XML** (entre `--[[ ]]`) que declara cómo se dispara y qué requisitos tiene (el formato
`mission.xml`), más funciones `create()`/`accept()` y las llamadas `misn.accept()` /
`misn.finish()` que la registran en el diario y activan el OSD. El **ordenador de misión** del
puerto presenta solo las misiones cuyas condiciones de disparo se cumplen. Y lo que importa para
este lote: Naev ofrece **plantillas de misión** para crear misiones simples *sin saber
programar*. El patrón reutilizable no es "escribe Lua", es "**el tablón filtra la oferta por
condiciones y hay plantillas que bajan la barrera del GM**".

**3. Qué problema nuestro toca:** el *tablón que filtra por condiciones* es exactamente la mitad
que le falta a `scenario_90` (hoy se ofrece entero, no por estado). Y las plantillas son la
respuesta a "el GM no quiere escribir Lua": en vez de que el GM autorice un `.lua`, autoriza un
formulario. Toca `contenido-externo/` y la matriz de autoridad de `station-actions.mjs` si la
misión exige acciones de puesto.

**4. Coste:** **Lua de escenario** para las plantillas y la presentación del tablón; **núcleo**
para la autoridad de oferta (mismo argumento que Endless Sky: recordar qué misiones están
disponibles es campaña). La cabecera XML de declaración de disparo es Node/Lua barato; la
decisión de si el disparo procede, núcleo.

**5. Veredicto:** **`adoptar`** el *tablón con filtro por condiciones + plantillas para el GM*,
bloqueado por [#766](https://github.com/EspacioKoop/espaciokooplagunak/issues/766). **Se descarta
explícitamente** la otra mitad de Naev (ver descarte 2): no copiamos el modelo de "misión = script
Lua a medida", porque eso es lo que `scenario_90` ya es y el objetivo del lote es lo contrario.

---

## Wesnoth — la misión es datos declarativos y el editor baja la barrera del mapa

**1. Juego y licencia:** Battle for Wesnoth (motor) — GPL-2.0 (verificada); contenido CC-BY-SA,
apartado.

**2. Qué mecánica resuelve:** **todo** el dato de juego es WML (*Wesnoth Markup Language*):
una campaña es `[campaign]` con `id`/`define`/`name`/`difficulties` y `[story]`; una misión jugable
es `[scenario]` con `[side]`, `[event]`, `[unit]` y `map_data`. Quien no programa puede escribir
una misión como *datos etiquetados*, y el **editor de mapas/escenarios** (`wesnoth_editor`)
permite crear el mapa y colocar terreno/unidades por GUI. La limitación honesta: la lógica de campaña sigue
escribiéndose en WML/Lua fuera del editor (eventos/objetivos); no borra la barrera de la lógica,
solo la del mapa.

**3. Qué problema nuestro toca:** es el caso de referencia de "el GM declara una misión como dato,
no como código" llevado a su forma más limpia —un formato declarativo que el motor renderiza—.
Aplica al editor de contenido del GM (`contenido-externo/`): un `scenario` nuestro podría ser un
bloque declarativo (`[scenario]`-equivalente) que el editor del GM rellena, en vez del Lua manual
de `scenario_90`. La parte de "mapa/nave por GUI" es análoga a nuestro `andar-nave-app.mjs`
(planta que sale del `shipTemplate` real, [#540](https://github.com/EspacioKoop/espaciokooplagunak/issues/540)).

**4. Coste:** **puro/Node** para el formato declarativo de escenario y su validación; el editor
GUI es herramienta del GM, no del puente en partida. **Núcleo** solo si la misión declarada
pretende *recordar* progreso entre sesiones (otra vez #766). La lógica de eventos compleja queda
en Lua de escenario, no en núcleo.

**5. Veredicto:** **`cimiento`** — se escribe el esqueleto del formato declarativo de escenario
(declaración de objetivos, lados, eventos, mapa) y se declara huérfano hasta que el editor del GM
lo consuma, igual que el esqueleto de estados de
[#603](https://github.com/EspacioKoop/espaciokooplagunak/issues/603). No es `adoptar` completo porque
la lógica de eventos aún exige Lua; el hueso es el formato, no el motor de eventos.

---

## Descarte 1 — Pioneer / Oolite (economía de puertos y rutas de precios)

**1. De dónde sale:** el issue los lista como candidatos de partida («economía de puertos y rutas:
precios que dependen de dónde estás»).

**2. Por qué no:** resuelven *equilibrio de precios*, no *generación de misión*. Para que «el
precio dependa de dónde estás» hace falta una simulación de economía persistente (oferta/demanda
por sistema) que es territorio de núcleo ([#766](https://github.com/EspacioKoop/espaciokooplagunak/issues/766))
y aporta coste de equilibrio, no «trabajo que aparece solo». No toca el editor del GM ni
`scenario_90`, y el issue ya sospechaba `cimiento` o descarte para ellos.

**3. Qué se hace en su lugar:** si algún día queremos precios contextuales, se estudia como su
propio issue de economía, no como mecánica de misión. Aquí **`descartado`** para el Lote B.

---

## Descarte 2 — misión como script Lua a medida (el patrón de autoría pesado de Naev)

**1. De dónde sale:** Naev escribe cada misión como un `.lua` con su `create()`/`accept()`. Es
potente, pero es *el GM programa*.

**2. Por qué no:** es exactamente lo que `scenario_90_lagunak_primera_guardia.lua` ya es hoy. El
valor de este lote es mover al GM de «escribir código» a «declarar datos» (como Endless Sky y
Wesnoth). Copiar el modelo de script-por-misión mantendría la barrera en lugar de bajarla, y
chocaría con `docs/FOUNDRY.md`: la lógica de oferta seguiría viviendo donde no debe.

**3. Qué se hace en su lugar:** se adopta de Naev solo el **tablón con filtro por condiciones +
plantillas**, y de Endless Sky/Wesnoth el **formato declarativo**. El Lua se reserva para la
lógica de eventos concreta de una misión ya ofrecida, no para declarar la misión. **`descartado`**
como patrón de autoría principal.

---

## Lo que este lote NO resuelve

- **El editor del GM tiene que saber leer el formato declarativo.** Hoy `contenido-externo/`
  clasifica contenido ajeno (#332), no authoring de misiones; hacer que consume un bloque
  `mission`/`[scenario]` es trabajo aparte y previo.
- **La autoridad de oferta necesita dónde recordar.** Las tres entradas dependen de
  [#766](https://github.com/EspacioKoop/espaciokooplagunak/issues/766) (persistencia) para filtrar
  por estado de campaña; sin él, el tablón miente al reiniciar.
- **De dónde salen las misiones base.** Al igual que el Lote A necesitaba el catálogo de
  facciones (#213), este lote necesita un catálogo de *plantillas de misión* con procedencia,
  igual que `catalogo-piezas.mjs` exige que la malla que declara una ficha exista de verdad.

## Resumen del lote

Tres `adoptar`/`cimiento` que son **un solo patrón visto por tres lados** —formato declarativo
(Endless Sky/Wesnoth) + tablón que filtra por condiciones y plantillas (Naev)—, dos descartes
razonados (Pioneer/Oolite; script-Lua por misión), y un bloqueo declarado común:
[#766](https://github.com/EspacioKoop/espaciokooplagunak/issues/766) (autoridad de oferta). Fichero:
`docs/inspiracion/lote-b-misiones.md`.

**Vivos y sin tocar (al cierre de este lote): G.** Los lotes A, C, D, E, F quedaron aceptados en
el hilo como comentarios; este fichero es el primero entregado como PR, no como comentario.
