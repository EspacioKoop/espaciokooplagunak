# Candidatos de estatuas romanas verificados

<!-- Procedencia verificada contra la API del Met el 2026-08-22. -->

> **Cómo se verificó.** Cada pieza de esta lista se comprobó una a una contra la
> API pública del Met: que el objeto existe, que el título coincide con lo que
> aquí se dice, y que `isPublicDomain` es `true`. Las trece piezas de los tres
> catálogos lo cumplen. Repetible:
>
> ```bash no-ejecutar
> curl -s https://collectionapi.metmuseum.org/public/collection/v1/objects/<id> \
>   | python3 -c "import sys,json; d=json.load(sys.stdin); \
>     print(d['title'], '|', d['isPublicDomain'])"
> ```
>
> Que una obra esté en dominio público **no significa que la fotografía o el
> modelo derivado lo estén**: eso se comprueba por separado con
> `tools/arte-verificar.py` antes de que nada entre en el árbol.


## Marble statue of a member of the imperial family

- **Fuente:** Met 2003.407.8a, b
- **Cultura:** Roman
- **Fecha:** 27 BCE–68 CE
- **Enlace:** https://www.metmuseum.org/art/collection/search/257640
- **Por que sirve:** Su silueta imperial es reconocible incluso a bajo poligonaje, ideal para escenas históricas.

## Statue of Dionysos leaning on a female figure ("Hope Dionysos")

- **Fuente:** Met 1990.247
- **Cultura:** Roman
- **Fecha:** 27 BCE–68 CE
- **Enlace:** https://www.metmuseum.org/art/collection/search/255973
- **Por que sirve:** La postura dinámica y los atributos mitológicos son legibles en baja resolución.

## Marble Statue Group of the Three Graces

- **Fuente:** Met 2010.260
- **Cultura:** Roman
- **Fecha:** 2nd century CE
- **Enlace:** https://www.metmuseum.org/art/collection/search/256403
- **Por que sirve:** El grupo de tres figuras es icónico y reconocible incluso con pocos polígonos.

## Marble statue of Pan or a satyr with winnowing basket filled with offerings and cultic objects

- **Fuente:** Met 2024.615
- **Cultura:** 
- **Fecha:** ca. 2nd century CE
- **Enlace:** https://www.metmuseum.org/art/collection/search/912467
- **Por que sirve:** La figura mitológica y los objetos rituales son legibles en baja resolución.

## Marble head and torso of Athena

- **Fuente:** Met 24.97.15
- **Cultura:** Roman
- **Fecha:** 1st–2nd century CE
- **Enlace:** https://www.metmuseum.org/art/collection/search/251476
- **Por que sirve:** La cabeza y torso de Atenea son reconocibles por su casco y postura clásica.

## Marble head of a Greek general

- **Fuente:** Met 24.97.32
- **Cultura:** Roman
- **Fecha:** 1st–2nd century CE
- **Enlace:** https://www.metmuseum.org/art/collection/search/251493
- **Por que sirve:** El retrato de un general romano es legible incluso a bajo poligonaje por su expresión y atributos.