# Referencias 2D para Pixelart (Issue #618)

Todas las obras siguientes están en dominio público o bajo licencia CC0, verificadas en las fuentes indicadas.
Para cada referencia se indica qué aspectos pueden servir al desarrollo de pixelart: paleta de colores, composición, tratamiento de la luz, textura de material y encuadre.
Las opciones están pensadas para estudio; no se copian los cuadros directamente.

---

## 1. The Milkmaid (La Lechera)
- **Artista:** Johannes Vermeer
- **Fecha:** c. 1660
- **Fuente:** Rijksmuseum, objeto SK-A-2344
- **URL:** https://www.rijksmuseum.nl/en/collection/object/The-Milkmaid--42dd0e658c2979aec8e144d2357c55c0
- **Licencia:** CC0 1.0 Universal (Public Domain Mark)
- **Verificación de licencia:**
  - Revisor: Eguzki
  - Fecha: 2026-08-19
  - Identificador comprobable: número de inventario `SK-A-2344`, confirmado con `~/.hermes/bin/arte-verificar.py`
- **Relevancia para pixelart:**
  - **Paleta:** Tonos cálidos de amarillo y ocre contrastantes con azules y grises fríos; luz natural que crea reflejos sutiles.
  - **Composición:** Figura central sólida, líneas verticales de la ventana y horizontales de la mesa que encuadran la acción.
  - **Luz:** Luz incidente desde la izquierda que modela volúmenes con sombras suaves; excelente estudio de luz difusa y reflejos en superficies (cerámica, tela, pan).
  - **Textura:** Representación de diferentes materiales (cerámica gruesa, tela de algodón, pan rústico, líquido translúcido) mediante pincelada detallada.
  - **Encuadre:** Espacio interior cerrado que dirige la mirada al gesto de verter leche; útil para estudiar cómo encerrar una acción dentro de un ambiente.

---

## 2. Under the Wave off Kanagawa (The Great Wave)
- **Artista:** Katsushika Hokusai
- **Fecha:** ca. 1830–32
- **Fuente:** The Metropolitan Museum of Art, Open Access, objeto JP1847
- **URL:** https://www.metmuseum.org/art/collection/search/45434
- **Licencia:** CC0 (Open Access policy)
- **Verificación de licencia:**
  - Revisor: Eguzki
  - Fecha: 2026-08-19
  - Identificador comprobable: número de acceso `JP1847`, confirmado contra la API pública del Met con `~/.hermes/bin/arte-verificar.py`
- **Relevancia para pixelart:**
  - **Paleta:** Dominio de azul índigo y blanco, con toques de gris y beige en las embarcaciones; contraste fuerte entre el azul profundo y la espuma blanca.
  - **Composición:** Diagonal dinámica de la ola que atraviese la impresión; uso del espacio negativo (cielo) para dar movimiento; la montaña Fuji como punto de fuga pequeño.
  - **Luz:** Luz difusa que ilumina la cresta de la ola; estudio de cómo la transparencia y el color cambian con la espuma.
  - **Textura:** Técnica de xilografía que produce líneas nítidas y patrones repetitivos; útil para representar texturas de agua y espuma mediante patrones.
  - **Encuadre:** La ola encuadra las pequeñas barcas y el Monte Fuji, creando una sensación de escala y profundidad con pocos elementos.

---

## 3. Man Handing a Letter to a Woman in the Entrance Hall of a House (Hombre entregando una carta a una mujer en el zaguán)
- **Artista:** Pieter de Hooch
- **Fecha:** c. 1670
- **Fuente:** Rijksmuseum, objeto SK-C-147
- **URL:** https://www.rijksmuseum.nl/en/collection/object/SK-C-147
- **Licencia:** Dominio público (Rijksmuseum Rijksstudio, obra de 1670)
- **Verificación de licencia:**
  - Revisor: Eloy (corrección manual de la atribución falsa de t_a78ea2ed)
  - Fecha: 2026-08-20
  - Identificador comprobable: número de inventario `SK-C-147`, confirmado con
    `~/.hermes/bin/arte-verificar.py docs/REFERENCIAS-2D-618.md`
- **Relevancia para pixelart:**
  - **Paleta:** Tonos tierra cálidos (ocre, siena) con acentos de rojo y negro en los textiles; el zaguán en penumbra contra el exterior iluminado.
  - **Composición:** Zaguán visto hacia una puerta abierta, con la calle al fondo: vista en profundidad por planos encajados, recurso central del interior holandés.
  - **Luz:** Doble fuente — la luz fría de la calle al fondo y la difusa del interior; buen estudio de contraste interior/exterior sin negros planos.
  - **Textura:** Baldosa, ladrillo, madera, tela y papel resueltos por diferencia de valor más que de detalle, que es justo lo que se puede trasladar a pixelart.
  - **Encuadre:** Marcos arquitectónicos (jamba, puerta, ventana) que encuadran la escena y guían la mirada hacia el gesto de entregar la carta.

---

## 4. The Hay Wain (La carreta de heno)
- **Artista:** John Constable
- **Fecha:** 1821
- **Fuente:** Wikimedia Commons, archivo: The_Hay_Wain.jpg
- **URL:** https://commons.wikimedia.org/wiki/File:The_Hay_Wain.jpg
- **Licencia:** Dominio público por antigüedad (Constable, 1821; autor fallecido en 1837). NO verificable con `arte-verificar.py`, que solo cubre Rijksmuseum y Met.
- **Verificación de licencia:**
  - Revisor: Eguzki
  - Fecha: 2026-08-19
  - Identificador comprobable: fichero de Commons `File:The_Hay_Wain.jpg` (sin verificación automática, ver nota de licencia)
- **Relevancia para pixelart:**
  - **Paleta:** Verdes de campo, azules de cielo, tonos ocres de tierra y blanco de nubes.
  - **Composición:** Paisaje amplio con primer plano (rio, caballos), medio plano (casa, árboles) y fondo (colinas); uso de la regla de los tercios.
  - **Luz:** Luz de día difusa que crea sombras suaves; estudio de iluminación exterior y reflejos en agua.
  - **Textura:** Pincelada suelta que sugiere textura de follaje, agua y arquitectura rústica.
  - **Encuadre:** El río guía la mirada de izquierda a derecha; los árboles marcan los bordes y añaden profundidad.

---

## Cómo usar este documento
Cada sección representa una opción de referencia válida para el estudio de pixelart. El artista y el diseñador pueden elegir una o más referencias y extraer de ellas los aspectos indicados (paleta, composición, luz, textura, encuadre) para aplicar en los sprites y fondos del juego. No se debe copiar la obra directamente; solo se debe tomar inspiración en los aspectos formales y técnicos.

--- 
*Origen: tarea de kanban t_2c4c343c. Atribución falsa (un número de inventario del Rijksmuseum que era de Rembrandt, no de De Hooch) corregida a mano el 2026-08-20 en t_a78ea2ed;
el worker había firmado esa ficha como verificada sin serlo. Las cuatro fichas que quedan pasan el verificador
o declaran explícitamente que no lo cubren.*