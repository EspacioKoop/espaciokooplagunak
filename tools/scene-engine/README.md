# Primera vertical del motor de escena 3D/2D

**OTACON Astra · contribución GPL-2.0 · candidato experimental, no motor definitivo.**

Entrega parcial de [#1003](https://github.com/EspacioKoop/espaciokooplagunak/issues/1003):
un consumidor standalone ejecutable de un contrato anterior a la proyección,
con la **cantina existente completa en su colección `MUEBLES`** y los seis sprites
originales de nave. No es un filtro de pixelado ni una reconstrucción de una
captura. No cierra #1003, no modifica el cliente instalado y no incluye partida,
red, simulación, permisos, Foundry ni el trabajo cosmético #1002.

## Ejecutar y comprobar

Desde la raíz del repositorio, con Node 22 y npm:

```sh
cd tools/scene-engine
npm install --ignore-scripts
node serve.mjs
```

Abrir la URL loopback impresa. Mover giro, inclinación y avance: ambas superficies
comparten cámara. Cerrar/reabrir libera las instancias; un fallo de WebGL no
impide usar el software. No hay bucle de animación permanente: se repinta al
interactuar, redimensionar o recuperar visibilidad/contexto. No hay destellos ni
movimiento automático. Es un visor técnico, no navegación con colisiones.

```sh
npm test
npx playwright install chromium
npm run capture
```

`capture.mjs` arranca su propio servidor en loopback/puerto libre, ejecuta Chromium,
guarda PNG y JSON en `output/` (ignorado) y cierra ambos en `finally`. No necesita
Foundry, credenciales ni servidor de juego. El servidor no admite escrituras,
listados, dotfiles ni archivos de salida. Las capturas del informe contienen
solo arte original del proyecto.

La suite pura también entra en la **CI existente de tools**, mediante
`tools/tests/test_scene_engine.mjs`; no se toca el workflow compartido. La prueba
de navegador se ejecuta localmente con el comando anterior, **no está en CI**.

```sh
# Desde la raíz
node --test tools/tests/test_*.mjs
python3 -m pytest tools/tests -q
```

La segunda suite necesita las dependencias Python que ya declara el workflow
Tools (pytest, polib y PyYAML). No son dependencias del visor.

## Límites de arquitectura, explícitos y ejecutados

```text
cantina-escena.MUEBLES + escena-primitivas.caja + nave-sprite + paleta
                         ↓ content.mjs (adaptación, una vez)
             Scene v1: recursos en espacio de objeto + entidades
                         ↓ render(camera, poses)
          presentación efímera: cámara y overrides de transformaciones
                   ↙                            ↘
      software.mjs                               gpu.mjs
      matrices y proyección CPU                  matrices de objeto + cámara
      componerEscena REAL                        buffers residentes, shader GPU
      pintarEscenaConProfundidad REAL             WebGL2, depth-test/write
      Canvas 2D para atlas de pantalla            pasada ortográfica de atlas
                   ↘                            ↙
            resolución lógica, escala entera, HUD DOM separado
```

- `contract.mjs` no importa motor, contenido, Foundry, DOM, red ni reloj. El
  backend GPU depende solo de ese contrato y Three.js; no importa el proyector
  anterior ni le pasa polígonos de pantalla a la GPU.
- `Scene.version = 1`: IDs, grupos/padres sin ciclos, transformaciones, cámara,
  mallas trianguladas, materiales, atlas y sprites. Coordenadas con **Y arriba y
  cámara neutra hacia +Z**; medidas conservadas del contenido. Rotaciones en
  radianes, orden yaw Y → pitch X → roll Z; escala **uniforme positiva**. El
  adaptador de Three refleja Z en la raíz y adapta la cámara, sin modificar
  recursos originales. La prueba compara el álgebra con `transformar` real.
- `render(camera, poses)` admite overrides completos de transformación por ID de
  mundo, validados y sin mutar la escena. No recibe estado autoritativo ni decide
  acciones. Geometría, materiales, atlas, membresía y layout de pantalla son
  recursos de compilación: para cambiarlos se reconstruye la instancia. No
  presentar este prototipo como un editor caliente de recursos.
- El importador triangula las **caras convexas** de las mallas actuales. Las
  posiciones locales no se proyectan en CPU en el candidato. IDs y colocación
  se conservan; crear otro adaptador no requiere editar `gpu.mjs`.
- Material opaco, color de la paleta, iluminación plana direccional de **16
  escalones** o `unlit`. El cálculo GPU reproduce la fórmula del perfil GameCube
  actual, en valores de color de pantalla (no PBR/lineal físico). Se excluyen
  niebla, focos, sombras y temblor para comparar la misma política en ambos.
  No es paridad completa con `componerCantina`: aquí se importa la colección de
  sala/muebles, no gente, planetas, humo, cachivaches ni toda su composición.
- Profundidad por píxel en **ambas** rutas. La anterior ya tenía z-buffer software:
  no se atribuye su existencia al candidato. Los tests adversos incluyen planos
  que se atraviesan y cambian de ganador entre izquierda y derecha.
- Sprite: atlas RGBA con alfa binaria, rectángulo de frame, pivote normalizado,
  tamaño de téxel, entidad de mundo o pantalla. GPU: nearest, sin mipmaps,
  descarte alfa, depth-write en mundo y pasada ortográfica sin depth en pantalla.
  No hay transparencia mezclada ni billboard automático. Un plano de sprite
  conserva orientación en el mundo.
- El software anterior no descarta alfa en su rasterizador de texturas. El
  adaptador de comparación descompone **solo el sprite de mundo** en quads de
  téxeles opacos, y reutiliza su proyector/rasterizador. Esto añade coste CPU; se
  declara en la comparación, no se oculta como coste universal del motor viejo.
  El atlas de pantalla usa `drawImage` nearest. Su RGBA se compara byte a byte
  contra la salida GPU en navegador.
- Resolución lógica 320×180, con banda de muestras 2D de 40 píxeles. Escala entera
  calculada en píxeles CSS, centrado con bandas; si no cabe, **recorte a 1×**
  declarado en UI, no escalado fraccional. `logicalPoint` invierte esa operación.
  La evidencia usa DPR 1; el alineamiento con píxel físico en DPR fraccional o
  zoom de navegador queda como gate de dispositivo, no como garantía probada.
- HUD y controles HTML accesibles fuera del búfer lógico: los textos no se
  pixelan. No se altera la frontera PIXEL/TINTA de `paleta.mjs`.

El contrato valida los formatos soportados, **no es una frontera de seguridad
para UGC remoto**: solo consume módulos versionados de confianza. No hay URLs de
assets, shaders enviados por usuarios, código GM, Bearer, `/exec.lua`, sockets,
API de simulación ni escrituras de campaña.

## Elección provisional de dependencia

| Candidato       | Ventaja para este vertical                                                              | Coste o límite                                                                                                                                                  |
| --------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Three.js        | WebGL2, BufferGeometry, cámaras, materiales y ciclo de recursos; conserva contenido ESM | Instrumentación y políticas de presentación propias; no trae un juego/editor completo                                                                           |
| Babylon.js      | TransformNode, instrumentación y herramientas de escena documentadas                    | Más superficie de engine de la necesaria en este primer adaptador; licencia Apache-2.0 exige revisar su encaje antes de distribuir un runtime combinado GPL-2.0 |
| Software actual | Ya operativo, pequeño, referencia real y rollback                                       | Proyección/rasterización por CPU; no desaparece por introducir WebGL                                                                                            |

Se elige **Three.js 0.185.1 exclusivamente para el experimento**, no se afirma que
gane a Babylon en velocidad: **no se ha implementado un benchmark Babylon**.
No se introduce una dependencia en el módulo Foundry ni en la aplicación C++.
Godot sigue siendo alternativa de cliente de alcance mayor, no evaluada aquí.

Comprobaciones de suministro efectuadas: metadatos npm de la versión exacta y
LICENSE del paquete instalado. Three.js usa MIT, copyright © 2010–2026 three.js
authors; al redistribuir su código hay que conservar su aviso. El código propio
mantiene GPL-2.0 y no reclama autoría de EmptyEpsilon ni de contenido previo.
Playwright **1.58.2** es dependencia de desarrollo (Apache-2.0); su paquete depende
de `playwright-core` 1.58.2. No se redistribuyen navegador ni `node_modules`.

Los dos pins están en `package.json`. La base actual ignora/prohíbe registrar
`package-lock.json`; no se cambia esa guarda compartida, ocupada por #929.
La instalación genera un lock **local**. Si se adopta el candidato más allá del
experimento, acordar el lock de herramientas antes de empaquetar/distribuir.

Integridad npm comprobada de Three 0.185.1 (SHA-512 SRI):

```text
sha512-5aojFCXKwnjBRZvUnt3WFfEcvUJgkN5LlijRFN95hMy8WVkG4I0QNcJE+OuWvuJ0bOdStrbfXn0pkd6/QyiAlg==
```

Fuentes primarias consultadas:

- [Three WebGLRenderer: WebGL2, info, dispose y contexto](https://threejs.org/docs/pages/WebGLRenderer.html).
- [Licencia Three.js](https://github.com/mrdoob/three.js/blob/r185/LICENSE).
- [Metadatos exactos npm](https://registry.npmjs.org/three/0.185.1).
- [Babylon: matrices, culling, contexto e instrumentación](https://doc.babylonjs.com/features/featuresDeepDive/scene/optimize_your_scene/).
- [Babylon: licencia](https://github.com/BabylonJS/Babylon.js/blob/master/license.md).

## Coordinación y siguiente migración

Área: **Herramientas (`tools/**`)**, ya cubierta por el mapa de áreas. Se ha
inventariado la cola completa antes de elegir rutas. No se editan los archivos
de renderer, luces, rig, catálogo, paleta, Foundry ni workflows de PR concurrentes.
El único archivo fuera de este directorio es el punto de entrada de tests Node.

[#976](https://github.com/EspacioKoop/espaciokooplagunak/issues/976) sigue abierto:
en la base de esta entrega no está integrado su banco ni el paquete de #929.
Se reutilizan su método (ESM real, cámara reproducible, captura Playwright y
aserciones numéricas) y los módulos productivos; **no se duplica un pintor**.
Este consumidor prueba el contrato nuevo, no sustituye sus controles de avatar,
épocas o animación ni cierra su aceptación. Cuando su banco se integre, puede
importar estos backends en vez de copiar el harness.

Siguientes verticales, pendientes de acuerdo y evidencia:

1. Una superficie texturada existente y exterior: UV/materiales, niebla,
   selección por ID y presupuesto de buffers; comparar con sus módulos reales.
2. Rig/animación y frame de atlas como presentación dinámica; aprovechar los
   contratos en curso, no portar otra vez el trabajo concurrente.
3. Smoke GPU físico y browsers objetivo; DPR/zoom, coste frío, memoria real,
   raycast y colisiones de cámara. `preserveDrawingBuffer` está activado para
   capturas y tiene un coste que deberá reevaluarse en un cliente.
4. Solo después: adaptador standalone con autoridad por jugador, persistencia,
   reconexión y dos clientes. Foundry v11/host moderno y cliente C++ requieren
   smokes propios; ninguna compatibilidad de esas rutas cambia en este PR.

Rollback: no abrir este consumidor o retirar este directorio y su entrada de
tests. Ninguna ruta productiva lo importa. `dispose` libera recursos GPU y atlas
de instancia; los caches internos compartidos del rasterizador antiguo no se
modifican. No se promete mantener dos motores completos indefinidamente.

## Evidencia real

Ver [EVIDENCE.md](EVIDENCE.md): imágenes A/B, resultados crudos, comandos, coste
y límites. **Un navegador con SwiftShader no certifica rendimiento de GPU física
ni una partida standalone integrada.**
