# Contrato de capacidades y eventos entre módulos

Issue [#709](https://github.com/EspacioKoop/espaciokooplagunak/issues/709). Formato
declarativo, sin registro runtime obligatorio, para que cada módulo del
`foundry-module/` describa qué produce, qué consume y de qué depende. Lo
implementa `foundry-module/scripts/contrato-capacidades.mjs`; los pilotos
viven en `foundry-module/scripts/manifiestos-piloto.mjs` y ambos se prueban en
`foundry-module/tests/contrato-capacidades.test.mjs`.

Este issue es deliberadamente pequeño: define el formato, documenta las
invariantes y valida 2–3 manifiestos piloto. **No implementa el grafo** — eso
es trabajo futuro que puede consumir estos manifiestos una vez existan de
verdad para los módulos reales del árbol.

## Formato

```js
{
  module: "atlas",           // nombre del módulo
  standalone: true,          // ¿funciona sin Foundry? (docs/FOUNDRY.md)
  produces: ["discovery.recorded"],
  consumes: ["station.action.completed"],
  capabilities: ["record_discovery", "query_discovery"],
  required: [],               // opcional; módulos de los que depende en runtime
}
```

## Invariantes

- `module` sigue `^[a-z][a-z0-9-]{1,63}$` (kebab-case, como los slugs de
  `module.json`).
- `standalone` es un booleano obligatorio.
- `produces` y `consumes` son arrays de nombres de evento
  `^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)+$` (p. ej. `discovery.recorded`,
  `crew.convocation.requested`) sin duplicados.
- `capabilities` es un array de nombres `^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$`
  (snake_case) sin duplicados.
- `required` es opcional (por defecto `[]`); si se declara, cada entrada debe
  ser un nombre de módulo válido y **no puede repetirse**.
- **Un módulo `standalone: true` no puede declarar `required`.** Es la
  comprobación central del contrato: un módulo que se anuncia standalone pero
  depende en runtime de otro no lo es. `validarManifiesto` lanza si se viola.
- Al validar una lista completa (`validarManifiestos`), los nombres de módulo
  deben ser únicos y todo `required` debe apuntar a un módulo presente en esa
  misma lista — una dependencia hacia un módulo que no está declarado no se
  puede verificar y se rechaza.
- `consumidoresDeEvento(manifiestos, evento)` responde «¿qué módulos consumen
  este evento?» filtrando por `consumes`; valida la lista completa antes de
  responder y devuelve `[]` para un nombre de evento inválido en vez de
  lanzar, porque es una consulta de solo lectura.

## Manifiestos piloto

Tres, como pide el issue — dos standalone y uno integrado, para probar ambos
lados de la invariante:

- **`atlas`** — standalone, registra descubrimientos.
- **`chronicle`** — standalone, escucha `discovery.recorded` de Atlas además
  de eventos de puesto y convocatoria.
- **`foundry-bridge`** — `standalone: false`, consume `chronicle.entry.created`
  y el estado de la nave; ejemplo de módulo que SÍ depende de la integración
  con Foundry.

Ninguno de los tres es todavía el manifiesto real de su módulo homónimo en
`foundry-module/scripts/` — son datos piloto para probar el validador, no una
migración de los módulos existentes a este formato.

## Qué no hace todavía

No hay grafo, no hay comprobación de CI que recorra `foundry-module/` en busca
de manifiestos reales, y ningún módulo existente declara el suyo. Eso es
trabajo de seguimiento, no de este issue.
