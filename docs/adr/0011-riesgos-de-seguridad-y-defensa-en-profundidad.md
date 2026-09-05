# ADR-0011 — Riesgos de seguridad del fork y defensa en profundidad

- Estado: Propuesta
- Fecha: 2026-08-22
- Origen: análisis externo de Qwen3.7 sobre el estado público del repositorio,
  publicado inicialmente como aviso de seguridad `GHSA-wv5c-x3xw-hcgc`. Se
  traslada aquí porque **no describe una vulnerabilidad explotable**, que es lo
  que un aviso comunica, sino una postura de arquitectura. Un aviso abierto en
  `triage` con severidad alta anuncia a quien mire la pestaña de seguridad que
  hay algo sin parchear, y no lo hay.
- Verificación: los riesgos de abajo se contrastaron contra el árbol el
  2026-08-22. Donde el análisis original y el código discrepan, manda el código
  y queda dicho.

## Contexto

Este repositorio es un fork público de EmptyEpsilon con un puente en Python
hacia Foundry VTT, y parte del trabajo lo hacen agentes con acceso al entorno
local de quien colabora. La superficie de ataque son las dos cosas: la
aplicación heredada y el propio flujo de desarrollo.

## Decisión

Se adopta defensa en profundidad —aislamiento de red, mínimo privilegio,
endurecimiento del contenedor y prevención de fuga de secretos— y se deja por
escrito qué riesgos hay, cuáles están ya cubiertos y cuáles no.

## Los riesgos, contrastados contra el árbol

### R1 — Ejecución de Lua arbitrario por `/exec.lua`

**Severidad real: media, no crítica.** El análisis original lo calificó de
crítico diciendo que «el servidor expone `/exec.lua` sin autenticación». Es
cierto que no hay autenticación, y ahí acaba el parecido:

- **Está apagado de serie.** `src/main.cpp:159` solo levanta el `EEHttpServer`
  si la preferencia `httpserver` vale distinto de cero. El propio upstream
  registra `NOTE: This is potentially a risk!` al encenderlo.
- **Es comportamiento heredado**, no algo que este fork introduzca.
- **El puerto no se publica.** `docker/compose.yaml` no lo expone, y hay un
  trabajo de CI dedicado a vigilarlo, `guardia-exec-lua` en
  `.github/workflows/docker.yml`, que trata esa guardia como invariante.

Sigue siendo un riesgo real **si alguien lo enciende**, y por eso se queda
listado. Pero describirlo como un endpoint crítico expuesto no corresponde a lo
que hay, e ignora las tres defensas que ya existen.

### R2 — Fuga de secretos al repositorio público

**Severidad: alta.** Hay un hook local, y un hook local se salta con
`git push --no-verify`. La capa que no depende del cliente es secret scanning y
push protection del lado del servidor. Su estado y el procedimiento operativo
se mantienen en [`SECURITY.md`](../../SECURITY.md), la fuente canónica.

### R3 — Transporte sin cifrar en el puente

**Severidad: media, condicionada.** El puente se ata a `127.0.0.1` de serie
(`docker/compose.yaml`, `BRIDGE_BIND`). El riesgo aparece solo si alguien cambia
ese enlace para llegar desde otra máquina. La respuesta no es poner TLS en el
puente, sino **no exponerlo**: túnel SSH, VPN, o un proxy inverso que termine
HTTPS delante.

### R4 — Vulnerabilidades en dependencias

**Severidad: media, continua por naturaleza.** Cerrar las alertas una vez no es
un control; el control es que el pipeline falle solo. Ver la acción A3.

### R5 — Escalada de privilegios en el contenedor

**Severidad: baja.** Ya mitigado: usuario no-root y sin herramientas de
compilación en el contenedor final.

## Acciones

| ID | Acción | De quién |
|----|--------|----------|
| A1 | Mantener secret scanning y push protection | administración |
| A2 | Documentar que el puente no se expone sin túnel, VPN o proxy con TLS | quien contribuya |
| A3 | Que CI falle ante CVE CRITICAL/HIGH sin excepción documentada | quien contribuya |
| A4 | Proceso de revisión del SHA anclado de SeriousProton | quien contribuya |

A4 no reabre [ADR-0004](0004-seriousproton-hermano-fijado-por-sha.md), que ya
decidió anclar por SHA y actualizar ambos anclajes a la vez en cada
sincronización. Lo que falta es la **cadencia**: hoy el anclaje se mueve cuando
alguien se acuerda, y un anclaje sin fecha de caducidad acumula parches de
upstream sin que nadie lo note.

## Consecuencias

Positivas: la superficie queda acotada y escrita, y las expectativas para
personas y agentes quedan en un sitio que se revisa por PR.

Negativas: los hooks locales generan falsos positivos que cuestan tiempo; la
seguridad del transporte del puente depende de que quien lo opere no cambie el
enlace sin poner algo delante; y mantener la imagen base al día exige vigilar
cambios de ruptura.
