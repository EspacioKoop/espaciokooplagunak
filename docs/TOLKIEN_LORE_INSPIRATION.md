# Fuentes de Tolkien y su puente hacia Espaciokoop / D&D

> Documento de investigación exploratoria, a validar. No hay issue ni decisión de Eloy/Varo
> asociada todavía: es un mapa de oportunidades, no un plan aprobado (misma naturaleza que
> `docs/ATLAS_SPELLJAMMER.md`). No promover ninguna acción de aquí a "hecho" sin ese paso.

## Objetivo
Mapear las fuentes que inspiraron Tolkien y, a través de él, a D&D, hacia oportunidades concretas de lore, nombres, artefactos y estructuras narrativas para Espaciokoop Lagunak.

## Fuentes principales

### 1. The Kalevala (Finnish)
- Temas: magia cantada, artefactos-forjados, héroes con nombres musicales
- Puente D&D: hechizos basados en canciones, creación por palabra
- Oportunidad Espaciokoop: `foco-render.mjs` podría exponer un "eco kalevaliano" como FX de cantos; nombres de sistemas en `.data/` con raíces finesas

### 2. The Poetic Edda / Prose Edda (Norse)
- Temas: "Middle Earth" como plano, Gandalf/Gandálfr, enanos, bosque Mirkwood, anillos, runas, wolven, Yggdrasil-like estructuras
- Puente D&D: alineamientos, enanos/herreros, magia rúnica, lobos gigantes, Valhalla-like
- Oportunidad Espaciokoop: `foundry-module/scripts/visor-piloto/visor-piloto.mjs` como Yggdrasil estelar; `foundry-module/scripts/npc-*.mjs` con nombres eddicos; `foundry-module/scripts/mapa-*.mjs` como rutas rúnicas

### 3. The Volsung Saga / The Nibelungenlied / Wagner's Ring
- Temas: anillo maldito, héroe trágico, espada rota/remodelada, dragón, tesoro nibelungo
- Puente D&D: artefactos malditos, linajes heroicos, dragones como guardianes de tesoro, música como magia
- Oportunidad Espaciokoop: `foundry-module/scripts/procedencia-*.mjs` para trazar artefactos con historia tipo Ring; `foundry-module/scripts/escena-*.mjs` para "tierras del anillo" como escenas de nave espacial abandonada

### 4. Heimskringla (Snorri Sturluson)
- Temas: genealogías de reyes, nombres de Alfheim, batallas, Harald Harfagra
- Puente D&D: facciones nobles, linajes, reclamación de tronos
- Oportunidad Espaciokoop: `foundry-module/scripts/station-*.mjs` con "casas" al estilo Heimskringla; `foundry-module/scripts/asistencia*.mjs` con linajes

### 5. Beowulf (Old English)
- Temas: monstruo primordial, héroe con fuerza sobrehumana, combate cuerpo a cuerpo, mead-halls
- Puente D&D: gremlins/grendel-like, bárbaros, monstruos de las profundidades
- Oportunidad Espaciokoop: `foundry-module/scripts/npc-*.mjs` con "tipo Grendel" para criaturas de los casilleros/compuertas; `foundry-module/scripts/museo-escena.mjs` como salón del festín

### 6. The Mabinogion (Welsh)
- Temas: Red Book of Hergest, magia dual, viaje entre mundos, cajas pandora-like
- Puente D&D: hechicería druídica, viaje entre planos, objetos con personalidad
- Oportunidad Espaciokoop: `foundry-module/scripts/convocatoria-*.mjs` como "puerta entre mundos"; `foundry-module/scripts/libro-geometria.mjs` / `libro-pagina.mjs` con inspiración estética/conceptual en el Red Book (sin copiar su contenido)

### 7. William Morris / Lord Dunsany / E.R. Eddison
- Temas: mundo inventado con lógica interna, estética artística, guerra de civilizaciones
- Puente D&D: tono elevado, artefactos bellos/peligrosos
- Oportunidad Espaciokoop: `foundry-module/scripts/paleta.mjs` con paletas inspiradas en Morris; `foundry-module/scripts/avatar-*.mjs` con estética Dunsany

## Acciones concretas para Espaciokoop

