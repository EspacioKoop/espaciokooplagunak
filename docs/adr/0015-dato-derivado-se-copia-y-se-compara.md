# ADR-0015 — El dato derivado se copia de su fuente autoritativa, y una prueba lo compara con ella

- Estado: Aceptada
- Fecha: registrada 2026-08-26
- Issues relacionados: #508, #539, #540, #542, #553, #560, #598
- Fuentes: `foundry-module/scripts/nave-planta-phobos.mjs`, `nave-estancias.mjs`,
  `nave-mobiliario-sala.mjs`, `minijuegos/blackjack-lectura.mjs`,
  `museo-piezas.mjs`; `scripts/shiptemplates/frigates.lua`;
  `tools/convertir-estatua.mjs`.

## Contexto

El módulo necesita a menudo un dato que **ya existe** en otra parte del árbol: la
distribución interior del Phobos M3P, las reglas de la casa del blackjack, la
procedencia de una malla. Hay tres formas de tenerlo, y el fork ya probó dos.

**Inventarlo** fue lo que hizo #508 con la geografía de la nave —vestíbulo,
pasillo del puente y cinco salas de estación idénticas— y produjo los cuatro
fallos de #539: huecos entre salas, puertas contra las que te golpeabas, solo la
cantina alcanzable y una escala distinta por sala.

**Leerlo por red** rompe standalone-first (ADR-0008): el puente publica la planta
en `ship.internal.rooms` (#522), pero leerla de ahí dejaría la ventana sin
geografía justo cuando no hay puente.

Queda copiarlo. El riesgo obvio de una copia es que se desactualice en silencio —
y ese riesgo se paga con una prueba, no con disciplina humana.

## Alternativas consideradas

- **Leer la planta del puente.** Descartada por ADR-0008.
- **Mantener la copia a mano confiando en la revisión.** Descartada: es
  exactamente el modo de fallo del cartel de reglas escrito al lado del motor —
  «un cartel escrito a mano no falla, se desincroniza, y sigue anunciando cómo se
  jugaba antes» (#553).
- **Generar la copia en build time desde el `.lua`.** Descartada: añade un paso
  de construcción a un módulo que hoy es ESM puro sin toolchain, para ahorrar una
  prueba de veinte líneas.
- **Inventar el dato y declararlo «aproximación».** Descartada por #539: la
  aproximación no se quedó en aproximación, se quedó en injugable.

## Decisión

Cuando el módulo necesita un dato que ya tiene fuente autoritativa en el árbol,
**lo copia como dato estático del módulo y una prueba compara la copia con el
original**. Nunca se inventa, y nunca se lee por red lo que debe existir sin
puente.

Casos ya aplicados:

- **La planta sale de la nave real.** `nave-planta-phobos.mjs` copia las trece
  salas que `scripts/shiptemplates/frigates.lua` declara, y **deriva** de ellas la
  geometría: una única `CELDA` en metros, puerta entre toda pareja de salas
  contiguas calculada del solapamiento real de sus aristas, y punto de llegada
  separado del rect de vuelta.
- **Una sola planta para todo el módulo** (#542): `celdasConCantina()` alimenta
  la ventana de andar, el minimapa y la sección. Con ella se fueron la traducción
  a mano `puente → pasarela-proa` y la salud por «regiones de casco», que podía
  teñir una sala por una avería que no estaba en ella.
- **La maquinaria de sala sale del `sistema` que ya declara `SALAS_PHOBOS`**
  (#560), no de una tabla paralela por sala.
- **El cartel de reglas del blackjack se deriva** de `LIMITE_PLANTADO_BANCA`,
  `PAGO_BLACKJACK` y `CARTAS_PARA_DOBLAR` (#553).
- **La procedencia del museo se compara** con las `FICHAS` de
  `tools/convertir-estatua.mjs` (#598).

Corolario de diseño, y es el que hace que esto funcione: **la planta es navegable
por composición, no por casos especiales**. El motor solo sabe recorrer un grafo
de espacios conectados y no conoce el nombre de ninguna sala. Si para meter una
sala hace falta un `if` con su nombre dentro del motor, el diseño se ha roto.

## Consecuencias

### Positivas

- #540 cambió la nave entera **sin tocar** el motor de recorrido. Fue la primera
  prueba de fuego del corolario y la pasó.
- La deriva se detecta el día que ocurre, no el día que alguien la nota jugando.
- La ventana conserva su geografía sin puente, que es lo que ADR-0008 pide.

### Negativas

- Una prueba de comparación por cada dato copiado. Es barata, pero es recurrente.
- **`scripts/shiptemplates/frigates.lua` es archivo heredado de upstream.** Un
  cambio de upstream en el interior del Phobos **romperá** esta prueba durante el
  merge `upstream/AAAA-MM-DD`. Eso es lo que se quiere —falla ruidosamente en vez
  de dejar una planta obsoleta— pero debe leerse como **fallo esperado y no como
  regresión del fork**, y por eso queda anotado en `docs/UPSTREAM.md`.
- La copia obliga a decidir qué parte es dato y qué parte es derivación. En la
  planta, la rejilla es dato y las puertas son derivación; equivocar ese corte
  devuelve el problema.

## Implementación y evidencia

Guardas en CI (`.github/workflows/foundry-module.yml`):

- `foundry-module/tests/nave-planta-phobos.test.mjs` — lee el `.lua` con
  `readFileSync` y falla con «la copia de `SALAS_PHOBOS` ya no coincide con
  `scripts/shiptemplates/frigates.lua`»; más la prueba de **alcanzabilidad sobre
  el catálogo real**, que es la que faltaba en #508 (el motor tenía sus pruebas y
  la nave no).
- `foundry-module/tests/museo-escena.test.mjs` — «LA GUARDA DE PROCEDENCIA: lo
  que declara el museo no se separa de la ficha del conversor».

## Criterios de revisión

Se revisa si el fork deja de seguir a upstream en `shiptemplates/` (entonces la
fuente autoritativa pasa a ser propia y la prueba cambia de sentido), o si
aparece un dato derivado que cambie **durante la partida** — ese no se copia, y
no lo cubre este ADR.

---

## Referencias

- [ADR-0008](0008-standalone-first-autoridad-del-nucleo.md) — por qué no se lee
  por red.
- [ADR-0007](0007-frontera-upstream.md) — qué se hace con el archivo heredado.
- `docs/UPSTREAM.md` — la nota de fallo esperado en el merge.
- Issues #508, #522, #539, #540, #542, #553, #560, #598.
