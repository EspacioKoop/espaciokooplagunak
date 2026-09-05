# Ways to Integrate Year Zero Engine Concepts in Espaciokoop Lagunak (Standalone-First)

## Bloqueante jurídico/arquitectónico (revisión de @VaroTv7, PR #860)

La [Free Tabletop License v1.1](https://freeleaguepublishing.com/wp-content/uploads/2026/03/Year-Zero-Engine-License-Agreement-version-1.1.pdf),
cláusula 1, autoriza el uso del SRD de YZE en **impreso, PDF o módulo VTT**, y
**excluye expresamente los videojuegos**. Espaciokoop Lagunak es un videojuego
(motor SeriousProton/C++), así que ningún adaptador YZE dentro de `src/` o del
núcleo puede presentarse como amparado por la FTL — no importa cuánto se
abstraiga o renombre.

Esto reduce las opciones reales a dos categorías, no a las cinco de la
propuesta original:

- **(A) Inspiración abstracta**, sin copiar texto ni terminología del SRD: cae
  fuera del alcance de la FTL (las mecánicas no registradas no son propiedad
  de nadie) y por tanto **sí** puede vivir en el núcleo del videojuego.
- **(B) Un eventual módulo Foundry/VTT** que use el SRD de YZE tal cual (con
  su terminología, sus fórmulas): eso SÍ está cubierto por la cláusula 1, pero
  solo si vive en la capa de integración con Foundry — nunca en el núcleo del
  videojuego — y cumple los requisitos de atribución de la licencia.

Cualquier propuesta que mezcle ambas categorías en el mismo adaptador, o que
las meta en `src/`, repite el error que bloqueó esta entrega.

## Categoría A — Inspiración abstracta (núcleo, sin licencia YZE)

Estas ideas no citan el SRD ni su terminología; son lecciones de diseño que
Espaciokoop puede reimplementar con su propio vocabulario y balance, igual que
cualquier otro juego de mesa aporta ideas sin que eso implique una licencia.

### 1. Modelo de atributos amplios + especialidades
**Concepto**: la lección de diseño de YZE (pocos atributos amplios, muchas
especialidades) sin adoptar sus nombres (Strength/Agility/Wits/Empathy) ni su
escala 1-5.
**Comprobación standalone**: el núcleo define sus propios atributos; ninguna
referencia a YZE en el código.

### 2. Reintentar con coste como principio de diseño
**Concepto**: la lección de "arriesgar más para intentarlo otra vez" es un
patrón genérico de juegos de dados/cartas, no exclusivo de YZE ni parte de su
SRD. Si Espaciokoop quiere una mecánica de este tipo, se diseña desde cero
sobre su propio sistema de tiradas, sin nombrarla "push" ni copiar su coste
exacto en estrés/daño del SRD.

## Categoría B — Módulo Foundry/VTT bajo FTL 1.1 (fuera del núcleo)

Si en el futuro se decide ofrecer contenido derivado del SRD de YZE tal cual
(terminología, unidades de tiempo Round/Stretch/Shift, tabla de contratiempos
de campamento, pool de dados d6 con éxitos en 6), eso solo es viable como:

- Un módulo de Foundry VTT, no como código en `src/` del videojuego.
- Con la nota de no afiliación exigida por la FTL y enlace a la licencia
  (ver `docs/research/YZE-Research.md`).
- Dependiendo del núcleo de Espaciokoop, nunca al revés: `adapter → espaciokoop-core`.

Esta categoría es una línea de trabajo futura, condicionada a que exista de
verdad la integración con Foundry (ver `docs/FOUNDRY.md` y la regla
standalone-first del proyecto) y a que alguien redacte esa propuesta de forma
separada, con su propia atribución FTL. Este documento no propone su
implementación todavía.

## Principios de diseño si se retoma esta línea

1. **Separación de categorías**: nada de código de categoría B en el núcleo
   del videojuego; nada de terminología literal del SRD en la categoría A.
2. **Dependencia**: cualquier adaptador depende del núcleo de Espaciokoop
   (`adapter → espaciokoop-core`), nunca al revés.
3. **Atribución**: si se usa el SRD (categoría B), la nota de no afiliación y
   el enlace a la FTL 1.1 son obligatorios en esa integración, no en el
   videojuego.
4. **Sin afirmaciones de licencia sobre el videojuego**: el núcleo de
   Espaciokoop Lagunak no está bajo la FTL y no debe declarar que lo está.
