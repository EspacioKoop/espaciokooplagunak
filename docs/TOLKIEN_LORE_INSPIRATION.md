# Fuentes de Tolkien y su puente hacia Espaciokoop / D&D

> Documento de investigación exploratoria, a validar. No hay issue ni decisión de Eloy/Varo
> asociada todavía: es un mapa de oportunidades, no un plan aprobado (misma naturaleza que
> `docs/ATLAS_SPELLJAMMER.md`). No promover ninguna acción de aquí a "hecho" sin ese paso.

## Objetivo
Mapear las fuentes que inspiraron Tolkien y, a través de él, a D&D, hacia oportunidades concretas de lore, nombres, artefactos y estructuras narrativas para Espaciokoop Lagunak.

## Fuentes principales

### 1. The Kalevala (Finish)
- Temas: magia cantada, artefactos-forjados, héroes con nombres musicales
- Puente D&D: hechizos basados en canciones, creación por palabra
- Oportunidad Espaciokoop: `foco-render.mjs` podría exponer un "eco kalevaliano" como FX de cantos; nombres de sistemas en `.data/` con raíces finesas

### 2. The Elder (Poetic) Edda / Younger (Prose) Edda (Norse)
- Temas: "Middle Earth" como plano, Gandalf/Gandálfr, enanos, bosque Mirkwood, anillos, runas, wolven, Yggdrasil-like estructuras
- Puente D&D: alineamientos, enanos/herreros, magia rúnica, lobos gigantes, Valhalla-like
- Oportunidad Espaciokoop: `foundry-module/scripts/visor-piloto.mjs` como Yggdrasil estelar; `foundry-module/scripts/npc-*.mjs` con nombres eddicos; `foundry-module/scripts/mapa-*.mjs` como rutas raúnicas

### 3. The Volsung Saga / The Nibelungenlied / Wagner's Ring
- Temas: anillo maldito, héroe trágico, espada rota/remodelada, dragón, tesoro nibelungo
- Puente D&D: artefactos malditos, linajes heroicos, dragones como guardianes de tesoro, música como magia
- Oportunidad Espaciokoop: `foundry-module/scripts/procedencia-*.mjs` para trazar artefactos con historia tipo Ring; `foundry-module/scripts/escena-*.mjs` para "tierras del anillo" como escenas de nave espacial abandonada

### 4. Heimskringla (Snorri Sturlson)
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
- Oportunidad Espaciokoop: `foundry-module/scripts/convocatoria-*.mjs` como "puerta entre mundos"; `foundry-module/scripts/libro-geometria.mjs` / `libro-pagina.mjs` directamente inspirados en el Red Book

### 7. William Morris / Lord Dunsany / E.R. Eddison
- Temas: mundo inventado con lógica interna, estética artística, guerra de civilizaciones
- Puente D&D: tono elevado, artefactos bellos/peligrosos
- Oportunidad Espaciokoop: `foundry-module/scripts/paleta.mjs` con paletas inspiradas en Morris; `foundry-module/scripts/avatar-*.mjs` con estética Dunsany

## Acciones concretas para Espaciokoop

1. Nombres: añadir batch de nombres eddicos/fineses en foundry-module/data/nombres/ (directorio a crear)
2. Artefactos: ampliar `foundry-module/scripts/procedencia-*.mjs` con 3 artefactos tipo Ring/Volsung
3. Escenas: prototipo de "Yggdrasil stellar" en `foundry-module/scripts/visor-piloto*.mjs`
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
## Fuente adicional: Classics (Greek/Roman) — Sacred Texts
- Fuente: https://www.sacred-texts.com/cla/index.htm
- Textos clave: Homer (Iliad, Odyssey), Hesiod (Theogony, Works and Days), Orpheus, Sappho, Aesop, Herodotus, Virgil, Ovid, Apollonius, Lucian
- Temas: monomito/road of trials, viaje de regreso, catábasis, código de hospitalidad, bestiario simbólico, civilizaciones perdidas/tecnología antigua, máquinas/autómatas, metamorfosis, islas raras, profecías, destinos trágicos
- Puente D&D/Dragon: Odisea como dungeon del camino a casa; Theogony como árbol genealógico de dioses/dragones; autómatas de Vulcano como constructos; viaje al Hades como plano de sombras/mazmorra
- Oportunidad Espaciokoop: `foundry-module/scripts/escena-*.mjs` con "Odisea espacial" como escena navegación por sectores peligrosos; `foundry-module/scripts/npc-*.mjs` con sirenas/escila-caríbdis como asteroides; `foundry-module/scripts/procedencia-*.mjs` con artefactos tipo "autómata de Hefesto"; `foundry-module/scripts/libro-geometria.mjs` con geometría sagrada clásica
- Acción: abrir issue `docs(classics-lore): puente Homero/Hesiodo/Ovidio hacia módulos Foundry` con 4 candidatos ejecutables
