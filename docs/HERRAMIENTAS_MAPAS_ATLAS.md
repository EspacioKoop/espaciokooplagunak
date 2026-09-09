# Herramientas de mapas/compendios/open-content para el atlas standalone

Investigación cerrada en el issue [#885](https://github.com/EspacioKoop/espaciokooplagunak/issues/885):
seis herramientas de uso frecuente en mazmorreo y worldbuilding, evaluadas por si aportan valor al
objetivo **standalone** de Espaciokoop Lagunak
([ADR-0008](adr/0008-standalone-first-autoridad-del-nucleo.md) / `docs/ROADMAP_PRODUCTO.md`) y si
su licencia permite port de código, adaptador de formato, solo referencia o descarte. Cinco de las
seis licencias están verificadas por fetch directo a la fuente oficial; The Thieves Guild es la
excepción declarada (su `/terms` está tras un challenge de Cloudflare y solo se confirmó vía
snippets indexados por buscador — ver esa fila de la tabla). Hay además dos correcciones respecto a
una primera revisión externa: ver la nota al pie de la tabla.

No se llama a las seis "herramientas open-content": la distinción real que importa para el
repositorio es **software/código → contenido propio → contenido generado → assets incrustados →
API/servicio**, porque la licencia aplicable cambia con cada capa y no es la misma pregunta que
"¿es de código abierto?".

## Tabla

| Herramienta | URL | Licencia (verificada en fuente) | Qué aporta | Formato de exportación | Riesgo de integración | Ventana de licencia en runtime standalone |
|---|---|---|---|---|---|---|
| **Mipui** | https://www.mipui.net/ | Software **MIT** ([`LICENSE.txt`](https://github.com/amishne/mipui/blob/master/LICENSE.txt): "MIT License / Copyright (c) 2017 Alon Mishne"). Uso comercial de mapas propios permitido; token images de terceros y mapas bifurcados de otros pueden traer sus propios derechos. | Editor de mapas 2D/2.5D con formato de guardado documentado | `.mipui`: JSON que codifica `state._pstate` (Developer Guide) | **Adaptador** (P1) | Ninguna: MIT permite portar el importador sin restricción de runtime. El riesgo no es de licencia sino de robustez — la propia guía avisa de que el servidor no está endurecido frente a ficheros malformados, así que la validación estricta del `.mipui` importado es responsabilidad de Espaciokoop |
| **Deepnight RPG Map / ANAmap** | https://deepnight.net/tools/rpg-map/ | Copyright propio de Deepnight Games; no se encontró licencia open-source permisiva del producto en la [página oficial de la herramienta](https://deepnight.net/tools/rpg-map/) ni en el resto del sitio | Generador procedural de mapas | No documentado públicamente como formato abierto | **Solo referencia** | No hay ventana: sin licencia de reutilización confirmada, cualquier uso se limita a inspiración de UX/algoritmos, nunca a copiar código ni assets |
| **donjon (d20 dungeon generator)** | https://donjon.bin.sh/d20/dungeon/ | Código: copyright estándar — pie de página del sitio: "code Copyright © 2009-2026 drow" (sin ninguna licencia Creative Commons en el sitio). Contenido: parcialmente bajo **OGL** ([`/ogl.html`](https://donjon.bin.sh/ogl.html)) | Generador clásico de mazmorras, con salidas estructuradas | Salidas HTML/JSON del propio generador, sin API pública documentada | **Solo referencia/interoperabilidad muy condicionada** | El código no tiene licencia de reutilización — no se copia ni se porta. El contenido bajo OGL solo se puede usar respetando esa licencia (atribución y compatibilidad de Product Identity), y solo la parte que el propio sitio marca como sujeta a OGL |
| **The Thieves Guild (Harvest)** | https://www.thievesguild.cc/harvest/ | [`/terms`](https://www.thievesguild.cc/terms) está tras un challenge de Cloudflare y devuelve 403 en acceso directo (reproducido de nuevo al escribir esta corrección); el texto solo se confirmó vía snippets indexados por buscador, no por fetch directo a la fuente oficial. Es una inferencia prudente, no una verificación documental de la misma fuerza que las demás filas | Generador de loot/tesoros/encuentros | No aplica (uso restringido) | **Descartar** | Sin una fuente oficial accesible que sostenga literalmente sus prohibiciones, la decisión conservadora por defecto es la misma: no existe una licencia reutilizable verificable, así que ningún port, adaptador o scraping automatizado es seguro |
| **DunGen** | https://dungen.app/dungen/ | ToS ([`/tos/`](https://dungen.app/tos/)) conceden licencia "personal, noncommercial" de la web/materiales; el uso comercial (incluida la explotación del contenido generado) requiere contacto directo con el autor — no hay una cláusula específica ya redactada para contenido de IA, es un genérico "contáctame para licencia comercial" | Generador de mapas con IA | No documentado como formato abierto | **No usar como runtime/integración** | Ninguna con la licencia por defecto (no comercial); una integración en el juego (que se distribuye y se puede usar en mesas de terceros) excede ese uso personal salvo acuerdo comercial explícito con el autor |
| **Laterpress** | https://www.laterpress.com/public-domain-books/ | Catálogo propio: "sourced from Project Gutenberg and Standard Ebooks" (confirmado en la propia página). [Términos de Laterpress](https://www.laterpress.com/terms) prohíben scraping fuera de `robots.txt` y protegen su propio contenido/código/marca — pero **no** son la fuente de la licencia de los libros en sí, que siguen siendo dominio público en origen | Catálogo/descubrimiento de libros de dominio público para texto/flavor/atlas | N/A (es un directorio, no una API) | **Solo descubrimiento** | Ninguna directa sobre Laterpress: para usar un texto hay que ir a la obra en Project Gutenberg / Standard Ebooks y verificar allí su estado de dominio público (varía por jurisdicción y por edición), nunca citar Laterpress como la fuente de licencia |

**Nota de verificación**: una primera revisión externa del issue #885 afirmaba que el código de
donjon estaba bajo CC BY-NC 3.0 y que DunGen separaba explícitamente una licencia comercial para
contenido de IA. Ambas afirmaciones se comprobaron directamente contra las páginas oficiales
(comentario de corrección en el issue) y no se sostienen: donjon usa copyright estándar sin ninguna
mención a Creative Commons, y DunGen solo ofrece un contacto genérico para licencia comercial. La
decisión priorizada no cambia, pero la tabla de arriba usa la redacción corregida.

## Propuestas concretas

### Mipui → P1, adaptador de importación

- **Módulo/capa afectada**: un importador nuevo que traduzca el JSON `.mipui`
  (`state._pstate`, ver Developer Guide) al `MapDocument` propio del atlas de Espaciokoop. No toca
  el motor de render de mapas ni `mapa-render.mjs`/`ventana-nave.mjs` — es una capa de entrada
  paralela a como ya se construye la planta del Phobos desde datos declarativos (ver
  `nave-planta-phobos.mjs` en `CLAUDE.md`).
- **Coste estimado**: bajo-medio. El formato ya está documentado por el propio proyecto; el trabajo
  real es la validación estricta antes de aceptar un fichero (la propia guía de Mipui avisa de que
  su servidor no está endurecido contra ficheros malformados, así que esa responsabilidad recae
  entera en el importador de Espaciokoop) y el mapeo de conceptos (capas, tokens, terreno) al modelo
  propio.
- **Depende de**: que exista ya un `MapDocument`/atlas propio contra el que importar; si no existe
  todavía, este importador es P1 solo dentro de la línea de trabajo del atlas (#213/#525), no una
  tarea aislada.

### donjon / Deepnight → P2, referencia de UX/algoritmos

- No se porta código de ninguno de los dos (donjon no tiene licencia de reutilización; Deepnight no
  tiene licencia confirmada). La propuesta es una implementación propia de un generador de mazmorras,
  tomando como referencia de diseño la estructura de salida de donjon (habitaciones, pasillos,
  puertas) y el flujo de UX de ambos, sin copiar ni un fragmento de su código o assets.
- Si se usa contenido de donjon marcado como OGL, debe aislarse en su propio fichero con atribución
  explícita y comprobación de que no mezcla Product Identity no licenciable.

### The Thieves Guild / DunGen → descartar como integración

- No se propone adaptador ni reutilización sin licencia verificable: los términos de The Thieves
  Guild no pudieron contrastarse directamente y DunGen limita el uso a personal/no comercial.
  El descarte de The Thieves Guild es conservador, no una prohibición jurídica acreditada por
  snippets. El valor que aportarían (loot proceduralmente generado, mapas por IA) se puede perseguir
  con una implementación propia si se decide que hace falta, no copiando estas herramientas.

### Laterpress → cómo se cita en docs

- Nunca se referencia Laterpress como fuente de licencia. Cualquier texto de dominio público que se
  quiera usar en el atlas o en flavor de misión se busca y verifica directamente en
  **Project Gutenberg** (`gutenberg.org`) o **Standard Ebooks** (`standardebooks.org`), comprobando
  el estado de dominio público de esa edición concreta en la jurisdicción relevante, y se cita esa
  fuente original en el propio contenido del escenario/atlas — Laterpress como mucho sirve para
  descubrir qué buscar allí.

## Decisión priorizada

1. **Mipui** — único candidato a port real (adaptador `.mipui` → `MapDocument`); prioridad ligada a
   cuándo exista un atlas propio contra el que importar.
2. **donjon** — referencia de diseño para un generador de mazmorras propio; sin plazo fijado.
3. **Deepnight** — referencia de UX únicamente, sin acción concreta pendiente.
4. **Laterpress** — proceso de trabajo (ir siempre a Gutenberg/Standard Ebooks), no requiere código.
5. **DunGen** y **The Thieves Guild** — descartados como integración; no se abre trabajo derivado.

Cobertura documental: seis herramientas evaluadas, cinco verificadas en fuente oficial y una
no verificable directamente (The Thieves Guild), descartada de forma conservadora; seis
propuestas concretas y decisión priorizada. No se presenta esa excepción como una sexta licencia
verificada ni se certifica aquí el criterio literal de cierre de #885.

## Coordinación con PR #887

El PR #887 propone `docs/EXTERNAL_TOOLS_RESEARCH_885.md` sobre las mismas seis herramientas,
pero también aporta `ECOSISTEMA_OPEN_SOURCE.md`, `PROCEDENCIA_ASSETS.md`, `gutendex_seeds.py`
y `sharetextures_categories.py`. Ese trabajo adicional no queda sustituido por esta tabla:
se conserva en #887 con sus pruebas y hallazgos pendientes. Este documento se integra como
investigación con la excepción de licencia indicada, no como un cierre automático de #885.
El estado vivo y los conflictos de ambos PR se consultan en GitHub, no se fijan en este documento.
