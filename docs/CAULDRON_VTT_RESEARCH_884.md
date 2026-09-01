# Investigación: Recursos de Cauldron VTT y ecosistema físico 3D standalone

> **Issue de origen:** [#884](https://github.com/VaroTv7/espaciokooplagunak/issues/884).  
> **Área:** Investigación de arquitectura, licencias y diseño para interacción física 3D standalone (#868).  
> **Objetivo:** Analizar qué recursos de Cauldron VTT y su ecosistema aportan valor real para el objetivo **standalone** de Espaciokoop Lagunak, sin Foundry como dependencia de ejecución, con verificación estricta de licencias.

---

## 1. Clarificación de partida: ¿Qué es (y qué no es) Cauldron VTT?

Existe una confusión habitual en la comunidad de VTTs respecto al término **Cauldron**:

1. **Cauldron VTT (`cauldron-vtt.net`, repositorio en GitLab `hsleisink/cauldron`)**:
   - Es una **aplicación web virtual tabletop completa, independiente y standalone** desarrollada en PHP 8, JavaScript puro y MySQL/SQLite por Hugo Leisink.
   - **No es un módulo de Foundry VTT**.
   - Su filosofía de diseño es deliberadamente **minimalista, ligera y 2D plana** (evitando gráficos 3D pesados o WebGL complejo para maximizar accesibilidad y rendimiento en navegadores modestos).
2. **Cauldron of Plentiful Resources (CPR / Chris's Premades)**:
   - Colección de automatizaciones dnd5e para Foundry VTT (dependiente de `midi-qol`). No tiene relación con interacción 3D ni físicas.
3. **Experimentos 3D de Castle.xyz / Godot VTT**:
   - Prototipos de físicas 3D e interacción espacial en plataformas independientes.

**La oportunidad real para Espaciokoop Lagunak:**  
Cauldron VTT resulta de alto interés no por tener un motor 3D (que no lo tiene), sino porque es **uno de los pocos VTTs web modernos licenciados bajo GNU GPL v2.0 or later**. Su arquitectura standalone resuelve problemas de gestión de estado, cálculo de visibilidad/oclusión (raycasting 2D), parsing de mecánicas de juego y modelos de datos SRD 5.1 con **cero dependencia de Foundry VTT**, en plena compatibilidad de licencia con nuestro núcleo GPL-2.0.

---

## 2. Áreas de análisis técnico

### 2.1. Interacción física 3D y físicas ligeras (click, agarre, arrastre, colisiones)

- **Situación en Cauldron VTT**: La interacción física en Cauldron se limita a eventos 2D de ratón (`mousedown`, `mousemove`, `mouseup` sobre `<canvas>`), arrastre de tokens sobre rejilla y cálculo de intersección de segmentos para puertas y muros. No cuenta con simulación de cuerpos rígidos ni espacio tridimensional.
- **Solución standalone para Espaciokoop Lagunak**:
  - Para `retro3d.mjs` y las escenas andables (cubierta, cantina, playa), la interacción 3D requiere raycasting desde la cámara al plano o colisionadores del objeto (AABB / esferas / cajas orientadas).
  - La física ligera de props (tirar dados 3D en cubilete #413, empujar cajas o soltar objetos en el suelo) no debe importar un motor pesado en C++ ni binarios WASM no auditables.
  - **Candidato óptimo**: **`cannon-es`** (código puro JS, licencia MIT, ejecutable en Node.js para tests deterministas sin DOM) o **`rapier3d`** para simulaciones más avanzadas.

### 2.2. Recursos de assets del catálogo de Cauldron

- **Situación en Cauldron VTT**: Cauldron incluye iconos SVG/PNG para estados y hechizos, así como datos de criaturas y objetos del SRD 5.1.
- **Filtro de arte del proyecto (`CLAUDE.md`, `ASSETS_LIBRES.md`, #351)**:
  - Espaciokoop Lagunak mantiene la doctrina de **arte procedural en cliente, cero binarios en el repo** y paleta indexada retro.
  - Los mapas y tokens rasterizados de Cauldron **no se importan** como ficheros de imagen.
  - Las estructuras de datos vectoriales y definiciones de geometría de mapas (coordenadas de muros, oclusores y vanos) sí son directamente convertibles a definiciones procedurales `{vertices, caras}` de `escena-primitivas.mjs`.

### 2.3. Mecánica "objeto → opciones → resolución → efecto" (#868)

- **Situación en Cauldron VTT**:
  - Cauldron implementa un patrón donde un elemento interactivo (como una puerta u obstáculo) tiene un estado (`open`, `closed`, `locked`), expone opciones contextuales al jugador/GM y resuelve la mutación emitiendo un diferencial de estado que actualiza la niebla de guerra y los polígonos de visión.
- **Aplicabilidad en Espaciokoop Lagunak**:
  - Encaja punto por punto con el contrato standalone de #868 (`interaccion-objeto.mjs` y `resolucion-interaccion.mjs`).
  - Permite resolver interacciones completas (como el vertical del *terminal deteriorado*) en módulos puros de JavaScript sin que existan `Actor`, `Item` ni hooks de Foundry.

### 2.4. Contratos de API y adaptadores reutilizables

- **Modelo de eventos y sincronización**: Cauldron utiliza un protocolo JSON ligero mediante peticiones AJAX periódicas / Server-Sent Events (SSE).
- **Adaptación**: El puente HTTP/WebSocket de Espaciokoop Lagunak (`bridge/`) y la difusión no autoritativa de telemetría pueden adoptar el esquema de diffs de estado de Cauldron para sincronizar cambios físicos y estados de props en clientes remotos.

---

## 3. Matriz de Licencias y Compatibilidad Legal

El proyecto Espaciokoop Lagunak se distribuye bajo **GNU GPL-2.0** ([`LICENSE`](../LICENSE)).

| Licencia del recurso | Compatibilidad con Espaciokoop Lagunak | Regla de uso |
|---|---|---|
| **GPL-2.0-or-later** (Cauldron VTT) | **Totalmente compatible** | Se puede fusionar código, portar algoritmos y adaptar directamente con atribución. |
| **MIT / BSD 2-Clause / BSD 3-Clause** (`cannon-es`, OIF) | **Totalmente compatible** | Se puede incorporar código o consumir como dependencia en el árbol GPL-2.0. |
| **Apache-2.0** (`rapier3d`) | **Incompatible para mezclar código en GPL-2.0** | No se puede fusionar código fuente directamente en repos GPL-2.0; solo admisible como runtime aislado / microservicio o referencia de diseño. |
| **CC-BY-4.0 / OGL 1.0a** (Datos SRD) | **Compatible para datos/reglas** | Datos de texto con atribución. No mezcla código. |
| **CC BY-NC / Licencias propietarias** | **Incompatible** | Descarte absoluto. |

---

## 4. Tabla de Evaluación de Recursos (Mínimo 6 evaluados)

| # | Recurso / Componente | URL Oficial | Licencia Verificada | Qué aporta al objetivo Standalone | Modo de Consumo | Riesgo Legal |
|---|---|---|---|---|---|---|
| 1 | **Cauldron VTT Core & State Engine** | [gitlab.com/hsleisink/cauldron](https://gitlab.com/hsleisink/cauldron) | **GPL-2.0-or-later** (verificado en `LICENSE`) | Arquitectura VTT ligera sin dependencias de Foundry. Modelo cliente-servidor para control de estado de objetos interactivos y niebla de guerra. | **Adaptador / Port** de algoritmos JS | **Nulo** (Misma licencia GPL-2.0) |
| 2 | **Cauldron LOS & Raycasting 2D** | [gitlab.com/hsleisink/cauldron/.../canvas.js](https://gitlab.com/hsleisink/cauldron/-/blob/master/public/js/canvas.js) | **GPL-2.0-or-later** (verificado) | Intersección analítica de rayos y polígonos de oclusión 2D para puertas, ventanas y mamparos. Ligero y testeable en Node. | **Port** a módulo puro JS (`vision-oclusion.mjs`) | **Nulo** |
| 3 | **Cauldron Dice Parser & Mechanics** | [gitlab.com/hsleisink/cauldron/.../dice.php](https://gitlab.com/hsleisink/cauldron/-/blob/master/application/libraries/dice.php) | **GPL-2.0-or-later** (verificado) | Parser de expresiones de dados (`NdX+K`), tiradas con ventaja/desventaja y semilla determinista sin usar `Roll` de Foundry. | **Port / Adaptación** a JS puro | **Nulo** |
| 4 | **Cauldron SRD 5.1 Compendium Data** | [gitlab.com/hsleisink/cauldron/.../data](https://gitlab.com/hsleisink/cauldron/-/tree/master/data) | **OGL 1.0a / CC-BY-4.0** | Dataset estructurado de monstruos, objetos y hechizos en JSON/SQL, desacoplado de compendios db de Foundry. | **Referencia** para catálogo offline standalone | **Bajo** (Requiere atribución SRD 5.1 CC-BY) |
| 5 | **cannon-es (3D Physics Engine)** | [github.com/pmndrs/cannon-es](https://github.com/pmndrs/cannon-es) | **MIT** (verificado en `LICENSE`) | Motor de físicas 3D puro en JS (sin WASM): cuerpos rígidos, colisionadores AABB/esferas/cajas, raycasting de click/agarre y gravedad para dados/props. | **Incorporar / Dependencia** en motor standalone | **Nulo** (MIT compatible con GPL-2.0) |
| 6 | **Rapier3D / rapier.js** | [github.com/dimforge/rapier](https://github.com/dimforge/rapier) | **Apache-2.0 / MIT** (dual según build) | Motor de físicas 3D WASM de alto rendimiento con CCD (Continuous Collision Detection) y raycasting avanzado. | **Vigilar / Solo referencia** | **Medio** (Por fricción Apache-2.0/GPLv2 si no se usa build MIT) |
| 7 | **ZotyDev / Objects-Interactions-FX** | [github.com/ZotyDev/objects-interactions-fx](https://github.com/ZotyDev/objects-interactions-fx) | **MIT** (verificado en `LICENSE`) | Patrón declarativo de interacción por etiquetas: "objeto → tags → trigger → efecto/animación". Modelo conceptual para #868. | **Solo referencia** de diseño | **Nulo** |
| 8 | **Godot VTT (Open 3D Spatial VTT)** | [github.com/MadRabbits/Godot-VTT](https://github.com/MadRabbits/Godot-VTT) | **MIT** (verificado en `LICENSE`) | Patrones de interacción espacial 3D: raycast de cursor a malla 3D, agarre/elevación de props y cálculo de colisión con suelo andable. | **Solo referencia** de diseño | **Nulo** |

---

## 5. Recomendaciones Priorizadas

### 1. Incorporar / Portar
- **Motor de resolución de dados y expresiones de Cauldron (GPL-2.0-or-later)**:
  - Portar su lógica de parsing a un módulo puro `dados-expresion.mjs` (Node/Browser) para que la resolución de tiradas y opciones de interacción (#868) funcione sin Foundry.
- **`cannon-es` (MIT) para físicas ligeras 3D**:
  - Usar para la detección de impacto en dados 3D retro (#413) y colisión de props interactivos en la nave 3D. Al ser JS puro, se prueba en `node --test` sin emuladores de navegador.

### 2. Adaptar
- **Algoritmo de oclusión y línea de visión de Cauldron (GPL-2.0-or-later)**:
  - Adaptar para el cálculo de visibilidad top-down en estaciones de navegación y minimapas de la nave.
- **Patrón "Objeto → Tags → Resolución → Estado" (Inspirado en Cauldron y OIF)**:
  - Implementar en el contrato puro de #868 (`interaccion-objeto.mjs`), manteniendo los props de `nave-props.mjs` independientes de cualquier capa de reglas de D&D.

### 3. Vigilar
- **Rapier3D (WASM)**:
  - Mantener bajo vigilancia técnica por si `cannon-es` resultara insuficiente en escenas complejas con múltiples tripulantes andables, verificando siempre que se consuma el paquete dual MIT.

### 4. Descartar
- **Módulos comerciales / cerrados (p.ej. 3D Canvas de theRipper93)**:
  - Descartados como base del proyecto standalone: son de código cerrado/pago, vinculados exclusivamente al runtime de Foundry VTT e incompatibles con la distribución libre.
- **Importación de assets rasterizados 2D de Cauldron**:
  - Descartados por contradecir la disciplina de arte procedural y cero binarios en el repo (`CLAUDE.md`).

---

## 6. Conclusión y Siguiente Paso

Cauldron VTT demuestra que es perfectamente viable construir un VTT completo, determinista y rápido sin la pesada infraestructura de Foundry. Su compatibilidad legal directa (**GPL-2.0-or-later**) lo convierte en una fuente limpia de algoritmos y patrones para el objetivo standalone de Espaciokoop Lagunak.

**Siguiente paso recomendado:**
1. En **#868**, consolidar el contrato `interaccion-objeto.mjs` y `resolucion-interaccion.mjs` apoyándose en el modelo puro y desacoplado validado en esta investigación.
2. Mantener la capa de reglas D&D 5e estrictamente como un adaptador externo opcional (#862), garantizando que el juego resuelva todas sus interacciones físicas y de consola de forma 100% standalone.
