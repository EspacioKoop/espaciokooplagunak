# Investigación: Recursos de Cauldron VTT y ecosistema físico 3D standalone

> **Issue de origen:** [#884](https://github.com/EspacioKoop/espaciokooplagunak/issues/884).
> **Área:** Investigación de arquitectura, licencias y diseño para interacción física 3D standalone (#868).
> **Objetivo:** Analizar qué recursos de Cauldron VTT y de su ecosistema comparativo aportan valor real para el objetivo **standalone** de Espaciokoop Lagunak, sin Foundry como dependencia de ejecución, con verificación estricta de licencias.
> **Commit de referencia fijado:** [`e7217c10a45916d703d962a894c8902f6e1c2402`](https://gitlab.com/hsleisink/cauldron/-/tree/e7217c10a45916d703d962a894c8902f6e1c2402) del repositorio `hsleisink/cauldron` en GitLab. Todos los enlaces de código de Cauldron en este documento apuntan a ese commit exacto, no a `master`, para que sigan resolviendo aunque el repositorio avance.

---

## 0. Nota de revisión (2026-09-08)

Este documento fue revisado tras `CHANGES_REQUESTED` de VaroTv7 y de Odiseo (GPT-5.6 Luna) sobre una versión anterior que:

- citaba rutas de Cauldron (`public/js/canvas.js`, `application/libraries/dice.php`, `data/`) que no existen en el árbol real del repositorio;
- describía el transporte de Cauldron como "AJAX periódicas / SSE" cuando su propio README declara un websocket sobre PHP + MySQL;
- acreditaba Rapier como licencia dual "Apache-2.0 / MIT" sin evidencia, y sin fijar paquete/versión concreta;
- enlazaba un repositorio de Godot VTT inexistente (`MadRabbits/Godot-VTT`, 404);
- presentaba capacidades de `cannon-es`, Rapier, Objects-Interactions-FX y "Godot VTT" mezcladas con las de Cauldron, como si fueran hallazgos de un mismo proyecto;
- aplicaba una regla de compatibilidad GPL uniforme sin distinguir entre copiar código, enlazar una dependencia, incorporar datos, portar un algoritmo o usar algo solo como referencia conceptual.

Esta versión corrige los cinco puntos verificando cada ruta/afirmación contra el árbol real del commit fijado (vía la API de GitLab) y contra el registro de npm/GitHub de cada dependencia externa, y separa explícitamente **Cauldron** (§1–§2) del **ecosistema comparado** (§3).

---

## 1. Clarificación de partida: ¿Qué es (y qué no es) Cauldron VTT?

Existe una confusión habitual en la comunidad de VTTs respecto al término **Cauldron**:

1. **Cauldron VTT (`cauldron-vtt.net`, repositorio en GitLab `hsleisink/cauldron`)**:
   - Es una **aplicación web virtual tabletop completa, independiente y standalone**, escrita en PHP y JavaScript, con **MySQL** como almacén de datos de partida y **un websocket para la comunicación cliente-a-cliente** ([`README.md` en el commit fijado](https://gitlab.com/hsleisink/cauldron/-/blob/e7217c10a45916d703d962a894c8902f6e1c2402/README.md)).
   - **No es un módulo de Foundry VTT**.
   - Su filosofía de diseño es deliberadamente **minimalista, ligera y 2D plana** (evitando gráficos 3D pesados o WebGL complejo para maximizar accesibilidad y rendimiento en navegadores modestos).
2. **Cauldron of Plentiful Resources (CPR / Chris's Premades)**:
   - Colección de automatizaciones dnd5e para Foundry VTT (dependiente de `midi-qol`). No tiene relación con interacción 3D ni físicas, ni con el proyecto anterior más allá del nombre.
3. **Experimentos 3D de terceros (`cannon-es`, Rapier, Objects-Interactions-FX, prototipos "Godot VTT")**:
   - Herramientas y prototipos **no relacionados con Cauldron VTT**, evaluados en la §3 como ecosistema comparativo porque tocan la misma necesidad (interacción/físicas 3D), no porque compartan código o arquitectura con Cauldron.

**La oportunidad real para Espaciokoop Lagunak:**
Cauldron VTT resulta de interés no por tener un motor 3D (que no lo tiene: es 2D sobre DOM/canvas), sino porque es un VTT web standalone licenciado bajo **GNU GPL-2.0-or-later**, con **cero dependencia de Foundry VTT**, en plena compatibilidad de licencia con nuestro núcleo GPL-2.0. Lo aprovechable de Cauldron es su **modelo de estado de objetos interactivos** (puertas, muros, niebla de guerra) y su elección de un **motor de dados de terceros** para tiradas 3D — no un motor de físicas o raycasting 3D propio, que no tiene.

---

## 2. Áreas de análisis técnico (Cauldron VTT exclusivamente)

### 2.1. Modelo de estado de objetos interactivos (puertas, muros, niebla de guerra)

- **Situación verificada en Cauldron VTT**: el cliente ([`public/js/spectate.js`](https://gitlab.com/hsleisink/cauldron/-/blob/e7217c10a45916d703d962a894c8902f6e1c2402/public/js/spectate.js)) modela muros y puertas como elementos DOM con atributos de posición, dirección y estado (`door_show_closed`, `wall_position`, atributo `transparent="yes"` para ventanas) y mantiene una capa `LAYER_FOG_OF_WAR` sobre el mapa. Es un modelo de **estado por objeto sincronizado por websocket**, no un motor de raycasting geométrico: no se ha encontrado en el árbol del commit fijado ningún cálculo analítico de intersección de rayos o polígonos de visión — la clase `canvas.js` citada en una versión anterior de este documento **no existe** en el repositorio.
- **Solución standalone para Espaciokoop Lagunak**:
  - Lo transferible es el **patrón de estado** (`open` / `closed` / `locked`, ventana vs. muro opaco) para `interaccion-objeto.mjs` (#868), no un algoritmo de LOS: si Espaciokoop Lagunak necesita oclusión/raycasting real para las escenas andables (cubierta, cantina, playa), debe seguir resolviéndolo con geometría propia (`retro3d.mjs`), sin base en Cauldron.
  - La física ligera de props (tirar dados 3D en cubilete #413, empujar cajas o soltar objetos en el suelo) no debe importar un motor pesado en C++ ni binarios WASM no auditables; ver §3.1 para las opciones evaluadas como **ecosistema externo**, no como parte de Cauldron.

### 2.2. Tiradas de dados: Cauldron no implementa su propio motor 3D

- **Situación verificada**: el cliente de Cauldron delega la animación de dados 3D en la librería de terceros **[`3d-dice/dice-box`](https://github.com/3d-dice/dice-box)** (vendorizada en [`public/dice-box/`](https://gitlab.com/hsleisink/cauldron/-/tree/e7217c10a45916d703d962a894c8902f6e1c2402/public/dice-box) del commit fijado, con `dice-box.js` importando `dice-box.es.min.js`). Es decir, la afirmación "parser de dados propio de Cauldron" de una versión anterior de este documento era incorrecta: no existe `application/libraries/dice.php` en el árbol.
- La lógica de reglas por sistema (d20, ventaja/desventaja) vive en [`libraries/rule_systems/*.php`](https://gitlab.com/hsleisink/cauldron/-/tree/e7217c10a45916d703d962a894c8902f6e1c2402/libraries/rule_systems) (un fichero PHP por sistema: `dnd5.php`, `pathfinder2.php`, `sw5e.php`, `cyberpunkred.php`, `daggerheart.php`), acoplada a la infraestructura de PHP de Cauldron (`cauldron.php`, `cauldron_model.php`).
- **Aplicabilidad en Espaciokoop Lagunak**: ninguna directa por herencia de código — `dice-box` es un proyecto MIT independiente que Espaciokoop Lagunak podría evaluar por su cuenta como candidato de renderizado 3D de dados (fuera del alcance de licencia de Cauldron, que es GPL-2.0-or-later solo sobre su propio código). No se recomienda portar los ficheros de `rule_systems/`: son adaptadores de reglas de mesa concretas acoplados al framework PHP de Cauldron, no una biblioteca de mecánica genérica reutilizable.

### 2.3. Datos de criaturas/objetos incluidos en Cauldron: riesgo de licencia, no SRD limpio

- **Situación verificada**: [`public/data/monsters`](https://gitlab.com/hsleisink/cauldron/-/blob/e7217c10a45916d703d962a894c8902f6e1c2402/public/data/monsters) es un JSON con entradas como `{"name":"Aarakocra Aeromancer", ..., "source":"XMM", "page":"10"}`. Los campos `source` citan manuales comerciales completos de Wizards of the Coast (`MM` = Monster Manual, `XMM` = Xanathar's, `SKT`, `LoX`, `BAM`...), **no** el SRD 5.1 en CC-BY-4.0. No hay ningún aviso de licencia SRD/OGL en el propio fichero.
- **Corrección respecto a la versión anterior**: la fila que afirmaba una ruta `data/` bajo licencia "OGL 1.0a / CC-BY-4.0" era doblemente incorrecta — la ruta no existe (es `public/data/monsters` y `public/data/spells`) y el contenido real referencia manuales con copyright de WotC no cubiertos por SRD, por lo que **no** es un dataset seguro para reutilizar ni siquiera como referencia. Se elimina esta fila de la tabla de recursos (§4) y se marca como **riesgo alto / descartado**, no como recurso aprovechable.

### 2.4. Contratos de API y adaptadores reutilizables

- **Modelo de eventos y sincronización verificado**: Cauldron usa **un websocket** para la comunicación cliente-a-cliente sobre una base de PHP + MySQL (README, commit fijado). No hay evidencia de "peticiones AJAX periódicas" ni de Server-Sent Events como mecanismo principal — esa descripción de una versión anterior de este documento no está respaldada por el código ni por la documentación oficial y se retira.
- **Adaptación**: el puente HTTP/WebSocket de Espaciokoop Lagunak (`bridge/`) ya usa WebSocket para la difusión no autoritativa de telemetría; no se identifica en Cauldron ningún esquema de protocolo de diffs de estado suficientemente documentado como para "adoptar" — como mucho, confirma que un websocket simple es una elección de transporte validada por otro VTT standalone del mismo espacio de problema.

---

## 3. Ecosistema comparativo (NO son código ni datos de Cauldron VTT)

Esta sección evalúa herramientas independientes que responden a la misma necesidad (interacción y físicas 3D para #868/#413) pero que **no tienen relación de código, arquitectura ni licencia con Cauldron VTT**. Se listan aparte deliberadamente, para no repetir el error de la versión anterior de atribuir sus capacidades a Cauldron.

### 3.1. Motores de físicas 3D para JS/Node

| Recurso | Licencia verificada | Fuente primaria | Nota |
|---|---|---|---|
| **`cannon-es`** | **MIT** | [`registry.npmjs.org/cannon-es`](https://www.npmjs.com/package/cannon-es) (campo `license`, verificado en el paquete publicado) | JS puro, sin WASM; ejecutable en `node --test` sin DOM. Compatible como dependencia enlazada en un árbol GPL-2.0. |
| **`@dimforge/rapier3d` / `@dimforge/rapier3d-compat`** (paquetes npm, ambos en versión `0.20.0` al momento de esta investigación) | **Apache-2.0** (no dual; verificado en el `package.json` publicado de ambos paquetes y en la `LICENSE` del repositorio [`dimforge/rapier`](https://github.com/dimforge/rapier/blob/master/LICENSE)) | [`registry.npmjs.org/@dimforge/rapier3d`](https://www.npmjs.com/package/@dimforge/rapier3d), [`.../rapier3d-compat`](https://www.npmjs.com/package/@dimforge/rapier3d-compat) | El repositorio histórico `dimforge/rapier.js` está **archivado** (solo lectura) en GitHub; el desarrollo activo es `dimforge/rapier` con bindings JS empaquetados como los dos paquetes anteriores. No hay build "MIT" que consumir: la afirmación de licencia dual de una versión anterior de este documento era incorrecta y se retira. |

**Regla de uso derivada** (no una regla GPL genérica, sino aplicada a cada tipo de consumo — ver también §5):

- `cannon-es` (MIT): consumible como **dependencia enlazada** (`import`/`require`) dentro del árbol GPL-2.0 sin conflicto.
- Rapier (Apache-2.0): Apache-2.0 y GPL-2.0 (estricta, sin "or later") tienen problemas de compatibilidad documentados por la FSF para **combinar código fuente en un mismo binario/proceso bajo GPLv2 puro**. Espaciokoop Lagunak se distribuye como GPL-2.0-or-later (permite "or later"), lo que reduce el conflicto práctico, pero **no se recomienda introducir Rapier como dependencia de runtime** sin que alguien con criterio legal confirme el encaje exacto de versión de GPL declarada por el proyecto. Hasta entonces, vigilancia técnica únicamente (§5).

### 3.2. Patrón de interacción declarativa

| Recurso | Licencia verificada | Fuente primaria |
|---|---|---|
| **Objects-Interactions-FX (ZotyDev)** | **MIT** | [`api.github.com/repos/ZotyDev/objects-interactions-fx`](https://github.com/ZotyDev/objects-interactions-fx) (campo `license`, verificado) |

Aporta un patrón conceptual (`objeto → tags/estado → trigger → efecto`) útil como inspiración de diseño para #868, manteniendo implementación propia — no se copia código, solo se referencia la idea.

### 3.3. "Godot VTT": sin fuente primaria verificable — recurso retirado

Una versión anterior de este documento citaba `github.com/MadRabbits/Godot-VTT` como fuente de patrones de interacción espacial 3D bajo licencia MIT. Ese repositorio **no existe** (404 confirmado contra la API de GitHub) y no se ha localizado un proyecto "Godot VTT" canónico con licencia primaria verificable que sustituya la referencia. Se **retira este recurso** de la investigación en vez de citar un repositorio distinto sin relación demostrada con la afirmación original. Si en el futuro se identifica un proyecto concreto, debe añadirse con su propio enlace primario y licencia verificada, no reintroducirse bajo el mismo nombre genérico.

---

## 4. Tabla de Evaluación de Recursos (6 evaluados con fuente primaria verificable)

| # | Recurso / Componente | Procedencia | URL Oficial (commit/versión fijados) | Licencia Verificada | Qué aporta al objetivo Standalone | Modo de Consumo | Riesgo Legal |
|---|---|---|---|---|---|---|---|
| 1 | **Cauldron VTT (proyecto completo)** | Cauldron | [`gitlab.com/hsleisink/cauldron`](https://gitlab.com/hsleisink/cauldron/-/tree/e7217c10a45916d703d962a894c8902f6e1c2402) @ `e7217c10a4` | **GPL-2.0-or-later** (verificado en `LICENSE` del commit fijado) | Referencia de arquitectura de VTT ligero, standalone, sin Foundry: stack PHP+JS+MySQL+websocket ya en producción. | **Referencia arquitectónica**; no se porta código directamente sin evaluar caso por caso el acoplamiento a PHP. | **Nulo** para código de Cauldron (misma licencia GPL-2.0); el riesgo está en confundirlo con datos ajenos que empaqueta (ver fila 4). |
| 2 | **Modelo de estado de puertas/muros/niebla de Cauldron** | Cauldron | [`public/js/spectate.js`](https://gitlab.com/hsleisink/cauldron/-/blob/e7217c10a45916d703d962a894c8902f6e1c2402/public/js/spectate.js) | **GPL-2.0-or-later** (heredada del proyecto, mismo `LICENSE`) | Patrón de estado por objeto (`open`/`closed`/`locked`, muro vs. ventana transparente) para `interaccion-objeto.mjs` (#868). **No** contiene raycasting ni cálculo geométrico de oclusión. | **Referencia de patrón**, no port literal (el módulo mezcla JS y manipulación jQuery del DOM propia de la arquitectura PHP de Cauldron). | **Nulo** |
| 3 | **`3d-dice/dice-box`** (vendorizado por Cauldron, proyecto de terceros) | Externo, usado por Cauldron | [`github.com/3d-dice/dice-box`](https://github.com/3d-dice/dice-box); vendorizado en [`public/dice-box/`](https://gitlab.com/hsleisink/cauldron/-/tree/e7217c10a45916d703d962a894c8902f6e1c2402/public/dice-box) del commit fijado | **MIT** (licencia del proyecto `3d-dice/dice-box`, independiente de la de Cauldron) | Confirma que un motor de dados 3D en JS puro y MIT es viable para navegador; candidato a evaluar de forma independiente para #413 (dados 3D retro), sin relación de código con Cauldron. | **Evaluar como dependencia independiente**, no como "código de Cauldron". | **Nulo** si se consume el paquete oficial `3d-dice/dice-box` directamente, no la copia vendorizada de Cauldron. |
| 4 | **Datos de monstruos/objetos empaquetados en Cauldron** (`public/data/monsters`, `public/data/spells`) | Empaquetado por Cauldron, contenido de terceros | [`public/data/monsters`](https://gitlab.com/hsleisink/cauldron/-/blob/e7217c10a45916d703d962a894c8902f6e1c2402/public/data/monsters) | **No SRD / origen no claro** — las entradas citan manuales comerciales completos de WotC (`MM`, `XMM`, `SKT`, `LoX`...) sin aviso de licencia SRD/OGL en el fichero | Ninguno recomendable: no es un dataset limpio de reutilizar. | **Descartado.** | **Alto** — no usar como fuente ni como referencia de contenido. |
| 5 | **`cannon-es`** | Externo (ecosistema comparado, no Cauldron) | [`npmjs.com/package/cannon-es`](https://www.npmjs.com/package/cannon-es) | **MIT** (verificado en el paquete publicado) | Motor de físicas 3D puro en JS (sin WASM): cuerpos rígidos, colisionadores AABB/esferas/cajas, para dados/props andables. | **Incorporar / Dependencia** directa si se decide avanzar con físicas 3D en el motor standalone. | **Nulo** (MIT compatible como dependencia enlazada en GPL-2.0). |
| 6 | **`@dimforge/rapier3d` / `rapier3d-compat` (0.20.0)** | Externo (ecosistema comparado, no Cauldron) | [`npmjs.com/package/@dimforge/rapier3d`](https://www.npmjs.com/package/@dimforge/rapier3d) | **Apache-2.0** (no dual; verificado en el paquete publicado y en la `LICENSE` de `dimforge/rapier`) | Motor de físicas 3D WASM de alto rendimiento con CCD y raycasting avanzado, si `cannon-es` resultara insuficiente. | **Vigilar / no introducir todavía** como dependencia de runtime. | **Medio** — Apache-2.0 combinado con un árbol GPL-2.0(-or-later) requiere confirmar el encaje exacto antes de depender de él; ver §3.1. |
| 7 | **Objects-Interactions-FX (ZotyDev)** | Externo (ecosistema comparado, no Cauldron) | [`github.com/ZotyDev/objects-interactions-fx`](https://github.com/ZotyDev/objects-interactions-fx) | **MIT** (verificado) | Patrón declarativo "objeto → tags → trigger → efecto/animación" como inspiración de diseño para #868. | **Solo referencia** de diseño, sin copiar código. | **Nulo** |

Se retira de esta tabla la fila de "Godot VTT" (§3.3: sin fuente primaria verificable) en vez de sustituirla por un recurso sin relación demostrada con la afirmación original.

---

## 5. Matriz de Licencias por Tipo de Uso

Sustituye a la matriz categórica de la versión anterior de este documento, que trataba "compatibilidad de licencia" como una propiedad binaria del recurso. La compatibilidad real depende del **tipo de consumo**: copiar código fuente al árbol, enlazar como dependencia externa, incorporar datos, portar un algoritmo reescribiéndolo, o usar algo solo como referencia conceptual sin copiar nada.

| Recurso / licencia | Copiar código fuente al árbol GPL-2.0 | Enlazar como dependencia (import/require) | Incorporar datos | Portar un algoritmo (reescritura propia) | Referencia conceptual (sin copiar) |
|---|---|---|---|---|---|
| **Cauldron VTT (GPL-2.0-or-later)** | Permitido, con atribución y conservando la nota de copyright original | Permitido | N/A (no hay dataset limpio que incorporar, ver fila 4 de §4) | Permitido | Permitido |
| **`cannon-es` (MIT)** | Permitido (MIT es permisiva) | Permitido, sin restricción práctica | N/A | Permitido | Permitido |
| **Rapier (Apache-2.0)** | **No recomendado** sin confirmación legal expresa del encaje Apache-2.0 / GPL-2.0-or-later para el modo de distribución elegido | Solo tras esa confirmación; mientras tanto, vigilancia (§3.1) | N/A | Evitar re-portar algoritmos completos sin la misma confirmación | Permitido (leer su diseño no exige licencia) |
| **Objects-Interactions-FX (MIT)** | Permitido | Permitido | N/A | Permitido | Permitido |
| **Datos de monstruos/objetos de Cauldron (origen no claro, cita manuales WotC)** | No aplica | No aplica | **No permitido**: no hay licencia SRD/CC-BY que ampare esas entradas | No aplica | No recomendado como referencia de contenido concreto (nombres/estadísticas de manuales con copyright) |

---

## 6. Recomendaciones Priorizadas

### 1. Incorporar / Portar
- **`cannon-es` (MIT) para físicas ligeras 3D**:
  - Evaluar para la detección de impacto en dados 3D retro (#413) y colisión de props interactivos en la nave 3D. Al ser JS puro, se prueba en `node --test` sin emuladores de navegador. Es una dependencia enlazada, no un port de código de Cauldron.

### 2. Adaptar (como patrón, no como código literal)
- **Modelo de estado "objeto interactivo" de Cauldron (puertas/muros/niebla, GPL-2.0-or-later)**:
  - Usar como referencia de diseño para el contrato puro de #868 (`interaccion-objeto.mjs`), manteniendo los props de `nave-props.mjs` independientes de cualquier capa de reglas de D&D. No hay código de raycasting que portar: ese cálculo, si hace falta, se resuelve con geometría propia.
- **Patrón "Objeto → Tags → Resolución → Estado" (inspirado en Objects-Interactions-FX, MIT)**:
  - Implementar en `interaccion-objeto.mjs` sin copiar código, solo la idea del contrato.

### 3. Vigilar
- **Rapier (Apache-2.0)**:
  - Mantener bajo vigilancia técnica por si `cannon-es` resultara insuficiente en escenas complejas con múltiples tripulantes andables, y **antes** de introducirlo como dependencia, confirmar el encaje de licencia exacto (§3.1, §5) — no "verificar que se consuma un build MIT", porque ese build dual no existe.
- **`3d-dice/dice-box` (MIT)**:
  - Candidato independiente a evaluar para renderizado de dados 3D en #413; no tiene relación de código con Cauldron más allá de que Cauldron lo vendoriza tal cual.

### 4. Descartar
- **Módulos comerciales / cerrados (p. ej. 3D Canvas de theRipper93)**:
  - Descartados como base del proyecto standalone: son de código cerrado/pago, vinculados exclusivamente al runtime de Foundry VTT e incompatibles con la distribución libre.
- **Datos de monstruos/objetos empaquetados en Cauldron** (`public/data/monsters`, `public/data/spells`):
  - Descartados: citan manuales comerciales de WotC sin licencia SRD/OGL declarada en el propio dataset (§2.3, §4 fila 4). No usar ni como fuente ni como referencia de contenido concreto.
- **Importación de assets rasterizados 2D de Cauldron**:
  - Descartados por contradecir la disciplina de arte procedural y cero binarios en el repo (`CLAUDE.md`).
- **"Godot VTT" (`MadRabbits/Godot-VTT`)**:
  - Retirado de la investigación por falta de fuente primaria verificable (§3.3).

---

## 7. Conclusión y Siguiente Paso

Cauldron VTT demuestra que es viable construir un VTT standalone determinista sobre PHP + JS + MySQL + websocket sin la infraestructura de Foundry, y su licencia GPL-2.0-or-later es directamente compatible con el núcleo de Espaciokoop Lagunak. Su aporte concreto está en el **patrón de estado de objetos interactivos**, no en algoritmos de físicas o LOS 3D que no implementa. Las piezas de físicas 3D evaluadas (`cannon-es`, Rapier) y el patrón declarativo de Objects-Interactions-FX son hallazgos **independientes de Cauldron**, evaluados porque tocan la misma necesidad de #868/#413.

**Siguiente paso recomendado:**
1. En **#868**, consolidar el contrato `interaccion-objeto.mjs` y `resolucion-interaccion.mjs` apoyándose en el patrón de estado observado en Cauldron y en el patrón tag→trigger→efecto de Objects-Interactions-FX, sin copiar código de ninguno de los dos.
2. Evaluar `cannon-es` como dependencia real para físicas ligeras de props/dados (#413) antes de considerar Rapier, que queda en vigilancia hasta resolver su encaje de licencia exacto.
3. Mantener la capa de reglas D&D 5e estrictamente como un adaptador externo opcional (#862), garantizando que el juego resuelva todas sus interacciones físicas y de consola de forma 100% standalone.