1. Nombres: añadir batch de nombres eddicos/fineses en foundry-module/data/nombres/ (directorio a crear)
2. Artefactos: ampliar `foundry-module/scripts/procedencia-*.mjs` con 3 artefactos tipo Ring/Volsung
3. Escenas: prototipo de "Yggdrasil stellar" en `foundry-module/scripts/visor-piloto/*.mjs`
4. Música/FX: Kalevala como inspiración para FX de cantos en `foundry-module/scripts/audio-*.mjs`
5. NPCs: bestiario eddico/beowulfiano en `foundry-module/scripts/npc-*.mjs`
6. Tests: foundry-module/tests/lore-sources.test.mjs (a crear) que verifique que cada fuente tenga al menos un asset/fichero asociado

## Criterios de aceptación
- [ ] Issue desglosado en 6 unidades mínimas, una por fuente
- [ ] Cada unidad propone archivo concreto y prueba ejecutable
- [ ] No se modifican binarios/assets externos sin criterio CC0/atribución
- [ ] Se respeta el Mapa de Áreas: cada cambio cae en exactamente un área

## Riesgos
- Mezclar fuentes sin filtro puede generar incoherencia de tono
- D&D ya tomó prestado mucho; evitar derivación directa sin transformación
- Algunos textos no son CC0; solo usarlos como inspiración, no como contenido copiado

## Siguiente paso recomendado
Abrir 1 issue por fuente o issue global con 6 subtareas; priorizar Nibelungenlied/Edda por trazabilidad directa a D&D.
## Fuente adicional: Basque Folklore (Sacred Texts)
- Fuente: https://www.sacred-texts.com/neu/basque/index.htm
- Textos: Legends and Popular Tales of the Basque People (Monteiro, 1887) + Basque Legends (Webster, 1879)
- Temas: seres feéricos/montañeses, gigantes, brujería, Lamia, Tartalo, Mari, cuevas como portales, objetos prestados/robados con maldición
- Puente D&D/Dragon: criaturas de montaña tipo gigante/troll, objetos malditos, portales de mazmorra en cuevas
- Oportunidad Espaciokoop: `foundry-module/scripts/npc-*.mjs` con "tipo Tartalo"; `foundry-module/scripts/escena-*.mjs` cueva-portal; `foundry-module/scripts/procedencia-*.mjs` objeto con maldición
- Acción: abrir issue `docs(basque-lore): mapa de mitos vascos hacia módulos Foundry` con 3 candidatos ejecutables
## Fuente adicional: guía de recursos textuales clásicos en dominio público (Qwen)

> Contenido pegado en los comentarios del PR #881 por una IA externa (firmado "Qwen", con un
> PDF adjunto que reproduce el mismo texto con 127 referencias numeradas); no es investigación
> propia del repositorio y no ha pasado ninguna verificación editorial ni de licencia — inclúyelo
> aquí solo como mapa de punteros a validar, no como hecho establecido. Complementa (no repite)
> las fuentes ya mapeadas arriba con foco en **dónde conseguir el texto** y **cómo procesarlo**.

- **Eddas** (ver también fuente 2 arriba): *Prose Edda* (trad. Brodeur 1916, Project Gutenberg;
  trad. Faulkes, VSNR) y *Poetic Edda* (trad. Bellows 1923, Project Gutenberg/Wikisource/Sacred
  Texts). Útiles como base de datos semi-estructurada de genealogías (`Gylfaginning`) y como
  fuente de verso para generación procedimental de nombres/epígrafes.
- **Kalevala** (ver también fuente 1 arriba): trad. Crawford (1888, primera en inglés completa) y
  trad. Kirby (1907, directa del finés, imita el esquema métrico). Estructura en `runos`
  (cánticos) independientes entre sí: encaja con un modelo de datos por canto/región.
- **Beowulf** (ver también fuente 5 arriba): trad. Lesslie Hall (prosa moderna), trad. Gummere
  (más fiel/poética); el manuscrito Old English original solo existe como PDF/DjVu escaneado, así
  que necesitaría OCR + curación manual antes de ser texto procesable.
- **Sagas nórdicas/germánicas**: *Völsunga saga* (Sigurd/Fafnir, ya cubierta como fuente 3 arriba)
  y *Norna-Gests þáttr* (aventuras sobrenaturales y predicción del futuro), ambas en Wikisource/
  Project Gutenberg en texto plano.

