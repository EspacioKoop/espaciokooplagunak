# Contrato de minijuegos sociales en Foundry

- Estado: **diseño previo a implementación**
- Issue: [#308](https://github.com/VaroTv7/espaciokooplagunak/issues/308)
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

## Espectadores

Los espectadores reciben únicamente `vistaPublica`, no ocupan asiento, no
apuestan y no pueden emitir `act`. Pueden entrar o salir en cualquier fase. El
póker debe seguir siendo legible para ellos: cartas comunitarias, bote, apuestas,
turno y resultado sí son públicos; manos aún activas, no.

## Primer vertical: póker

El primer corte implementará una sola mesa de Texas Hold'em simplificado:

- 2–6 jugadores y espectadores;
- fichas efímeras iguales al entrar; sin recompras, economía ni premios externos;
- barajar, ciegas, reparto, rondas, bote y showdown deterministas;
- acciones cerradas: `fold`, `check`, `call`, `raise` con límites explícitos;
- retirada automática al expirar el turno de un jugador ausente;
- resultado público y nueva mano solo por decisión explícita del anfitrión.

Quedan fuera del primer corte torneos, bots, dinero real, chat propio, múltiples
variantes y efectos sobre la campaña.

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

   **Relevo real.** El cableado detecta el cambio de `game.users.activeGM` al
   registrarse y en cada `userConnected`, y también antes de despachar una
   propuesta. Cuando el GM activo ve un estado público cuyo `coordinadorId` es
   otro, adopta la mesa con `adoptarSesionPublicada`: reconstruye la sesión desde
   el ajuste público con el privado vacío y delega en `sustituirCoordinador`, que
   sube la época —invalidando los sobres en vuelo del anterior—, cancela la mano
   y restaura el checkpoint previo al reparto. No se reanuda la mano a medias:
   sin semilla no hay forma honesta de continuarla. El relevo se anuncia por el
   hook `lagunakMinijuegoRelevoCoordinador` para que la UI del paso 4 lo explique.
4. Ventana clásica v11 y ApplicationV2 compartiendo el mismo modelo.
5. Arte pixel-art, teclado, reduced-motion e i18n.
6. Smoke multijugador real con GM, dos jugadores, espectador, reconexión, pérdida
   del coordinador y cancelación/reinicio seguro de la mano.

El issue #309 puede consumir este marco cuando llegue la Fase 4, pero no puede
usar el minijuego para emitir órdenes de nave ni saltarse permisos de puesto.
