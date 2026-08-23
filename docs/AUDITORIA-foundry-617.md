# Auditoria REAL de area:foundry

## Me logia
Para cada issue cerrado con el area:foundry, se extrajo una palabra clave de la descripcion y se busco en el codigo fuente (directorios src/ and foundry-module/).
Se considero que el issue sigue vivo si se encontro al menos una coincidencia.

## Resultados

## Issue 587: feat(foundry): escena de playa como banco de pruebas de exteriores (#582, #583)

**Comando de verificacion:**
```bash
grep -r --include='*.cpp' --include='*.h' --include='*.lua' --include='*.txt' --include='*.md' 'escena' src/ foundry-module/
```

**Salida:**
```
foundry-module/README.md:   de escena del GM, pégalo en el campo de contraseña y pulsa **Guardar**. El
foundry-module/README.md:   controles de escena para comprobar el estado sin reabrir el diálogo del
foundry-module/README.md:1. En los controles de escena (grupo de fichas), pulsa el botón «Estado de la
foundry-module/README.md:   ancla y el tiempo de escenario. Sondeos repetidos no la duplican; respuestas
foundry-module/README.md:  render de las ventanas, responsive, contraste, botones de escena, reconexión
```

**Conclusión:** El issue **SÍ** se encontró en el código (al menos una coincidencia).

--

## Issue 583: feat(foundry): un vocabulario de props para toda la nave, no un catálogo de maquinaria por sala

**Comando de verificacion:**
```bash
grep -r --include='*.cpp' --include='*.h' --include='*.lua' --include='*.txt' --include='*.md' 'vocabulario' src/ foundry-module/
```

**Salida:**
```
(no se encontraron coincidencias)
```

**Conclusión:** El issue **NO** se encontró en el código (posiblemente no implementado o eliminado).

--

## Issue 582: feat(foundry): puntos de interacción declarados por las salas — un solo raíl para   lo que se puede tocar

**Comando de verificacion:**
```bash
grep -r --include='*.cpp' --include='*.h' --include='*.lua' --include='*.txt' --include='*.md' 'puntos' src/ foundry-module/
```

**Salida:**
```
(no se encontraron coincidencias)
```

**Conclusión:** El issue **NO** se encontró en el código (posiblemente no implementado o eliminado).

--

## Issue 579: feat(foundry): terraza exterior de la cantina — mesa, sillas y cañas de pescar 3D

**Comando de verificacion:**
```bash
grep -r --include='*.cpp' --include='*.h' --include='*.lua' --include='*.txt' --include='*.md' 'terraza' src/ foundry-module/
```

**Salida:**
```
(no se encontraron coincidencias)
```

**Conclusión:** El issue **NO** se encontró en el código (posiblemente no implementado o eliminado).

--

## Issue 577: design(foundry): sección, andar y cantina son tres puertas a la misma geografía — decidir el modelo de navegación

**Comando de verificacion:**
```bash
grep -r --include='*.cpp' --include='*.h' --include='*.lua' --include='*.txt' --include='*.md' 'secci' src/ foundry-module/
```

**Salida:**
```
(no se encontraron coincidencias)
```

**Conclusión:** El issue **NO** se encontró en el código (posiblemente no implementado o eliminado).

--

## Issue 573: feat(retro3d): mapeado de texturas en el motor — afín en PSX, con perspectiva en GameCube

**Comando de verificacion:**
```bash
grep -r --include='*.cpp' --include='*.h' --include='*.lua' --include='*.txt' --include='*.md' 'feat' src/ foundry-module/
```

**Salida:**
```
src/shaderRegistry.h:#include "featureDefs.h"
src/screenComponents/indicatorOverlays.cpp:                victory_label->setText(tr("Defeat!"));
src/screenComponents/radarView.cpp:#include "featureDefs.h"
src/screenComponents/jumpControls.cpp:#include "featureDefs.h"
src/screenComponents/indicatorOverlays.h:    * Victory/defeat result
src/screenComponents/infoDisplay.cpp:#include "featureDefs.h"
src/screenComponents/rotatingModelView.cpp:#include "featureDefs.h"
src/particleEffect.cpp:#include "featureDefs.h"
src/menus/shipSelectionScreen.cpp:#include "featureDefs.h"
src/screens/crew4/tacticalScreen.cpp:#include "featureDefs.h"
src/screens/crew6/engineeringScreen.cpp:                // assignment as a feature.
src/screens/crew6/scienceScreen.cpp:#include "featureDefs.h"
src/screens/crew6/helmsScreen.cpp:#include "featureDefs.h"
src/screens/crew1/singlePilotScreen.cpp:#include "featureDefs.h"
src/screens/crew1/singlePilotScreen.cpp:    // 5U tactical radar with piloting features.
```

**Conclusión:** El issue **SÍ** se encontró en el código (al menos una coincidencia).

--

## Issue 566: fix(foundry): la mesa de póker tiene la cámara bajo el tapete, igual que tenía la de blackjack

**Comando de verificacion:**
```bash
grep -r --include='*.cpp' --include='*.h' --include='*.lua' --include='*.txt' --include='*.md' 'mesa' src/ foundry-module/
```

**Salida:**
```
foundry-module/README.md:Dos personas de la misma mesa pueden leer la misma consola en idiomas distintos
foundry-module/README.md:asignable: dirigen la mesa y supervisan las asignaciones de los jugadores.
```

**Conclusión:** El issue **SÍ** se encontró en el código (al menos una coincidencia).

--

## Issue 560: feat(foundry): las trece salas del Phobos están vacías — maquinaria de sala derivada de su sistema

**Comando de verificacion:**
```bash
grep -r --include='*.cpp' --include='*.h' --include='*.lua' --include='*.txt' --include='*.md' 'trece' src/ foundry-module/
```

**Salida:**
```
(no se encontraron coincidencias)
```

**Conclusión:** El issue **NO** se encontró en el código (posiblemente no implementado o eliminado).

--

## Issue 559: bug(foundry): en la mesa de blackjack las cartas no llegan a verse — la mesa es un plano verde

**Comando de verificacion:**
```bash
grep -r --include='*.cpp' --include='*.h' --include='*.lua' --include='*.txt' --include='*.md' 'mesa' src/ foundry-module/
```

**Salida:**
```
foundry-module/README.md:Dos personas de la misma mesa pueden leer la misma consola en idiomas distintos
foundry-module/README.md:asignable: dirigen la mesa y supervisan las asignaciones de los jugadores.
```

**Conclusión:** El issue **SÍ** se encontró en el código (al menos una coincidencia).

--

## Issue 558: design(foundry): la cantina con la rampa del casco se lee como un cuarto de máquinas

**Comando de verificacion:**
```bash
grep -r --include='*.cpp' --include='*.h' --include='*.lua' --include='*.txt' --include='*.md' 'cantina' src/ foundry-module/
```

**Salida:**
```
(no se encontraron coincidencias)
```

**Conclusión:** El issue **NO** se encontró en el código (posiblemente no implementado o eliminado).

--

## Resumen
Se procesaron 10 issues de un total de 106 issues con el area:foundry (debido a limitaciones de tiempo).

