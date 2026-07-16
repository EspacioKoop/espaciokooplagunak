# Informe AECF — madurez por dimensión (escala M0–M5)

- **Fecha**: 2026-07-16 · **Alcance**: `main` en fase 3
- **Base de evidencia**: [`BASELINE.md`](BASELINE.md) (fuente de verdad AECF,
  issue #88), CI en `.github/workflows/`, `SECURITY.md`.
- Este informe **evalúa**; no sustituye a BASELINE.md, que sigue siendo el
  índice operativo. Se reevalúa cuando cambie un gate de CI, no por calendario.

## Escala de madurez

Adaptación de los niveles de capacidad tipo CMMI al principio del fork
«cumplimiento = pipeline verde»:

| Nivel | Nombre | Criterio |
|---|---|---|
| M0 | Inexistente | Nadie lo ha mirado; sin regla ni evidencia |
| M1 | Documentado | Regla escrita (doc/convención), sin verificación |
| M2 | Verificado manualmente | Comprobado por humano con evidencia fechada |
| M3 | Automatizado parcial | Algún gate de CI/config de repo lo cubre, con huecos conocidos |
| M4 | Automatizado completo | Toda regresión conocida rompe la CI o la impide la config del repo |
| M5 | Optimizado | M4 + revisión ante cada cambio de contexto (sync upstream, release) con criterio de mejora |

## Valoración por dimensión

### Seguridad — **M3** (techo alcanzable hoy: M4)

| Práctica | Nivel | Evidencia |
|---|---|---|
| `/exec.lua` nunca expuesto | M4 | Gate `guardia-exec-lua` prueba ambas regresiones (puerto publicado, `network_mode: host`) |
| Permisos mínimos en workflows | M3 | Declarados en los 8: seis a nivel de workflow; `codeql.yml` (`security-events: write`) y `label.yml` (`contents: read`, `pull-requests: write`) solo a nivel de job. Sin gate que impida ampliarlos |
| CodeQL | M3 | Activo; alertas 8/9 resueltas (ADR-0006); actions con tags mutables (riesgo R3) |
| Dependabot (alerts + updates acotadas) | M3 | Verificado por API 2026-07-15; nunca deps C++ heredadas |
| Deps Python fijadas exactas | M4 | `requirements*.txt` + pytest en CI |
| Protección de rama `main` | **M1** | "Todo por PR" es solo convención — el hueco que fija la nota global |
| Private vulnerability reporting | M2 | Verificado por API 2026-07-14 |

**Para subir a M4**: activar branch protection con los checks existentes y
SHA-pinning en `codeql.yml`. Ambos ya en BASELINE con propietario (Varo).

### Accesibilidad — **M1** (deliberadamente)

- Módulo Foundry + docs (superficie propia): solo `aria-`/`role` puntuales en
  un `.hbs`. La condición de secuencia que aplazaba la pasada real (contraste
  Neo Geo, teclado, `aria-` en controles del GM) ya se cumplió: el mapa vivo
  (PR #73) se fusionó el 2026-07-14. La pasada está **pendiente de ejecución**
  — ya sin bloqueo previo; es la siguiente acción de la dimensión.
- Juego C++ heredado: fuera de alcance por ADR-0007 (solo si un jugador real
  choca y no se resuelve en módulo/doc; experiencia = fase 4).
- M1 sigue siendo el nivel correcto (regla escrita, sin verificación), pero ya
  no ampara aplazar: la secuencia registrada se agotó al fusionarse PR #73.
  **Para subir a M2–M3**: ejecutar la pasada ahora y convertir lo verificable
  (p. ej. lint de plantillas) en check de CI.

### Calidad y mantenimiento — **M4**

- Tres suites propias + `luac -p`, todas en CI: CTest del editor de contenido,
  pytest del puente (incl. adversariales de auth/rate-limit), `node --test`
  del módulo.
- El job Linux compila con `-DWARNING_IS_ERROR=1` (hueco corregido).
- Cobertura de línea/rama: **cortada** por ADR-0005 — no puntúa en contra.
- **Para M5**: checklist de sincronización upstream que reevalúe gates y
  divergencias en cada `upstream/AAAA-MM-DD` (parcialmente ya en UPSTREAM.md).

### Fiabilidad — **M3**

- SHA-pinning doble de SeriousProton (release + gate de CI): M4.
- Smoke test headless también en PRs que tocan `src/**` y arranca el escenario
  propio: M4.
- Publicación GHCR reproducible con actions por SHA: M4.
- Jobs heredados windows-cross/macOS contra `master` vivo: **M1**, desviación
  aceptada y documentada (ADR-0004) — es lo que deja la dimensión en M3.
- Activación del módulo en Foundry real no verificable en CI (licencia): techo
  estructural M2 para esa pieza; guion manual en `FOUNDRY_GUI_SMOKE.md`.

## Resumen

| Dimensión | Nivel | Siguiente acción concreta |
|---|---|---|
| Accesibilidad | M1 | Ejecutar ya la pasada al módulo (PR #73 fusionado el 2026-07-14; sin bloqueo previo) |
| Seguridad | M3 | Branch protection en `main` + SHA-pin en `codeql.yml` |
| Calidad | M4 | Checklist de reevaluación en cada sync upstream |
| Fiabilidad | M3 | Vigilar jobs heredados; sin acción hasta que fallen en falso |

Lectura global: el fork está en **M3–M4 sobre lo que gobierna**. De los dos
M1 restantes, la desviación de jobs heredados sigue siendo una decisión
registrada (ADR-0004); el de accesibilidad dejó de estar amparado por la
secuencia al fusionarse PR #73 y es ahora trabajo pendiente con acción
concreta. La regla de admisión de
BASELINE.md sigue vigente: nada de aquí se convierte en issue hasta que duela
y quepa en un PR.
