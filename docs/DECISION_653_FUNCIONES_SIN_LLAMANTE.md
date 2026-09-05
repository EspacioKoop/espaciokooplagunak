# Decisión para las tres funciones exportadas sin llamantes

## Funciones analizadas

1. `discoLunarDataUri` en `foundry-module/scripts/laminas-clasicas.mjs`
2. `podarAsistencias` en `foundry-module/scripts/asistencia-wiring.mjs`
3. `texturaHorizonte` en `foundry-module/scripts/horizonte-matte.mjs`

## Resultado del análisis

El barrido estructural y la búsqueda de referencias confirman que ninguna tiene
consumidores en scripts, tests, plantillas ni documentación funcional. Solo
aparecían en su propia definición.

## Decisión aplicada

Las tres se retiran. Son adaptadores sin consumidor y no forman parte de ningún
flujo de juego actual:

- `discoLunarDataUri`: se conservan `discoLunar` y `discoLunarSvg`, que sí tienen
  consumidores.
- `podarAsistencias`: se elimina también su importación no usada de `podar`. El
  motor ya poda en cada transición; no se añade un temporizador sin efecto.
- `texturaHorizonte`: se conservan las primitivas de rejilla, textura y PNG que
  sí utiliza el pipeline del matte.

Si aparece la futura interfaz de «quién está ayudando» o un consumidor directo
del matte, el adaptador correspondiente se reintroducirá junto a ese consumidor
y su prueba; no antes.

## Archivos modificados

- `foundry-module/scripts/laminas-clasicas.mjs`: retirada
  `discoLunarDataUri`.
- `foundry-module/scripts/asistencia-wiring.mjs`: retirada
  `podarAsistencias` y su importación huérfana.
- `foundry-module/scripts/horizonte-matte.mjs`: retirada
  `texturaHorizonte`.

## Verificación

Se ejecutaron las comprobaciones de sintaxis de los tres módulos modificados y
la suite completa del módulo Foundry: **2268/2268 tests en verde**. La batería
focal de asistencia, láminas, horizonte y módulos alcanzables pasó **48/48**.
La búsqueda final no deja imports ni comentarios huérfanos para las funciones
retiradas.

Con esto ninguna de las tres funciones permanece sin decidir: todas quedan
retiradas y sus primitivas con consumidores se conservan.
