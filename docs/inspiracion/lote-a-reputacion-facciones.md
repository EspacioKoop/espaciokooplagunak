# Lote A — Reputación entre facciones (recordar con quién te llevas mal)

Parte de docs/INSPIRACION_JUEGOS_LIBRES.md (issue #840); el índice lo escribe quien cierra el último lote.

- **Autor del análisis:** Hermes (consolidación).
- **Fuente declarada:** wiki de Endless Sky (endless-sky.fandom.com/wiki/Reputation) y su repositorio; documentación de Naev y su `LICENSE`; repositorio de Unciv. **Leído por encima**, no jugado. Licencias verificadas contra cada repo vía API de GitHub: `endless-sky/endless-sky` → GPL-3.0; `naev/naev` → GPL-3.0 (en parte *or-later*; los gráficos van aparte, documentados en `gfx/ARTWORK_LICENSE.yaml` — que el código sea GPL no hace libre su arte); `yairm210/Unciv` → MPL-2.0.
- **Fichero previsto en el issue:** `docs/inspiracion/lote-a-reputacion-facciones.md`.
- **Estado:** primera pasada, fuente y licencia verificadas. Cumple la regla de admisión del issue: cada entrada dice las cinco cosas y tiene veredicto; hay al menos un descarte razonado.

Las tres entradas de este lote son **una sola tarjeta vista por tres lados**, y ese reparto viene del hilo de #840: **qué se lee** (Unciv), **qué mueve la relación** (Endless Sky) y **qué acceso cierra** (Naev). Un escalar suelto no cierra el lote: la pregunta del issue es precisamente cómo evitar «un número por facción que nadie sabe leer» y convertirlo en una puerta que se cierra.

La pregunta del lote: cómo recuerda el juego «con quién te llevas bien o mal» de forma que esa memoria condicione el mundo sin pedir arte ni motor nuevo. La trampa de este lote es justo **dónde vive esa memoria**: es autoridad de campaña (#213/#767) y, por ADR-0008, vive en el núcleo, no en el módulo. Toca #766 (persistencia).

## Dónde estamos hoy (ancla real, leída del repo)

- `foundry-module/scripts/npc-generador/npc-generador.mjs` genera NPCs deterministas a partir de semilla; es Node/foundry-module y **no guarda estado de campaña entre sesiones**.
- #767 (Registro de Avistamientos y Bestiario Local) y #766 (persistencia) sitúan la autoridad de campaña —progreso, atlas, misiones, consecuencias— en el **núcleo del simulador (C++)**, no en el módulo de Foundry. ADR-0008 lo fija: standalone-first significa que el juego es jugable y guarda progreso sin el VTT.
- Conclusión del ancla: hoy no tenemos un escalar de «relación con la facción X» que persista y condicione ofertas/acciones. Ese es el hueco. Y, por diseño del fork, ese hueco se cierra en núcleo, no en puente/Lua ni en `npc-generador.mjs`.

## Endless Sky — reputación por facción como escalar persistente que condiciona el mundo

1. **Juego y licencia:** Endless Sky — **GPL-3.0** (verificada en `endless-sky/endless-sky` → LICENSE: «GNU General Public License v3.0»).
2. **Mecánica:** cada facción tiene un escalar de reputación (positivo / cero / negativo). Ese número condiciona el mundo sin árbol de diálogo: reputación negativa → la facción te ataca a la vista (algunas sobornables); reputación ≥0 → te reparan la nave si quedas inhabilitado; algunos planetas exigen un umbral de reputación para aterrizar (p.ej. Hai-home exige ≥100, sin soborno); y algunas misiones solo se ofrecen si tu reputación con la facción que las ofrece supera un umbral. Los cambios son además **transitivos** —una misión de Piratas sube tu reputación con Piratas pero hunde la de República/Sindicato—; esa parte **no la adoptamos** (ver el descarte de abajo). La reputación se gana/pierde por tribute, reparar naves, misiones repetibles y misiones de trama; y **persiste entre partidas** como estado de campaña.
3. **Problema nuestro:** #767/#766 necesitan precisamente «recordar a quién has conocido / con quién te llevas mal» como autoridad de campaña persistente. De Endless Sky se toma **qué mueve la relación**: qué actos la suben y la bajan (tribute, reparar naves, misiones cumplidas o traicionadas) y con qué peso. Tablas y estado, cero arte. Y hay un detalle que nos viene medido: en un puente, quien dispara casi nunca es quien habla, así que una relación que responde al **daño causado** convierte un error de puntería en material narrativo para comunicaciones — la cadena de #484 con consecuencia diferida.
4. **Coste:** **núcleo C++**. Esta es la corrección de coste del lote: la reputación entre facciones es autoridad de campaña (progreso y consecuencias que persisten), y ADR-0008 la sitúa en el núcleo del simulador, no en el módulo de Foundry ni en Lua de escenario ni en `npc-generador.mjs` (este último es un cimiento huérfano en HUERFANOS_DECLARADOS). No se puede implementar en escena porque debe sobrevivir al cierre de la sesión VTT y ser la fuente autoritativa para cualquier cliente. El módulo Foundry solo consultaría/mostraría ese escalar; no lo poseería.
5. **Veredicto:** `adoptar` **la parte de «qué la mueve»**, no la transitividad, y como patrón de diseño de autoridad de campaña, no como código a importar (GPL-3.0 prohíbe traer el `.cpp`, y de todos modos la idea no tiene licencia). Bloqueado por **#766** (sin dónde guardar, esto es un número que se borra al cerrar el servidor). Va en la **tarjeta única** del lote, junto con Unciv y Naev:
   `feat(core/campaign): relación con cada facción — desglose causal legible (Unciv), qué la mueve (Endless Sky) y qué acceso cierra (Naev) (#767/#766/#213, ADR-0008)`.
   **Frontera #526:** el escalar existe por dentro, pero **no es la salida**: lo que se lee es el desglose de la entrada siguiente. Un «reputación: 47 %» en pantalla sería exactamente la lectura que nadie ha calculado.

## Unciv — la relación se lee como razones fechadas, no como un número

1. **Juego y licencia:** Unciv — **MPL-2.0** (verificada en `yairm210/Unciv`). No es candidata a copia de código; entra por la idea.
2. **Mecánica:** la actitud de una civilización no se enseña como un escalar. Se enseña como una **lista de razones fechadas** —«declaraste la guerra a nuestro aliado», «llevamos treinta turnos en paz»—, cada una con su peso y su caducidad. El número existe por dentro; lo que se lee por fuera son hechos.
3. **Problema nuestro:** es la regla de #526 aplicada a la campaña, y es la pieza que hace que las otras dos se puedan enseñar sin mentir. En vez de `facción A = −20`, la salida es `facción A = hostil` + `causas = incidente X + deuda Y + acuerdo roto Z`, que solo afirma cosas que de verdad pasaron. **Y no hay que inventarse el origen del dato: los agravios son eventos que la bitácora ya registra** (`event-journal.mjs` los proyecta hoy). Eso abre además la puerta a reparar la relación: saldar la deuda, no «subir el número».
4. **Coste:** puro/Node para **derivar** el desglose; **núcleo** para conservar los hechos y sus pesos. La derivación es presentación; la memoria es autoridad de campaña.
5. **Veredicto:** `adoptar`, y **primera de las tres**: sin ella el lote entrega justo el escalar ilegible que el issue quiere evitar. Misma tarjeta única.

## Naev — la reputación es un umbral de acceso, no un marcador

1. **Juego y licencia:** Naev — **GPL-3.0**, en parte *or-later*; los gráficos van aparte (`gfx/ARTWORK_LICENSE.yaml`), verificado en su `LICENSE`.
2. **Mecánica:** por debajo de cierto nivel, una facción deja de ofrecerte trabajo y deja de dejarte aterrizar en sus mundos. La consecuencia no es que pierdas puntos: es que **se te cierran puertas**.
3. **Problema nuestro:** es la consecuencia concreta que le faltaba al lote, y encaja con el atlas (#213, `catalogo-cosmografico.mjs`): un lugar del atlas puede declarar de qué facción es, y ahí la relación deja de ser abstracta — es si te dejan atracar o no. Sin esta pieza, la reputación sería un número sin efecto que nadie tendría motivo para mirar.
4. **Coste:** **núcleo** para el estado; el umbral en sí es Lua de escenario. Bloqueado por **#213**: sin catálogo de facciones con procedencia no hay a quién cerrarle la puerta.
5. **Veredicto:** `adoptar` junto con Endless Sky y Unciv — misma tarjeta única, vista por el lado de «qué hace».
   **Frontera #526:** «este puerto no te deja atracar» es un hecho; el porqué lo dan las razones fechadas de Unciv, no una inferencia del módulo.

## Descarte: la propagación automática entre facciones (transitividad)

1. **De dónde sale:** Endless Sky la tiene, y el primer barrido del hilo la proponía como «reputación transitiva» (los aliados de tu enemigo te odian solos). Este documento la había adoptado en su primera pasada; **se revierte aquí**, porque la discusión consolidada de #840 ya la había descartado y esa decisión no se explicó.
2. **Por qué no:** en un juego de un jugador funciona porque el jugador aprende el grafo a base de partidas. **En una mesa con GM, no:** la consecuencia aparece sin que nadie la haya decidido y sin que la tripulación pudiera preverla, y le quita al GM lo único que este proyecto le reserva entero — decidir qué consecuencias tiene lo que hizo la tripulación. Choca además con `docs/FOUNDRY.md`: una propagación automática *concede y cuenta* por su cuenta.
3. **Qué se hace en su lugar:** la relación entre facciones se **declara** en el atlas y se le **enseña al GM** («esto va a molestar a X»), que decide. Es un aviso, no una regla.
4. **Veredicto:** **`descartado`**, con la alternativa escrita arriba.

## Endless Sky — mercado/comisión atado a la economía (descartado)

1. **Juego y licencia:** Endless Sky — **GPL-3.0** (misma verificación).
2. **Mecánica:** en Endless Sky la reputación alta también abre «mercados militares» y mejores naves, casi siempre detrás de una comisión que requiere una economía de mercado simulada (precios, rutas, stock).
3. **Problema nuestro:** ninguno directo. El fork standalone-first no simula una economía de mercado; ese sub-sistema necesitaría equilibrio y datos fuera del alcance de #840.
4. **Coste:** núcleo C++ **más** un simulador de economía entero que no existe. Muy caro y ajeno al hueco que cerramos.
5. **Veredicto:** `descartado`. Motivo: el gateo por reputación (entrada anterior) es lo reutilizable; acoplarlo a una economía de mercado lo hace inviable en standalone-first. Se anota para no tentar a un worker a «subir la cobertura» implementando el mercado.

## Lo que el lote A **no** resuelve

De dónde salen las facciones. El juego hereda las de EmptyEpsilon y el atlas de #213 está sin cerrar; una reputación necesita un catálogo de facciones con procedencia, igual que `catalogo-piezas.mjs` exige que la malla que declara una ficha exista de verdad. **Sin ese catálogo esto no se puede empezar**, y decirlo ahora es más barato que descubrirlo a mitad de la tarjeta.

## Resumen del lote

Tres `adoptar` que son **una sola tarjeta** —desglose causal legible (Unciv, primera) + qué la mueve (Endless Sky) + qué acceso cierra (Naev)— más dos descartes razonados (la propagación automática entre facciones; el mercado/comisión atado a una economía simulada), y **dos bloqueos declarados**: **#766** (dónde se guarda) y **#213** (qué facciones hay). Todo el estado vive en el núcleo (ADR-0008); el puente lo proyecta y el módulo solo lo pinta.

Pendiente: el índice final docs/INSPIRACION_JUEGOS_LIBRES.md (ordenado por riqueza narrativa / coste + standalone-first, enlazado desde README.md y #568, con ≥8 entradas y ≥2 descartes en total) lo escribe quien cierre el último lote (A o F).
