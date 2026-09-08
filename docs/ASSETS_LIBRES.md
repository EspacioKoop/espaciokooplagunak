# Fuentes libres de arte y audio, y qué haría falta para usarlas

Continuación de #568, que cubría el código; esto cubre el **arte**. La pregunta
útil no es «¿qué hay disponible?» —hay muchísimo— sino **«¿qué tiene dónde
entrar?»**, y son cosas muy distintas: los catálogos más citados (texturas PBR
4K, escaneos fotogramétricos de cien mil triángulos) son justo los que este
motor no puede consumir tal cual.

Por eso el filtro técnico va **delante** de la lista.

---

## 1. Corrección de una premisa

#571 se planteó afirmando que «`retro3d.mjs` no tiene mapeado de texturas — un
polígono es un color plano». **Eso ya no es cierto**, y lo señaló #584:

- un vértice es `[x,y,z]` o `[x,y,z,u,v]`, el recorte interpola las UV y la
  textura viaja con el polígono;
- `retro3d-lienzo.mjs` muestrea texturas indexadas sin filtrado, que es el
  aspecto de la época;
- lo que falta es corrección de perspectiva, y eso es #573.

Desde #584 hay superficies texturadas de verdad en producción (el matte del
horizonte), desde #596 los props llevan material, y desde #590 entra malla de
terceros. El motor consume más de lo que este issue suponía.

---

## 2. Qué tiene consumidor hoy, y qué no

