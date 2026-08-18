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
