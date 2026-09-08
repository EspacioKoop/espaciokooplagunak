# Opciones de referencia para texturas pixelart 2D

Abanico de opciones para [#618](https://github.com/EspacioKoop/espaciokooplagunak/issues/618).
**No decide ninguna dirección**: cada opción se plantea para que la elija un humano.

No se copia ninguna obra. De cada referencia se traslada una decisión abstracta —paleta,
contraste, densidad, tratamiento del material, encuadre— al lenguaje pixelart propio del
módulo, que ya está fijado: paleta corta, sin filtrado y sin degradados
(`foundry-module/scripts/paleta.mjs`, #351).

## Por qué la estampa japonesa y no la pintura al óleo

De estas estampas interesa estudiar el **número de tintas limitado**, las **masas planas**,
la **silueta que aguanta a tamaño pequeño** y el **contorno que separa materiales**.
Son propiedades trasladables a este módulo, no una afirmación de que todo ukiyo-e carezca
de gradaciones ni de que el óleo no pueda aportar referencias. Aquí se proponen saltos
discretos de valor: las transiciones continuas de la fuente no se trasladan al pixelart.

Todas las fichas de abajo están **verificadas contra la API del museo**, no citadas de memoria:

```bash
python3 tools/arte-verificar.py docs/REFERENCIAS_PIXELART_2D.md
```

Esa herramienta ya existía en el árbol y nació de un fallo real (2026-08-19: un documento
atribuía SK-C-5 del Rijksmuseum a «The Letter» de Pieter de Hooch, cuando SK-C-5 es «La Ronda
de Noche» de Rembrandt — dos fichas correctas y una inventada, las tres con el mismo aspecto
de rigor). El paso repetible que pide el requisito transversal de #618 **es esa herramienta**;
este documento la usa en vez de duplicarla.

**Límite del verificador:** comprueba inventario y coincidencia de autor; muestra el título
devuelto, pero no lo compara automáticamente con el citado ni exige `isPublicDomain`.
Por eso la revalidación de estas seis opciones contrasta también título y autor completos
y comprueba `isPublicDomain: true` en cada respuesta JSON enlazada. El séptimo resultado
del script corresponde al ejemplo histórico de arriba, no a una séptima opción de arte.

## Opción 1 — Piel de muros: masa plana con contorno, no sombreado

**Artista:** Katsushika Hokusai
**Ficha:** [Met JP1847](https://www.metmuseum.org/art/collection/search/45434) — *Under the Wave off Kanagawa (Kanagawa oki nami ura)*, ca. 1830–32
**Evidencia de derechos:** [JSON individual](https://collectionapi.metmuseum.org/public/collection/v1/objects/45434), `isPublicDomain: true`.
**Licencia:** dominio público confirmado en la ficha individual (`isPublicDomain: true`)
**Rasgo que se estudia:** cómo se separan dos materiales contiguos sin un solo degradado, solo
por contorno y salto de valor.
**Superficie candidata:** `nave-mural-pixel.mjs` — la rampa de seis tonos y el bisel ya
funcionan así; la referencia sirve para decidir *cuánto* salto de valor necesita una junta
para leerse sin convertirse en una sombra.
**Lo que NO se toma:** la ola, la composición ni ningún motivo reconocible.

## Opción 2 — Suelo y techo: profundidad por bandas, sin perspectiva forzada

**Artista:** Katsushika Hokusai
**Ficha:** [Met JP2557](https://www.metmuseum.org/art/collection/search/56787) — *Fujimigahara in Owari Province (Bishū Fujimigahara)*, ca. 1830–32
**Evidencia de derechos:** [JSON individual](https://collectionapi.metmuseum.org/public/collection/v1/objects/56787), `isPublicDomain: true`.
**Licencia:** dominio público confirmado en la ficha individual
**Rasgo que se estudia:** el plano de suelo se resuelve por bandas de material de valor casi
igual, sin líneas convergentes.
**Superficie candidata:** `nave-piel-suelo.mjs` — encaja con su regla ya escrita de que una
junta de suelo sea una línea *un punto* más clara y solo un punto, porque con más las juntas
longitudinales convergen y el suelo se lee como el carril de una autopista.
**Lo que NO se toma:** el paisaje ni el motivo del barril.

## Opción 3 — Consolas y paneles: contraste de instrumento en dos tintas

**Artista:** Katsukawa Shunkō
**Ficha:** [Met JP1494](https://www.metmuseum.org/art/collection/search/55589) — *Kabuki Actor Ichikawa Danjūrō V*, ca. 1788–90
**Evidencia de derechos:** [JSON individual](https://collectionapi.metmuseum.org/public/collection/v1/objects/55589), `isPublicDomain: true`.
**Licencia:** dominio público confirmado en la ficha individual
**Rasgo que se estudia:** una figura oscura sobre fondo liso que se lee entera a distancia con
dos tintas, sin rótulos ni detalle interior.
**Superficie candidata:** `nave-consola.mjs` — refuerza su regla dura: la pantalla va
**encendida y vacía**, porque un monitor con un gráfico afirma una lectura que nadie ha
calculado (#526). Aquí el estudio es del *marco* y el bisel, nunca del contenido.
**Lo que NO se toma:** el retrato, el mon del actor ni ninguna tipografía.

## Opción 4 — Láminas y marco del mapa: registro de serie

**Artista:** Katsukawa Shunshō
**Ficha:** [Met JP3061](https://www.metmuseum.org/art/collection/search/56536) — *Chuban of the Chushingura Drama* (sin fecha en la API)
**Evidencia de derechos:** [JSON individual](https://collectionapi.metmuseum.org/public/collection/v1/objects/56536), `isPublicDomain: true`.
**Licencia:** dominio público confirmado en la ficha individual
**Rasgo que se estudia:** cómo un marco ornamental encuadra sin competir con lo que rodea.
**Superficie candidata:** `laminas-clasicas.mjs` → `mapa-marco.mjs` — el marco va *alrededor*
del visor y no encima, y apaga a propósito los tics del limbo y la rosa de los vientos porque
sobre un instrumento que sí se lee serían una escala y una marcación que nadie ha calculado.
**Lo que NO se toma:** ninguna escena narrativa dentro del marco.

## Opción 5 — Cartas y fichas: silueta legible a tamaño de ficha

**Artista:** Katsukawa Shunkō
**Ficha:** [Met JP1352](https://www.metmuseum.org/art/collection/search/55328) — *The Actor Nakamura Nakazo with Drawn Sword*, ca. 1790
**Evidencia de derechos:** [JSON individual](https://collectionapi.metmuseum.org/public/collection/v1/objects/55328), `isPublicDomain: true`.
**Licencia:** dominio público confirmado en la ficha individual
**Rasgo que se estudia:** la silueta sigue siendo reconocible reducida, porque la pose se
resuelve en el contorno exterior y no en el detalle interno.
**Superficie candidata:** `minijuegos/cartas-pixelart.mjs` y `minijuegos/fichas-pixelart.mjs`
— volumen por planos de color, nunca degradados.
**Lo que NO se toma:** el personaje, el vestuario ni la escena.

## Opción 6 — Ventana y fondo: vacío que sí dice algo

**Artista:** Ryūryūkyo Shinsai
**Ficha:** [Met JP2074](https://www.metmuseum.org/art/collection/search/54905) — *Landscape with Willow Trees*, siglo XIX
**Evidencia de derechos:** [JSON individual](https://collectionapi.metmuseum.org/public/collection/v1/objects/54905), `isPublicDomain: true`.
**Licencia:** dominio público confirmado en la ficha individual
**Rasgo que se estudia:** un fondo con muy poca información que aun así no se lee como un
error, por densidad graduada en vez de vacío uniforme.
**Superficie candidata:** `nave-ventana-espacio.mjs` — donde ya está decidido que una lectura
vacía **sí** se pinta, porque «he mirado y no hay nada» es un dato, y que sin telemetría baja
una persiana en vez de un cielo de estrellas quietas.
**Lo que NO se toma:** los sauces ni el paisaje.

## Filtro antes de usar una referencia

1. Confirmar **en la ficha individual** de la obra que la licencia es CC0 o dominio público.
   La licencia de la colección no sustituye a la de la pieza; pasar
   `tools/arte-verificar.py` tampoco sustituye esta comprobación de derechos.
2. Registrar fuente, autor, identificador, licencia y URL en la procedencia del asset si se
   reutiliza algo más que una idea visual (`docs/PROCEDENCIA_ASSETS.md`).
3. Extraer solo decisiones abstractas: paleta, contraste, densidad, material y encuadre. No se
   copian cuadros, personajes, logotipos ni motivos reconocibles.
4. Medir la lectura a 1x y 2x antes de aumentar detalle. Una textura que solo funciona
   ampliada no cumple el objetivo pixelart del proyecto.

## Presupuesto: por qué esto no es «más detalle»

Cualquiera de estas opciones se mide antes de subirla. La cabecera de `nave-mural-pixel.mjs`
lleva el coste medido (886–1135 polígonos, 4,21 ms la peor sala) y esa es la cifra que se
vuelve a medir. Si no cabe, **se recorta la densidad de greebles, nunca la rejilla**: media
resolución se nota en todo el muro, media plancha sin escotilla no la echa nadie de menos.

---

Estas son opciones para revisión humana. Este documento no elige una dirección ni autoriza
importar ninguna obra.