| Categoría | ¿Entra? | Por dónde |
|---|---|---|
| **Malla 3D** | **Sí** | `tools/convertir-estatua.mjs` (#590): STL → decimado por colapso de aristas → `{vertices, caras}`. UV por `uvsTriplanar` |
| **Textura tileable** | **Sí, y desde #600 con consumidor de primera** | `piel-textura.mjs` tilea la piel del muro; `retro3d-lienzo.mjs` consume `{ancho, alto, indices, paleta}`. La tesela mide `ANCHO_TESELA` 3,2 m a `METROS_POR_TEXEL` 0,025, o sea **128 téxeles de ancho**, y el alto lo clava la altura de sala. Lo que hace falta son **patrones tileables de poca resolución y pocos colores**, no packs 4K |
| **Audio (ambiente y efectos)** | **Sí, desde #571** | `arte/audio/audio-ficheros.mjs`. La música sigue siendo procedural (#318) y no cambia |
| **Pixelart 2D** | **Sí** | `png-indexado.mjs` codifica y descodifica PNG indexado |
| **Texturas PBR** (albedo + normal + rugosidad) | **No** | El motor no tiene modelo de iluminación que las use. Se aprovecharía el albedo y se tiraría el resto: es traer 40 MB para usar 2 |
| **Malla con esqueleto** | **Parcial, desde #603 fase 1** | `rig-esqueleto.mjs` tiene formato de rig, pesos y `deformarMalla`. **No** hay asignación automática de pesos (fase 2) ni retargeting (fase 3), así que un rig ajeno no se puede consumir todavía: entra la malla, el rig se hace a mano |
| **Clips de animación interpolados** | **No** | Fuera de alcance de #603 por decisión, no por falta de tiempo |
| **Fuentes tipográficas** | **No hace falta** | El texto lo pone Foundry |

**Regla de oro:** una categoría sin consumidor no se lista aunque el material sea
excelente. Traer lo que no se puede usar es exactamente cómo un repositorio
acaba con veinte binarios y ninguno cableado.

---

## 3. La trampa, antes que la lista

**Que la obra sea de dominio público no implica que el archivo lo sea.** Una
escultura de hace dos mil años no tiene derechos; el escaneo o la fotografía que
alguien hizo de ella, normalmente sí. Hay que comprobar la licencia del
**archivo**.

No es teórico: el primer candidato de #590 fue un escaneo fotogramétrico de una
Afrodita en Wikimedia Commons, obra antiquísima y archivo bajo `CC BY-SA 4.0`.
Descartado.

Y una segunda trampa, más silenciosa: **`CC BY-NC` no es libre** para este
proyecto. Aparece constantemente en catálogos de modelos 3D para impresión, y es
la licencia por defecto de buena parte de Scan the World en MyMiniFactory.

---

## 4. Fuentes, y cómo se verificó cada una

Se distingue **verificado** (lo comprobé contra la fuente durante #590/#571) de
**por verificar** (razonable, sin comprobar).

### Wikimedia Commons — **verificado**

Lo mejor que hay para pieza suelta, por un motivo que no es el catálogo sino el
**proceso**: Commons tiene revisión de licencia (`LicenseReview`), en la que un
revisor humano comprueba la licencia en el origen y lo deja sellado con fecha.

Es lo que sostuvo al León de Al-Lāt cuando `newpalmyra.org` se cayó de la red: la
fuente original ya no responde, y la verificación sigue en pie.

- API sin autenticación: `commons.wikimedia.org/w/api.php`, con `extmetadata`
  para leer licencia y autoría por fichero.
- Se puede filtrar por `filetype:3d` y comprobar `License` en bloque.
- **Cuidado:** la mayoría de los ficheros 3D de Commons son CC BY-SA, no CC0.
  Filtrar es obligatorio, y de una búsqueda de 120 salieron unos 58 libres, casi
  todos figuras geométricas y piezas de impresión, no escultura.

### Smithsonian Open Access — **verificado (API)**

Más de dos mil modelos 3D liberados, y lo importante para que un catálogo grande
sea viable: **la licencia es un campo consultable por pieza**. La API devuelve
`metadata_usage: {"access": "CC0"}` en cada resultado, así que se puede filtrar
CC0 **en bloque** en vez de a mano.

Eso es lo que separa «traer una pieza» de «traer una sala» (#598): sin filtro
programable, treinta piezas son treinta verificaciones manuales.

- API: `api.si.edu/openaccess/api/v1.0/search` (necesita clave; `DEMO_KEY`
  responde para pruebas).
- **Cuidado:** su web (`si.edu/openaccess`, `3d.si.edu`) responde 403 a clientes
  automatizados. La API sí responde.

### The Met, Rijksmuseum, Art Institute of Chicago — **por verificar**

Programas de acceso abierto muy citados, sobre todo de **imagen**. Para 3D el
material es escaso. Útiles como referencia visual y para pixelart derivado, no
como fuente de malla.

### Scan the World / MyMiniFactory — **por verificar, con reserva**

El catálogo de escultura más grande que existe, y por eso hay que decirlo: buena
parte está bajo **CC BY-NC**, que no sirve aquí. Cada pieza necesita su
comprobación individual, y muchas requieren cuenta para descargar. Alto valor,
alto coste de verificación.

### Audio: Freesound y bancos CC0 — **por verificar**

Ahora tienen consumidor (`arte/audio/audio-ficheros.mjs`), así que por primera vez tiene
sentido mirarlos. Freesound mezcla CC0, CC BY y CC BY-NC en el mismo sitio: hay
que filtrar por licencia, y su API la expone.

**Lo que hace falta es poco y corto**: mar, viento, una puerta, una alarma. No un
banco de mil efectos.

### Nuevas fuentes contrastadas para investigación — **verificadas como políticas, no como assets**

Estas fuentes son útiles para buscar referencias visuales, mapas, documentación o
material de ambientación, pero la verificación de la política del proveedor no
autoriza a importar una pieza concreta sin revisar su ficha y su consumidor.

#### Library of Congress — Free to Use and Reuse

La biblioteca mantiene conjuntos seleccionados de imágenes y otros materiales
que considera de dominio público, sin restricciones conocidas o autorizados para
uso público. Su guía de derechos insiste en consultar la declaración de derechos
del propio ítem: una colección o una búsqueda no convierte automáticamente cada
resultado en dominio público.

- Portal: `https://www.loc.gov/free-to-use/`
- Criterio de entrada: la ficha debe indicar `Public domain`, `No known copyright`
  o una autorización equivalente; conservar autor, institución, URL y declaración
  de derechos.
- Uso en este proyecto: referencia visual, mapas y documentación histórica;
  ningún fichero entra al repositorio sin ficha de procedencia y consumidor.

#### Europeana — objetos con derechos explícitos y metadatos CC0

Europeana publica sus metadatos bajo CC0, pero los objetos digitales mostrados
conservan los derechos que aparecen en la insignia de cada proveedor. Si falta
la información de derechos, se debe acudir al sitio del proveedor y no asumir
dominio público. Su guía de uso pide conservar crédito institucional y señalar
las modificaciones.

- Política: `https://www.europeana.eu/en/rights/terms-of-use`
- Guía de dominio público: `https://www.europeana.eu/en/rights/public-domain-usage-guidelines`
- Consumidor en este repositorio: `tools/apis/europeana.py` (`europeana(consulta,
  reusabilidad="open")`), que ya filtra por reusabilidad y devuelve la licencia
  declarada de cada resultado — el punto de partida de la comprobación, no su
  sustituto.
- Criterio de entrada: solo objetos con marca `Public Domain`/`CC0` verificable;
  los metadatos CC0 no conceden por sí solos derechos sobre la imagen, audio o
  modelo.
- Uso en este proyecto: catálogo y referencias de patrimonio; los metadatos
  pueden alimentar investigación, no assets binarios sin verificación adicional.

#### NOAA — imágenes y datos del gobierno estadounidense

NOAA declara que la mayoría de su contenido es de dominio público salvo indicación
contraria, pero exige comprobar el crédito o pie de cada pieza, no sugerir
respaldo oficial y no presentar una modificación como material oficial. Sus
vídeos pueden incluir metraje de terceros y requieren revisión caso a caso.

- Política: `https://oceanservice.noaa.gov/about/faq.html`
- Criterio de entrada: conservar el crédito NOAA, comprobar excepciones y
  descartar cualquier pieza con material de terceros no despejado.
- Uso en este proyecto: cielos, océanos, mapas y referencias científicas; no se
  importa nada por la mera procedencia institucional.

**Regla común:** estas tres fuentes quedan verificadas como políticas de acceso,
no como una lista de assets aprobados. La ficha del archivo concreto, su licencia,
su hash y su consumidor siguen siendo obligatorios.

---

## 5. El precio de entrada, medido

De #590, que es la única pieza que ha hecho el recorrido completo:

| Paso | Coste real |
|---|---|
| Encontrar candidato y **verificar la licencia del archivo** | **Lo caro.** Dos candidatos para una pieza |
| Descarga y comprobación por sha256 | Minutos |
| Conversión y decimado | 1,6 s de máquina; el trabajo fue *escribir* el decimador |
| Ficha de procedencia | Minutos |
| Colocarla para que se lea | **Lo segundo más caro.** El León es un relieve: solo se lee desde un lado, y hubo que probar cuatro orientaciones |

**El cuello es la verificación de licencia, no la conversión.** Cualquier plan
que suponga lo contrario está mal presupuestado.

---

## 6. Reglas para traer algo

1. **Ficha o no entra.** `docs/PROCEDENCIA_ASSETS.md`, con obra, qué es el
   fichero (escaneo, fotogrametría o reconstrucción: no es lo mismo), autoría del
   archivo, licencia exacta, enlace a donde consta, sha256 y el comando de
   conversión.
2. **CC0 o dominio público.** CC BY obliga a atribución en un sitio que hay que
   decidir; CC BY-SA y CC BY-NC, fuera.
3. **El binario de origen no vive en el repositorio.** Se comprueba por sha256 y
   lo que se versiona es el resultado convertido, que es texto y se revisa en un
   PR.
4. **La frontera de arte de #351 se mantiene**: lo importado aporta GEOMETRÍA (o
   forma de onda). El color, el material y la paleta los pone el módulo. Una
   textura ajena pegada a una malla ajena convierte la escena en un collage de
   tres maquetas, que es lo que la estética propia existe para evitar.
5. **Nada sin consumidor.** Si la categoría no está en la tabla del punto 2, no
   entra: primero el consumidor, después el asset.

---

## 7. Lo que NO entra: sprite-rips y salidas de IA

Ninguna de las dos entra en el árbol, y por motivos distintos.

**Sprite-rips** — imágenes extraídas de un juego comercial (The Spriters
Resource y equivalentes). Son obra derivada con derechos vivos: que el juego
esté descatalogado no libera nada, y usarlas exigiría permiso del titular. No
son CC0 ni dominio público, así que **no pasan la regla de entrada de la
sección 4**: la licencia se acredita por archivo o no se acredita.

**Salidas de generadores de IA.** Aquí el problema no es solo la licencia
—incierta o restrictiva según el modelo, y difícil de acreditar por pieza— sino
que **no son arte procedural**: la regla del módulo es que el arte se genera en
el cliente a partir de código y semilla (ver *Arte procedural* en `CLAUDE.md`),
y una imagen generada fuera y guardada es un binario más, con la diferencia de
que no se puede rehacer ni auditar.

**Qué hacer en su lugar.** Para arte 2D, el módulo ya tiene pixelart procedural
—`nave-sprite.mjs`, `minijuegos/cartas-pixelart.mjs`, `minijuegos/fichas-pixelart.mjs`—
y `png-indexado.mjs` para codificarlo. Nota la diferencia con la tabla de la
sección 2: el pixelart 2D **sí** entra, pero como código que lo dibuja, no como
fichero de imagen traído de fuera. Si de verdad hace falta algo que no se pueda
generar, se dibuja a mano y se le hace su ficha de procedencia como a cualquier
otra pieza (sección 6) — con licencia propia, que es la única que se puede
acreditar sin dudas.

---

## 8. Auditoría de RPGs para avatares y NPC 3D (#969)

Auditoría realizada el 2026-09-04 sobre las fuentes primarias enlazadas. El
filtro es deliberadamente corto: si no hay malla humanoide 3D, no se invierte
tiempo en convertir; si la hay pero su licencia no es CC0 o dominio público, se
descarta. La licencia del motor o del repositorio **no se hereda** al arte.

`⛔` significa descartado para este uso. `🟡` significa pendiente de acreditar,
ya sea un catálogo o un fichero concreto; no autoriza a importar nada.

| Candidato | Geometría y licencia del arte | Decisión | Fuente primaria |
|---|---|---|---|
| **Meridian 59** | El repositorio libera el código bajo GPL-2.0, pero su README excluye expresamente *artwork*, salas y audio, que deben obtenerse aparte. No ofrece una malla de personaje licenciada. | ⛔ Sin arte reutilizable ni licencia de archivo. | [README oficial](https://github.com/Meridian59/Meridian59/blob/master/README) |
| **Stendhal** | Sprites y tiles 2D. Su propia guía exige procedencia por imagen y admite una mezcla de GPL, CC BY, CC BY-SA, CC0 y dominio público: la GPL del cliente no resuelve la licencia de cada gráfico. | ⛔ No es malla 3D. | [Guía oficial de gráficos](https://stendhalgame.org/wiki/StendhalRefactoringGraphics) |
| **Dungeon Crawl Stone Soup** | Tiles 2D. El export oficial separa los tiles cedidos a CC0 de una lista extensa con autoría o licencia inciertas; incluso los CC0 siguen sin ser geometría. | ⛔ No es malla 3D. | [Repositorio oficial de tiles](https://github.com/crawl/tiles) |
| **Naev** | Juego espacial cenital cuyo README remite parte del arte a un repositorio separado. Su licencia deriva la autoría y licencia de cada gráfico a `gfx/ARTWORK_LICENSE.yaml`; la GPL del código no acredita el arte en bloque ni aparece una malla de personaje candidata. | ⛔ No hay un avatar/NPC 3D identificado que auditar. | [README](https://github.com/naev/naev/blob/main/Readme.md) · [licencia](https://github.com/naev/naev/blob/main/LICENSE) |
| **NetHack** | Sus interfaces representan el mapa mediante símbolos o tiles 2D; la documentación de X11 describe estos últimos como imágenes y fuentes alternativas, no como mallas. | ⛔ No es malla 3D. | [Instalación X11 oficial](https://github.com/NetHack/NetHack/blob/NetHack-5.0/win/X11/Install.X11) |
| **Angband** | El propio README describe personajes textuales para representar mapa y habitantes; los frontends gráficos usan tiles 2D. | ⛔ No es malla 3D. | [README oficial](https://github.com/angband/angband) |
| **ToME4** | La licencia oficial separa el software GPL del contenido: los gráficos, audio y música solo se conceden para su uso con Tales of Maj’Eyal. | ⛔ Aunque hubiera geometría aprovechable, su arte no se puede reutilizar aquí. | [Licencia oficial](https://te4.org/license) |
| **Freeciv-web** | La premisa «solo 2D» estaba desactualizada: `Characters/` contiene `Explorer.blend` y `Settler.blend`. El repositorio declara el cliente bajo AGPL y `CREDITS` solo indica de forma genérica que algunos modelos procedían del dominio público; ninguna fuente vincula esos dos ficheros con una procedencia y licencia concretas. | 🟡 Candidatos reales, bloqueados hasta acreditar por fichero autoría y CC0/dominio público. | [Personajes](https://github.com/freeciv/freeciv-web/tree/develop/blender/blender_models_version_2/Characters) · [créditos](https://github.com/freeciv/freeciv-web/blob/develop/blender/CREDITS) · [licencia](https://github.com/freeciv/freeciv-web/blob/develop/LICENSE.txt) |
| **DOOM Retro** | Es un *source port*: su documentación aclara que no proporciona el contenido necesario y exige un IWAD obtenido de DOOM o DOOM II. La licencia del port no libera ese arte comercial. | ⛔ No aporta mallas reutilizables ni el contenido original. | [Guía oficial de inicio](https://github.com/bradharding/doomretro/wiki/Starting-a-Game) |
| **Arcmage** | Juego de cartas. El arte original es 2D y CC BY-SA 4.0, con obras adicionales bajo otras licencias. | ⛔ No es malla 3D y BY-SA queda fuera. | [Licencia oficial del arte](https://arcmage.org/artwork/) |
| **PlaneShift** | MMORPG 3D real, pero su licencia oficial declara propietarios el arte, modelos, música y textos, y prohíbe reutilizarlos sin permiso explícito. | ⛔ Malla 3D no libre. | [Licencia oficial](https://www.planeshift.it/License) |
| **Arx Libertatis** | Solo se liberó el motor. El proyecto confirma que los datos de Arx Fatalis no están incluidos y exige una copia del juego o de la demo. | ⛔ Datos y mallas comerciales, fuera de la GPL del motor. | [FAQ oficial](https://arx.vg/FAQ) |
| **Penumbra: Overture** | Frictional liberó bajo GPL-3.0 el código del juego y HPL1, no sus assets: la nota oficial conserva expresamente su copyright anterior. | ⛔ Mallas 3D no libres. | [Anuncio oficial](https://frictionalgames.com/2010-05-penumbra-overture-goes-open-source/) |
| **Destination Sol** | Shooter espacial 2D cenital. El README oficial declara Apache-2.0 para el proyecto, CC BY 4.0 para los sprites originales y CC-NC 4.0 para la banda sonora. | ⛔ No es malla humanoide 3D y su arte no es CC0. | [README oficial](https://github.com/MovingBlocks/DestinationSol/blob/develop/README.md) |
| **MakerWorld** | Catálogo de impresión 3D pendiente de revisión manual. La documentación oficial confirma que cada subida declara una licencia, pero no acredita por sí sola que haya un resultado CC0 humanoide con autoría y pose válidas. | 🟡 No verificado: solo buscar por ficha y aplicar después procedencia, licencia, sha256 y prueba de pose. | [Guía oficial de subida](https://wiki.bambulab.com/en/makerworld/tutorials/how-to-upload-models) |

**Resultado: ningún asset autorizado para importar.** Los cuatro juegos con 3D
relevante o cercano —Meridian 59, PlaneShift, Arx Libertatis y Penumbra— separan
el código libre del contenido no liberado. Los proyectos 2D pueden servir como
referencia visual, pero no como fuente de malla. Freeciv-web aporta dos modelos
humanoides concretos y MakerWorld un catálogo manual, pero ninguno pasa todavía
la procedencia: una incorporación futura deberá empezar por acreditar la ficha
o el fichero concreto y recorrer las reglas de la sección 6.

El catálogo genérico `open-source-games.com` y las búsquedas de GitHub no son
fuentes citables: solo pueden producir nuevos candidatos, nunca acreditar un
asset.
