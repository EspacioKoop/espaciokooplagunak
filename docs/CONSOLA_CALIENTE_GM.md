# Consola caliente del GM — especificación de ejecución

- Estado: **ejecutada por completo.** Los pasos 0-4 están en `main`
  (`consola-caliente-v1.mjs`/`consola-caliente-v2.mjs`, `consola-caliente-poll.mjs`)
  y probados en Node (`foundry-module/tests/consola-caliente-{v1,v2,poll}.test.mjs`).
  El paso 5 se resolvió fusionando también V1 (ver
  [Preguntas resueltas](#preguntas-resueltas)). La dirección de arte del RFC
  (marcos como refuerzo estructural, pulso `lagunak-pulse` de acento único) está
  aplicada en `foundry-module/styles/lagunak-consola.css`.
- Issue: [#276](https://github.com/EspacioKoop/espaciokooplagunak/issues/276) (el RFC, con la visión y la
  dirección de arte). Aquí está solo el **cómo**.
- Fase: **3**. Se ejecutó (PR #455, 2026-08-04) antes de que la última casilla
  de salida de Fase 3 (sesión completa en mesa, ver README) estuviera marcada
  — el criterio de aceptación #7 de este documento ("una sesión en mesa no
  pierde capacidad") sigue sin verificarse en mesa real; ver
  [Cuándo](#cuándo-se-ejecuta-esto) para el razonamiento original de la puerta.

El RFC decidió *qué* se fusiona y *por qué*. Lo que faltaba era que el día de
ejecutarlo no hubiera que rediseñar nada: este documento fija el reparto de
pestañas, el bucle de sondeo único, el aislamiento de fallo por pestaña, el orden
de migración y cómo se sabe que salió bien.

## Cuándo se ejecuta esto

**Después de cerrar el criterio de salida de Fase 3**, que sigue con casillas sin
marcar en el README — en particular «probar una sesión completa de *Spelljammer*
con director de juego y varios puestos conectados». Esa casilla es de mesa real y
no la cierra ningún commit.

La razón de la puerta no es ceremonia: este refactor mete bajo un mismo cambio la
maquinaria de sondeo, backoff y revocación que ya ha fallado tres veces (#201 ACK
tardío, #263 ciclo de vida, guardas de generación del mapa). Hacerlo antes de
saber si el relé de órdenes aguanta en mesa es cambiar los cimientos mientras se
comprueba si el edificio se tiene en pie.

Corolario que conviene tener escrito: **si al jugar la sesión aparecen fallos en
ese ciclo de vida, se arreglan ANTES de fusionar, no durante.**

## Lo que hay hoy, medido

| archivo | líneas | bucle propio | guardas de revocación |
|---|---|---|---|
| `estado-nave-app-v1.mjs` | 611 | sí | 25 |
| `estado-nave-app-v2.mjs` | 666 | sí | 25 |
| `mapa-vivo-app-v1.mjs` | 442 | sí | 4 |
| `mapa-vivo-app-v2.mjs` | 460 | sí | 4 |
| **total** | **2 179** | 4 bucles | |

Cada una tiene su `setTimeout`, su `#fallosSeguidos` y su backoff exponencial
acotado, y cada una vuelve a pedir por su cuenta lo mismo:

| ventana | lo que pide en cada vuelta |
|---|---|
| estado de nave | `healthz`, `state`, `scenario`, `events` (+ `encounters` una vez, para el catálogo) |
| mapa vivo | `healthz`, `state` + `contacts` (juntos, para que no se desfasen) |

O sea que con las dos ventanas abiertas —que es el caso normal de una mesa— el
puente recibe **dos `healthz` y dos `state` por ciclo**, con dos backoffs que se
desincronizan en cuanto uno falla.

## La forma de destino

### Una clase por generación, no una para las dos

`main.mjs` elige por `foundry.applications?.api?.ApplicationV2`. La cabecera de
`mapa-vivo-app-v1.mjs` dice que la réplica v11 es «equivalente y **AISLADA**, sin
código compartido — mismo criterio que `EstadoNaveAppV1`», y **esa decisión no se
toca aquí**: el aislamiento v11-contra-moderno es lo que permite mover la rama
moderna sin arriesgar la mesa que hostea en v11.

Por tanto el destino son **dos clases**, `ConsolaCalienteV1` y
`ConsolaCalienteV2`, no una. La fusión que da el ahorro es la de *superficies*
(estado + mapa + encuentros + previsualización), no la de generaciones: cuatro
factorías con cuatro bucles pasan a dos con uno cada una.

Lo que **sí** puede compartirse entre generaciones es lo que ya lo es hoy: los
módulos puros (`ventana-nave.mjs`, `mapa-render.mjs`, `encuentro-control.mjs`,
`proyeccion-puesto.mjs`…). El reparto se mantiene: la clase es cascarón de
Foundry, la decisión vive fuera y con pruebas en Node.

### Pestañas: el patrón que ya existe

`espacio-puesto.hbs` ya resuelve pestañas internas con un solo `PARTS.main` y un
bloque `{{#each tabs}}`. Se copia tal cual — **no** se declara una `PART` por
pestaña. Motivo: con `PARTS` separadas, Foundry rerenderiza partes de forma
independiente y hay que reconciliar foco por parte; el módulo ya pelea eso una vez
(`#focoAConservar`, #227) y no conviene multiplicarlo por cuatro.

Pestañas, en este orden:

| pestaña | de dónde sale | datos que necesita |
|---|---|---|
| Estado | `estado-nave.hbs` | `state`, `scenario`, `events` |
| Mapa | `mapa-vivo.hbs` | `state`, `contacts` |
| Encuentros | ya vive en `estado-nave.hbs` vía `encuentro-control.mjs` | catálogo `encounters` (una vez) |
| Previsualización | rama `isGM` de `station-workspaces.mjs` / `espacio-puesto.hbs` | los mismos que ya usa |

Pausa/tempo y maniobra **no son pestaña**: son controles de cabecera, visibles
desde cualquier pestaña. Son lo que se toca con la escena ardiendo, y esconderlos
detrás de una pestaña es exactamente la fricción que este trabajo venía a quitar.

## El bucle único

Un solo `setTimeout`, un solo `#fallosSeguidos`, una sola guarda de revocación.
Cada vuelta:

1. `healthz` — si falla, no se pide nada más; toda la consola pasa a `error` de
   conexión, que es la única condición **global** legítima: el puente no está.
2. `state` — una vez, compartido por Estado y Mapa. Hoy se pide dos veces.
3. Los extras **por pestaña**, y solo de las pestañas que hoy podrían pintarse:
   `scenario`/`events` para Estado, `contacts` para Mapa.
4. El catálogo `encounters`, una sola vez por sesión, perezoso.

Sobre el punto 3, una decisión que hay que tomar a conciencia y no por descuido:
**pedir los extras de una pestaña que no está a la vista.** Recomendación: pedir
los de la pestaña activa siempre, y los del Mapa también cuando esté oculta *solo
si estuvo activa en este ciclo de vida de la ventana* — el mapa mantiene una
ventana de reproducción (`rotarMuestras`) que se rompe si se queda sin muestras, y
volver a él con un salto es peor que el coste de un `contacts` de más. Estado no
necesita ese trato: se repinta de una foto.

## Aislamiento de fallo por pestaña

Es el criterio que pidió la revisión del RFC y **la parte que más importa de este
documento**, porque no se cumplía ni dentro de una ventana. **El paso 0 ya lo
arregló para el mapa**; lo que sigue describe el defecto tal como estaba, porque
es lo que la consola fusionada tiene que evitar por diseño.

Cada ventana tenía **un** campo `conexion` (`"ok" | "error" | "conectando"`)
para todo su contenido. Y en `mapa-vivo-app-v{1,2}` las dos peticiones iban en un
`Promise.allSettled` cuyo primer rechazo se relanzaba —un `all` con pasos de
más—:

```js
const resultados = await Promise.allSettled([cliente.state(), cliente.contacts()]);
const rechazado = resultados.find((r) => r.status === "rejected");
if (rechazado) throw rechazado.reason;
```

Es decir: **si `contacts` fallaba, se tiraba también un `state` que llegó bien**, y
la ventana entera quedaba en error. Con dos superficies eso es molesto; con cuatro
pestañas colgando del mismo bucle sería inaceptable —un endpoint caído apagaría la
consola de dirección al completo, con la escena en marcha—.

Regla, entonces:

- **`conexion` global solo la fija `healthz`.** Es la única señal que de verdad
  dice «no hay puente».
- **Cada pestaña tiene su propio estado de datos**: `ok`, `sin-datos` o `error`,
  con su propio motivo. Una pestaña en error se pinta con su aviso dentro de su
  panel y **no** toca a las demás.
- **Un dato que llegó bien se usa**, aunque su compañero de vuelta fallase. El
  `allSettled` se aprovecha en vez de anularse.
- **El backoff es del bucle, no de la pestaña.** Un `contacts` que falla no debe
  frenar el sondeo de estado; lo que ralentiza el ciclo entero es `healthz`.
- La pestaña activa que entra en error **no cambia de pestaña sola**. Un salto
  automático con la escena en marcha le mueve la interfaz al GM debajo del ratón.

En el mapa esto se aplicó primero (paso 0), en un módulo aparte: la ventana
publica `contactosCaidos` y la plantilla lo dice con palabras en vez de dejar un
mapa vacío que parece «no hay nadie ahí fuera». La fusión (pasos 1-5) aplicó la
misma regla al resto de pestañas: cada una tiene su propio estado de datos y un
fallo no toca a las demás. Desde #536 esa regla tiene UNA sola copia, la de
`consola-caliente-poll.mjs` (`dependeDeState`), que además no tumba la vuelta
entera cuando falla `state`: solo las pestañas que dependen de él.

## Orden de migración

Cada paso deja el módulo utilizable y se puede mergear solo.

- **Paso 0 — el `allSettled` que sí aprovecha lo que llegó. HECHO.** La decisión
  vive en `consola-caliente-poll.mjs` (puro, probado en Node) y la aplican las
  dos generaciones; la ventana publica `contactosCaidos` y la plantilla lo dice con
  palabras. Un `contacts` caído ya no tira el `state` que llegó bien, no vacía la
  nave propia, no arranca el backoff del ciclo y no se rellena con contactos
  viejos. No requería la puerta de Fase 3 y no la ha tocado.
- **Paso 1 — extraer el bucle a un módulo puro. HECHO** (`consola-caliente-poll.mjs`,
  probado en Node).
- **Paso 2 — fusionar Estado + Mapa. HECHO** en `ConsolaCalienteV2`.
- **Paso 3 — absorber Encuentros como pestaña. HECHO.**
- **Paso 4 — migrar la previsualización por puesto. HECHO**; `station-workspaces.mjs`
  ya no bifurca por rol para esa selección de puesto.
- **Paso 5 — replicar en V1. HECHO** (`consola-caliente-v1.mjs`): se fusionó
  también V1 en vez de congelarlo (ver
  [Preguntas resueltas](#preguntas-resueltas)); las cuatro factorías sueltas y
  sus plantillas se retiraron.

Todos los pasos están en `main` (PR #455). Lo único que ninguno de ellos cierra
es el criterio de aceptación #7 (mesa real), que sigue pendiente de playtest.

## Lo que NO cambia

Se mantienen tal cual los descartes del RFC, y conviene releerlos antes de tocar
nada:

- **La credencial del puente (`token-puente.hbs`) sigue aislada**, en las dos
  superficies y sin excepción. `bridge-token-session.mjs` la mantiene solo en
  memoria; fundirla en un panel de config por ahorrar un botón amplía la
  superficie de exposición del secreto. No se negocia aquí.
- **El setup frío** (asignación de puestos y, en su día, permisos de #268) no
  entra como pestaña. Es pre-sesión y se hace una vez; sería una pestaña muerta en
  la superficie que más se usa.
- **`espacio-puesto.hbs` queda fuera de la fusión, siempre.**
- **El mapa vivo agregado del GM no entra nunca en la consola de tripulación.**

Sobre por qué `espacio-puesto` queda fuera, la premisa del RFC hay que corregirla
otra vez —ya se corrigió una y ha vuelto a moverse—:

- El RFC citaba `ship = isGM ? statePayload?.ship : null`. Esa línea no existe:
  hoy es `const ship = statePayload?.ship ?? null` (`station-workspaces.mjs:331`).
- La corrección posterior dijo que la asimetría eran los contactos, con
  `safeContactsPayload = isGM ? contactsPayload : null`. **Eso también ha
  cambiado**: hoy la tripulación no recibe `null` sino una lectura *degradada*
  (`station-workspaces.mjs:341-343`), tras #331 paso 3.

La conclusión aguanta las dos correcciones, y por un motivo más fuerte que
cualquiera de las dos versiones anteriores: lo que separa las superficies no es
que la tripulación vea *menos*, es que **ve otra cosa** —lo que su radar alcanza,
degradado por distancia y salud de sensores—. Eso no es una rama de permisos que
se pueda fusionar; es otro producto de datos.

## Criterios de aceptación

Ninguno de estos exige mesa real salvo el último.

1. Con el puente caído, la consola pinta un único aviso de conexión y **ninguna
   pestaña** inventa datos viejos como si fueran frescos.
2. Con `contacts` fallando y `state` respondiendo, la pestaña Estado sigue
   **completamente operativa** y solo Mapa muestra su aviso.
3. Pausa, tempo y maniobra siguen alcanzables **sin cambiar de pestaña**.
4. El puente recibe **un** `healthz` y **un** `state` por ciclo con la consola
   abierta, medido en el log del puente. Hoy son dos de cada.
5. Revocar el acceso del puente mientras la consola sondea no deja ningún
   `setTimeout` vivo (la regresión de #263, ahora con un solo bucle que vigilar).
6. El foco de teclado no salta al cambiar de pestaña ni durante un sondeo que
   repinta (la regresión de #227).
7. Una sesión en mesa con la consola fusionada no pierde ninguna capacidad que el
   GM tuviera con las ventanas sueltas.

## Preguntas resueltas

- **¿V1 se fusiona o se congela?** (paso 5). **Fusionado.** Decisión de producto
  explícita: ambas generaciones se fusionan, aisladas entre sí (nada de clase o
  mixin compartido, solo los módulos puros que ya compartían las cuatro
  factorías) — `scripts/consola-caliente-v1.mjs` replica el mismo cuerpo de
  clase que `consola-caliente-v2.mjs` sobre `Application` clásica en vez de
  `ApplicationV2`.
- **¿La consola caliente recuerda la pestaña activa entre sesiones?** No: arranca
  siempre en Estado. Decisión de producto explícita del encargo original.
- **¿Qué pasa con las dos ventanas actuales tras el paso 2?** Se retiraron: los
  botones de escena de estado/mapa sueltos y las cuatro factorías que abrían
  (`estado-nave-app-v{1,2}.mjs`, `mapa-vivo-app-v{1,2}.mjs`) ya no existen. Un
  único botón (`lagunak-consola`) abre la consola fusionada, con instancia
  perezosa reutilizada al reabrir.
