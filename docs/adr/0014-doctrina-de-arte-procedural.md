# ADR-0014 — Doctrina de arte: procedural en cliente, cero binarios, un solo sitio para el color, y ningún ornamento que abra una lectura falsa

- Estado: Aceptada
- Fecha: registrada 2026-08-26
- Issues relacionados: #351, #362, #526, #541, #548–#556
- Fuentes: `foundry-module/scripts/paleta.mjs`, `laminas-clasicas.mjs`,
  `mapa-marco.mjs`, `nave-mural-pixel.mjs`, `nave-piel-suelo.mjs`,
  `nave-consola.mjs`, `nave-ventana-espacio.mjs`;
  `docs/ECOSISTEMA_MODULOS_FOUNDRY.md` §«Descartes razonados».

## Contexto

Todo el arte del módulo se genera en el cliente. Eso empezó como una restricción
práctica —un módulo de Foundry que no arrastra megas de sprites se instala y se
actualiza sin fricción— y se convirtió en doctrina cuando aparecieron los dos
fallos que la justifican:

- **El color se dispersa.** La regla de `paleta.mjs` se cerró (#351) cuando el
  cuarto módulo de arte se inventó su propio sepia. Un color declarado en dos
  sitios no se ve mal: se ve *casi* igual, que es peor.
- **El ornamento afirma cosas.** #526 iba a poner el registro completo de la
  lámina clásica —tics de limbo, rosa de los vientos— alrededor del mapa vivo.
  Sobre un instrumento que **sí se lee**, eso es una escala y una marcación que
  nadie ha calculado.

La segunda es la que más decide, y no es una preferencia estética: es una
afirmación de lectura, del mismo género que las que ADR-0002/ADR-0008 reparten
entre núcleo y módulo.

## Alternativas consideradas

- **Assets de terceros (JB2A, sprites de FXMaster, los skybox de EmptyEpsilon).**
  Descartados por tres motivos que coinciden: licencia (CC-BY-NC-SA en JB2A),
  peso (16 MB de skybox) y verdad — un cielo de EmptyEpsilon enseñaría un espacio
  que no es el de esta partida.
- **Sequencer animando el canvas de Foundry.** Descartado: animaría impactos
  sobre tokens que no siguen a la simulación, o sea animaría una mentira (#354).
- **«Tics decorativos que se entiende que no cuentan».** Descartado: quien anda
  por la nave no tiene cómo saber que ese dial no cuenta.
- **Dejar que cada módulo de arte declare sus colores y unificar «cuando duela».**
  Descartado por el contraejemplo de #351: cuando duele, ya hay cuatro.

## Decisión

1. **Arte procedural en el cliente y cero binarios en el repositorio.**
2. **Los colores viven solo en `paleta.mjs`**, con la frontera vivo/registrado, y
   una prueba falla si otro módulo de arte declara un color propio.
3. **El ornamento no puede abrir por detrás la lectura falsa que la superficie
   cierra por delante.** Aplicaciones ya en el árbol:
   - el marco del mapa vivo va **alrededor** del visor y apaga tics y rosa
     (#526), mientras la lámina completa sigue siendo el registro de serie para
     el resto del módulo;
   - **ninguna señal en el suelo** —ni líneas guía ni flechas— porque una marca
     que parezca indicar por dónde ir afirma algo que nadie ha decidido (#552);
   - **nada legible en la piel de los muros**: un dial pintado sería una medida
     que nadie ha calculado, y lo que hay detrás de una escotilla tampoco se
     declara (#548/#551);
   - la pantalla de una consola va **encendida y vacía** (#557): un monitor
     iluminado no afirma nada, uno con un gráfico afirma una lectura inventada —
     y es la infracción más creíble posible, porque una consola es el único sitio
     donde un dato tendría sentido;
   - sin telemetría, una ventana al espacio baja una **persiana** (#541): un
     cielo de estrellas quietas afirmaría que no hay nada ahí fuera.
4. **Una luminaria ilumina, no señala** (#555): va en `LUZ_CALIDA` y no en el
   turquesa que marca lo accionable, que no se gasta en adornos.

El corolario general: una superficie de ambiente puede ser todo lo rica que
quepa en el presupuesto; una superficie **con lectura** solo admite ornamento que
no pueda confundirse con lectura.

## Consecuencias

### Positivas

- El repositorio no engorda, y el módulo se distribuye como texto.
- El tinte de alerta sale de `paleta.mjs` aunque lo pinte FXMaster: la
  dependencia opcional no se lleva el color con ella.
- Cada superficie nueva con lectura llega con la pregunta ya hecha.
- El presupuesto de fotograma se mide y se escribe en la cabecera del módulo
  (`nave-mural-pixel.mjs` lleva la serie 20–86 → … → 894–1173), en vez de
  negociarse por PR.

### Negativas

- Hay efectos que sencillamente no se van a poder hacer, y no por falta de
  tiempo. Se acepta.
- Escribir el arte cuesta más que instalarlo. El pixelart de #548–#552 son varios
  módulos donde otro proyecto pondría una textura.
- La prueba de color es sintáctica: detecta `#rrggbb`, `rgb()` y `hsl()` en las
  tres comillas, no un color calculado a mano. Es una guarda, no una demostración.

## Implementación y evidencia

Guardas en CI (`.github/workflows/foundry-module.yml`):

- `foundry-module/tests/paleta.test.mjs` — «ningún módulo de arte esconde un
  color propio», y «cada par que porta información llega al mínimo de WCAG».
- `foundry-module/tests/mapa-marco.test.mjs` — «el marco no dibuja tics de limbo:
  sobre el mapa serían una escala que nadie ha calculado», «el marco no dibuja la
  rosa de los vientos: sería una marcación inventada», «no declara ni un color
  propio: la tinta sale de paleta.mjs (#351)» y «las opciones de tics y rosa
  siguen ENCENDIDAS por defecto para el resto del módulo».
- `foundry-module/tests/museo-escena.test.mjs` — «compone una escena con
  polígonos y sin colarse ningún color de fuera de MUSEO».

## Criterios de revisión

El punto 3 no caduca. Los puntos 1 y 2 se revisarían si el módulo alguna vez
distribuye assets por un canal aparte del repositorio — que sería un ADR nuevo, y
tendría que resolver antes la licencia (ADR-0013) y el peso.

---

## Referencias

- `docs/ECOSISTEMA_MODULOS_FOUNDRY.md` — descartes de JB2A, sequencer, TokenMagic.
- [ADR-0013](0013-frontera-de-licencias-y-procedencia.md) — la mitad de licencia.
- Issues #351, #354, #362, #526, #541, #548, #550, #551, #552, #555, #556, #557.
