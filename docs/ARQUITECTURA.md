# Arquitectura del sistema — diagramas C4

Este documento explica cómo funciona la aplicación a distintos niveles de
zoom siguiendo el [modelo C4](https://c4model.com/) (estándar de facto para
documentar arquitecturas de software): **contexto → contenedores →
componentes**, más un diagrama de flujo de datos.

Los diagramas existen en dos formatos equivalentes:

- **Fuente editable draw.io**:
  [`docs/assets/diagramas/arquitectura.drawio`](assets/diagramas/arquitectura.drawio)
  (una página por nivel; se abre en [app.diagrams.net](https://app.diagrams.net/)
  o con la extensión *Draw.io Integration* de VS Code). Es la fuente de
  verdad visual: edítala y mantén este documento en sincronía.
- **Mermaid embebido** en este documento, para que GitHub los renderice sin
  herramientas.

Para la autoridad de cada dominio de datos y la visión de juego, ver
[`docs/FOUNDRY.md`](FOUNDRY.md). Para la superficie HTTP exacta,
[`docs/seguridad/API_HTTP.md`](seguridad/API_HTTP.md).

## Nivel 1 — Contexto del sistema

Quién usa el sistema y con qué habla. Espaciokoop Lagunak es autoritativo para
la simulación de la nave **y para la campaña** —progreso, personajes, atlas,
misiones y consecuencias—; Foundry VTT (sistema externo) es una integración
**opcional** que proyecta y adapta, sin poseer nada ([ADR-0008](adr/0008-standalone-first-autoridad-del-nucleo.md),
que sustituye a ADR-0002).

La consecuencia práctica es la pregunta que filtra cualquier propuesta: **¿sigue
siendo jugable si Foundry desaparece?** El GM puede dirigir sin él; con él, gana
una superficie de mesa más cómoda.

```mermaid
C4Context
    Person(gm, "Director de juego", "Dirige la campaña, controla el tempo y anota consecuencias")
    Person(crew, "Tripulación", "Ocupa los puestos de la nave (timón, armas, ingeniería…)")
    System_Ext(foundry, "Foundry VTT (opcional)", "Mesa virtual: proyecta la campaña y adapta fichas, mapas narrativos y diarios. No autoritativa")
    System(lagunak, "Espaciokoop Lagunak", "Autoritativo: simulación de la nave (posición, sistemas, daños) y campaña (progreso, personajes, atlas, misiones)")

    Rel(gm, lagunak, "Dirige la campaña", "cliente nativo")
    Rel(gm, foundry, "Dirige desde la mesa virtual, si la mesa la usa", "navegador")
    Rel(crew, lagunak, "Opera los puestos", "cliente nativo, LAN")
    Rel(foundry, lagunak, "Lee estado/eventos proyectados y envía órdenes de lista blanca", "HTTP + Bearer, polling")
```

## Nivel 2 — Contenedores

Las piezas desplegables y sus límites de red, según el despliegue de
referencia [`docker/compose.yaml`](../docker/README.md). La regla de
seguridad central: **el puerto :8080 del juego (con `/exec.lua`) no se
publica jamás al host**; solo el puente lo alcanza por la red interna.

```mermaid
flowchart LR
    subgraph clientes["Mesa de juego"]
        gmweb["Navegador del GM<br/>módulo Lagunak cargado (como en todos)<br/>único con Bearer configurado (setting client)<br/>único que hace fetch al puente"]
        players["Navegadores de jugadores<br/>módulo Lagunak cargado<br/>sin token ni acceso al puente"]
        native["Clientes nativos<br/>(puestos de la tripulación)"]
    end
    foundry["Servidor Foundry VTT<br/><i>Node.js — sistema externo</i>"]
    subgraph compose["Docker Compose — red interna «espaciokoop»"]
        bridge["Puente de integración<br/><i>Python/FastAPI — bridge/</i><br/>:8090 (bind 127.0.0.1 por defecto)"]
        game["Servidor headless del juego<br/><i>C++/SDL2/Lua</i><br/>:8080 interno · :35666 LAN"]
    end

    gmweb -->|"sesión Foundry"| foundry
    players -->|"sesión Foundry"| foundry
    gmweb -->|"GET /v1/* · POST /v1/command<br/>fetch directo · HTTP + Bearer · CORS"| bridge
    bridge -->|"POST /exec.lua<br/>solo plantillas definidas en el puente"| game
    native -->|":35666 TCP/UDP (protocolo del juego)"| game
```

| Contenedor | Tecnología | Responsabilidad |
|---|---|---|
| Servidor headless | C++ (fork de EmptyEpsilon), escenarios Lua | Simulación autoritativa de la nave y del escenario |
| Puente de integración | Python / FastAPI | Única pieza autorizada a hablar con `/exec.lua`: auth Bearer, CORS estricto, rate limit, órdenes de lista blanca |
| Servidor Foundry | Node.js (sistema externo) | Aloja el mundo y sirve la aplicación web de Foundry a GM y jugadores |
| Módulo Foundry | JavaScript cargado en el navegador de todos los clientes; solo el del GM tiene token y habla con el puente | Presenta el estado vivo, escribe eventos en el Journal y llama directamente al puente; URL y Bearer v0 son settings `client` provisionales |
| Clientes nativos | EmptyEpsilon de escritorio | Puestos de la tripulación por LAN |

## Supuesto de confianza y visibilidad GM

El contrato v0 del puente es una **capacidad GM compartida**, no una frontera de
permisos por jugador. FastAPI solo comprueba la posesión del Bearer: no conoce la
sesión, el usuario ni el rol de Foundry y concede a cualquier poseedor la misma
lista de lecturas y órdenes. El guard `game.user.isGM`, la ausencia de token en
los navegadores de jugadores y CORS reducen exposiciones accidentales en el
cliente, pero no acreditan el rol ante el puente.

En particular, `/v1/contacts` ofrece deliberadamente una vista omnisciente para
el GM, sin aplicar detección, identificación ni ocultación por puesto. El puente
no debe usarse como API directa de tripulación ni sus respuestas GM deben
redistribuirse sin un filtrado autoritativo. Si en el futuro los jugadores hablan
con el puente, esa ampliación requerirá credenciales o capacidades diferenciadas
y endpoints con visibilidad impuesta en el servidor; ocultar controles en la UI
no será suficiente.

El inventario completo de actores, controles y riesgos residuales está en el
[modelo de amenazas del puente](seguridad/BRIDGE_THREAT_MODEL.md).

## Nivel 3 — Componentes

Dentro del puente y del módulo Foundry (los dos contenedores propios de este
fork; el servidor del juego mantiene la arquitectura de EmptyEpsilon).

```mermaid
flowchart TB
    subgraph mod["Módulo Foundry «Lagunak» — navegador del GM"]
        main["main.mjs<br/>registro y ajustes"]
        ship["ship-view.mjs / ventana-nave.mjs<br/>estado vivo, destino y ETA"]
        mapa["mapa-render.mjs<br/>mapa vivo con contactos"]
        tempo["tempo-control.mjs<br/>pausa/reanudación"]
        journal["event-journal.mjs<br/>Registro de descriptores;<br/>Journal deduplicado por eventId"]
        alerta["nivel-alerta.mjs / alerta-escena.mjs<br/>nivel sostenido con histéresis;<br/>ajuste de mundo → toda la mesa"]
        client["bridge-client.mjs<br/>cliente HTTP: polling, token, errores"]
        ship --> client
        mapa --> client
        tempo --> client
        journal --> client
        ship --> alerta
    end
    subgraph puente["Puente de integración (bridge/app.py)"]
        api["API v1 (FastAPI)<br/>/healthz · /v1/state · /v1/scenario<br/>/v1/events · /v1/contacts · /v1/command"]
        auth["Seguridad<br/>Bearer (hmac) · CORS allowlist · rate limit"]
        cmds["Órdenes de lista blanca<br/>modelos Pydantic → plantillas Lua fijas"]
        runlua["_run_lua (httpx)<br/>timeout, límite de respuesta, parseo JSON"]
        api --> auth
        api --> cmds
        cmds --> runlua
    end
    client -->|"HTTP + Bearer"| api
    runlua -->|"POST /exec.lua"| game["Servidor headless"]
```

## Nivel de alerta: lo único que ven todos los clientes

Casi todo el módulo es asimétrico —solo el navegador del GM tiene token y habla
con el puente—, con una excepción deliberada: el **nivel de alerta de la nave**
(verde / amarilla / roja).

- Lo **deriva** `nivel-alerta.mjs` del mismo `/v1/state` que el GM ya sondea.
  Es lógica pura, con **histéresis**: se entra en un nivel con un umbral y solo
  se sale con otro más holgado, para que una nave oscilando en el borde no haga
  parpadear la pantalla en cada sondeo.
- Lo **publica** el GM en un ajuste de mundo, y solo cuando cambia.
- Lo **lee** cualquier cliente y lo aplica como un borde de aviso sobre el
  viewport. Al ser un ajuste de mundo, un jugador que se conecta tarde ve la
  alerta vigente sin esperar al siguiente sondeo.

No es una fuga de información oculta: una tripulación sabe perfectamente que su
propia nave está en alerta roja. Tampoco toca ningún documento de escena — es
una capa de presentación, así que volver a verde no deja nada que limpiar.
Se distingue de `alertas-nave.mjs`, que detecta **flancos** (el instante del
cruce) y los anota una vez en la bitácora; esto describe el estado **mientras
dura**.

## Flujo de datos — polling y una orden

El transporte del contrato v0 está fijado en **polling HTTP** (issue #6). El
módulo nunca envía Lua: los fragmentos viven en el puente y las entradas del
cliente solo rellenan valores tipados y validados.

```mermaid
sequenceDiagram
    participant F as Módulo Foundry (navegador del GM)
    participant B as Puente
    participant G as Servidor headless

    loop cada intervalo de polling
        F->>B: GET /v1/state (Bearer)
        B->>B: auth + rate limit
        B->>G: POST /exec.lua (plantilla fija)
        G-->>B: resultado Lua (JSON)
        B-->>F: estado normalizado (posición, rumbo, destino, ETA)
        F->>B: GET /v1/events
        B-->>F: eventos normalizados
        F->>F: escribe en Journal (deduplicado por eventId)
    end

    F->>B: POST /v1/command {call: "pause"}
    B->>B: validación Pydantic (lista blanca cerrada)
    B->>G: POST /exec.lua → pauseGame()
    G-->>B: resultado de la orden
    B-->>F: ACK (orden aceptada, sin estado autoritativo)
    Note over F: la UI queda en «pausando» — el ACK no confirma la pausa
    F->>B: GET /v1/scenario (sondeo posterior)
    B->>G: POST /exec.lua (lectura de estado)
    G-->>B: paused observado
    B-->>F: paused autoritativo
    Note over F: solo esta lectura confirma la pausa en la UI del GM
```

## Mantenimiento

- Si cambia la topología (nuevos contenedores, puertos, transporte), actualiza
  **primero** el `.drawio` y después los Mermaid de este documento.
- Los nombres de componentes deben coincidir con los ficheros reales
  (`bridge/app.py`, `foundry-module/scripts/*.mjs`); si renombras código,
  renombra aquí.
