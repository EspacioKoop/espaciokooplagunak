# Contrato de lectura de respuestas del puente

OTACON Astra — incremento local revisable, sin cambio de autoridad de datos.

## Garantía y alcance

`bridge/app.py::_run_lua` consume la respuesta de `/exec.lua` como stream HTTPX.
Rechaza un estado distinto de 200 antes de leer su cuerpo y deja de consumir el
stream al recibir el primer fragmento que excedería `MAX_GAME_RESPONSE_BYTES`.
Solo acumula hasta 64 KiB de contenido decodificado antes de convertirlo a texto
y analizar JSON. No confía en `Content-Length`. El contexto de respuesta cierra
el stream tanto al terminar como ante exceso de tamaño o error.

Las rutas autenticadas de estado, escenario, eventos, contactos, base científica
y órdenes, y la sonda pública de salud, reutilizan este mismo consumidor. Los
catálogos locales de encuentros y anclas no llaman al juego.

| Garantía | Control vigente | Límite explícito |
|---|---|---|
| No acumular una respuesta completa arbitraria | Lectura incremental y contador previo a `body.extend` | HTTPX y su descompresor pueden materializar un fragmento mayor que el límite antes de entregarlo; no es una cota absoluta de memoria del proceso |
| Rechazo de respuesta excesiva | Contador de bytes decodificados, sin depender de la cabecera | No cancela una orden ya ejecutada por el simulador |
| Liberación de la respuesta | Contexto `client.stream` | No equivale a transacción ni rollback remoto |
| Error público sin contenido del juego | Errores HTTPX y estados/tamaños inválidos se traducen a 502 genérico | No se auditan aquí logs de proxy ni infraestructura |
| Semántica de JSON y charset conservada | Decodificación tras acumular el cuerpo aceptado | No añade esquema de salida por endpoint |

El timeout HTTPX existente de cinco segundos es por operación/inactividad de
transporte, no un plazo total para una respuesta que avance lentamente. Este
incremento no añade límite global de concurrencia, cuota a `/healthz`, política
de compresión ni frontera nueva de permisos. Esos cambios requieren revisión
separada y no deben darse por implementados.

## Regresiones

`bridge/tests/test_run_lua.py` usa `httpx.MockTransport` con un
`AsyncByteStream` instrumentado y datos explícitamente sintéticos:

- límite exacto y byte anterior aceptados;
- exceso corta antes del fragmento posterior, con cabecera ausente o engañosa;
- estado no 200 no consume el cuerpo;
- timeout a mitad de stream cierra y oculta el detalle ficticio;
- gzip se cuenta tras descomprimir, conservando respuestas pequeñas válidas;
- UTF-8 dividido entre fragmentos conserva el texto.

La suite previa mantiene autenticación, CORS, comandos y ejecución de plantillas
Lua con dobles del simulador. Esto no sustituye build Docker, prueba nativa ni
validación en todas las versiones declaradas de dependencias.

```sh
python3 -m pytest bridge/tests -o addopts= -q
```

Rollback: revertir el commit completo, incluyendo la adaptación del doble de
HTTPX en `bridge/tests/conftest.py`. Ningún consumidor cambia su DTO ni su URL.
