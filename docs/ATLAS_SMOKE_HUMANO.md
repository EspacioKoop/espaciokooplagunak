# Protocolo de smoke humano del atlas

Preparacion para [#909](https://github.com/EspacioKoop/espaciokooplagunak/issues/909), dependiente de la proyeccion standalone de [#905](https://github.com/EspacioKoop/espaciokooplagunak/issues/905) y del resolutor `map_ref` de [#906](https://github.com/EspacioKoop/espaciokooplagunak/issues/906).

Este documento prepara una comprobacion reproducible; no declara el criterio cerrado mientras no exista una ejecucion real en Foundry con acta.

## Fixture original

Usar el atlas de ejemplo `foundry-module/data/cosmografia.example.json` sin nombres ni lore de Spelljammer:

- plano: `mar-de-argia`
- sistema estelar: `sistema-laguna`
- planeta: `mundo-auzolan`
- `map_ref`: ausente en la fixture base; añadir una referencia solo a un `MapDocument` de prueba existente

La fixture debe permanecer pequena y no debe copiar contenido de terceros. Su finalidad es comprobar la forma del contrato, no representar una campana completa.

## Pasos

1. Cargar el JSON con la proyeccion standalone y validar el esquema cosmografico.
2. Crear una entrada equivalente en un Journal o Compendium de Foundry, conservando `id`, `type`, `parent_id`, `continuity` y `provenance`.
3. Leer el nodo desde Foundry y comparar con el atlas autoritativo, campo por campo.
4. Resolver un `map_ref` valido y repetir la comparacion con el `MapDocument`.
5. Resolver una referencia ausente y una inexistente; ambas deben presentarse como "sin mapa" y no bloquear la carga.
6. Registrar plataforma, version de Foundry, commit, pantalla, accion anterior, texto visible y resultado.

## Acta pendiente

| Campo | Valor |
| --- | --- |
| Commit probado | Pendiente |
| Version de Foundry | Pendiente |
| Sistema operativo | Pendiente |
| Journal/Compendium creado | Pendiente |
| Comparacion atlas vs Foundry | Pendiente |
| `map_ref` valido | Pendiente |
| `map_ref` ausente | Pendiente |
| `map_ref` inexistente | Pendiente |
| Fallos y capturas | Pendiente |

Hasta completar el acta con una mesa real, #909 sigue abierto. Esta preparacion no sustituye el smoke humano ni convierte Foundry en autoridad del atlas.
