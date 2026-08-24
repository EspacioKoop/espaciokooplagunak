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

## Head of a Hindu Deity
- **Fuente:** Met 27.187
- **Cultura:** India (Rajasthan, Sirohi, Vasantgarh)
- **Fecha:** 9th century
- **Enlace:** https://www.metmuseum.org/art/collection/search/38725
- **Por que sirve:** Silueta reconocible de deidad con atributos distintivos adecuada para modelado bajo polígonos.

## Torso of a Hindu Deity
- **Fuente:** Met 33.65.1
- **Cultura:** India
- **Fecha:** 8th–9th century
- **Enlace:** https://www.metmuseum.org/art/collection/search/38154
- **Por que sirve:** Forma fragmentada que sugiere movimiento y permite reutilización en escenas variadas.

## Surya, the Hindu Solar Deity
- **Fuente:** Met 1977.444.1
- **Cultura:** Nepal (Kathmandu Valley)
- **Fecha:** 11th–12th century
- **Enlace:** https://www.metmuseum.org/art/collection/search/38336
- **Por que sirve:** Representación icónica del dios solar con rayos que ofrecen contornos simples para bajo polígonos.

## Surya, the Hindu Solar Deity
- **Fuente:** Met 2009.225
- **Cultura:** Nepal (Kathmandu valley)
- **Fecha:** 14th century
- **Enlace:** https://www.metmuseum.org/art/collection/search/75359
- **Por que sirve:** Estatua de bronce con postura dinámica que se adapta bien a siluetas de videojuego.

## Garuda (Vishnu's Mount) Seated in Royal Ease
- **Fuente:** Met 1983.518
- **Cultura:** India, Tamil Nadu
- **Fecha:** second half of the 8th–early 9th century
- **Enlace:** https://www.metmuseum.org/art/collection/search/38134
- **Por que sirve:** Figura alada de Garuda que ofrece silueta distintiva y detalles de plumas modelables.

## Standing Ganesha
- **Fuente:** Met 1982.220.7
- **Cultura:** Cambodia
- **Fecha:** second half 7th century
- **Enlace:** https://www.metmuseum.org/art/collection/search/38159
- **Por que sirve:** Representación de Ganesha con postura firme y atributos identificables para bajo polígonos.
