# Cómo conectar módulos cosmográficos

Este documento explica cómo conectar y configurar los módulos cosmográficos dentro del proyecto.

## Requisitos previos

- Tener instalado el motor de renderizado 3D (Three.js o similar).
- Tener los assets cosmográficos disponibles (modelos, texturas, shaders).

## Pasos de integración

1. Copiar los módulos en la carpeta `src/modules/cosmograficos/`.
2. Registrar el módulo en el sistema de plugins mediante `registerCosmographicModule()`.
3. Configurar los parámetros de escala y posición en el archivo de configuración `config/cosmographic.json`.
4. Inicializar el módulo en el bucle de renderizado llamando a `module.init(scene, camera)`.
5. Asegurarse de que los shaders se compilen correctamente; revisar la consola para errores de WebGL.

## Ejemplo de uso

```javascript
import { CosmographicModule } from './modules/cosmograficos/CosmographicModule.js';

const module = new CosmographicModule();
module.loadAssets('path/to/assets/');
scene.add(module.getObject3D());
```

## Solución de problemas

- Si el módulo no se ve, verifique que la cámara esté apuntando a la posición correcta.
- Revise los logs de Three.js para advertencias de materiales faltantes.
- Asegúrese de que los archivos de textura tengan potencia de dos dimensiones.

