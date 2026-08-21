# Investigación de proyectos open source y fuentes de dominio público aprovechables

Este documento lista proyectos open source, bibliotecas, assets y otras fuentes de dominio público que podrían ser aprovechados en el proyecto Espaciokoop Lagunak, ya sea como inspiración, como dependencias directas o como sources de assets libres.

## Categorías

1. **Motores y frameworks de juego**
2. **Bibliotecas de utilidades y helpers**
3. **Assets de arte, audio y modelos 3D (CC0, dominio público)**
4. **Herramientas de desarrollo y pipelines**
5. **Proyectos de referencia o similares (espacial, simulación, narrativos)**

---

### 1. Motores y frameworks de juego

- **Godot Engine** (MIT): Motor de juego 2D/3D completo. Podría ser útil para comparar arquitecturas o incluso exportar escenas/animaciones si se decide usar Godot para ciertos assets.
  - URL: https://godotengine.org/
  - Licencia: MIT

- **Three.js** (MIT): Biblioteca JavaScript para 3D en el navegador. Ya se usa en partes del proyecto (probablemente). Investigar si hay extensions o ejemplos útiles.
  - URL: https://threejs.org/
  - Licencia: MIT

- **Babylon.js** (Apache 2.0): Otro motor 3D para web.
  - URL: https://www.babylonjs.com/
  - Licencia: Apache 2.0

- **PixiJS** (MIT): Para renderizado 2D rápido, útil si se necesita más potencia en la capa de UI o efectos visuales.
  - URL: https://pixijs.com/
  - Licencia: MIT

### 2. Bibliotecas de utilidades y helpers

- **Lodash** (MIT): Utilidades de JavaScript para manejo de objetos, arrays, etc.
  - URL: https://lodash.com/
  - Licencia: MIT

- **Date-fns** (MIT): Manejo de fechas.
  - URL: https://date-fns.org/
  - Licencia: MIT

- **Chance.js** (MIT): Generador de datos aleatorios (names, traits, etc.) útil para generación procedural de contenido.
  - URL: https://chancejs.com/
  - Licencia: MIT

- **Seedrandom** (MIT): Generadores de números aleatorios semillados, importante para reproducibilidad en simulaciones.
  - URL: https://github.com/davidbau/seedrandom
  - Licencia: MIT

### 3. Assets de arte, audio y modelos 3D (CC0, dominio público)

- **OpenGameArt.org**: Repositorio masivo de assets bajo diversas licencias libres (CC0, CC BY, etc.). Buscar por categoria: 2D sprites, 3D models, music, sound effects.
  - URL: https://opengameart.org/
  - Licencia: Varia (filtrar por CC0/dominio público)

- **Kenney.nl**: Gran cantidad de assets (2D, 3D, audio, UI) bajo dominio público (CC0).
  - URL: https://kenney.nl/assets
  - Licencia: CC0

- **Freesound.org**: Banco de sonidos bajo licencias Creative Buscar por CC0 o Attribution.
  - URL: https://freesound.org/
  - Licencia: Varia (CC0 disponible)

- **Sketchfab** (sección de modelos gratuitos): Algunos modelos bajo CC0 o dominio público.
  - URL: https://sketchfab.com/3d-models?features=downloadable&license=0,1,2,3
  - Licencia: Varia

- **Poly Haven** (formerly HDRI Haven): HDRIs, textures y modelos 3D bajo CC0.
  - URL: https://polyhaven.com/
  - Licencia: CC0

- **The Metropolitan Museum of Art Open Access**: Imágenes de dominio público de su colección (arte, artefactos, etc.) útiles como referencia o textures.
  - URL: https://www.metmuseum.org/art/collection
  - Licencia: CC0 (datos y imágenes de dominio público)

- **NASA Images**: Imágenes, modelos y datos de dominio público de la NASA.
  - URL: https://images.nasa.gov/
  - Licencia: Dominio público (works of the US Government)

- **Wikimedia Commons**: Medios bajo diversas licencias, mucha cantidad en dominio público o CC0.
  - URL: https://commons.wikimedia.org/
  - Licencia: Varia (filtrar)

### 4. Herramientas de desarrollo y pipelines

- **TexturePacker** (licencia comercial, pero hay versión gratuita limitada): Para crear atlases de sprites.
  - URL: https://www.codeandweb.com/texturepacker
  - Nota: Evaluar si la versión gratuita basta o buscar alternativas libres.

