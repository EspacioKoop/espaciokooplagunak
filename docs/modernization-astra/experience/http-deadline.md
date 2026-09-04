# Plazo completo del cliente HTTP — OTACON Astra

Primera mejora de fiabilidad de la auditoría de experiencia, relacionada con el
lifecycle de [#1003](https://github.com/EspacioKoop/espaciokooplagunak/issues/1003).
No es una migración GPU ni completa el rediseño 3D/2D.

## Defecto y consumidor real

`BridgeClient.#request` cancelaba el temporizador al recibir las **cabeceras**.
`response.json()` se ejecutaba después, sin plazo. Un servidor que empieza a
responder y no termina el JSON puede bloquear indefinidamente diagnóstico,
sondeo y confirmaciones de órdenes aunque `timeoutMs` esté configurado.

No es un helper nuevo sin consumidor: las consolas clásica y moderna esperan
`healthz()` y después `Promise.allSettled` sobre las lecturas; el diagnóstico
espera `healthz()` antes de autorizar su siguiente petición. Una única respuesta
incompleta impide que ese ciclo alcance la resolución de estado/backoff.

## Cambio acotado

El mismo `AbortController` y temporizador permanecen vivos hasta que termina
`response.json()`. Un aborto al leer el cuerpo se clasifica como `timeout`, no
como JSON inválido. HTTP, JSON inválido y fallo de transporte conservan sus
categorías. `finally` libera el temporizador en todas las salidas.

No cambia endpoints, DTO, permisos, token, traducciones, renderer, contenido ni
manifest. No añade reintentos: una orden cuyo resultado no se recibió puede
haberse ejecutado en el servidor. El timeout no prueba rollback de la orden.

## Verificación

La regresión importa el cliente productivo y usa un servidor HTTP efímero en
loopback con `fetch` real de Node. El servidor entrega cabeceras y un prefijo de
JSON inmediatamente, y completa el cuerpo al segundo como salida de seguridad;
el plazo del cliente es 400 ms. Se comprueban:

- GET `state`: aborto durante el cuerpo, error saneado y recuperación posterior.
- POST `setPause`: mismo plazo, una sola petición y ningún reintento implícito.
- Consumidor `probarConexion`: `healthz` incompleto acaba en `inaccesible`, sin
  enviar una petición autenticada posterior.
- Clasificación conservada para HTTP 403, JSON inválido y error de transporte.

```sh
node --test --test-concurrency=1 foundry-module/tests/bridge-client.test.mjs
```

Contra el código base, las tres regresiones de cuerpo tardío fallan; con la
corrección pasan. La suite completa del dominio también se ejecuta en serie.
La evidencia cruda y la cobertura por archivo permanecen en el control privado
de la auditoría, no en el paquete distribuido.

## Límites y rollback

Prueba de transporte Node y pruebas con dobles de Application clásica/V2, **no
smoke Foundry real ni navegador**. Se mantienen v11.302 + dnd5e 2.3.1 como fila
clásica y el host moderno como fila pendiente de prueba licenciada. No se amplía
`compatibility.verified`.

El aborto depende del contrato estándar de Fetch; un `fetchImpl` inyectado que
ignore AbortSignal no queda acotado por este mecanismo. El temporizador tampoco
preempta trabajo síncrono de parseo JSON en el hilo principal. No se promete
mejora de FPS ni se mide GPU.

No cambia el aspecto visual; no hay capturas A/B ni maqueta sustitutiva.
Rollback: revertir únicamente este commit local. Antes de publicar, revisar otra
vez archivos de PR abiertas y ejecutar las pruebas sobre la base elegida.

OTACON Astra
