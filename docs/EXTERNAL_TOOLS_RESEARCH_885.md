# docs/research: herramientas de mapas/compendios/open-content para standalone (mipui, deepnight, donjon, thievesguild, dungen, laterpress)

Issue: [#885](https://github.com/VaroTv7/espaciokooplagunak/issues/885)

## Resumen ejecutivo

Se evaluaron seis herramientas/repositorios de uso frecuente en mazmorreo y worldbuilding, con foco en si aportan valor al objetivo **standalone** de Espaciokoop Lagunak y si su licencia permite port, adaptación o solo referencia.

**Conclusión priorizada:** solo **Mipui** merece una integración directa prioritaria. El resto conviene tratarlos como referencia, interoperabilidad condicionada o descarte, porque las licencias y los derechos sobre código/contenido no son equivalentes.

---

## Matriz de decisión

| Herramienta | URL | Licencia / situación | Decisión |
| --- | --- | --- | --- |
| **Mipui** | https://www.mipui.net/ | El software es **MIT**. Su documentación confirma MIT y el sitio permite uso comercial de mapas creados con Mipui, aunque los token images pueden ser CC-BY y los forks de mapas pueden generar obras derivadas. ([GitHub](https://github.com/amishne/mipui)) | **P1 — Adaptador/importador** |
| **Deepnight RPG Map** | https://deepnight.net/tools/rpg-map/ | Las fuentes oficiales actuales no me dan base suficiente para afirmar una licencia open-source permisiva del producto. Deepnight mantiene copyright propio. ([Deepnight Games](https://deepnight.net/tools/anamap/)) | **Referencia, no port** |
| **donjon** | https://donjon.bin.sh/d20/dungeon/ | El propio sitio indica que el código simplificado del generador está bajo **CC BY-NC 3.0**, y parte del contenido usa OGL. | **Referencia/interoperabilidad muy condicionada; no copiar código** |
| **The Thieves Guild** | https://www.thievesguild.cc/harvest/ | Sus términos reservan el copyright del servicio, software y contenido, limitando el uso y prohibiendo copiar/adaptar software y automatizar/scrapear el servicio. ([Thieves Guild](https://www.thievesguild.cc/terms)) | **Descartar como fuente de port/datos** |
| **DunGen** | https://dungen.app/dungen/ | Sus ToS conceden uso personal/no comercial de la web/materiales y separan explícitamente la licencia comercial del contenido generado. ([DunGen](https://dungen.app/tos/)) | **No usar como runtime/integración** |
| **Laterpress** | https://www.laterpress.com/public-domain-books/ | La colección ofrece libros de dominio público procedentes de Project Gutenberg y Standard Ebooks, pero Laterpress es un servicio propietario y sus términos restringen scraping y protegen su contenido/código. ([Laterpress](https://www.laterpress.com/public-domain-books)) | **Solo descubrimiento; ir a la fuente original** |

---

## Propuestas concretas por herramienta

### Mipui → P1
Crear un importador de `.mipui` al `MapDocument` propio de Espaciokoop. Es la propuesta con mejor relación utilidad/licencia.

- El `.mipui` es JSON estructurado y la propia guía documenta su formato.
- El importador de Espaciokoop debe validarlo estrictamente antes de aceptarlo.
- Módulo/capa afectada: capa de importación de mapas.
- Coste estimado: medio.

Referencia: [Mipui Developer Guide](https://www.mipui.net/docs/developer_guide.html)

### donjon / Deepnight → P2
Implementar en Espaciokoop un generador/importador propio, tomando ideas de UX/algoritmos pero sin portar código no compatible.

- Donjon dispone de salidas JSON y ya documenta su generador, lo que lo hace interesante como referencia de interoperabilidad, no como biblioteca para copiar.
- Deepnight puede servir como referencia de UX/generación procedural.

### Thieves Guild / DunGen → descartar como integración
No merece la pena introducir una dependencia jurídica o de scraping cuando el valor puede reproducirse de forma independiente.

### Laterpress → referencia
Para textos y flavor, seguir la cadena hasta Project Gutenberg/Standard Ebooks y comprobar allí la obra concreta, en vez de tratar Laterpress como fuente licenciada.

---

## Cambio de planteamiento respecto al issue original

No conviene denominar a las seis “open-content tools” de forma genérica. La distinción correcta para el repositorio debería ser:

**software / código → contenido propio → contenido generado → assets incrustados → API/servicio → licencia aplicable**

Eso evitará exactamente los problemas de copyright que hemos encontrado en los PR de assets anteriores.

---

## Criterio de cierre

- [x] 6 herramientas evaluadas con licencia verificada en fuente oficial.
- [x] 6 propuestas concretas de integración/no integración.
- [x] Decisión priorizada.
