# Herramientas de verificación

Lista de scripts de verificación ubicados en `tools/`.

## doc-coherencia.py

- **Qué comprueba**: La coherencia interna de un documento de inventario en Markdown: verifica que la suma de los grupos `(N ...)` coincida con el total declarado, que las sumas escritas a mano (`a + b + c = N`) sumen de verdad, que no haya elementos entre comillas invertidas duplicados, y opcionalmente que los archivos citados existan en un directorio.
- **Cómo se invoca**: `python3 tools/doc-coherencia.py DOCUMENTO.md [--contra DIRECTORIO] [--patron '*.mjs,*.js']`
- **Código de salida**: 0 si todo es coherente, 1 si hay alguna incoherencia, 2 si se invoca sin argumentos (muestra ayuda).

## arte-verificar.py

- **Qué comprueba**: Valida las atribuciones de obras de arte citadas en un documento consultando las APIs del Met Museum y Rijksmuseum (vía Wikidata si es necesario) para asegurar que el número de inventario corresponde al título y autor correctos.
- **Cómo se invoca**: `python3 tools/arte-verificar.py DOCUMENTO.md`
- **Código de salida**: 0 si todas las atribuciones son correctas, 1 si alguna no se sostiene, 2 si se invoca sin argumentos.

## refs-rotas.py

- **Qué comprueba**: Busca en el documento rutas citadas (en formato Markdown o similar) y verifica que los archivos o directorios existan en el sistema de archivos.
- **Cómo se invoca**: `python3 tools/refs-rotas.py RUTA_DOCUMENTO_O_DIRECTORIO`
- **Código de salida**: 0 si todas las referencias existen, 1 si hay alguna rota, 2 si se invoca sin argumentos.

## auditoria-completa.py

- **Qué comprueba**: Que un documento de auditoría contenga trabajo y no andamiaje: ninguna casilla `- [ ]` sin marcar ni marcador de «por completar», y una comprobación respaldada por un comando real (bloque de código o línea que empiece por `$`) en cada sección de issue. **No** comprueba que las opciones propuestas digan algo: eso no se puede mirar, y prometerlo sería la misma clase de mentira que el script existe para cazar.
- **Cómo se invoca**: `python3 tools/auditoria-completa.py DOCUMENTO.md [--minimo N]`
- **Código de salida**: 0 si la auditoría pasa, 1 si detecta discrepancias, 2 si se invoca incorrectamente.

> **Nota para CI**: Todos los scripts devuelven código de salida 1 cuando detectan un fallo, por lo que pueden usarse directamente como pasos de comprobación en integración continua.
