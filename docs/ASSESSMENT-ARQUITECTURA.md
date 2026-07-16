# Architecture Assessment Report — Espaciokoop Lagunak

- **Fecha**: 2026-07-16 · **Alcance**: `main` en fase 3 del roadmap
- **Método**: descripción conforme a ISO/IEC/IEEE 42010 (vistas C4 en
  [`ARQUITECTURA.md`](ARQUITECTURA.md)), evaluación tipo **ATAM-lite** (SEI):
  escenarios de atributos de calidad → riesgos, no-riesgos, puntos de
  sensibilidad y trade-offs. Las decisiones quedan registradas como ADRs
  ([`docs/adr/`](adr/README.md)); las propuestas de cambio siguen el flujo
  RFC del fork: issue = contrato de alcance, PR = registro de implementación.
- **Complemento**: métricas de madurez AECF (M0–M5) en
  [`AECF-METRICAS.md`](AECF-METRICAS.md).

## 1. Contexto y partes interesadas

| Stakeholder | Interés dominante |
|---|---|
| Director de juego (GM) | Estado vivo de la nave en Foundry, control de tempo, anotación en Journal |
| Tripulación | Puestos del juego nativo por LAN, sin fricción |
| Mantenedores (2 humanos + agentes) | Merge tax mínimo con upstream, CI como fuente de verdad |
| Upstream (daid/EmptyEpsilon) | Recibir arreglos generales como PR (ADR-0007) |

Sistema en dos contenedores propios (`docker/compose.yaml`: servicios `game`
y `bridge`, vista C4 nivel 2): juego headless C++ (:8080 interno, :35666 LAN)
← puente FastAPI (:8090, bind 127.0.0.1). El módulo Foundry se ejecuta en un
Foundry VTT **externo** al despliegue (polling HTTP + Bearer contra el
puente); no es un contenedor del sistema.

## 2. Decisiones arquitectónicas registradas

El inventario completo está en [`docs/adr/README.md`](adr/README.md)
(ADR-0001 a ADR-0007). Las tres estructuralmente dominantes:

1. **ADR-0001** — `/exec.lua` jamás expuesto; el puente es el único cliente,
   con gate de CI (`guardia-exec-lua`).
2. **ADR-0002** — autoridad de datos partida: Foundry = narrativa,
   simulación = nave; el puente traduce con contrato v0 versionado.
3. **ADR-0007** — frontera upstream: cero divergencia en `src/` heredado salvo
   PR previo a upstream; divergencias permanentes enumeradas (ADR-0006).

## 3. Escenarios de atributos de calidad (ATAM-lite)

| # | Atributo | Escenario | Respuesta observada |
|---|---|---|---|
| E1 | Seguridad | Un atacante en la LAN intenta ejecutar Lua vía HTTP | El 8080 no está publicado; el puente solo acepta plantillas de lista blanca con Bearer + rate limit; regresión cubierta por CI |
| E2 | Modificabilidad | Upstream publica cambios en `src/` | Merge `--no-ff` en rama `upstream/AAAA-MM-DD`; divergencia real vs. upstream (medida con `git diff --name-only upstream/master...HEAD`): piezas propias deliberadas en `src/content/` + `src/screens/gm/` (editor de contenido, 20 archivos) y soporte del fork en `src/` (puestos, menús, `gameGlobalInfo`, 12 archivos), `scripts/` (locale es 76, escenario propio, `api/shipTemplate.lua`) y `script_docs/` (8, ADR-0006) — ese es el merge tax a vigilar en cada sync |
| E3 | Fiabilidad | SeriousProton cambia su HEAD | Sin efecto: release y CI fijan el mismo SHA (ADR-0004) |
| E4 | Testabilidad | Cambio en el puente o el módulo | pytest con juego mockeado y `node --test` de lógica pura — sin necesidad de juego ni Foundry vivos |
| E5 | Disponibilidad de datos | El polling pierde muestras | El mapa interpola solo muestras confirmadas, nunca extrapola; eventos idempotentes por `eventId` |
| E6 | Rendimiento/latencia | El GM necesita estado "en vivo" | Polling suficiente hoy; WebSocket aplazado hasta latencia medida (ADR-0003) |

## 4. Fortalezas (no-riesgos)

- La regla de seguridad central es **mecánica** (gate de CI), no documental.
- Frontera de autoridad de datos explícita y respetada en el código
  (el módulo nunca escribe estado de nave; el puente nunca escribe narrativa).
- Piezas propias pequeñas y testeables de forma aislada (~2.9 kLOC propias
  entre puente y módulo, con tres suites en CI + `luac -p`).
- Reproducibilidad: SHA-pinning doble de SeriousProton, publicación GHCR con
  actions fijadas por SHA, dependencias Python por versión exacta.

## 5. Riesgos y puntos de sensibilidad

| ID | Riesgo | Sensibilidad / mitigación propuesta |
|---|---|---|
| R1 | `main` sin protección de rama: "todo por PR" es convención, no mecanismo | Activar branch protection exigiendo los checks existentes (pendiente en BASELINE, requiere admin) |
| R2 | La activación del módulo en un Foundry real no es verificable en CI (licencia) | Punto de sensibilidad permanente; mitigar con el guion de humo manual (`FOUNDRY_GUI_SMOKE.md`) tras cada release del módulo |
| R3 | `codeql.yml` con permisos ampliados usa tags mutables de actions | SHA-pinning pendiente (BASELINE) |
| R4 | Jobs heredados windows-cross/macOS contra `master` vivo de SeriousProton | Desviación aceptada y documentada (ADR-0004); revisar si fallan en falso |
| R5 | Factor bus ≈ 2 humanos; conocimiento operativo en issues | El estado vive en `main` verificado + docs; mantener esa disciplina |

## 6. Trade-offs asumidos

- **Polling vs. latencia** (ADR-0003): simplicidad y menor superficie a cambio
  de estado con retardo de segundos — aceptable para una mesa de rol.
- **Cero divergencia vs. velocidad local** (ADR-0007): arreglos en código
  heredado son más lentos (pasan por upstream) a cambio de merge tax acotado.
- **Sin cobertura global** (ADR-0005): se renuncia a la métrica a cambio de no
  incentivar divergencia; el control real son las suites propias en verde.

## 7. Conclusión

Arquitectura **sana para su fase**: los límites (seguridad, autoridad de
datos, frontera upstream) están decididos, documentados y en su mayoría
convertidos en gates de CI. El trabajo de evaluación pendiente no es de
diseño sino de gobierno: R1 (branch protection) y R3 (SHA-pinning de CodeQL)
son los dos únicos hallazgos accionables hoy, y ambos ya constan en
[`BASELINE.md`](BASELINE.md) con propietario.
