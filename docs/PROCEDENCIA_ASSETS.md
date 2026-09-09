# Procedencia de los assets de terceros

Todo asset que no sea de autoría propia entra con su ficha, y sin ficha no entra
(#590). No es burocracia: es lo que permite publicar este repositorio sin miedo,
y es la misma regla que #351 aplica al arte propio.

## La trampa, escrita antes que la lista

**Que la obra sea de dominio público no implica que el archivo lo sea.** Una
escultura de hace dos mil años no tiene derechos; la fotografía o el escaneo que
alguien hizo de ella, normalmente sí. Hay que comprobar la licencia del
**archivo**, no la fecha de muerte del escultor.

No es un peligro teórico. El primer candidato para #590 fue un escaneo
fotogramétrico de una Afrodita con delfín en Wikimedia Commons: obra antigua,
hallazgo submarino, y el archivo bajo `CC BY-SA 4.0`. Se descartó por eso.

## Qué tiene que traer una ficha

| Campo | Por qué |
|---|---|
| Obra | Qué representa, y de dónde es |
| Qué es el fichero | Escaneo, fotogrametría o reconstrucción: no es lo mismo, ni jurídica ni descriptivamente |
| Autoría | Del **archivo**, no de la obra original |
| Licencia | Exacta, y dónde consta |
| Enlace | A la página que declara la licencia, no al fichero |
| sha256 | Para que cualquiera compruebe que tiene el mismo archivo que se convirtió |
| Cómo se convirtió | El comando exacto |

---

## León de Al-Lāt

| | |
|---|---|
| **Obra** | León de Al-Lāt (Asad Al-Lāt), del templo de Al-Lāt en Palmira, Siria. Destruido por el ISIL en 2015 |
| **Qué es el fichero** | **Reconstrucción digital, no un escaneo.** Del proyecto RSSSD (Re-Sculpting Syrian Statues Digitally) para #NEWPALMYRA |
| **Autoría** | Georges Dahdouh, con optimización de Jim Ellis |
| **Licencia** | **CC0 1.0** (dedicación al dominio público) |
| **Verificación** | Wikimedia Commons, plantilla `{{cc-zero}}` con revisión de licencia (`LicenseReview`, usuario `-revi`, 2018-02-22) |
| **Enlace** | https://commons.wikimedia.org/wiki/File:Asad_Al-Lat.stl |
| **Fuente original** | http://www.newpalmyra.org/models/asad-al-lat/ (fuera de línea; la revisión de Commons es lo que sostiene la verificación) |
| **Archivo** | `Asad_Al-Lat.stl`, STL binario, 1 470 284 bytes, 29 404 triángulos |
| **sha256** | `5748e4d150a370f34328ea768ced85ccafcaae6dd3c3891f2c0e80fb0a7a4ac8` |

Que sea una **reconstrucción** y no un escaneo importa más allá de la licencia:
es una interpretación de cómo era la estatua, hecha después de su destrucción. Si
algún día la escena la nombra, eso es lo que hay que decir — no «así era», sino
«así la reconstruyeron».

**Conversión:**

```
node tools/convertir-estatua.mjs Asad_Al-Lat.stl leon-al-lat --caras 900 --alto 2.2
```

El STL de origen **no vive en el repositorio**: se descarga aparte y se comprueba
por su sha256. Un binario de metro y medio para producir un fichero de texto de
veinte kilobytes es pagar el peso dos veces. Lo que sí vive en el árbol es el
resultado, `foundry-module/data/mallas/leon-al-lat.mjs`, que es texto y se revisa
en un PR como cualquier otro cambio.

**Cómo se pinta:** solo se importa geometría. El color y el material los pone la
escena con la paleta del módulo (frontera de arte de #351), con UV por proyección
triplanar (`uvsTriplanar`) y material `piedra`. La textura del original, si la
tuviera, no se usa.

---

## La Colección Real de Vaciados (SMK) — 186 piezas bajo una sola plantilla

El hallazgo que cambia el cálculo de #590. El **Statens Museum for Kunst** de
Copenhague ha subido a Commons 186 modelos 3D de su *Kongelige
Afstøbningssamling* (Colección Real de Vaciados), **todos con la misma
plantilla**:

```
{{Licensed-PD-Art|PD-old-100-expired|Cc-zero}}
```

Esa plantilla separa exactamente las dos capas que este documento avisa que hay
que separar: la **obra** está en dominio público por antigüedad, y el **escaneo**
lo dedica el museo a **CC0**. Verificado una a una en cinco piezas antes de
traer ninguna.

**Por qué importa más que las piezas concretas:** el cuello de la importación es
la verificación de licencia, no la conversión. Con 186 piezas bajo una plantilla
uniforme, verificar la colección una vez convierte el coste por pieza en un
trámite. Es lo que hace viable un catálogo —y una sala de museo (#598)— en vez de
piezas sueltas.

**Y un matiz que va en cada ficha, no en una nota al pie:** son escaneos de
**vaciados en yeso**, no de los originales. La Venus de Milo de aquí es el
vaciado que hay en Copenhague, no el mármol del Louvre. Igual que el León es una
reconstrucción y no un escaneo: lo honesto es decir qué se está enseñando.

| Pieza | Inventario | Cultura | sha256 del origen |
|---|---|---|---|
| Afrodita de Melos (Venus de Milo) | KAS434 | Griega | `96e9c5a8e380c3b932526fc561233dffb3c9dbd0549ed9efc956a47851511020` |
| Retrato del faraón Amasis II (563–525 a. C.) | KAS576 | Egipcia | `42db40d2d4dc32e410925ce60d74004017a91bcfe20924d486790febdf5e944b` |
| Loba (Ulvinde) | KAS837 | Romana | `8639d994cd3366e1bc2fcddd21c94a129c59a179c76ca0329d748b9b7db59a32` |

### El lote

Verificadas una a una contra la plantilla antes de descargar ninguna. La
herramienta rechazó además una descarga que había traído una página de error en
vez del STL — la comprobación de tamaño del punto 1 hizo su trabajo.

| Pieza | Inventario | Cultura | sha256 del origen |
|---|---|---|---|
| Poseidón (o Zeus) de Artemisión | KAS2100 | griega | `855a92ebe9d5b6133328b0d2bfb427e27c8d11bf8e82ac763fefacff39509179` |
| Doríforo (el portador de lanza), de Policleto | KAS1242 | griega | `196c3d1848fcb1894e0503316c906fe14dc44cb59e9d20581dc16bb821316470` |
| Koré con quitón y epíblema | KAS1800 | griega arcaica | `3d430723b9e84d331ebfa5e9239c7dc8b4100f606cd5341d48c437c3b4743ea7` |
| Heracles Farnesio | KAS701 | griega | `582bf914ba61ef18e99453450fcf62449b903110726d3b9882c8d8052b6576a8` |
| Laocoonte y sus hijos | KAS385 | helenística | `288aba62cd966aebc67d8b62edc79d6467766c2f794c1c7f354bf3eac2c7d707` |
| Penélope sentada | KAS202 | griega | `efaa8ba5bb6013417104b03376c6962fcd3b16dea8d1bcaf8b89f17a7b5c9ebe` |
| Venus Capitolina | KAS493 | romana | `d3adef824abb1b7e7c60d11a800af4795763e236d63cd9c84358be0784463104` |
| Retrato de Marco Aurelio, emperador (161–180 d. C.) | KAS979 | romana | `17c5d2ee27079dcefddfac74f0ef2e00bc71dc4b526bdc0c6fa9c8825e1a9e31` |
| Julio César | KAS297 | romana | `3777e48425b4e940a5e2be37ca8289ac91b71d4187f863e104779938a7f7054e` |
| Princesa de Amarna | KAS2226 | egipcia | `da28f85b79bc1a2628efd9c68791bbcda7e73133b1755a68fab39df43cb1d5c8` |
| Jabalí sentado (el Porcellino) | KAS2157 | romana | `bfdc040a40272c211bde8b39471ee9ce693bf8d8759d254f1ecfb04b1b995eec` |
| Caballo de la estatua ecuestre de Marco Aurelio | KAS1133/2 | romana | `a6d4d06a68694aee41ef145b825da7827bb0dce8b0b1ddfe04fe72aefb78153f` |
| Cabeza del David, de Miguel Ángel | KAS2232 | renacentista | `ba9f6b5e67981f340bae43a5b2b284a35b5f108cc9c6d654e43309e9e08d0e66` |
| Retrato de Homero | KAS210 | griega | `de9b1ce2813673dde14befe5956089ca3bd3dfc389d90aac65b3699534fb03df` |

Todas: autoría del escaneo **Statens Museum for Kunst**, fuente **Wikimedia
Commons**, licencia **CC0 1.0 sobre el escaneo**.

**Conversión:**

```
node tools/convertir-estatua.mjs KAS434.stl venus-de-milo   --caras 900 --alto 2.0
node tools/convertir-estatua.mjs KAS576.stl farao-amasis    --caras 800 --alto 1.5
node tools/convertir-estatua.mjs KAS837.stl loba-capitolina --caras 900 --alto 1.2
```

Los originales traen entre 274 000 y 1 128 000 triángulos, así que el decimado
recorta más del 99,7 %. Que se lean igual de bien a 900 caras que el León a 882
dice que el nivel elegido no era casualidad de aquella pieza.

**La ficha vive también en el código.** `tools/convertir-estatua.mjs` tiene una
tabla `FICHAS` y **se niega a convertir** lo que no esté en ella. Este documento
es la versión para humanos, con el porqué; aquella es la que hace imposible
saltarse el paso.

---

## Los tres cuadros interpretados del museo (#836)

Estos tres no encajan en el molde de arriba, y por eso van con su propia
explicación en vez de con una fila más de la tabla: **no hay archivo**. De la
fuente sale la COMPOSICIÓN y nada más — se mira un escaneo de dominio público y
se vuelve a dibujar el paisaje en `foundry-module/scripts/museo-cuadro.mjs`, con
los mismos rectángulos con los que se pinta la piel de un muro, a 2,5 cm por
píxel. Ni un byte del escaneo entra en el árbol.

De ahí las dos consecuencias que hay que saber leer:

- **No hay `sha256` ni comando de conversión.** No se ha copiado nada que
  comprobar. El día que una de estas fichas necesite un hash, es que alguien ha
  traído un fichero ajeno y eso ya no es una interpretación: vuelve a la tabla de
  arriba, con su licencia del **archivo**.
- **Su `naturaleza` es `interpretacion`,** el sexto valor de `NATURALEZAS`
  (`foundry-module/scripts/catalogo-piezas.mjs`). No es `obra-propia`: el
  fichero es nuestro pero la composición es de otro y está identificada, y
  llamarla propia sería la única forma de que la sala enseñara la obra de alguien
  sin decirlo. La cartela lo dice en los dos idiomas y una prueba lo exige.

| Cuadro | Obra de la que se redibuja | Autoría del original | Situación de la obra | Enlace que declara la licencia |
|---|---|---|---|---|
| `frente-al-mar` | *La gran ola de Kanagawa*, c. 1830 | Katsushika Hokusai | Dominio público por antigüedad; el escaneo, sin derechos reclamados | https://commons.wikimedia.org/wiki/File:Tsunami_by_hokusai_19th_century.jpg |
| `viento-del-sur` | *Viento del sur, cielo despejado* (Fuji rojo), c. 1830 | Katsushika Hokusai | Ídem | https://commons.wikimedia.org/wiki/File:Red_Fuji_southern_wind_clear_morning.jpg |
| `sobre-la-niebla` | *El caminante sobre el mar de nubes*, c. 1818 | Caspar David Friedrich | Ídem | https://commons.wikimedia.org/wiki/File:Caspar_David_Friedrich_-_Wanderer_above_the_sea_of_fog.jpg |

**Por qué estas tres y no otras tres mejores.** No es la fama: es que un lienzo
mide 48 × 32 píxeles, y ahí solo sobrevive lo que se reconoce por MASAS. La ola,
el cono rojo y la silueta contra la niebla se leen enteros a esa resolución; un
retrato o un interior se convierten en una mancha. La resolución no se sube para
que quepa una cuarta —esa es la celda del lienzo, y bajarla o subirla es mover el
mando de escala de todos los cuadros a la vez—.

## Escalera de balcón — Kenney Retro Urban Kit

| | |
|---|---|
| **Obra** | "Balcony ladder bottom", pieza del pack *Retro Urban Kit* |
| **Qué es el fichero** | **Modelo 3D modelado a mano por un tercero** (`modelo-cc` en `catalogo-muebles.mjs`), no un escaneo ni una reconstrucción de un objeto físico |
| **Autoría** | Kenney (kenney.nl) |
| **Licencia** | CC0 1.0 |
| **Enlace** | https://kenney.nl/assets/retro-urban-kit |
| **Archivo** | `Models/GLB format/balcony-ladder-bottom.glb`, GLB 2, 4196 bytes, del ZIP oficial Retro Urban Kit 2.0 |
| **sha256** | `266b04ffb06c53a17988f858646d1fd1072258050ac3d9ba653004a769cc37d1`, comprobado contra la fuente recuperada |

**Fuente y licencia recuperadas.** El [ZIP oficial de Kenney](https://kenney.nl/media/pages/assets/retro-urban-kit/8314d4db22-1738147509/kenney_retro-urban-kit.zip)
contiene el archivo exacto y su aviso CC0. Se conserva solo esa pequeña fuente en
[`tools/sources/kenney-retro-urban-kit/balcony-ladder-bottom.glb`](../tools/sources/kenney-retro-urban-kit/balcony-ladder-bottom.glb),
con el [aviso del distribuidor](../tools/sources/kenney-retro-urban-kit/License.txt)
y [contrato de extracción](../tools/sources/kenney-retro-urban-kit/README.md).
No se versionan el ZIP completo ni sus texturas.

**Conversión reproducible verificada, sin sustituir la geometría.** El script
histórico no se recuperó: se añadió una receta nueva que demuestra igualdad
exacta con los 48 vértices y 28 caras publicados, incluidos orden y ceros con
signo. No hay soldadura, decimado, cambio de ejes ni normalización:

```bash
node tools/convertir-glb-geometria.mjs > foundry-module/data/mallas/balcony-ladder-bottom.mjs
node --test foundry-module/tests/convertir-glb-geometria.test.mjs
```

La afirmación anterior «convertir-estatua solo lee STL» quedó obsoleta: el árbol
actual también tiene una ruta GLB/NASA. Esta receta es independiente y no carga
Draco ni aplica el pipeline de estatuas. Su lector es genérico **dentro de un
subconjunto cerrado**, no un importador glTF completo: GLB 2 con JSON y BIN,
una escena/nodo/malla/primitiva, transformación identidad y triángulos indexados.
Rechaza las estructuras geométricas no soportadas. Materiales, normales, UV y
texturas se descartan; ninguna URI se abre. Solo devuelve `vertices` y `caras`.
El color de una futura escena seguirá perteneciendo a la paleta de #351.

**Límite de entrega:** malla y catálogo preparados, no integración visual.
`catalogo-muebles.mjs` no tiene consumidor de runtime y está declarado como
`declared-orphan`, no como cimiento aprobado, en
[`docs/orphan-declarations.json`](orphan-declarations.json). Faltan selección,
colocación, escena y aceptación visual; los tests Node no equivalen a un smoke
Foundry. No se amplía la compatibilidad declarada ni se cierra una integración
jugable por registrar esta procedencia.

## The Open Window — Saki (semilla procedural para #853)

Propuesta de obra de dominio público como semilla visual para el libro 3D
interactuable de issue #853. No se redistribuye texto ni imagen escaneada: las
páginas del libro se pintan proceduralmente como mancha tipográfica/atmosférica.

| Obra | *The Open Window*, cuento de Saki (H. H. Munro). |
|---|---|
| **Qué es el fichero** | No se incluye archivo del libro. Solo se usa título, ambientación y estructura como seed para generación procedural de páginas en rejilla. |
| **Autoría original** | Saki (H. H. Munro), fallecido en 1916. |
| **Licencia** | Public domain en EE. UU. |
| **Verificación** | Project Gutenberg, colección *Beasts and Super-Beasts*, ID 269: autor Saki, contenido incluye *The Open Window*, estado «Public domain in the USA». El ID 11639 citado antes corresponde a *Figures of Earth* de Cabell y no acredita este cuento. |
| **Enlace** | https://www.gutenberg.org/ebooks/269 |
| **Archivo en repo** | No aplica; no se distribuye contenido del libro. |
| **sha256** | No aplica. |
| **Cómo se genera** | Páginas pintadas con `scripts/libro-pagina.mjs` usando `chapasDeRejilla`, sin texto legible ni binarios. |

**Nota:** Si en el futuro se incluyera una cubierta o interior escaneado, haría
falta una segunda ficha para ese archivo concreto con su propia licencia y sha256.

## Assets 2D (tokens) — #891

Mismo formato de ficha que arriba, mismo candado. `tools/convertir-token.mjs`
es el equivalente 2D de `tools/convertir-estatua.mjs`: reescala a 128×128 por
vecino más próximo, cuantiza a color indexado y se niega a convertir cualquier
`<nombre>` que no esté en su tabla `FICHAS`. A diferencia de una estatua, un
token conserva **su propia paleta** — la frontera de arte de #351 gobierna las
superficies procedurales del módulo, no una ilustración importada con su color
ya decidido por su autor.

Esta sección está vacía a propósito (#891-A/#891-B: el pipeline se entrega
antes que el primer lote). Verificar la licencia de un pack concreto en su
página exacta —no basta con que el issue diga "confirmado"— es el paso que
convierte en real la primera fila de esta tabla; hasta entonces no hay ninguna
ficha que documentar.

| Pieza | Autoría | Licencia | Enlace | sha256 |
|---|---|---|---|---|
| _(ninguna todavía)_ | | | | |

**Conversión (cuando llegue la primera ficha):**

```
node tools/convertir-token.mjs origen.png <id-declarado-en-FICHAS>
```

El PNG de origen **no entra en el repositorio**, igual que los STL de la
sección anterior: se descarga aparte, se verifica su licencia y su sha256, y lo
que se versiona es `foundry-module/data/tokens/<id>.mjs` — texto, revisable en
un PR como cualquier otro cambio.
## Packs 3D propuestos — licencias por componente pendientes (#1052)

Seis directorios propuestos, no piezas sueltas convertidas a malla de texto como las
de arriba: contienen archivos de los packs (GLB/FBX/BLEND, entre otros) bajo
`resources/animations/` y `resources/models/`, sin pasar por
`convertir-estatua.mjs`. Es una excepción deliberada al patrón de "solo texto
convertido" que sigue el resto de este documento — decisión de Eloy,
2026-09-08 — y por eso cada ficha aquí verifica contra el **árbol git**
(`git rev-parse HEAD:<ruta>`) en vez de un sha256 de fichero: no hay un binario
único de origen que hashear, hay un directorio completo tal y como lo empaquetó
cada autor.

**El PR original atribuía tres de estos seis packs a Kenney.** Es falso: el
`Readme.txt`/`READ ME.txt` de cada pack, ya presente en el propio commit,
nombra a otro autor. Las fichas de abajo citan la fuente primaria, no la
etiqueta que traía el PR.

### Universal Animation Library (1 y 2)

| | |
|---|---|
| **Qué es** | Librería de animaciones humanoides (120+ y 130+ clips respectivamente), con y sin root motion |
| **Autoría** | Quaternius |
| **Licencia** | CC0 1.0 Universal — declarada en `License.txt` dentro de cada pack |
| **Enlace** | https://quaternius.com |
| **Verificación** | `git rev-parse HEAD:resources/animations/universal-animation-library` → `5e8f3495` (9 archivos) · `HEAD:resources/animations/universal-animation-library-2` → `b35c79d6` (13 archivos) |

### Medieval Village MegaKit — edición Standard (gratuita, parcial)

| | |
|---|---|
| **Qué es** | Kit modular de aldea medieval. **Solo la edición Standard/gratuita**, que su propio `License_Standard.txt` dice que "only contains a portion of the models" — las ediciones PRO/SOURCE (300+ piezas) no están incluidas y no hay que anunciarlas como entregadas |
| **Autoría** | Quaternius |
| **Licencia** | CC0 1.0 Universal — declarada en `License_Standard.txt` |
| **Enlace** | https://quaternius.com |
| **Verificación** | `git rev-parse HEAD:resources/models/medieval-village-megakit` → `9c44e2ed` (760 archivos) |

### Classic64 Asset Library

| | |
|---|---|
| **Qué es** | Biblioteca de props de estética N64/PS1-PS2. **No es de Kenney.** |
| **Autoría** | Craig Snedeker (craigsnedeker.itch.io). Los avisos internos atribuyen a rubberduck las texturas de árboles, sapling y tronco modificados de *Free Vegetation Asset Pack*, y las rocas pintadas modificadas de *More Handpainted Rocks*; a Yughues, varias texturas de hierba y arbusto. No atribuyen la totalidad de `Nature/` o `Rocks/` a un único tercero |
| **Licencia** | CC0 — declarada en `Readme.txt`, con enlace a Creative Commons. La petición de no vender directamente la biblioteca es una preferencia del autor, no una restricción añadida: el propio aviso dice "I can't stop you under the CC0 licence" |
| **Enlace** | https://craigsnedeker.itch.io/classic64-asset-library |
| **Versión** | El `Readme.txt` dice **0.2**, pero el mismo árbol contiene `Changelog v0.6.txt` y archivos de sus ampliaciones. No identificar el conjunto como una copia íntegra de 0.2 ni acreditar una versión solo con ese encabezado. La página ofrece 0.6 (2022-08-02) |
| **Verificación** | `git rev-parse HEAD:resources/models/classic-64-asset-pack` → `b9ead6e7` (872 archivos) |

### Ultimate Retro PSX Tree Pack

| | |
|---|---|
| **Qué es** | Árboles de estética retro PSX. **No es de Kenney.** No trae fichero de licencia propio dentro del pack (el directorio `resources/models/ultimate-retro-tree-pack/` no tiene `Read Me`) |
| **Autoría** | Elegant Crow (elegantcrow.itch.io) |
| **Licencia** | La página declara CC0 para el pack, pero también declara imágenes de terceros. La concesión del autor no acredita los derechos de esas imágenes: **redistribución del conjunto pendiente** |
| **Enlace** | https://elegantcrow.itch.io/ultimate-retro-psx-tree-pack |
| **Origen de las imágenes** | La página del autor declara explícitamente que "All images come from sites like Pixabay and Pexels" — no son fotografías propias de Elegant Crow |
| **Verificación** | `git rev-parse HEAD:resources/models/ultimate-retro-tree-pack` → `fba13de4` (600 archivos) |

### Retro Nature Pack

| | |
|---|---|
| **Qué es** | Vegetación de estética retro (arbustos, variantes de invierno). **No es de Kenney.** |
| **Autoría** | Elegant Crow (mismo autor que el pack anterior) |
| **Licencia** | **CC0 para los modelos**, según la página del autor; texturas de AmbientCG e imágenes de Pixabay, con derechos separados. El `READ ME.txt` solo contiene contacto/donación, no una licencia |
| **Enlace** | https://elegantcrow.itch.io/retro-psx-nature-pack |
| **Verificación** | `git rev-parse HEAD:resources/models/retro-nature-pack` → `fe0c89cb` (182 archivos) |

### Evidencia de licencia por componente y bloqueo de redistribución

Fuentes públicas contrastadas con los seis árboles indicados arriba:

- **Nature, geometría de Elegant Crow:** la fuente dice literalmente
  «The models on this pack are under CC0 License». Dice por separado
  «Textures come from AmbientCG.com» e «Images come from Pixabay».
  Los 40 GLB presentes no declaran imágenes en su JSON. Un lector acotado de
  FBX binario recorrió también los 40 FBX sin encontrar propiedades `Content`
  con datos; sí hay referencias a archivos. Son comprobaciones del contenedor,
  no una licencia CC0 para los PNG separados ni una prueba de carga/renderizado.
- **AmbientCG:** su [aviso de licencia](https://docs.ambientcg.com/license/)
  declara CC0 1.0 para los archivos descargables y renders de previsualización,
  y permite «include the raw files in your project». Por tanto, el problema no
  es una prohibición de distribuir texturas AmbientCG: falta identificar cuáles
  de los 101 PNG de Nature proceden de allí y cuáles de Pixabay, con sus fuentes.
- **Pixabay:** su [resumen oficial](https://pixabay.com/service/license-summary/)
  prohíbe «sell or distribute Content (either in digital or physical form) on a
  Standalone basis». Sus [términos](https://pixabay.com/service/terms/), secciones
  4 y 5, distinguen contenido CC0 y Content License. No se ha identificado la
  ficha ni la licencia aplicable a cada imagen de estos packs; no se presume ni
  CC0 histórico ni una infracción demostrada para todas las imágenes.
- **Pexels:** sus [términos](https://www.pexels.com/terms-of-service/), secciones
  4 y 5, también distinguen CC0 y Pexels License. La segunda prohíbe vender o
  distribuir contenido «on a Standalone basis»; un filtro, cambio de colores,
  redimensionado o recorte por sí solos siguen siendo uso Standalone. Su
  [explicación oficial](https://help.pexels.com/hc/en-us/articles/900005880463-What-are-the-Terms-and-Conditions)
  confirma esa restricción. No basta con llamar «textura retro» a la imagen.
- **Tree, contenedores:** hay 240 PNG separados y 120 GLB; **cada GLB contiene
  una imagen incrustada**. De esas imágenes, 119 coinciden byte a byte por
  SHA-256 con PNG del inventario; una no coincide. Quitar solo PNG no eliminaría
  las imágenes de terceros del conjunto. Los 120 FBX también contienen
  propiedades `Content` con datos incrustados: tampoco son una alternativa
  acreditada como geometría sola. No se ha autorizado ni realizado una retirada.
- **Classic64, contribuciones:** [Free Vegetation Asset Pack](https://opengameart.org/content/free-vegetation-asset-pack)
  y [More Handpainted Rocks](https://opengameart.org/content/more-handpainted-rocks)
  identifican a rubberduck y CC0; el primero declara texturas propias. El aviso
  interno de Nature atribuye hierbas y arbustos a Yughues bajo CC0, sin fichas
  individuales. Se localizaron fichas CC0 de Yughues para
  [Grass Pack 01](https://opengameart.org/content/grass-pack-01),
  [02](https://opengameart.org/content/grass-pack-02),
  [03](https://opengameart.org/content/grass-pack-03) y
  [Bushes](https://opengameart.org/content/bushes), pero no se afirma que cada
  archivo modificado del pack corresponda a esas fuentes sin un mapeo.
  `Changelog v0.6.txt` registra 18 texturas retiradas en 0.4 por falta de licencia
  de distribución: ninguno de esos nombres exactos aparece como archivo en este
  árbol. Esa comprobación no cubre copias renombradas o imágenes empaquetadas en
  BLEND y no convierte el encabezado antiguo 0.2 en una garantía de versión.

[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/legalcode.en) opera
sobre los derechos del otorgante; su sección 4 no despeja derechos de terceros.
Conservar los avisos originales y la autoría no sustituye las concesiones que
faltan. Para desbloquear la redistribución completa se necesita un mapa
archivo → imagen original/autor → licencia aplicable y prueba de permiso para
esta distribución, o una sustitución/reducción de alcance autorizada. **Ningún
pack ni dato se ha retirado por esta revisión documental.**

**Límite de entrega:** estos directorios siguen siendo material propuesto, no
un conjunto globalmente acreditado como CC0 ni una integración jugable. Resolver
la licencia no crea un consumidor; conectar cada pieza a una escena es trabajo
aparte.
