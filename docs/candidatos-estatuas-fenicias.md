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

## Stamp seal (scarab) with monster

- **Fuente:** Met 1970.183.3
- **Cultura:** Phoenician
- **Fecha:** 9th–7th century BCE or later
- **Enlace:** https://www.metmuseum.org/art/collection/search/326011
- **Por que sirve:** Su forma compacta de sello escarabajo y su relieve sencillo permiten una fácil lectura a bajo poligonaje en 3D.
