# Baseline AECF — accesibilidad, seguridad, calidad y fiabilidad

Índice único del estado de buenas prácticas del fork (issue #88). Este documento
es la fuente de verdad: se cambia por pull request, como todo lo demás. El issue
#88 fue el arranque de este doc, no un paraguas permanente — el estado del
proyecto vive en `main` verificado, no en la pestaña Issues.

## Reglas de funcionamiento

1. **Regla de admisión**: un ítem de esta lista solo se convierte en issue
   cuando duele y cabe en un PR. Mientras no duela, vive aquí como línea sin
   marcar. Nada de sub-issues de vigilancia perpetua.
2. **Cumplimiento = pipeline verde**: cuando una práctica se adopta, se
   convierte en un check de CI o en configuración del repo, no en una ceremonia
   de revisión periódica. La cadencia "periódica" la da la CI en cada push.
3. **Normas externas (ISO/IEEE/RFC/opensource.guide)**: solo se citan con
   cláusula concreta y beneficio verificable para este fork. "Conforme a X" sin
   una decisión que cambie no entra en este doc.
4. **Frontera upstream**: ninguna práctica de este doc justifica por sí sola
   divergir del código heredado de EmptyEpsilon. Si el arreglo correcto está en
   `src/` heredado, primero PR a upstream ([UPSTREAM.md](UPSTREAM.md)).

## Seguridad

Baseline normativa: [SECURITY.md](../SECURITY.md) (no se duplica aquí).

- [x] `/exec.lua` nunca expuesto — regla en SECURITY.md **y gate en CI**
      (job `guardia-exec-lua` en `docker.yml`: falla si `compose.yaml` publica
      el puerto 8080).
- [x] Permisos mínimos declarados en los 6 workflows (`contents: read`;
      ampliaciones justificadas en `codeql.yml` y `docker-publish.yml`).
- [x] CodeQL activo (`codeql.yml`); alertas 8/9 resueltas vendorizando
      highlight.js (issue #87, PR #89).
- [x] Dependabot acotado a lo propio del fork: `github-actions`, `pip` en
      `bridge/`, imágenes Docker. **Nunca** dependencias C++ heredadas
      (`.github/dependabot.yml` documenta el porqué).
- [x] Dependencias Python fijadas por versión exacta (`bridge/requirements*.txt`).
- [ ] **Protección de rama en `main`** exigiendo los checks existentes
      (cicd, pytest del puente, foundry-module, guardia-exec-lua). Hoy "todo
      por PR" es solo convención. *Propietario: Varo (requiere admin).*
- [ ] **Dependabot alerts** (Settings → Security): las actualizaciones
      programadas de `dependabot.yml` no avisan de un CVE en una dependencia
      ya pinneada hasta el bump semanal; las alertas sí. Pedido en #88.
      *Propietario: Varo (requiere admin).*
- [x] Private vulnerability reporting activado y verificado por API
      (issue #86, Varo, 2026-07-14).
- [ ] CODEOWNERS (opcional con 2 humanos; decidir si aporta o estorba).
      *Propietario: Varo (requiere admin para hacerlo obligatorio).*
- [ ] SHA-pinning de actions en los workflows con permisos ampliados que aún
      usan tags mutables (`codeql.yml`) — `docker-publish.yml` ya lo hace.

## Accesibilidad

Tres superficies con costes muy distintos; solo dos son nuestras:

- **Módulo Foundry (`foundry-module/`) y documentación**: código propio,
  mejorable sin merge tax. Pendiente de baseline real (hoy solo hay `aria-`/
  `role` puntuales en un `.hbs`).
  - [ ] Pasada de accesibilidad al módulo Foundry (contraste de la ventana
        Neo Geo, navegación por teclado, `aria-` en los controles del GM)
        cuando el mapa vivo (PR #73) esté fusionado — no antes, para no
        revisar dos veces lo mismo.
- **Juego C++ heredado (`src/gui/`, `src/screens/`)**: divergencia upstream
  permanente y cara. Regla: solo si un jugador real del fork choca con la
  barrera y no puede resolverse en módulo/doc — y entonces primero PR a
  upstream. La accesibilidad de experiencia es **fase 4** del roadmap; traerla
  a fase 3 roba foco.

## Calidad y mantenimiento

Baseline normativa: las tres suites propias + gates documentados en
[CLAUDE.md](../CLAUDE.md) y el procedimiento de sincronización en
[UPSTREAM.md](UPSTREAM.md).

- [x] Suites propias en CI: CTest C++ (editor de contenido), pytest del puente
      (65 tests, auth/rate-limit adversarial), `node --test` del módulo Foundry,
      `luac -p` sobre `scripts/`.
- [x] El job Linux de CI compila con `-DWARNING_IS_ERROR=1` (era el único
      job con tests que no lo exigía; corregido en `docker/build.sh`).
- [x] `actions/checkout@v2` (EOL) eliminado de `cicd.yml`.
- Cobertura de línea/rama: **cortada deliberadamente** en fase 3. Medirla
  sobre un árbol 95 % heredado da un número que no podemos ni debemos mover.
  Si algún día se mide, solo sobre `bridge/` y `foundry-module/`.

## Fiabilidad

- [x] La imagen de release fija la revisión de SeriousProton por SHA
      (`docker/Dockerfile`).
- [x] El gate de CI fija la MISMA revisión (`docker/build.sh`) — antes clonaba
      el HEAD vivo de SeriousProton y la CI podía romperse sin ningún cambio
      local. Ambos pins se actualizan a la vez en cada sincronización upstream.
- [x] El smoke test headless corre también en PRs que tocan `src/**` y
      `CMakeLists.txt` (antes solo tras el merge a `main`) y arranca el
      escenario propio del fork, no solo el heredado.
- [x] Publicación reproducible en GHCR con actions fijadas por SHA
      (`docker-publish.yml`).
- [ ] Los jobs windows-cross/macOS heredados de upstream siguen usando el
      `master` vivo de SeriousProton (`cicd.yml`). Desviación aceptada de
      momento: son jobs de empaquetado heredados, sin tests, y pinnearlos es
      más divergencia de mantenimiento que valor. Revisar si empiezan a fallar
      en falso.

## Fuera de este documento

- El trabajo de fase 3 (mapa vivo, avería-palanca, gestión de nave) — roadmap
  en el README.
- Auditorías genéricas tipo scorecard OpenSSF: puntuarían en rojo código de
  upstream que no gobernamos.
