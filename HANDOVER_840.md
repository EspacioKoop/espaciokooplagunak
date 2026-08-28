# HANDOVER — Issue #840 (destilar bobeff/open-source-games) — sesión 2026-08-28

## Estado al cierre de esta sesión

- Issue #840: OPEN (KEEP OPEN por el owner, falta merge de Lote D + consolidación final).
- De los 7 lotes, 5 ya están MERGED en main: A(#849), B(#843), C(#848), E(#846), G(#845).
- 2 lotes abiertos, ambos con CHANGES_REQUESTED del owner. La revisión de contenido YA está
  resuelta en HEAD en los dos; falta que el owner re-revise y apruebe (no es bloqueo de código):
  - Lote D (#847) — rama docs/inspiracion-lote-d. HEAD = ef4804c8.
    - La corrección que el owner pidió en su 2ª revisión (frase «Sustituido por Enlace» en el
      descarte de Moral + separar evidencia/propuesta) YA ESTÁ APLICADA en ef4804c8. El owner
      revisó un SHA anterior (4e8a329d).
    - NO hace falta tocar nada en D. Solo falta que el owner re-revise y apruebe (re-visión
      trivial, verificada línea a línea abajo).
  - Lote F / índice final (#850) — rama docs/inspiracion-lote-f. HEAD = 49ae3443.
    - Mi commit añadió: Ask the Oracle (Ironsworn/Starforged CC BY 4.0), Kenney (CC0 assets),
      Beyond the Spozak (CC0 setting). Tabla rápida 19 entradas. Secciones 7b/7c en
      lote-g-otras-fuentes.md.
    - Las 4 correcciones que el owner pidió en su revisión (SHA 6865cbf7) YA ESTÁN APLICADAS en
      commits posteriores (7744ed87, b4241538, 49ae3443) — verificadas línea a línea abajo.
    - #850 NO está «bloqueado solo por D»: su contenido está completo y verde. La única
      dependencia de D es el recuento firme de la sección de aceptación (líns 292-293: «hasta que
      se mergee, el recuento firme es 17 mecánicas»). Ambos PRs son MERGEABLE de forma
      independiente (sin conflicto entre ellos).

## Qué hice esta sesión (sesión de avance / verificación, 2026-08-28)

1. Verifiqué contra GitHub el estado real (no me fíe solo del handover previo): #847 y #850 siguen
   OPEN, ambos CHANGES_REQUESTED, ambos MERGEABLE, ambos con CI en verde (todas las puertas SUCCESS,
   incluido tools/tests y Puerta de tools).
2. Leí las dos revisiones CHANGES_REQUESTED del owner en #847 y la de #850, y contrasté con el
   contenido actual de HEAD en cada rama:
   - #847 (ef4804c8): la frase Moral/Enlace es coherente (docs/inspiracion/lote-d-estados.md
     líns 143-146: «Enlace ya no es estado de personaje: pasó al anexo de salud de puesto»); Enlace
     está en el anexo de salud de puesto (líns 122-138); la convención evidencia/propuesta está
     escrita (líns 25-26). Los 5 estados de personaje tienen productor real o entran «bloqueado»
     (líns 101-164).
   - #850 (49ae3443): las 4 correcciones están presentes — (a) orden riqueza/coste: sección
     «Priorización por riqueza narrativa / coste» (líns 242-247) + columna Riqueza(1-5) en la tabla
     rápida (líns 52, 32-36); (b) Forged in the Dark = CC BY 3.0 (tabla línea 61 + nota líns
     296-297); (c) columna Standalone honesta (líns 46-49, 54-61, nombra event-journal.mjs,
     station-actions.mjs, npc-generador.mjs); (d) Lote D marcado no consolidado (líns 180, 262,
     292-293). README enlaza el índice (línea 370) y #568/ECOSISTEMA lo hace en prosa (línea 107).
3. Corrí los gates locales en la rama lote-f: refs-rotas.py → 0 rotas (tras corregir los backticks
   de este handover); pytest tools/tests → 234 passed, 1 skipped.
4. Corregí este handover: eliminé los backticks alrededor de nombres de rama/ruta (refs-rotas.py los
   parsea como enlaces de fichero y los marcaba rotos en local), y aclaré que #850 no está
   «bloqueado solo por D».

## Límites / bloqueos (decisión humana, no mía)

- Protección de rama + AGENTS.md: la fusión de #847 y #850 la hace el humano (owner). NO mergeo yo.
- El único camino para cerrar #840 es: owner aprueba #847 → merge #847 → (revisión/aprobación de
  #850, ya content-complete) → merge #850 → cerrar #840.
- El CHANGES_REQUESTED de GitHub NO se borra solo: persiste hasta una nueva revisión APPROVE del
  owner, aunque el contenido ya esté corregido. Por eso ambos PRs necesitan tu re-visión explícita,
  no solo el merge.
- No abrí tarjetas de implementación (regla del issue: los adoptar se escriben, no se ejecutan).

## Directorio de archivos relevantes

- docs/INSPIRACION_JUEGOS_LIBRES.md — índice final (rama F, ya con 19 entradas).
- docs/inspiracion/lote-g-otras-fuentes.md — secciones 7b (Ask the Oracle) y 7c (fuentes CC0).
- docs/inspiracion/lote-d-estados.md — Lote D (en rama D, ya corregido por su autor).
- Rama de trabajo actual: docs/inspiracion-lote-f (sincronizada con origin).

## Fuentes verificadas (para reusar)

- FitD CC BY 3.0: bladesinthedark.com/licensing
- Ironsworn/Starforged SRD CC BY 4.0: tomkinpress.com/pages/licensing
- Kenney CC0: kenney.nl (sección licencia)
- Beyond the Spozak CC0: itch.io jam "Forever Open Source"
- WN SRD CC0: ficha DriveThruRPG producto 473939

## Siguiente paso recomendado (humano)

1. Owner: re-revisar #847 (ya corregido en ef4804c8) y aprobar.
2. Mergear #847 en main.
3. Owner: re-revisar #850 (contenido completo y verde; correcciones verificadas arriba) y aprobar.
4. Mergear #850 (índice final) en main.
5. Cerrar #840 y borrar ramas de lote.

— Hermes (handover 2026-08-28, actualizado en sesión de avance/verificación)
