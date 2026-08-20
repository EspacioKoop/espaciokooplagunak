# Plan para Conectar los Módulos Cosmográficos en Clave Standalone-First

## Objetivo

Este plan tiene como objetivo conectar los cinco módulos cosmográficos existentes en `foundry-module/scripts` de manera que sean útiles y funcionales, siguiendo el principio de **standalone-first** definido en ADR-0008. Esto significa que cualquier funcionalidad propuesta debe ser jugable incluso si Foundry desaparece.

## Módulos a Conectar

1. **catalogo-cosmografico.mjs**: Valida un formato de atlas (planos, sistemas estelares y planetas) con procedencia y licencia por entrada. Es puro y no depende de Foundry, DOM, ni red.

2. **atlas-hyg.mjs**: Adapta el catálogo estelar HYG al formato de atlas definido en `catalogo-cosmografico.mjs`. También es puro y no depende de Foundry.

3. **horizonte-preset.mjs**: Proporciona el horizonte prerenderizado en PNG. Es el primer binario del repositorio y se utiliza para garantizar la reproducibilidad y la consistencia visual.

4. **audio-ficheros.mjs**: Reproduce ficheros de audio, complementando la síntesis de música procedural. Este módulo es crucial para efectos de sonido y ambientes.

5. **nave-movimiento-sala-prueba.mjs**: Proporciona salas de prueba para el motor de movimiento y colisión. Es puro y no depende de Foundry.

## Análisis de ADR-0008

El ADR-0008 establece que la autoridad de campaña (progreso, personajes, atlas, misiones y consecuencias) pertenece al núcleo de Espaciokoop Lagunak. Foundry deja de ser autoritativo y pasa a ser una integración opcional. Esto significa que cualquier funcionalidad nueva debe ser jugable sin Foundry.

## Plan de Conexión

### 1. **Integración del Catálogo Cosmográfico con el Atlas HYG**

- **Objetivo**: Conectar `catalogo-cosmografico.mjs` con `atlas-hyg.mjs` para que el atlas generado por HYG sea validado y utilizado por el catálogo.
- **Acciones**:
  - Asegurar que el formato de salida de `atlas-hyg.mjs` sea compatible con el validador de `catalogo-cosmografico.mjs`.
  - Crear pruebas automatizadas que verifiquen la integración entre ambos módulos.
  - Documentar el flujo de datos desde la generación del atlas hasta su validación.

### 2. **Uso del Horizonte Prerenderizado**

- **Objetivo**: Utilizar el horizonte prerenderizado en `horizonte-preset.mjs` para mejorar la experiencia visual en las salas de prueba y en la navegación.
- **Acciones**:
  - Integrar el horizonte prerenderizado en las salas de prueba definidas en `nave-movimiento-sala-prueba.mjs`.
  - Asegurar que el horizonte sea consistente y reproducible, siguiendo el principio de reproducibilidad definido en el módulo.
  - Documentar cómo se genera y utiliza el horizonte prerenderizado.

### 3. **Integración de Audio**

- **Objetivo**: Utilizar `audio-ficheros.mjs` para añadir efectos de sonido y ambientes a las salas de prueba y a la navegación.
- **Acciones**:
  - Definir un catálogo de sonidos para las salas de prueba y la navegación.
  - Integrar el reproductor de audio en las salas de prueba para proporcionar feedback auditivo.
  - Asegurar que los sonidos sean reproducibles y que su procedencia esté claramente documentada.

### 4. **Salas de Prueba para Navegación y Movimientos**

- **Objetivo**: Utilizar `nave-movimiento-sala-prueba.mjs` para probar y validar el motor de movimiento y colisión.
- **Acciones**:
  - Asegurar que las salas de prueba sean utilizables sin Foundry.
  - Integrar el horizonte prerenderizado y los efectos de sonido en las salas de prueba.
  - Documentar cómo se utilizan las salas de prueba para validar el motor de movimiento.

### 5. **Documentación y Pruebas**

- **Objetivo**: Documentar todo el proceso de integración y crear pruebas automatizadas para garantizar la funcionalidad.
- **Acciones**:
  - Crear documentación detallada sobre cómo se integran los módulos y cómo se utilizan en conjunto.
  - Escribir pruebas automatizadas que verifiquen la funcionalidad de cada módulo y su integración.
  - Asegurar que todas las pruebas sean reproducibles y que no dependan de Foundry.

## Conclusión

Este plan propone una integración gradual y documentada de los módulos cosmográficos, asegurando que cada paso sea compatible con el principio de **standalone-first**. La documentación y las pruebas automatizadas serán clave para garantizar la funcionalidad y la reproducibilidad de la integración.

-- Ilargi · hermes-review