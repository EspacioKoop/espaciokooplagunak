# ADR-0012 — Puestos sin tripulación: degradado con aviso, sin automatización

- Estado: Aceptada
- Fecha: 2026-08-28
- Decisores: @eGurucharri
- Issue relacionado: #512
- Fuentes: [`docs/VERIFICACION-NAVEGACION-Y-AUTOMATIZACION.md`](../VERIFICACION-NAVEGACION-Y-AUTOMATIZACION.md#481--automatización-nativa-de-puestos-sin-tripulación) (#481), [`docs/PERMISOS_PUESTO.md`](../PERMISOS_PUESTO.md) (#237, ADR-0009)

## Contexto

#479 (Etapa B, frente 4) dejó pendiente decidir qué pasa con el sistema de un
puesto de mando cuando ese puesto no tiene tripulación asignada. #481 verificó
que EmptyEpsilon nativo no condiciona ninguna automatización a la ocupación de
un puesto: impulso, warp, escudos, armas, sensores... permanecen en su último
valor ordenado, y `commandSetAutoRepair` es un interruptor de nave completa
ajeno a qué puestos estén cubiertos.

La métrica de salida de la Etapa B es que ningún jugador pueda describir su
puesto como «mirar mientras otro juega» — una automatización generosa para
puestos vacíos incumple esa métrica directamente, porque diluye la presión
cooperativa que hace notar la ausencia de un puesto.

## Alternativas consideradas

- **Nada (agujero)** — un puesto vacío deja de responder a cualquier orden.
  Descartada: es más severo que el propio comportamiento nativo y no aporta
  nada sobre él.
- **Suplencia** — otro puesto puede asumir temporalmente el vacío. Descartada:
  es la única de las alternativas que toca la matriz de autoridad de #237
  (`station-actions.mjs`/`station-order-relay.mjs`, ADR-0009), y el coste de
  abrir esa puerta no está justificado por evidencia de que haga falta.
- **IA de respaldo competente** — un sistema controlado por IA sustituye al
  jugador ausente. Descartada para esta fase: exige decidir una política de
  comportamiento propia por sistema (¿qué dispara Armas-IA? ¿qué escanea
  Sensores-IA?) sin evidencia de que un puesto vacío hunda una sesión real, y
  contradice directamente la métrica de éxito de la etapa si la IA juega
  razonablemente bien por el hueco.
- **Valor de seguridad automático al vaciarse** (p. ej. escudos arriba,
  energía repartida uniformemente) — descartada: convierte la ausencia de un
  jugador en una decisión autónoma con consecuencias propias, y cada sistema
  necesitaría su propia política de "seguridad" sin que nadie la haya pedido.
- **Degradado con aviso** (elegida) — el sistema conserva su último valor
  ordenado, que es el comportamiento nativo ya verificado por #481, y la nave
  añade una señal de que ese puesto no está atendido. No actúa por su cuenta.

## Decisión

Un puesto sin tripulación **no se automatiza**. El sistema que gobierna
mantiene el último valor ordenado —comportamiento nativo de EmptyEpsilon,
sin cambios— y la nave **avisa** de que el puesto está sin atender. Lo único
que añade esta decisión sobre el comportamiento nativo es la señal.

No se reasigna la autoridad del puesto a nadie por el mero hecho de quedar
vacío: ni a otro puesto (suplencia), ni al GM de forma implícita. La consola
caliente del GM ya permite una intervención manual y explícita cuando haga
falta, con la misma autoridad que ya tiene hoy — esta decisión no le añade ni
le quita ninguna capacidad.

Alcance de la tarjeta de implementación que sale de aquí: dónde se muestra el
aviso y cómo se calcula «puesto no atendido» — desde el `User` autenticado,
nunca desde la orden (#237, ADR-0009). No añade ninguna entrada nueva a
`station-actions.mjs`.

## Consecuencias

### Positivas

- Cero automatización especulativa: no hay que diseñar ni mantener una
  política de IA por sistema sin evidencia de que haga falta.
- Compatible con el comportamiento nativo ya verificado (#481): no hay
  divergencia de upstream que justificar ni sincronizar.
- No toca la matriz de autoridad de #237/ADR-0009: ningún puesto gana
  capacidad de actuar por otro.
- La presión de un puesto vacío se mantiene visible y real, alineada con la
  métrica de éxito de la Etapa B.

### Negativas

- Un puesto vacío durante mucho tiempo puede dejar a la nave en una
  configuración inadecuada para la situación actual (p. ej. escudos bajos en
  combate) sin que nada la corrija salvo intervención humana.
- Si el playtest de #467 muestra que esto hunde sesiones reales con menos de
  la tripulación ideal, hará falta abrir una decisión nueva (posible IA de
  respaldo) en vez de reutilizar esta.

## Implementación y evidencia

Pendiente: issue de implementación para el aviso de «puesto no atendido» y su
cálculo desde el `User` autenticado — no abierto todavía a fecha de este ADR.
`docs/ROADMAP_PRODUCTO.md` enlaza esta decisión desde el frente #481/#512 de
la Etapa B.

## Criterios de revisión

Esta decisión deja de ser válida si el playtest de #467 (u otro con
tripulación real) demuestra que un puesto vacío hunde la sesión pese al
aviso — en ese caso, la alternativa de IA de respaldo se reabre como decisión
independiente, condicionada a esa evidencia, y no como reescritura de este
ADR.

---

## Referencias

- #512 — issue de diseño que registra esta decisión
- #481 — verificación del comportamiento nativo de EmptyEpsilon
- #479 — coordinación de Etapa B, frente 4
- #467 — playtest pendiente que podría justificar revisar esta decisión
- #237 / ADR-0009 — matriz de autoridad por puesto
