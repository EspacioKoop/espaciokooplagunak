# Contrato del atlas cosmográfico

El atlas que valida `foundry-module/scripts/catalogo-cosmografico.mjs` usa un
objeto JSON con esta cabecera obligatoria:

```json
{
  "format": "espaciokoop-cosmography",
  "version": 1,
  "entries": []
}
```

`format` identifica la familia del documento y `version` su contrato. No son
intercambiables ni opcionales. Un documento sin `version` se rechaza con
`missing_version`; una versión que el lector no conoce se rechaza con
`invalid_version`. El lector nunca intenta interpretar esos documentos
como si fueran v1.

## Contrato v1

La raíz contiene exactamente `format`, `version` y `entries`. Cada entrada usa
los campos obligatorios `id`, `type`, `name`, `summary`, `continuity` y
`provenance`; `parent_id` es obligatorio para sistemas y planetas y no se
admite en planos.

Los únicos tipos de entrada de v1 son:

- `plane`;
- `star_system`, cuyo padre debe ser un `plane`;
- `planet`, cuyo padre debe ser un `star_system`.

`name` y `summary` contienen texto plano en `es` y `en`. `provenance` requiere
`kind`, `source` y `license`; `source_url` es opcional salvo para procedencia
`cc`, donde es obligatoria y debe usar HTTPS. El ejemplo canónico está en
`foundry-module/data/cosmografia.example.json`.

## Evolución y compatibilidad

La versión es mayor y entera: no existe negociación ni conversión implícita.
Dentro de v1 solo son compatibles hacia atrás los cambios aditivos que
mantienen válidos todos los documentos v1 anteriores, por ejemplo añadir un
campo opcional. El validador nuevo debe aceptar tanto el documento anterior
sin ese campo como el documento enriquecido. Esta política guía futuras
ampliaciones compatibles de v1; el esquema actual sigue siendo estricto y
detecta claves desconocidas para descubrir erratas y datos ejecutables. Un
productor no debe emitir el campo nuevo hasta que sus consumidores hayan
actualizado el validador.

Requieren una nueva versión mayor los cambios que:

- eliminen o renombren campos;
- conviertan un campo opcional en obligatorio;
- cambien el tipo, significado, límites o jerarquía de datos ya válidos;
- introduzcan un tipo de entrada que un lector v1 no pueda interpretar;
- hagan inválido cualquier documento aceptado por el contrato v1.

Añadir una restricción, aunque parezca una corrección, también exige versión
mayor si invalida datos v1 antes válidos. Una versión nueva debe añadirse al
mismo validador mediante una ruta explícita; no se crea un validador paralelo.

## Round-trip

Un documento v1 válido debe conservar su semántica tras `JSON.stringify`
seguido de `JSON.parse`: vuelve a validar, mantiene la versión 1 y conserva sus
datos. Las pruebas del catálogo cubren el ejemplo base, el round-trip con el
`source_url` opcional ya permitido y el rechazo explícito de versiones ausentes
o desconocidas.