**Consideraciones técnicas que aporta el comentario** (a evaluar, no adoptadas todavía):
- Licencia: declarar explícitamente CC0/dominio-público al incorporar cualquier texto — el
  "dominio público" no es universal entre jurisdicciones (cita el caso alemán).
- Formato: preferir `.txt` UTF-8 (Project Gutenberg) sobre `.epub`/`.pdf` escaneado; el PDF/DjVu
  exige OCR y corrección manual antes de ser útil.
- TEI (Text Encoding Initiative): propone marcar texto en XML semántico
  (`<person name="Thor">Thor</person> viajó a <place name="Jötunheimr">...`) como vía a una base
  de conocimiento estructurada; cita `PG2TEI` como conversor automático desde Project Gutenberg.
  Sin prototipo ni decisión: es una idea a largo plazo, no una propuesta concreta de este repo.

## Fuente adicional: ampliación a otras mitologías (comentario sin firma, PR #881)

> Igual que la anterior: contenido pegado por una IA externa en los comentarios del PR, sin
> verificación propia. Se resume aquí para no perder el punterío, con la misma reserva sobre
> licencias y precisión histórica que pide la revisión de VaroTv7 en este PR.

- **Griega/romana**: *Teogonía* de Hesíodo (trad. Evelyn-White) como grafo genealógico
  divino/monstruoso; *Odisea* (trad. Butler) como estructura de "viaje de regreso" con pruebas
  encadenadas; *Metamorfosis* de Ovidio como catálogo de "estados de transformación" para
  mecánicas de maldición/mutación.
- **Celta (irlandesa/galesa)**: las *geasa* (tabúes mágicos) del *Mabinogion* (ya cubierto como
  fuente 6 arriba) y del *Táin Bó Cúailnge* como sistema de restricción/consecuencia
  condicional ("si rompe el tabú, entonces...").
- **Mesopotámica**: *Epopeya de Gilgamesh* (trad. R. Campbell Thompson) como plantilla de misión
  de alto nivel (preparación → viaje → guardián → botín → consecuencia imprevista).
- **Védica/hindú**: *Rigveda* como catálogo de personificaciones elementales (Agni/Vayu/Indra)
  para sistemas de magia elemental jerárquica; *Mahabharata* como caso de estudio de diplomacia
  multifacción a gran escala.
- **Mesoamericana**: *Popol Vuh* — las "casas de pruebas" de Xibalbá (Casa de la Oscuridad, de
  los Cuchillos, del Frío) como diseño de nivel/puzle ya resuelto por la tradición oral.

Ninguna de estas dos fuentes adicionales tiene todavía oportunidad Espaciokoop ni acción
concreta asociada — quedan como candidatas a un futuro issue de ampliación, no como parte del
alcance de este documento.

## Fuente adicional: Classics (Greek/Roman) — Sacred Texts
- Fuente: https://www.sacred-texts.com/cla/index.htm
- Textos clave: Homer (Iliad, Odyssey), Hesiod (Theogony, Works and Days), Orpheus, Sappho, Aesop, Herodotus, Virgil, Ovid, Apollonius, Lucian
- Temas: monomito/road of trials, viaje de regreso, catábasis, código de hospitalidad, bestiario simbólico, civilizaciones perdidas/tecnología antigua, máquinas/autómatas, metamorfosis, islas raras, profecías, destinos trágicos
- Puente D&D/Dragon: Odisea como dungeon del camino a casa; Theogony como árbol genealógico de dioses/dragones; autómatas de Vulcano como constructos; viaje al Hades como plano de sombras/mazmorra
- Oportunidad Espaciokoop: `foundry-module/scripts/escena-*.mjs` con "Odisea espacial" como escena navegación por sectores peligrosos; `foundry-module/scripts/npc-*.mjs` con sirenas/escila-caríbdis como asteroides; `foundry-module/scripts/procedencia-*.mjs` con artefactos tipo "autómata de Hefesto"; `foundry-module/scripts/libro-geometria.mjs` con geometría sagrada clásica
- Acción: abrir issue `docs(classics-lore): puente Homero/Hesiodo/Ovidio hacia módulos Foundry` con 4 candidatos ejecutables
