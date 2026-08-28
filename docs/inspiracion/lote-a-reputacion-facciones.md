# Lote A — Reputación entre facciones (recordar con quién te llevas mal)

Parte de docs/INSPIRACION_JUEGOS_LIBRES.md (issue #840); el índice lo escribe quien cierra el último lote.

- **Autor del análisis:** Hermes (consolidación).
- **Fuente declarada:** wiki de Endless Sky (endless-sky.fandom.com/wiki/Reputation) y repositorio (endless-sky/endless-sky). **Leído por encima**, no jugado. Licencia verificada contra el repo vía API de GitHub: `endless-sky/endless-sky` → LICENSE = GPL-3.0.
- **Fichero previsto en el issue:** `docs/inspiracion/lote-a-reputacion-facciones.md`.
- **Estado:** primera pasada, fuente y licencia verificadas. Cumple la regla de admisión del issue: cada entrada dice las cinco cosas y tiene veredicto; hay al menos un descarte razonado.

La pregunta del lote: cómo recuerda el juego «con quién te llevas bien o mal» de forma que esa memoria condicione el mundo sin pedir arte ni motor nuevo. La trampa de este lote es justo **dónde vive esa memoria**: es autoridad de campaña (#213/#767) y, por ADR-0008, vive en el núcleo, no en el módulo. Toca #766 (persistencia).

## Dónde estamos hoy (ancla real, leída del repo)

- `foundry-module/scripts/npc-generador.mjs` genera NPCs deterministas a partir de semilla; es Node/foundry-module y **no guarda estado de campaña entre sesiones**.
- #767 (Registro de Avistamientos y Bestiario Local) y #766 (persistencia) sitúan la autoridad de campaña —progreso, atlas, misiones, consecuencias— en el **núcleo del simulador (C++)**, no en el módulo de Foundry. ADR-0008 lo fija: standalone-first significa que el juego es jugable y guarda progreso sin el VTT.
- Conclusión del ancla: hoy no tenemos un escalar de «relación con la facción X» que persista y condicione ofertas/acciones. Ese es el hueco. Y, por diseño del fork, ese hueco se cierra en núcleo, no en puente/Lua ni en `npc-generador.mjs`.

## Endless Sky — reputación por facción como escalar persistente que condiciona el mundo

1. **Juego y licencia:** Endless Sky — **GPL-3.0** (verificada en `endless-sky/endless-sky` → LICENSE: «GNU General Public License v3.0»).
2. **Mecánica:** cada facción tiene un escalar de reputación (positivo / cero / negativo). Ese número condiciona el mundo sin árbol de diálogo: reputación negativa → la facción te ataca a la vista (algunas sobornables); reputación ≥0 → te reparan la nave si quedas inhabilitado; algunos planetas exigen un umbral de reputación para aterrizar (p.ej. Hai-home exige ≥100, sin soborno); y algunas misiones solo se ofrecen si tu reputación con la facción que las ofrece supera un umbral. Lo más interesante para nosotros: los cambios son **transitivos** —una misión de Piratas sube tu reputación con Piratas pero hunde la de República/Sindicato. La reputación se gana/pierde por tribute, reparar naves, misiones repetibles y misiones de trama; y **persiste entre partidas** como estado de campaña.
3. **Problema nuestro:** #767/#766 necesitan precisamente «recordar a quién has conocido / con quién te llevas mal» como autoridad de campaña persistente. Un escalar por facción que (a) gatee acceso (aterrizar, misiones ofrecidas) y (b) tenga efectos transitivos (ayudar a X daña a Y) es el patrón barato que buscamos: tablas y estado, cero arte.
4. **Coste:** **núcleo C++**. Esta es la corrección de coste del lote: la reputación entre facciones es autoridad de campaña (progreso y consecuencias que persisten), y ADR-0008 la sitúa en el núcleo del simulador, no en el módulo de Foundry ni en Lua de escenario ni en `npc-generador.mjs` (este último es un cimiento huérfano en HUERFANOS_DECLARADOS). No se puede implementar en escena porque debe sobrevivir al cierre de la sesión VTT y ser la fuente autoritativa para cualquier cliente. El módulo Foundry solo consultaría/mostraría ese escalar; no lo poseería.
5. **Veredicto:** `adoptar` (como patrón de diseño de autoridad de campaña, no como código a importar — GPL-3.0 prohíbe traer el `.cpp`, y de todos modos la idea no tiene licencia). Tarjeta:
   `feat(core/campaign): escalar de reputación por facción persistente que gatea acceso y tiene efectos transitivos (#767/#766, ADR-0008)`.
   **Frontera #526:** la reputación es un hecho observable del mundo (un número); el módulo lo muestra, no afirma intención ni moral de la facción.

## Endless Sky — mercado/comisión atado a la economía (descartado)

1. **Juego y licencia:** Endless Sky — **GPL-3.0** (misma verificación).
2. **Mecánica:** en Endless Sky la reputación alta también abre «mercados militares» y mejores naves, casi siempre detrás de una comisión que requiere una economía de mercado simulada (precios, rutas, stock).
3. **Problema nuestro:** ninguno directo. El fork standalone-first no simula una economía de mercado; ese sub-sistema necesitaría equilibrio y datos fuera del alcance de #840.
4. **Coste:** núcleo C++ **más** un simulador de economía entero que no existe. Muy caro y ajeno al hueco que cerramos.
5. **Veredicto:** `descartado`. Motivo: el gateo por reputación (entrada anterior) es lo reutilizable; acoplarlo a una economía de mercado lo hace inviable en standalone-first. Se anota para no tentar a un worker a «subir la cobertura» implementando el mercado.

Pendiente: el índice final docs/INSPIRACION_JUEGOS_LIBRES.md (ordenado por riqueza narrativa / coste + standalone-first, enlazado desde README.md y #568, con ≥8 entradas y ≥2 descartes en total) lo escribe quien cierre el último lote (A o F).
