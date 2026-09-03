# Inventario del API HTTP heredado

Estado del servidor HTTP embebido que EmptyEpsilon activa con la preferencia
`httpserver=<puerto>`. Este inventario cumple el punto de la Fase 2 del
roadmap («inventariar el API HTTP heredado») y fundamenta el diseño del
puente ([`bridge/`](../../bridge/), [`FOUNDRY.md`](../FOUNDRY.md)).

Código fuente: `src/httpScriptAccess.cpp` (clase `EEHttpServer`, servidor de
`sp::io::http::Server` de SeriousProton). Inventario por inspección de código
(2026-07-12); el comportamiento de los tres endpoints está además confirmado
en vivo contra un servidor headless local — véase la sección «Seguridad
obligatoria» de [`FOUNDRY.md`](../FOUNDRY.md) (PR #9).

## Endpoints

| Ruta | Método | Estado real | Comportamiento |
|---|---|---|---|
| `/exec.lua` | POST | **Funcional y peligroso** | Ejecuta el cuerpo de la petición como Lua dentro del entorno del escenario y devuelve el resultado como texto. Sin autenticación, sin límites, sin lista blanca. |
| `/get.lua` | GET | **No implementado** | Todo el cuerpo está comentado como `TODO`; responde literalmente `TODO`. |
| `/set.lua` | GET | **No implementado** | Ídem: responde `TODO`. |
| `/` y resto de rutas | GET | Funcional | Sirve archivos estáticos del directorio `www/` (`www_directory`), pensado para las pantallas web (`index.html`, jQuery). |

## Propiedades relevantes

- **Sin autenticación de ningún tipo.** Cualquiera con acceso TCP al puerto
  ejecuta Lua con los mismos privilegios que el escenario: crear/destruir
  naves, terminar la partida, leer estado completo.
- **Sin TLS.** Todo viaja en claro.
- **Sin límites** de frecuencia, tamaño o tiempo de ejecución por petición
  (el entorno Lua del escenario es compartido; un bucle infinito congela la
  simulación).
- El propio juego lo avisa al arrancar: `NOTE: This is potentially a risk!`
  (`src/main.cpp`).
- Los errores de script se devuelven al cliente con el mensaje de Lua, lo
  que puede filtrar detalles internos del escenario.

## Consecuencias para este fork

1. `/exec.lua` **nunca se publica** fuera de la red interna de compose
   (`docker/compose.yaml` no mapea el puerto 8080 al host).
2. Todo acceso externo pasa por el puente, que solo admite operaciones de
   una lista blanca tipada y nunca reenvía Lua del cliente
   ([`bridge/README.md`](../../bridge/README.md)).
3. `/get.lua` y `/set.lua` no se usan como base: están vacíos en upstream y,
   aunque se completaran, su diseño (funciones Lua en la query string) sigue
   siendo ejecución remota de código con otra sintaxis.
4. Un contrato propio y versionado (v0 ya en el puente, v1 en diseño) es el
   único API que verá el módulo de Foundry VTT.

## Relación con upstream

Este archivo describe código heredado de EmptyEpsilon sin modificarlo. Si en
una sincronización de upstream (`UPSTREAM.md`) cambia
`src/httpScriptAccess.cpp`, hay que revisar este inventario y el puente.
