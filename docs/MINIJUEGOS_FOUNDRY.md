# Contrato de minijuegos sociales en Foundry

- Estado: **diseño previo a implementación**
- Issue: [#308](https://github.com/EspacioKoop/espaciokooplagunak/issues/308)
- Primer vertical previsto: **póker de la sala común**

Este documento fija el corte común que debe existir antes de construir el primer
minijuego. No declara que el sistema esté implementado ni cierra el issue.

## Objetivo

Los minijuegos representan la vida social a bordo durante tiempos muertos. Viven
en el módulo Foundry, son opcionales y no modifican la simulación, la campaña ni
los permisos de los puestos. Deben poder reutilizar la misma sesión, sincronía,
accesibilidad y estética con póker, blackjack, dominó u otros verticales.

## Decisiones del primer corte

1. **Marco común mínimo.** Cada juego implementa el mismo ciclo: crear, unirse,
   observar, abandonar, actuar y terminar. No se construye un gestor genérico de
   plugins dinámicos; basta una interfaz interna estable para evitar acoplar todo
   el sistema al póker.
2. **Estado efímero.** Fichas, apuestas y resultados existen solo dentro de la
   sesión social. No conceden créditos, experiencia, objetos ni ventajas de
   campaña y no se pueden convertir en recursos de la nave.
3. **Ventana propia primero.** El vertical inicial se abre desde una acción del
   módulo. Una mesa u holoteca en una escena podrá actuar después como acceso
   diegético a esa misma ventana, sin duplicar motor ni estado.
4. **Foundry es la única autoridad.** El simulador y el puente no reciben datos,
   endpoints u órdenes de minijuegos. Esto respeta ADR-0002 y mantiene intacto
   upstream EmptyEpsilon.
5. **Reductor determinista.** Mismo estado privado inicial y misma secuencia
   válida de acciones producen el mismo resultado. La aleatoriedad se consume a
   través de una semilla creada y conservada solo por el coordinador; el motor no
   llama a `Math.random()` ni incluye la semilla en DTO, flag o evento compartido.
6. **Coordinador único.** El GM primario valida y aplica acciones. Los demás
   clientes proponen acciones mediante un evento de Foundry que vincule la
   identidad en origen (por ejemplo, el patrón existente basado en cambios del
   documento `User`), no mediante un mensaje de socket que declare libremente
   quién lo envía. Nunca se acepta un `userId` incluido por el propio cliente
   como prueba de identidad.

## Contrato de sesión

El estado compartido mínimo es lógica pura y serializable, pero contiene solo la
vista pública de la mesa:

```text
EstadoPublicoSesion {
  version: 1
  id: string
  juego: string
  fase: "lobby" | "en_curso" | "terminada"
  revision: integer >= 0
  epocaCoordinador: integer >= 0
  coordinadorId: string
  anfitrionId: string
  jugadores: [{ userId, asiento, estado }]
  espectadores: [userId]
  checkpointMano: object | null
  juegoPublico: object
  resultado: object | null
}
```

- `id` identifica una mesa, no una campaña ni un mundo.
- `revision` aumenta exactamente una vez por acción aceptada y permite rechazar
  acciones obsoletas o repetidas.
- `coordinadorId` se elige mediante la misma regla determinista de GM primario que
  use el adaptador; solo esa identidad aplica acciones. `epocaCoordinador` cambia
  al sustituirlo e invalida propuestas y respuestas de la época anterior.
- `checkpointMano` conserva únicamente fichas y datos públicos inmediatamente
  anteriores al reparto. Permite cancelar una mano sin reconstruir secretos ni
  adjudicar apuestas incompletas.
- `juegoPublico` contiene solo información que todos los participantes pueden
  conocer. Las manos privadas no forman parte de este estado compartido.
- El motor limita jugadores, espectadores, tamaño de payload y longitud de
  cadenas antes de persistir o retransmitir estado.

El GM coordinador mantiene por separado, y solo en memoria, el estado necesario
para resolver la mano:

```text
EstadoPrivadoCoordinador {
  sessionId: string
  epocaCoordinador: integer
  semilla: integer
  estadoAleatorio: object
  mazo: [carta]
  manos: { userId: [carta] }
  noncesProcesados: colección acotada
}
```

Este objeto puede serializarse dentro de pruebas puras del motor, pero el
adaptador Foundry no lo escribe en Documents, flags, ajustes, sockets de difusión
ni almacenamiento persistente del navegador. Tampoco se deriva desde el estado
público ni se transmite completo a otros clientes.

## Acciones comunes

Todas las acciones contienen `sessionId`, `epocaCoordinador`,
`revisionEsperada`, `tipo` y un `nonce` acotado. El coordinador obtiene el actor
del evento autenticado de Foundry, no del payload. Los nonces se comparan en el
estado privado y no se copian al estado público.

| Acción | Quién puede pedirla | Efecto |
|---|---|---|
| `join` | usuario conectado | ocupa un asiento libre en lobby |
| `watch` | usuario conectado | entra como espectador |
| `leave` | participante | abandona o queda ausente según la fase |
| `start` | anfitrión o GM | inicia si el juego valida el lobby |
| `act` | jugador activo | delega una acción cerrada al motor del juego |
| `finish` | motor o GM | publica el resultado y cierra la sesión |
| `close` | anfitrión o GM | destruye la mesa cuando ya no está en curso |

Una acción inválida devuelve un resultado cerrado (`ok: false`, código estable)
y no modifica estado ni revisión. Repetir el mismo `nonce` del mismo actor dentro
de la época vigente es idempotente.

## Interfaz interna de cada juego

Cada vertical proporciona funciones puras equivalentes a:

```text
crear(configuracion, semilla) -> estadoJuego
vistaPublica(estadoJuego) -> object
vistaPrivada(estadoJuego, userId) -> object
accionesPermitidas(estadoJuego, userId) -> [string]
aplicar(estadoJuego, { actorId, tipo, parametros }) -> resultado
haTerminado(estadoJuego) -> boolean
resultado(estadoJuego) -> object | null
```

`aplicar` devuelve un nuevo estado o un error cerrado; no toca Foundry, red,
DOM, reloj ni almacenamiento. La capa Foundry se ocupa de identidad, revisión,
transporte, vistas y ciclo de vida.

Dos invariantes que `crear` debe hacer cumplir por sí mismo, porque sostienen la
asociación identidad↔asiento de la que dependen las vistas privadas:

- cada asiento lleva un `userId` no vacío y **único** en la mesa; una
  configuración con identidades repetidas se rechaza cerrada, no se acepta a
  medias;
- toda referencia a un asiento en la configuración (por ejemplo el botón) debe
  apuntar a un asiento existente.

Además, un estado recién creado nunca puede quedar sin salida: si la propia
creación deja a todos los participantes sin acción posible, `crear` resuelve la
partida en el acto en vez de devolver un estado sin turno y sin terminar.

## Información privada y límite de seguridad

Una partida de cartas necesita ocultar manos en la interfaz. Sin embargo, el
socket de un módulo Foundry ejecutado en clientes no constituye por sí solo un
canal secreto frente a un participante con herramientas de desarrollo.

Por tanto:

- la UI solo muestra a cada jugador su vista privada y nunca incluye manos en el
  estado público, logs, notificaciones o flags compartidos;
- una vista privada se entrega como mensaje efímero dirigido al `userId`
  autenticado y los demás clientes la descartan; dado que el transporte cliente
  de Foundry no es un canal secreto, esto sigue siendo privacidad de interfaz;
- el proyecto describe esta garantía como **privacidad de interfaz**, no como
  seguridad criptográfica contra jugadores hostiles;
- no se persisten mazo, semilla ni manos privadas en `localStorage`, ajustes del
  módulo o documentos legibles por toda la mesa;
- si una futura prueba exige secreto resistente a inspección, hará falta un
  coordinador servidor o un protocolo criptográfico en un issue independiente.

No se debe vender como «póker competitivo seguro» algo que Foundry solo oculta a
nivel de presentación.

## Desconexión y abandono

- **Lobby:** abandonar libera el asiento inmediatamente.
- **Partida:** una desconexión marca al jugador `ausente`; no transfiere su
  identidad ni revela su mano. El juego define una acción automática segura
  (en póker, retirarse al expirar el turno).
- **Reconexión:** el mismo `userId` recupera asiento y vista; otro usuario no
  puede reclamarlo.
- **Cambio de escena o cierre de ventana:** no equivale a abandonar. La sesión
  sigue y la ventana puede reabrirse.
- **Pérdida del GM coordinador:** la mesa se congela. Si vuelve la misma instancia
  con su estado privado intacto, puede continuar en la misma época. Si la pérdida
  es definitiva, no se intenta reconstruir mazo ni manos desde datos públicos:
  un nuevo GM incrementa `epocaCoordinador`, cancela la mano sin resultado,
  restaura las fichas al checkpoint público anterior al reparto y crea una mano
  nueva con semilla privada nueva. Las acciones pendientes de la época cancelada
  se descartan; nunca avanzan dos coordinadores simultáneamente.
- **Todos ausentes:** la mesa expira tras un plazo acotado y solo fuera de una
  resolución activa. El plazo exacto será configuración del host, no del juego.


**Volver a la mesa.** Abandonar en partida no libera el asiento: lo reserva y
marca al jugador ausente, para que su identidad no la reclame otro. Esa reserva
necesitaba su vuelta, o era una trampa —el asiento seguía siendo suyo y no había
forma de ocuparlo otra vez—, así que existe la acción `return`, que solo se le
ofrece a quien está ausente. La presencia también la lleva el cableado: el
coordinador marca ausente a quien se desconecta y reconecta a quien vuelve, con
`userConnected`. Antes nadie se lo decía al motor, y la mesa esperaba
eternamente a alguien que había cerrado la pestaña.
## Asientos automáticos

Un asiento puede llevarlo la máquina (`controlador: "automatico"`). Los sienta y
los levanta **quien lleva la mesa** —anfitrión o GM coordinador— y solo en lobby:
cambiar la composición a media mano movería el reparto de fichas y el orden de
apuestas de una mano ya en juego.

**Identidad sintética.** Un NPC no es un usuario de Foundry: no tiene documento,
ni socket, ni vista que recibir. Se le da un `userId` con el prefijo `auto:`, que
ningún id de Foundry puede tener, así que no hay forma de confundirlo con una
persona ni de que alguien reclame su asiento. La numeración **no se reutiliza**:
las fichas se arrastran entre manos por identidad, y un `auto:2` nuevo heredaría
el montón del `auto:2` que se levantó.

**Quién juega sus turnos.** El motor no tiene reloj y el agente automático no
sabe de sesiones; los presenta `turnos-automaticos.mjs`, que el coordinador
invoca después de publicar cada jugada humana —primero se ve lo que hizo la
persona, luego la respuesta de la máquina—. Dos reglas lo sostienen: los NPC
pasan por la **misma puerta** que las personas (`aplicar`, con sobre, época y
nonce; no hay atajo que escriba el estado del juego a mano), y la cadena **se
corta siempre**: hay un límite duro de jugadas y cualquier rechazo del motor la
detiene. Sin eso, una política que devolviera una acción inválida colgaría el
navegador de quien lleva la mesa.

La política vive fuera y llega inyectada, así que se puede sustituir por otra
más lista —o por una de otro juego— sin tocar el motor ni la interfaz.

## Espectadores

Los espectadores reciben únicamente `vistaPublica`, no ocupan asiento, no
apuestan y no pueden emitir `act`. Pueden entrar o salir en cualquier fase. El
póker debe seguir siendo legible para ellos: cartas comunitarias, bote, apuestas,
turno y resultado sí son públicos; manos aún activas, no.

## Verticales

El **póker** es el primer vertical y va justo debajo. El segundo son los **dados
de cubilete** (#413), cuyas reglas viven en [MINIJUEGOS_DADOS.md](MINIJUEGOS_DADOS.md):
no repite nada de este contrato porque no le hace falta —la sesión aloja
cualquier juego por su interfaz interna, y eso es exactamente lo que el segundo
vertical demuestra—.

## Primer vertical: póker

El primer corte implementará una sola mesa de Texas Hold'em simplificado:

- 2–6 jugadores y espectadores;
- fichas efímeras iguales al entrar; sin recompras, economía ni premios externos.
  Cada mano arranca con lo que dejó la anterior (`mesa-config.mjs`), no con la
  entrada: repartir de nuevo la entrada sería una recompra encubierta y ganar no
  significaría nada más allá de la mano en curso. Quien se queda a cero sale de
  **la mano, no de la mesa** — sigue sentado y viendo el reparto, porque esta
  capa es social antes que competitiva, pero no se le reponen fichas;
- barajar, ciegas, reparto, rondas, bote y showdown deterministas;
- acciones cerradas: `fold`, `check`, `call`, `raise` con límites explícitos;
- retirada automática al expirar el turno de un jugador ausente;
- resultado público y nueva mano solo por decisión explícita del anfitrión.

Quedan fuera del primer corte torneos, bots, dinero real, chat propio, múltiples
variantes y efectos sobre la campaña.

## El sistema nativo de cartas de Foundry (`Cards`)

Decidido en #340: **el póker no se apoya en `Cards`**. La investigación con el
código de Foundry 13.351 en mano encontró tres choques frontales con este
contrato, y ninguna ventaja que los compense:

- **Determinismo** (decisión 5): `Cards#shuffle()` baraja con el Mersenne
  Twister global de Foundry, sin semilla nuestra. El barajado quedaría fuera del
  reductor.
- **Autoridad** (decisión 6): fuera de los mazos, cualquier cliente puede crear
  cartas directamente en la base de datos del mundo. Nuestro modelo es el
  contrario — el tripulante propone en un flag de su propio `User` y el
  coordinador aplica.
- **Estado efímero** (decisión 2): los `Cards` son documentos del mundo, con
  barra lateral y persistencia entre sesiones.

Y no regala privacidad: no se encontró filtrado por permiso en la lectura, así
que persistir mazo y manos como documentos sería *más* expuesto que mantenerlos
en memoria del coordinador, como hoy.

Sí se toma prestado lo barato, que no toca ninguna decisión del contrato: la
baraja se publica como **preset** en `CONFIG.Cards.presets` para que la mesa
pueda jugar a las cartas fuera del póker, y se adopta la nomenclatura de `Card`
(`suit`, `value`, `faces[].img`) como formato de intercambio.
`foundry-module/scripts/minijuegos/baraja-preset.mjs` hace la traducción;
`tools/generar-baraja-preset.mjs` vuelca el arte a `foundry-module/data/cartas/`
como ficheros `.svg` — no como `data:` URI incrustado, que exigiría apoyarse en
un hueco del saneador del servidor y engordaría la base de datos del mundo. Ese
directorio es **derivado**: se regenera con el comando y una prueba falla si se
edita a mano.

## UI y accesibilidad

- Pixel art propio con backing bajo y `image-rendering: pixelated`, sin assets
  externos ni referencias protegidas.
- Mesa, cartas y fichas se distinguen también por forma, texto y patrón, no solo
  por color.
- Todo el flujo es operable por teclado, con foco visible y orden DOM lógico.
- Estado de turno y errores usan una región `aria-live` sin anunciar animaciones.
- `prefers-reduced-motion` elimina reparto, pulsos y desplazamientos sin ocultar
  información ni ralentizar acciones.
- La vista compacta mantiene controles con objetivo mínimo y no recorta bote,
  turno o acción disponible.
- Textos desde i18n ES/EN; ningún ID interno aparece como etiqueta visible.

## Orden de implementación

1. Motor puro de sesión y contrato común con pruebas de identidad, revisión,
   época, nonces, desconexión, cancelación segura y espectadores.
   **Implementado** en `foundry-module/scripts/minijuegos/sesion-motor.mjs`
   (pruebas: `foundry-module/tests/minijuegos-sesion-motor.test.mjs`). Aloja el
   juego por la interfaz interna de abajo, recibiéndolo como dependencia: no
   importa ningún vertical.
2. Motor puro de póker con vectores deterministas y pruebas de reglas.
3. Adaptador Foundry y vistas pública/privada sin persistir secretos.
   **Implementado** en `foundry-module/scripts/minijuegos/adaptador-sesion.mjs`
   (lógica pura, con pruebas) y `foundry-module/scripts/minijuegos-wiring.mjs`
   (capa fina con globales de Foundry). Transporte: propuesta en un flag del
   propio `User` → `updateUser` en el GM coordinador → estado público en un
   ajuste de mundo, y vistas privadas por socket dirigidas a cada `userId`. La
   sesión viva del coordinador (semilla, mazo, manos) no se persiste en ningún
   sitio: si se pierde, el relevo la cancela con checkpoint.

   **El manifiesto tiene que declarar `"socket": true`.** Sin esa línea el
   servidor de Foundry no retransmite los eventos `module.<id>`: el `emit` sale
   del cliente y muere ahí, sin error en ninguno de los dos extremos. Desde
   dentro es idéntico a un mensaje perdido, y deja la mesa funcionando a medias
   —el estado público llega, porque va por un ajuste de mundo, pero las manos
   privadas no—. Hay prueba que lo fija.

   **El sobre se lee del documento, no del diferencial.** `updateUser` entrega
   los cambios como diferencial: la segunda propuesta de un mismo cliente solo
   trae las claves que cambiaron y llegaría sin `sessionId` ni época. Los
   cambios sirven para saber *que* el flag se tocó; el sobre se lee del `User`
   ya actualizado. La identidad sigue siendo la del documento.

   **Relevo real.** El cableado detecta el cambio de `game.users.activeGM` al
   registrarse y en cada `userConnected`, y también antes de despachar una
   propuesta. Lo que dispara el relevo es **no tener la sesión viva**, no quién
   figure como coordinador en el estado público: el GM que recarga la página
   sigue figurando como coordinador —un ajuste de mundo no se entera de un F5—
   pero ha perdido semilla, mazo y manos, así que readopta su propia mesa por el
   mismo camino que un relevo entre GMs distintos. Cuando el GM activo ve un estado público cuyo `coordinadorId` es
   otro, adopta la mesa con `adoptarSesionPublicada`: reconstruye la sesión desde
   el ajuste público con el privado vacío y delega en `sustituirCoordinador`, que
   sube la época —invalidando los sobres en vuelo del anterior—, cancela la mano
   y restaura el checkpoint previo al reparto. No se reanuda la mano a medias:
   sin semilla no hay forma honesta de continuarla. El relevo se anuncia por el
   hook `lagunakMinijuegoRelevoCoordinador` para que la UI del paso 4 lo explique.
4. Ventana clásica v11 y ApplicationV2 compartiendo el mismo modelo.
   **Implementado** en `foundry-module/scripts/minijuegos/mesa-poker-app.mjs`
   (dos clases hermanas, sin compartir código de ventana) sobre el modelo puro
   `mesa-vista.mjs` y la plantilla `templates/mesa-poker.hbs`. Se abre desde el
   botón **Mesa de juego** del grupo Lagunak en los controles de escena, que ven
   TODOS los usuarios: la mesa es la capa social, y un minijuego al que solo
   entrara el GM no sería un minijuego. El GM que pulsa el botón crea la mesa si
   no había ninguna; sentarse es otra acción, con su propio botón, porque el GM
   puede querer repartir sin jugar.

   **Los botones no los decide la ventana.** `accionesPermitidas` necesita la
   sesión viva —con la mano en curso—, que solo existe en la memoria del
   coordinador. Por eso cada vista dirigida viaja con la lista de acciones de su
   destinatario, y el reparto llega a todos los conectados, no solo a los
   sentados: quien todavía no juega necesita su vista para que se le pueda
   ofrecer «sentarse» o «mirar» (a ese se le manda exactamente la vista pública,
   que ya es un ajuste de mundo). Un cliente que dedujera sus propios botones
   estaría reimplementando las reglas, y la segunda implementación de unas
   reglas es una forma cara de acabar enseñando un botón que el coordinador va a
   rechazar.
5. Arte pixel-art, teclado, reduced-motion e i18n.
   **Implementado.** Las cartas se dibujan en
   `foundry-module/scripts/minijuegos/cartas-pixelart.mjs` y las fichas en
   `fichas-pixelart.mjs`; ambas entran en la vista por `mesa-vista.mjs`, que las
   pide como data URI: no hay assets externos ni peticiones de red desde la
   mesa. Las fichas se apilan de verdad —la altura del montón es lo primero que
   se lee de una mesa—, con el dibujo acotado a cinco fichas y la cuenta exacta
   escrita al lado, que es la que no puede mentir. La denominación se distingue
   por número de cuñas (2, 3, 4, 6, 8) visibles también en el canto, que es lo
   que no tapa el montón, y la silueta va siempre en crema (12:1) contra el
   fieltro: ningún tono de valor llega a 3:1 contra el tapete. El teclado sale gratis porque las acciones
   son `<button type="button">` en el orden DOM de la mesa, sin controles
   sintéticos que reimplementen el foco. La fase de la mano vive en una región
   `role="status" aria-live="polite"`, así que el cambio de turno se anuncia sin
   robar el foco a quien esté decidiendo.

   **Bajo `prefers-reduced-motion` no hay nada que detener**, y es una decisión,
   no un olvido: el bloque `lagunak-mesa` de `foundry-module/styles/lagunak.css`
   no declara ni una `animation` ni una `transition`. El reparto se pinta ya
   repartido. Una mesa cuya información depende de una animación en curso es una
   mesa que miente a quien tiene la preferencia puesta, y la alternativa —animar
   y luego apagarlo— obliga a mantener dos veces la misma verdad. Si algún día
   entra movimiento aquí, entra con su `@media` en el mismo commit.
6. Smoke multijugador real con GM, dos jugadores, espectador, reconexión, pérdida
   del coordinador y cancelación/reinicio seguro de la mano.

   **La mitad ya no necesita humanos.**
   `foundry-module/tests/minijuegos-wiring.test.mjs` corre GM + dos jugadores
   contra `minijuegos-wiring.mjs` simulando lo justo de Foundry —ajustes de
   mundo, `User` con flags, `updateUser` y socket—, y cubre reparto privado,
   ausencia de secretos en el estado público, conservación de fichas entre
   manos, rotación del botón, desconexión con reconexión por `pedirVista()` y
   relevo del coordinador tras un F5 del GM. **Cada cliente es una instancia
   distinta del módulo** (import con query propia): el cableado guarda estado a
   nivel de módulo, así que compartir instancia le daría a los jugadores la
   sesión viva del coordinador y la prueba de privacidad pasaría por
   construcción en vez de por mérito.

   Lo que sigue exigiendo dos navegadores de verdad es lo que el arnés no puede
   fingir: que Foundry retransmita `module.<id>` (el fallo de `"socket": true`
   no existe fuera de un servidor real), el render de las dos ventanas, el
   pixel-art a tamaño real y la privacidad frente a un jugador que **inspecciona
   la consola** — que es la prueba que #340 dejó abierta.

El issue #309 puede consumir este marco cuando llegue la Fase 4, pero no puede
usar el minijuego para emitir órdenes de nave ni saltarse permisos de puesto.
