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
