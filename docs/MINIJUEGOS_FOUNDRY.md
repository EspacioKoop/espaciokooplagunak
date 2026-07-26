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
5. **Reductor determinista.** Mismo estado inicial, semilla y secuencia válida de
   acciones producen el mismo resultado público. La aleatoriedad se consume a
   través de una semilla de sesión explícita; el motor no llama a `Math.random()`.
6. **Coordinador único.** El GM primario valida y aplica acciones. Los demás
   clientes proponen acciones mediante un evento de Foundry que vincule la
   identidad en origen (por ejemplo, el patrón existente basado en cambios del
   documento `User`), no mediante un mensaje de socket que declare libremente
   quién lo envía. Nunca se acepta un `userId` incluido por el propio cliente
   como prueba de identidad.

## Contrato de sesión

El estado común mínimo es lógica pura y serializable:

```text
SesionMinijuego {
  version: 1
  id: string
  juego: string
  fase: "lobby" | "en_curso" | "terminada"
  revision: integer >= 0
  semilla: integer
  anfitrionId: string
  jugadores: [{ userId, asiento, estado }]
  espectadores: [userId]
  juegoPublico: object
  resultado: object | null
}
```

- `id` identifica una mesa, no una campaña ni un mundo.
- `revision` aumenta exactamente una vez por acción aceptada y permite rechazar
  acciones obsoletas o repetidas.
- `juegoPublico` contiene solo información que todos los participantes pueden
  conocer. Las manos privadas no forman parte de este estado compartido.
- El motor limita jugadores, espectadores, tamaño de payload y longitud de
  cadenas antes de persistir o retransmitir estado.

## Acciones comunes

Todas las acciones contienen `sessionId`, `revisionEsperada`, `tipo` y un
`nonce` acotado. El coordinador obtiene el actor del evento autenticado de
Foundry, no del payload.

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
y no modifica estado ni revisión. Repetir el mismo `nonce` del mismo actor es
idempotente.

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
- **Pérdida del GM coordinador:** se congela la mesa hasta elegir un nuevo GM
  primario y reconciliar la última revisión confirmada; nunca avanzan dos
  coordinadores simultáneamente.
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
   nonces, desconexión y espectadores.
2. Motor puro de póker con vectores deterministas y pruebas de reglas.
3. Adaptador Foundry y vistas pública/privada sin persistir secretos.
4. Ventana clásica v11 y ApplicationV2 compartiendo el mismo modelo.
5. Arte pixel-art, teclado, reduced-motion e i18n.
6. Smoke multijugador real con GM, dos jugadores, espectador, reconexión y relevo
   controlado del coordinador.

El issue #309 puede consumir este marco cuando llegue la Fase 4, pero no puede
usar el minijuego para emitir órdenes de nave ni saltarse permisos de puesto.
