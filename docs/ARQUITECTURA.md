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
[`docs/API_HTTP.md`](API_HTTP.md).

## Nivel 1 — Contexto del sistema

Quién usa el sistema y con qué habla. Espaciokoop Lagunak es la simulación
autoritativa de la nave; Foundry VTT (sistema externo) es autoritativo para
la narrativa de campaña.

```mermaid
C4Context
    Person(gm, "Director de juego", "Dirige la campaña, controla el tempo y anota consecuencias")
    Person(crew, "Tripulación", "Ocupa los puestos de la nave (timón, armas, ingeniería…)")
    System_Ext(foundry, "Foundry VTT", "Mesa virtual: campaña, fichas, mapas narrativos y diarios")
    System(lagunak, "Espaciokoop Lagunak", "Simulación autoritativa de la nave: posición, sistemas, daños, encuentros")

    Rel(gm, foundry, "Dirige la campaña", "navegador")
    Rel(crew, lagunak, "Opera los puestos", "cliente nativo, LAN")
    Rel(foundry, lagunak, "Lee estado/eventos y envía órdenes de lista blanca", "HTTP + Bearer, polling")
```

## Nivel 2 — Contenedores

Las piezas desplegables y sus límites de red, según el despliegue de
referencia [`docker/compose.yaml`](../docker/README.md). La regla de
seguridad central: **el puerto :8080 del juego (con `/exec.lua`) no se
publica jamás al host**; solo el puente lo alcanza por la red interna.

```mermaid
flowchart LR
    subgraph clientes["Mesa de juego"]
        nav["Navegador del GM y jugadores"]
        native["Clientes nativos<br/>(puestos de la tripulación)"]
    end
    foundry["Foundry VTT + módulo Lagunak<br/><i>Node.js — foundry-module/</i>"]
    subgraph compose["Docker Compose — red interna «espaciokoop»"]
        bridge["Puente de integración<br/><i>Python/FastAPI — bridge/</i><br/>:8090 (bind 127.0.0.1 por defecto)"]
        game["Servidor headless del juego<br/><i>C++/SDL2/Lua</i><br/>:8080 interno · :35666 LAN"]
    end

    nav -->|"sesión Foundry"| foundry
    foundry -->|"GET /v1/* · POST /v1/command<br/>HTTP + Bearer, polling"| bridge
    bridge -->|"POST /exec.lua<br/>solo plantillas definidas en el puente"| game
    native -->|":35666 TCP/UDP (protocolo del juego)"| game
```

| Contenedor | Tecnología | Responsabilidad |
|---|---|---|
| Servidor headless | C++ (fork de EmptyEpsilon), escenarios Lua | Simulación autoritativa de la nave y del escenario |
| Puente de integración | Python / FastAPI | Única pieza autorizada a hablar con `/exec.lua`: auth Bearer, CORS estricto, rate limit, órdenes de lista blanca |
| Módulo Foundry | JavaScript (módulo VTT) | Presenta el estado vivo al GM, escribe eventos en el Journal y envía órdenes cerradas |
| Clientes nativos | EmptyEpsilon de escritorio | Puestos de la tripulación por LAN |

## Nivel 3 — Componentes

Dentro del puente y del módulo Foundry (los dos contenedores propios de este
fork; el servidor del juego mantiene la arquitectura de EmptyEpsilon).

```mermaid
flowchart TB
    subgraph mod["Módulo Foundry «Lagunak»"]
        main["main.mjs<br/>registro y ajustes"]
        ship["ship-view.mjs / ventana-nave.mjs<br/>estado vivo, destino y ETA"]
        mapa["mapa-render.mjs<br/>mapa vivo con contactos"]
        tempo["tempo-control.mjs<br/>pausa/reanudación"]
        journal["event-journal.mjs<br/>Journal deduplicado por eventId"]
        client["bridge-client.mjs<br/>cliente HTTP: polling, token, errores"]
        ship --> client
        mapa --> client
        tempo --> client
        journal --> client
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

## Flujo de datos — polling y una orden

El transporte del contrato v0 está fijado en **polling HTTP** (issue #6). El
módulo nunca envía Lua: los fragmentos viven en el puente y las entradas del
cliente solo rellenan valores tipados y validados.

```mermaid
sequenceDiagram
    participant F as Módulo Foundry
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
