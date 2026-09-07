# Artefactos de Claude — referencias aportadas para EspacioKoop

Registro: 2026-09-06. **Archivo integral completado: 2026-09-08.**
Seguimiento: [issue #1039](https://github.com/EspacioKoop/espaciokooplagunak/issues/1039).

## Qué está conservado

**10 enlaces únicos, procedentes de 11 referencias recibidas**, con el **HTML íntegro
de los diez** archivado en [`html/`](html/) y su SHA-256 en el
[manifiesto](manifest.json). El artefacto `4aa48576-bef8-4d20-b9cb-1e1cde410c16` se
recibió dos veces: una sola ficha, ambas apariciones registradas.

- Todos los identificadores y enlaces se conservan literalmente.
- De «Piel de Puerta» se conserva además [el texto extraído en 2026-09-06](piel-de-puerta-texto.md),
  anterior al archivo del HTML completo.
- Esto sigue siendo un **archivo documental de referencia**, no una demo aprobada, un
  asset validado ni una prueba de integración en el juego. Que el HTML esté aquí no
  convierte ninguna de estas maquetas en decisión tomada.

## Catálogo

| Artefacto | Tema | Issue | Enlace original | Copia en el repositorio |
|---|---|---|---|---|
| Piel de Puerta | Piel pixelart de media hoja de puerta corredera a 2,5 cm/téxel | [#458](https://github.com/EspacioKoop/espaciokooplagunak/issues/458) | [368f25e2…](https://claude.ai/code/artifact/368f25e2-b8dd-4b08-b98b-737893382455) | [HTML íntegro](html/368f25e2-b8dd-4b08-b98b-737893382455.html) + [texto](piel-de-puerta-texto.md) |
| Muro: geometría o textura | rejillaMural() vs teselaMuro(): 263 polígonos frente a 7 | [#584](https://github.com/EspacioKoop/espaciokooplagunak/issues/584) | [9a78b189…](https://claude.ai/code/artifact/9a78b189-93a9-4280-985d-869c028a8742) | [HTML sin las dos imágenes comparativas](html/9a78b189-93a9-4280-985d-869c028a8742.html) |
| Mirada Viva | Cuatro políticas de seguimiento ocular; expresión solo por cejas | [#974](https://github.com/EspacioKoop/espaciokooplagunak/issues/974) | [4aa48576…](https://claude.ai/code/artifact/4aa48576-bef8-4d20-b9cb-1e1cde410c16) | [HTML íntegro](html/4aa48576-bef8-4d20-b9cb-1e1cde410c16.html) |
| Mochila del Phobos | Tres maquetas de inventario con las mismas teclas y datos | [#897](https://github.com/EspacioKoop/espaciokooplagunak/issues/897) | [19920f00…](https://claude.ai/code/artifact/19920f00-807b-41cc-a991-07edce9594a3) | [HTML íntegro](html/19920f00-807b-41cc-a991-07edce9594a3.html) |
| Arena de Combate | Campo de pruebas empaquetado del motor de andar, sin Foundry | — | [d50ed22e…](https://claude.ai/code/artifact/d50ed22e-bf54-455e-b16e-b944cc5dbdee) | [HTML íntegro](html/d50ed22e-bf54-455e-b16e-b944cc5dbdee.html) |
| Caras y Peinados PSX | Seis caras sin textura; peinados como casquete+flequillo+añadido | [#973](https://github.com/EspacioKoop/espaciokooplagunak/issues/973) | [94caf8e4…](https://claude.ai/code/artifact/94caf8e4-85cd-4c64-955a-0f88edb730d5) | [HTML íntegro](html/94caf8e4-85cd-4c64-955a-0f88edb730d5.html) |
| Salir del Cubo | Cinco direcciones de silueta y triaje de licencia de cinco fuentes | [#603](https://github.com/EspacioKoop/espaciokooplagunak/issues/603) | [b1ca927b…](https://claude.ai/code/artifact/b1ca927b-bfb7-4307-8ec1-00e83290e92a) | [HTML íntegro](html/b1ca927b-bfb7-4307-8ec1-00e83290e92a.html) |
| A Qué Miran los NPC | Siete políticas de mirada ante los mismos eventos | [#974](https://github.com/EspacioKoop/espaciokooplagunak/issues/974) | [5ff27ef2…](https://claude.ai/code/artifact/5ff27ef2-4587-4a11-99ee-5f7d721bab27) | [HTML íntegro](html/5ff27ef2-4587-4a11-99ee-5f7d721bab27.html) |
| El haz de las luminarias | Renders SVG del motor real con luces de punto y haz visible | [#556](https://github.com/EspacioKoop/espaciokooplagunak/issues/556) | [a53c0e8c…](https://claude.ai/code/artifact/a53c0e8c-6d82-4e84-8cb3-ed5d6b6b39d6) | [HTML íntegro](html/a53c0e8c-6d82-4e84-8cb3-ed5d6b6b39d6.html) |
| Gramática PSX del Avatar | Cinco razas y doce clases; la clase rompe el perfil | [#973](https://github.com/EspacioKoop/espaciokooplagunak/issues/973) | [37d76856…](https://claude.ai/code/artifact/37d76856-7688-4914-936f-bb15eecd0b4c) | [HTML íntegro](html/37d76856-7688-4914-936f-bb15eecd0b4c.html) |

## Cómo se desbloqueó la recuperación

El registro de 2026-09-06 describía un bloqueo real: el extractor devolvía la página
contenedora de Claude o un «Page not found», las consultas HTTP directas daban 200 con
solo el contenedor, y la API observada en la página devolvía un desafío de acceso.

La causa no era que los artefactos estuvieran borrados ni fueran privados: **son
propiedad de la cuenta del proyecto**, y se leen con la herramienta de artefactos de
Claude Code autenticada como esa cuenta, sin sortear ningún desafío ni raspar la
página. Ese era el camino que faltaba probar. Queda como lección para el próximo
bloqueo parecido: un HTTP 200 con contenedor vacío describe el raspador, no el recurso.

## Límites de este archivo

- **Un HTML archivado no es una licencia de reutilización.** La procedencia queda
  registrada (autoría de la cuenta del proyecto, fecha, identificador, checksum); usar
  cualquiera de estas maquetas como base de código sigue siendo una decisión aparte.
- **La fidelidad no es uniforme y está declarada por ficha** en el manifiesto. Nueve
  copias son íntegras; la de «Muro: geometría o textura» conserva texto, CSS y cifras
  pero no las dos imágenes PNG comparativas embebidas — para esas, la fuente sigue
  siendo el artefacto original en su URL.
- **Nada de esto está integrado.** Son maquetas y comparativas de apoyo a decisiones
  de arte y de interfaz; varias proponen direcciones que aún no se han elegido.
