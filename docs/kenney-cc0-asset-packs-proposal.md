# Propuesta de packs 3D de Craig Snedeker y Elegant Crow

Este documento corrige la atribución original a Kenney: ninguno de estos tres
packs es de Kenney.nl. Se conserva el nombre histórico del archivo para no
romper referencias; el contenido y las fuentes identifican a sus autores reales.

Es una **propuesta documental**, no una importación de assets ni una excepción
aprobada a la doctrina de arte del proyecto. La importación propuesta se sigue
en [#1052](https://github.com/EspacioKoop/espaciokooplagunak/pull/1052), que no debe
confundirse con una integración en `main` o con un consumidor jugable.

**Desenlace (2026-09-09).** De los tres, solo **Classic64** entró. Los dos packs
de Elegant Crow se retiraron antes de integrar por el límite de procedencia que
este mismo documento anticipaba: sus imágenes de Pixabay/Pexels no están
acreditadas y esas plataformas prohíben la redistribución *standalone*. Las
secciones 2 y 3 de abajo siguen describiendo material **no** importado. El
detalle de la evidencia y la vía para desbloquearlos está en
[`PROCEDENCIA_ASSETS.md`](PROCEDENCIA_ASSETS.md).

## 1. Classic64 Asset Library

- **Autor:** Craig Snedeker.
- **Fuente:** https://craigsnedeker.itch.io/classic64-asset-library
- **Licencia anunciada:** CC0 para la biblioteca, confirmada en la página del autor
  y en el aviso del pack examinado.
- **Contenido:** modelos y texturas de estética N64/PS1-PS2, creados con Blender;
  no un tileset de Kenney de 64×64 píxeles. La exportación a FBX/OBJ u otros
  formatos es un paso de conversión, no una afirmación de formatos ya importados.
- **Versionado:** el `Readme.txt` examinado en #1052 declara versión 0.2; la web
  ofrece revisiones posteriores. No se atribuyen las cifras del catálogo actual
  a ese archivo antiguo.
- **Procedencia interna:** `Nature/` y `Rocks/` remiten a rubberduck y yughues en
  OpenGameArt. Esas fuentes y los archivos concretos deben conservarse y verificarse
  en la ficha de incorporación; la autoría principal no las sustituye.

## 2. Ultimate Retro PSX Tree Pack

- **Autor:** Elegant Crow.
- **Fuente:** https://elegantcrow.itch.io/ultimate-retro-psx-tree-pack
- **Licencia anunciada:** CC0 para el pack, según la página oficial.
- **Contenido:** árboles 3D de baja complejidad, principalmente planos texturados,
  con malla independiente de tronco para colisiones. No son tiles 2D de Kenney.
- **Límite de procedencia:** el autor indica que las imágenes proceden de Pixabay
  y Pexels. La declaración CC0 del pack no sustituye la comprobación de las imágenes
  de terceros concretas antes de redistribuirlas.

## 3. Retro PSX Nature Pack

- **Autor:** Elegant Crow.
- **Fuente:** https://elegantcrow.itch.io/retro-psx-nature-pack
- **Licencia anunciada:** la página declara CC0 **para los modelos**.
- **Contenido:** árboles, arbustos y hierba 3D con variantes estacionales.
- **Límite de procedencia:** la fuente distingue texturas de AmbientCG e imágenes
  de Pixabay. No se extiende automáticamente la licencia de los modelos a cada
  textura o imagen; se verifica cada componente antes de incorporarlo.

## Plan de integración, todavía propuesto

1. Seleccionar archivos concretos y comprobar su licencia y procedencia, incluidas
   las fuentes internas de terceros; registrar versión, URL y hash en
   `docs/PROCEDENCIA_ASSETS.md` y las atribuciones correspondientes.
2. Resolver la compatibilidad con la doctrina de arte vigente antes de incorporar
   binarios. Esta propuesta no concede una excepción a esa doctrina.
3. Documentar la conversión reproducible al formato elegido y el presupuesto
   geométrico/texturas. Una conversión no se acredita con un hash inventado.
4. Conectar un consumidor real y probarlo visualmente antes de describirlo como
   integrado o jugable. La presencia de archivos en otra rama no cumple ese paso.

La malla `balcony-simple-straight.mjs` de la propuesta inicial se retiró en #1053:
no tenía conversión verificable y contenía JavaScript incompleto. Este documento
no la restaura ni presenta una malla sustitutiva como validada.

## Verificación y límites de este estudio

Se han leído las tres páginas individuales de los autores. Para Classic64 se
ha contrastado además el aviso del pack y sus subatribuciones en el SHA
`c726cde04063b6d74c15ac59e3b307ad41839f94` de #1052. El README de Retro Nature
identifica a Elegant Crow, pero la separación de derechos entre modelos,
texturas e imágenes procede de su página oficial enlazada arriba.

Esta verificación acredita autores, naturaleza del contenido y declaraciones de
licencia de la propuesta; **no** es una auditoría de todos los archivos de #1052.
No se añaden binarios, dependencias, excepciones de licencia ni cambios runtime.