- **SpriteSheet Packer** (open source): Alternativa libre para empaquetado de sprites.
  - URL: https://github.com/libgdx/libgdx (incluye herramientas) o https://github.com/amdptw/SpriteSheetPacker

- **Audacity** (GPL): Edición de audio libre.
  - URL: https://www.audacityteam.org/
  - Licencia: GPL

- **GIMP** (GPL): Edición de imágenes y creación de textures.
  - URL: https://www.gimp.org/
  - Licencia: GPL

- **Blender** (GPL): Modelado 3D, animación, renderizado. Fundamental para crear o adaptar modelos 3D.
  - URL: https://www.blender.org/
  - Licencia: GPL

### 5. Proyectos de referencia o similares

- **PULSAR: Lost Colony** (el sucesor espiritual mencionado en el roadmap): Juego cooperativo de nave espacial. Estudiar su diseño de puestos y mecánicas.
  - URL: https://store.steampowered.com/app/304930/PULSAR_Lost_Colony/
  - Nota: No es open source, pero sirve de referencia de diseño.

- **Artemis SBS** (Artemis Spaceship Bridge Simulator): Juego de puentes de nave espacial. Código parcialmente abierto?
  - URL: https://artemis.eochu.com/
  - Licencia: Algunas partes bajo licencias específicas, pero vale la pena inspeccionar.

- **EmptyEpsilon**: Simulador de puente de nave espacial open source (GPL).
  - URL: https://emptyepsilon.com/
  - Licencia: GPL

- **FTL: Faster Than Light** (no open source, pero muy influyente en el género de nave espacial con gestión de tripulación).
  - URL: https://www.ftlgame.com/
  - Nota: Solo como referencia de diseño de eventos y puestos.

- **Space Engineers**: Juego de construcción y simulación nave espacial (no open source, pero tiene un amplio ecosistema de mods).
  - URL: https://www.spaceengineersgame.com/

- **Celestia**: Simulador de vuelo espacial en tiempo real open source (GPL).
  - URL: https://celestia.space/
  - Licencia: GPL

- **OpenSpace**: Software de visualización interactiva del universo abierto (MIT).
  - URL: https://www.openspaceproject.com/
  - Licencia: MIT

- **NASA's Eyes**: Visualizaciones interactivas de misiones espaciales (algunos componentes abiertos).
  - URL: https://eyes.nasa.gov/

---

## Qué haría falta para poder usarlos

Para cada categoría, identificar los pasos necesarios:

1. **Motores y frameworks**:
   - Evaluar compatibilidad con el stack actual (JavaScript, Foundry VTT, etc.).
   - Si se trata de solo inspiración o extracción de conceptos, no se necesita integración.
   - Si se considera usar como dependencia (ej. Three.js para ciertos renders), añadir vía npm o script y asegurarse de que no entre en conflicto con el entorno de Foundry.

2. **Bibliotecas de utilidades**:
   - Instalar vía npm o yarn y agregarlas al `package.json` del proyecto (si existe) o al entorno de Foundry mediante algún mecanismo de carga (por ejemplo, incluir en el archivo principal o usar un bundler si se adopta).
   - Verificar tamaño y impacto en el tiempo de carga.

3. **Assets**:
   - Descargar y verificar licencias (guardar copia de la licencia o URL de origen).
   - Convertir o adaptar al estilo del proyecto (paleta, resolución, formato).
   - Integrar en el flujo de importación de assets (si existe) o documentar el proceso manual.
   - Considerar crear un pipeline de verificación de licencias en CI.

4. **Herramientas de desarrollo**:
   - Instalar localmente (no afecta al producto final).
   - Documentar su uso en el README o en una guía de contribuidores.
   - Si se generan assets con ellas, asegurar que los outputs sean compatibles con el proyecto.

5. **Proyectos de referencia**:
   - Estudiar documentación, videos de juego, postmortems, etc.
   - Extraer lecciones de diseño que puedan aplicarse (por ejemplo, cómo manejan la coordinación de puestos, eventos, progresión).
   - Posiblemente crear un documento de "lecciones aprendidas" para el equipo.

## Próximos pasos

- Crear una lista de candidatos específicos por necesidad actual del proyecto (por ejemplo, si se necesita un sistema de partículas, buscar bibliotecas de partículas ligeras).
- Para cada candidato, hacer una prueba de concepto pequeña (PoC) para validar integración y licencia.
- Mantener esta investigación como documento vivo, actualizándola periódicamente.
- Considerar crear un archivo `THIRDPARTY.yml` o similar que registre todas las dependencias de terceros y sus licencias para cumplimiento.

