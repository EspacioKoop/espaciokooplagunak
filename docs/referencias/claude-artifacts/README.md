# Artefactos de Claude — referencias aportadas para EspacioKoop

Registro: 2026-09-06. Seguimiento: [issue #1039](https://github.com/EspacioKoop/espaciokooplagunak/issues/1039).

## Qué está conservado

**10 enlaces únicos, procedentes de 11 referencias recibidas.** El artefacto
`4aa48576-bef8-4d20-b9cb-1e1cde410c16` se recibió dos veces: se registra una sola
ficha y se conservan ambas apariciones en el [manifiesto](manifest.json).
Se incluye «Piel de Puerta», recibido antes del lote de nueve artefactos distintos.

- Todos los identificadores y enlaces se conservan literalmente.
- De «Piel de Puerta» se conserva [el texto recuperado](piel-de-puerta-texto.md).
- **Ninguno cuenta todavía con archivo integral del artefacto** (HTML/código y
  recursos originales). Los otros nueve no tienen contenido recuperado.
- Esto es un catálogo de referencias, no una demo ejecutable ni prueba de
  integración en el juego. No se han inventado títulos para las páginas no leídas.

## Catálogo

| Artefacto | Enlace original | Copia en el repositorio |
|---|---|---|
| Piel de Puerta | [368f25e2-b8dd-4b08-b98b-737893382455](https://claude.ai/code/artifact/368f25e2-b8dd-4b08-b98b-737893382455) | [Texto parcial](piel-de-puerta-texto.md); sin código ni imagen |
| Artefacto 2 — título no recuperado | [9a78b189-93a9-4280-985d-869c028a8742](https://claude.ai/code/artifact/9a78b189-93a9-4280-985d-869c028a8742) | Referencia; contenido pendiente |
| Artefacto 3 — título no recuperado | [4aa48576-bef8-4d20-b9cb-1e1cde410c16](https://claude.ai/code/artifact/4aa48576-bef8-4d20-b9cb-1e1cde410c16) | Referencia; contenido pendiente |
| Artefacto 4 — título no recuperado | [19920f00-807b-41cc-a991-07edce9594a3](https://claude.ai/code/artifact/19920f00-807b-41cc-a991-07edce9594a3) | Referencia; contenido pendiente |
| Artefacto 5 — título no recuperado | [d50ed22e-bf54-455e-b16e-b944cc5dbdee](https://claude.ai/code/artifact/d50ed22e-bf54-455e-b16e-b944cc5dbdee) | Referencia; contenido pendiente |
| Artefacto 6 — título no recuperado | [94caf8e4-85cd-4c64-955a-0f88edb730d5](https://claude.ai/code/artifact/94caf8e4-85cd-4c64-955a-0f88edb730d5) | Referencia; contenido pendiente |
| Artefacto 7 — título no recuperado | [b1ca927b-bfb7-4307-8ec1-00e83290e92a](https://claude.ai/code/artifact/b1ca927b-bfb7-4307-8ec1-00e83290e92a) | Referencia; contenido pendiente |
| Artefacto 8 — título no recuperado | [5ff27ef2-4587-4a11-99ee-5f7d721bab27](https://claude.ai/code/artifact/5ff27ef2-4587-4a11-99ee-5f7d721bab27) | Referencia; contenido pendiente |
| Artefacto 9 — título no recuperado | [a53c0e8c-6d82-4e84-8cb3-ed5d6b6b39d6](https://claude.ai/code/artifact/a53c0e8c-6d82-4e84-8cb3-ed5d6b6b39d6) | Referencia; contenido pendiente |
| Artefacto 10 — título no recuperado | [37d76856-7688-4914-936f-bb15eecd0b4c](https://claude.ai/code/artifact/37d76856-7688-4914-936f-bb15eecd0b4c) | Referencia; contenido pendiente |

## Recuperación y límites

La extracción de «Piel de Puerta» devolvió su texto, pero eliminó la imagen
embebida y no entregó código. Los nueve restantes produjeron errores de extracción
(o «Page not found» en un caso); las consultas directas devolvieron HTTP 200 con
solo el contenedor de Claude. **HTTP 200 no prueba acceso al artefacto.**
El navegador de comprobación no arrancó y la API observada en la página devolvió
un desafío de acceso. No se ha iniciado sesión ni sorteado el desafío.
El resultado de acceso no permite afirmar que los enlaces estén rotos, borrados
o sean privados; pueden abrirse para otras personas.

No se suben páginas de error, contenedores vacíos, capturas de navegador con datos
personales ni HTML reconstruido como si fueran exportaciones originales. Las
referencias externas conservan su procedencia; no se presume autoría individual
ni una licencia de reutilización por estar enlazadas aquí.

## Pendiente de archivo integral

Responsable: ARQUÍMEDES. Autorización vigente: guardar y documentar estos enlaces
y artefactos en este repositorio. Bloqueo: no se han recuperado sus exportaciones
originales. Siguiente acción: cuando estén accesibles, incorporar los archivos
reales por identificador, con procedencia, comprobación de secretos, autoría/licencia
verificadas y checksum; actualizar el manifiesto y el issue enlazado. No reconstruir
prototipos, desarrollar funciones derivadas ni crear automatizaciones para ello.

El manifiesto distingue explícitamente `reference_preserved` de
`full_artifact_archived`. Publicar este catálogo no cierra el archivo integral.
