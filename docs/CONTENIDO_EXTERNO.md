# Contenido externo de dnd5e: integración opcional, solo 2014

- Estado: **adaptador, clasificador y ventana de diagnóstico implementados y probados**
  (`foundry-module/scripts/contenido-externo/`, suites `foundry-module/tests/contenido-externo-*.test.mjs`).
  Nada del módulo lee aún este adaptador: la capa existe y es probable en Node, pero
  ninguna funcionalidad depende de ella. Engancharla es trabajo de #308, #309 y #213.
- Issue: [#332](https://github.com/EspacioKoop/espaciokooplagunak/issues/332)
- Patrón heredado de: [MINIJUEGOS_ASISTENCIA.md](MINIJUEGOS_ASISTENCIA.md)
  §«dnd5e es enriquecimiento, no dependencia dura».

## Qué es

Si el usuario ya tiene criaturas, objetos y hechizos de dnd5e importados en su mundo —por
plutonium/5etools o por donde sea, **bajo su responsabilidad**—, el módulo puede aprovecharlos
en vez de obligar a escribirlo todo a mano. Si no los tiene, el módulo funciona exactamente
igual.

**Detectar, no depender.** La integración solo **lee lo que ya existe en el mundo del usuario**.

## Restricción legal — no negociable

- **Cero contenido de terceros en el repositorio**: ni JSON, ni compendios, ni fixtures de test
  con statblocks reales. Todos los datos de las pruebas son inventados.
- **Cero dependencia en `module.json`**: ni `requires`, ni `recommends`. Hay una prueba de
  regresión que lo impide (`manifiesto.test.mjs`), porque recomendar la vía de importación sería
  hacer nuestra la decisión del usuario.
- El contenido **propio** del proyecto sigue saliendo del **SRD 5.1 bajo CC-BY-4.0**, no de aquí.

## El filtro de 2014

La regla de mesa es dura: **solo material del ruleset de 2014**. Nada de 2024.

El problema técnico es que las dos ediciones llegan mezcladas y con la misma forma: un orco de
2014 y uno de 2024 son actores de dnd5e idénticos a ojos del código. La distinción vive
**solo en los metadatos de procedencia**. Nombres, carpetas y convenciones de la comunidad **no
son evidencia**: un mundo con una carpeta «2014» llena de material de 2024 es un mundo normal.

Orden de decisión, en `scripts/contenido-externo/edicion.mjs`:

1. **Declaración explícita de reglas** (`system.source.rules` / `.edition`): manda sobre todo.
   Si dice algo que no es ni `2014` ni `2024` —una etiqueta nueva, `2024-revised`—, el documento
   se descarta ahí mismo (`reglas-desconocidas`) **sin consultar la fuente**: quien declara
   reglas manda también cuando no le entendemos, y caer a la lista blanca dejaría que un libro
   aceptado colase material que se anuncia como otra cosa.
2. **Fuente contra lista blanca** de libros del ruleset de 2014 (`FUENTES_2014`).
3. **Todo lo demás se descarta.**

Y tres reglas que hacen que el filtro no se afloje solo:

- **Falla cerrado.** Lo que no se clasifique con certeza se descarta; no se asume 2014. El coste
  de descartar de más es escribir un statblock a mano; el de aceptar de más es meter reglas de
  2024 en la mesa sin avisar.
- **Metadatos contradictorios se resuelven en contra.** `rules: "2014"` dentro de un libro de
  2024 se rechaza: si los metadatos se contradicen, no se confía en ninguno.
- **Ampliar la lista blanca no puede aflojar el criterio.** `crearClasificador({ fuentes2014 })`
  suma a las de serie, nunca las sustituye, y la lista de fuentes de 2024 gana siempre.

Que un libro sea de 2022 (MPMM, SCC) no lo hace «de 2024»: la edición es el **ruleset**, no el
año de imprenta.

### Estado de verificación de los campos

Los caminos de dnd5e (`system.source.book`, `.rules`) están comprobados contra la forma de
actores e ítems del sistema. Los de plutonium (`flags.plutonium.source`) se aceptan como **pista
de fuente** pero **no** como declaración de reglas, mientras nadie los contraste contra un mundo
real con material importado. Hasta entonces el clasificador sigue fallando cerrado: como mucho,
descarta material válido, que es el error barato.

Verificar esos campos contra un mundo real y ampliar la lista blanca con lo comprobado es
trabajo pendiente, y se hace **añadiendo evidencia**, no suposiciones.

## Forma del código

```
scripts/contenido-externo/
  edicion.mjs            clasificador 2014/2024, puro, falla cerrado
  adaptador.mjs          contrato funcional + modelo interno, puro
  proveedor-foundry.mjs  el ÚNICO archivo que sabe qué es Foundry
```

- **Contrato funcional, no la forma ajena.** El resto del módulo pide `resolverCriaturas()`,
  `resolverObjetos()` y `resolverHechizos()`. Nadie fuera de esta carpeta sabe qué es plutonium.
  Si el proveedor reorganiza sus flags, el arreglo se queda en `edicion.mjs`.
- **Mismo modelo interno venga de donde venga.** Un elemento del SRD propio y uno del mundo del
  usuario se consumen igual; solo se diferencian en el campo `origen`.
- **Ausente no es error.** Sin proveedor, con proveedor a medias o con un proveedor que lanza:
  listas vacías, cero excepciones. Un módulo que revienta porque falta una integración opcional
  no es opcional.
- **Cada rechazo dice por qué.** Cada descarte lleva un `motivo` estable (`reglas-2024`,
  `fuente-desconocida`, `sin-metadatos`…) y `diagnostico()` los cuenta. Sin eso, depurar «no me
  sale ninguna criatura» acaba en relajar el criterio a ciegas.

## Qué queda por hacer

- Consumidores de juego: minijuegos de combate ([#308](https://github.com/EspacioKoop/espaciokooplagunak/issues/308)),
  atlas Spelljammer ([#213](https://github.com/EspacioKoop/espaciokooplagunak/issues/213)).
- Verificación de los campos de plutonium contra un mundo real, y ampliación de la lista blanca
  con lo comprobado.
