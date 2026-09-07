# Triage de arte en RPGs open source

Investigacion realizada para [#969](https://github.com/EspacioKoop/espaciokooplagunak/issues/969), con la regla de `docs/ASSETS_LIBRES.md`: la licencia del codigo no se hereda automaticamente por el arte.

## Resultado

| Candidato | Geometria 3D | Licencia observada | Decision |
| --- | --- | --- | --- |
| [Meridian 59](https://github.com/Meridian59/Meridian59) | No confirmada | El README separa el codigo del contenido y declara que el arte no esta cubierto por la licencia del codigo. | No usar arte ni mallas. Requeriria una licencia especifica del contenido. |
| [Stendhal](https://github.com/arianne/stendhal) | No; cliente 2D | GPL-2.0 para el software; no se encontro una licencia de arte independiente en la fuente revisada. | Descartado como fuente de avatares 3D. Solo podria servir como referencia 2D, fuera de este issue. |
| [Dungeon Crawl Stone Soup](https://github.com/crawl/crawl) | No; ASCII y tiles 2D | GPLv2+ para el proyecto; los datos visuales siguen siendo contenido del juego. | Descartado como fuente de mallas 3D. |
| [Naev](https://github.com/naev/naev) | No; juego 2D top-down | El repositorio espejo remite al proyecto activo en Codeberg; no se encontro una declaracion de licencia de arte que habilite reutilizacion aqui. | Descartado como fuente de mallas 3D y no importar assets. |

## Regla aplicada

La licencia del repositorio solo responde por el codigo que cubre. Para aceptar un asset harian falta, como minimo, una declaracion especifica del arte, procedencia, hash y compatibilidad con las reglas de `ASSETS_LIBRES.md`. Ninguno de estos candidatos supera el filtro para una importacion de malla o arte en este repositorio.

## Fuentes consultadas

- Meridian 59, README y separacion expresa entre codigo y contenido: https://github.com/Meridian59/Meridian59
- Stendhal, README y licencia del software: https://github.com/arianne/stendhal
- Dungeon Crawl Stone Soup, README, licencia GPLv2+ y descripcion de sus tiles: https://github.com/crawl/crawl
- Naev, README del espejo y enlace al proyecto activo: https://github.com/naev/naev