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
| **Audio (ambiente y efectos)** | **Sí, desde #571** | `audio-ficheros.mjs`. La música sigue siendo procedural (#318) y no cambia |
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

Ahora tienen consumidor (`audio-ficheros.mjs`), así que por primera vez tiene
sentido mirarlos. Freesound mezcla CC0, CC BY y CC BY-NC en el mismo sitio: hay
que filtrar por licencia, y su API la expone.

**Lo que hace falta es poco y corto**: mar, viento, una puerta, una alarma. No un
banco de mil efectos.

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
