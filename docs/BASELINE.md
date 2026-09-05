# Baseline AECF — accesibilidad, seguridad, calidad y fiabilidad

Índice único del estado de buenas prácticas del fork (issue #88). Este documento
es la fuente de verdad: se cambia por pull request, como todo lo demás. El
issue #88 fue el arranque de este doc, no un paraguas permanente — el estado del
proyecto vive en `main` verificado, no en la pestaña Issues.

Evaluaciones derivadas de este índice: madurez por dimensión (escala M0–M5) en
[`AECF-METRICAS.md`](AECF-METRICAS.md) y evaluación de arquitectura (ATAM-lite,
con registro de ADRs en [`adr/`](adr/README.md)) en
[`ASSESSMENT-ARQUITECTURA.md`](ASSESSMENT-ARQUITECTURA.md).

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
      el puerto 8080 o usa `network_mode: host`; el job prueba ambas regresiones).
- [x] Permisos mínimos declarados en los 8 workflows: seis a nivel de
      workflow (`contents: read`) y dos solo a nivel de job — `codeql.yml`
      (`security-events: write`) y `label.yml` (`contents: read`,
      `pull-requests: write`); ampliaciones justificadas también en
      `docker-publish.yml`.
- [x] CodeQL activo (`codeql.yml`); alertas 8/9 resueltas vendorizando
      highlight.js (issue #87, PR #89).
- [x] Dependabot acotado a lo propio del fork: `github-actions`, `pip` en
      `bridge/`, imágenes Docker. **Nunca** dependencias C++ heredadas
      (`.github/dependabot.yml` documenta el porqué).
- [x] Dependencias Python fijadas por versión exacta (`bridge/requirements*.txt`).
- [x] **Protección de rama en `main`** aplicada y verificada en el
      [issue #225](https://github.com/EspacioKoop/espaciokooplagunak/issues/225):
      pull request y una aprobación humana obligatorias, aprobación del último
      cambio por otra persona, conversaciones resueltas, administradores sin
      bypass y force-push/borrado bloqueados. Los checks requeridos son las cinco
      puertas estables por área (`build C++/Lua`, `módulo Foundry`, `tools`,
      `docker y puente`, `imágenes`) más `CodeQL` y `semgrep`; una PR solo de
      documentación publica los siete y una puerta roja bloquea la integración.
- [x] **Secret scanning** y **push protection** activados y verificados por API
      (issue #662, 2026-09-04, tras ganar administración con el traslado a la
      organización `EspacioKoop`): `secret_scanning` y
      `secret_scanning_push_protection` en `enabled`, cero alertas al activar.
      Es la capa que un hook local no puede sustituir, porque `git push
      --no-verify` desactiva el hook y no el servidor. Quedan **fuera**
      `non_provider_patterns` y `validity_checks`: el PATCH las devuelve
      `disabled` sin error, presumiblemente por plan.
- [x] **Dependabot alerts** activado y verificado por API
      (`GET /vulnerability-alerts` → 204, Varo, 2026-07-15). Las PR automáticas
      de `dependabot_security_updates` siguen siendo una decisión separada.
- [x] Private vulnerability reporting activado y verificado por API
      (issue #86, Varo, 2026-07-14).
- [ ] CODEOWNERS (opcional con 2 humanos; decidir si aporta o estorba).
      *Propietario: Varo (requiere admin para hacerlo obligatorio).*
- [x] SHA-pinning de actions en los workflows con permisos ampliados:
      `codeql.yml` y `docker-publish.yml` usan commits inmutables; los cuatro
      análisis CodeQL lo verificaron en el PR #229.

## Accesibilidad

Tres superficies con costes muy distintos; solo dos son nuestras:

- **Módulo Foundry (`foundry-module/`) y documentación**: código propio,
  mejorable sin merge tax. Cobertura automatizada real desde el PR #231
  (2026-07-20): `aria-`/`role`/nombre accesible en 4 de las 5 plantillas,
  foco visible, `prefers-reduced-motion` y contraste AA calculado desde los
  tokens CSS reales — todo verificado por regresión Node en CI, no solo
  documentado. El PR #274 cubrió gestión de puestos y espacios de puesto; el
  PR #281 fijó por regresión el orden de teclado en las cinco superficies
  (issue #227).
  - [x] Pasada de accesibilidad automatizada al módulo Foundry (contraste,
        navegación por teclado, `aria-` en los controles del GM) — PRs #231,
        #274, #281 (ver AECF-METRICAS.md).
  - [x] Foco conservado y `aria-live` sin ruido tras re-render en las dos
        rutas de aplicación (v11 clásico y ApplicationV2) — PRs #279, #280,
        #282.
  - [x] Recorrido humano con **teclado y reducción de movimiento** en Foundry
        real (v11.302), coordinado con el smoke general de #29. La pasada
        encontró una regresión real de `restaurarFoco()` (`pausar`/`reanudar`
        quedan `disabled` uno a otro; enfocar un control `disabled` es un no-op
        silencioso del navegador y el foco caía a `document.body`, rompiendo la
        tabulación del resto de la ventana), corregida con fallback al control
        enfocable adyacente (PR #288). Con esto **se cierra #227**: cobertura
        automatizada completa en las cinco superficies + pase humano de teclado
        y `prefers-reduced-motion` en v11.302.
  - [ ] Residual acotado (folded en #29, no bloquea #227): pase con **lector de
        pantalla** y repetición en **host moderno**. Es verificación adicional,
        no una superficie sin cubrir.
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
- [x] El smoke test headless corre también en PRs que tocan `src/**`,
      `CMakeLists.txt` o el escenario propio exacto (antes solo tras el merge a
      `main`) y arranca ese escenario, no solo el heredado.
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
