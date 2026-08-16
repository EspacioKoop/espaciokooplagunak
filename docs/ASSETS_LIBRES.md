# Assets libres: 3D, texturas, pixelart y audio — qué sirve de verdad aquí

> **De dónde sale:** continuación de [#568](https://github.com/VaroTv7/espaciokooplagunak/issues/568)
> ([ECOSISTEMA_OPEN_SOURCE.md](ECOSISTEMA_OPEN_SOURCE.md) cubre el **código**; esto cubre el **arte**).
> **Qué NO es:** una autorización para descargar nada. Ningún asset de aquí está en el
> repositorio, y meter el primero es una decisión aparte — ver «El precio de entrada».

## Empieza por aquí: la mitad de los catálogos de assets no nos sirven, y no es por la licencia

Antes de mirar ni un enlace hay dos hechos de este repositorio que descartan categorías
enteras:

1. **No hay ni un asset binario en el árbol.** Cero `.png`, `.jpg`, `.glb`, `.ogg`. Todo el
   arte se **genera en código**: el pixelart de la nave es procedimental
   (`nave-mural-pixel.mjs`), los retratos salen como SVG, y hasta el PNG de los tokens se
   escribe a mano con un codificador propio (`png-indexado.mjs`, #354).
2. **`retro3d.mjs` no tiene mapeado de texturas.** Un polígono tiene **un color plano**, y
   ya. No hay coordenadas UV, ni muestreo, ni material.

De ahí sale el filtro que ordena todo lo demás:

| Categoría de asset | ¿Tiene dónde entrar hoy? |
|---|---|
| Texturas PBR, HDRIs | **No.** El motor no puede mapear una textura. Valen como *referencia visual*, no como archivo |
| Modelos 3D escaneados (glTF/OBJ, decenas de miles de triángulos) | **No directamente.** Habría que convertirlos a `{vertices, caras}` y bajarlos a unos cientos de caras planas |
| Imágenes 2D (PNG) | **Sí.** El lado Foundry sí consume imágenes: `prototypeToken.texture.src`, tiles y fondos de escena |
| Audio | **Sí.** No hay ninguna restricción de motor; hoy no se usa porque la música es procedimental (#318) |
| Paletas de color | **No hace falta.** La paleta es propia y cerrada (#351), y es una frontera deliberada |

**Traducción práctica:** los sitios de texturas 4K y de escaneos fotogramétricos —que son
los que más se citan— son justo los que menos encajan. Lo que sí encaja es lo 2D y lo
sonoro.

## Fuentes verificadas

### CC0 (dominio público efectivo: sin atribución, sin condiciones)

| Fuente | Qué tiene | Veredicto aquí |
|---|---|---|
| [Kenney](https://kenney.nl/assets) | Sprites, modelos low-poly, UI sci-fi, **sonidos de interfaz** | **La mejor puerta de entrada.** El sonido de UI es lo único de la pila sin estética propia que defender |
| [Smithsonian Open Access](https://www.si.edu/openaccess) | +2.000 modelos 3D escaneados (OBJ/glTF), entre ellos el **módulo de mando del Apollo 11**, y 2,8 M de imágenes | 3D: solo tras convertir y decimar. Imágenes: directamente usables |
| [Poly Haven](https://polyhaven.com/license) | HDRIs, texturas y modelos, **todo CC0** | **Referencia visual.** Sus texturas no tienen dónde entrar |
| [ambientCG](https://ambientcg.com/) | +2.000 materiales PBR y HDRIs, CC0 | Igual: referencia |

### Dominio público por ser obra del gobierno de EE. UU.

| Fuente | Qué tiene | Veredicto aquí |
|---|---|---|
| [NASA 3D Resources](https://github.com/nasa/NASA-3D-Resources) | Modelos y texturas de misión reales | Útil como **geometría de referencia** para naves y estaciones propias |
| [NASA Image and Video Library](https://images.nasa.gov) | Fotografía e imagen de misión | Usable en el lado Foundry |
| [USGS Astrogeology](https://astrogeology.usgs.gov/search) | Mosaicos y mapas topográficos planetarios reales | Materia prima de mapas planetarios |

**La cautela con la NASA es de MARCA, no de derechos.** El material no tiene copyright en
EE. UU., pero no se puede usar de forma que insinúe que la NASA respalda el proyecto. Un
logo de la NASA en una nave del juego cruza esa línea; un mapa de Marte, no.

### CC BY (usable con atribución)

| Fuente | Qué tiene | Veredicto aquí |
|---|---|---|
| [Solar System Scope](https://www.solarsystemscope.com/textures/) — **CC BY 4.0**, verificado | Mapas planetarios en proyección equirectangular, basados en datos NASA | **El candidato 2D más concreto.** Un planeta en una escena de Foundry es una imagen, no una malla: aquí sí hay dónde entrar. Encaja además con el atlas de #213, que ya guarda licencia por entrada |

### Con reservas

| Fuente | Reserva |
|---|---|
| [OpenGameArt](https://opengameart.org) | Licencias mezcladas **por entrada**. Sirve, pero cada archivo se verifica solo, igual que ya exige `DOMINIO_PUBLICO_SCIFI.md` |
| [Lospec](https://lospec.com/palette-list) | La licencia es **por paleta**, no uniforme, y las imágenes de ejemplo pueden tener autoría propia. Da igual: no necesitamos paletas ajenas |
| Cualquier cosa marcada **NC** o **ND** | Fuera. `NC` choca con la GPL del módulo y `ND` prohíbe justo lo que haríamos: adaptar |

## El precio de entrada: qué costaría de verdad usar un modelo 3D

No es descargar. Es esto, y conviene tenerlo escrito antes de que alguien abra un PR con un
`.glb` dentro:

1. **Convertir** de OBJ/glTF a `{ vertices, caras }`, que es lo único que `componerEscena` acepta.
2. **Decimar** de decenas de miles de triángulos a unos cientos: el rasterizador es JS y
   ordena por pintor en cada cuadro. Una sala entera de la nave son ~800 caras.
3. **Asignar un color plano por cara**, porque no hay texturas — y ese color tiene que salir
   de `paleta.mjs` o rompe la frontera de arte de #351.
4. **Meter el binario en el repositorio**, con su licencia y su atribución, en un proyecto
   que hoy no tiene ninguno.

Los pasos 1–3 son una herramienta que no existe. El paso 4 es una decisión de proyecto. Por
eso este documento **no propone traer ningún modelo**: propone saber qué hay para cuando
esa herramienta se justifique.

## La frontera que nada de esto puede cruzar

La estética es propia y deliberada: rejilla de pixelart única para toda la nave, paleta
corta, escalonado de tonos por época (#362). Un pack ajeno bien hecho **estorba** si rompe
esa unidad — un muro con textura fotográfica al lado de uno procedimental no se lee como
mejor, se lee como dos juegos pegados.

Por eso el orden recomendado, si algún día se entra por aquí, es: **primero el audio de
interfaz** (no compite con nada visual), después **imágenes 2D del lado Foundry** (tokens y
fondos, que ya viven fuera del motor retro), y el 3D **el último**, si es que llega.
