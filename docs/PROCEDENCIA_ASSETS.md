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
