-- Name: Lagunak: Primera guardia
-- Description: Primer escenario propio de Espaciokoop Lagunak. Escolta corta para tripulaciones novatas: llevad la nave desde la estacion Lagunak hasta el puesto avanzado Argia. Asaltantes Exuari merodean el corredor a mitad de ruta; combatir o esquivarlos es decision de la tripulacion. Victoria al llegar a Argia; derrota si perdeis la nave.
-- Type: Basic
-- Setting[Modo]: Elige la experiencia normal o una ayuda opt-in para probar la mision en solitario desde Tactical.
-- Modo[Normal|Default]: Partida cooperativa sin controles de QA.
-- Modo[Prueba individual]: Anade controles de estado, restauracion y saltos de prueba en Tactical.

--- Scenario
-- @script scenario_90_lagunak_primera_guardia
--
-- Escenario propio del fork Espaciokoop Lagunak
-- (https://github.com/EspacioKoop/espaciokooplagunak). El contenido heredado de
-- EmptyEpsilon y sus creditos no se modifican; este archivo es nuevo.

require("utils.lua")
-- Pools de nombres scifi/pulp en dominio publico (#310, docs/DOMINIO_PUBLICO_SCIFI.md):
-- dan un "nombre de casco" evocador a pecios y mercantes de origen ajeno sin tocar el
-- indicativo vasco que el puente/Foundry rastrean por prefijo.
require("public_domain_names_scenario_utility.lua")
-- Crisis multipuesto de la Etapa B (#484): el arquetipo `ambush` no es una nave
-- suelta sino un grupo con su propia maquina de estados, que vive en su utilidad
-- para que cualquier escenario pueda montarla. Ver la cabecera de ese archivo
-- para el razonamiento de por que hacen falta tres puestos en cadena.
require("lagunak_crisis_scenario_utility.lua")

-- Globales (sin "local") a proposito: permiten sondear el estado desde la
-- consola Lua del modo headless o via /exec.lua en QA local.
fase = "preparacion"

function esModoPruebaIndividual()
    return getScenarioSetting ~= nil
        and getScenarioSetting("Modo") == "Prueba individual"
end

function pruebaIndividualDisponible()
    return modoPruebaIndividual == true
        and player ~= nil
        and player:isValid()
end

function init()
    timer = 0
    briefEnviado = false
    cierreTimer = 5.0
    eventoLlegadaId = string.format("%06d", math.random(0, 999999))
    marcadoresEventosEncuentro = {}
    marcadoresEventosReposicion = {}
    contadorReposiciones = 0
    -- Global a proposito, como el resto del estado del escenario: permite
    -- sondear la crisis desde la consola Lua del modo headless
    -- (`crisisActivas[1]:estado()`) durante el QA de #484.
    crisisActivas = {}
    modoPruebaIndividual = esModoPruebaIndividual()

    estacionLagunak = SpaceStation()
        :setTemplate("Medium Station")
        :setFaction("Human Navy")
        :setCallSign("Lagunak")
        :setPosition(0, 0)

    estacionArgia = SpaceStation()
        :setTemplate("Small Station")
        :setFaction("Human Navy")
        :setCallSign("Argia")
        :setPosition(28000, -16000)

    marcadorDestino = Artifact()
        :setPosition(28000, -16000)
        :setCallSign("LAGUNAK_ROUTE_s90_argia")
        :setRadarSignatureInfo(0, 0, 0)
        :allowPickup(false)

    -- Spawn deliberadamente dentro del rango de atraque de Lagunak: la
    -- guardia zarpa de puerto y desatracar es la primera decision de la
    -- tripulacion (y un sitio seguro donde practicar el atraque antes de
    -- que otro escenario lo exija). No es un descuido.
    player = PlayerSpaceship()
        :setTemplate("Phobos M3P")
        :setFaction("Human Navy")
        :setCallSign("Itsaso 1")
        :setPosition(1200, 800)
        :setHeading(60)

    -- Asaltantes a mitad de corredor: pocos y debiles; la guardia debe poder
    -- superarse tambien esquivando, no solo combatiendo.
    asaltantes = {}
    table.insert(asaltantes, CpuShip()
        :setFaction("Exuari"):setTemplate("Dagger"):setCallSign("Lapur 1")
        :setPosition(13000, -8500):orderDefendLocation(14000, -8000))
    table.insert(asaltantes, CpuShip()
        :setFaction("Exuari"):setTemplate("Dagger"):setCallSign("Lapur 2")
        :setPosition(15000, -7500):orderDefendLocation(14000, -8000))

    fase = "guardia"
    -- /exec.lua se ejecuta en otro entorno Lua: los globales del escenario no
    -- cruzan esa frontera. ScriptStorage es el canal explícito que comparte el
    -- callback cerrado con el puente, bajo un namespace propio del fork.
    local storage = getScriptStorage()
    storage.espaciokoop_lagunak = storage.espaciokoop_lagunak or {}
    storage.espaciokoop_lagunak.spawnEncounter = lagunakSpawnEncounter
    storage.espaciokoop_lagunak.repositionShip = lagunakRepositionShip
    if modoPruebaIndividual then
        instalarControlesPruebaIndividual()
    end
end

function mostrarMensajePruebaIndividual(mensaje)
    if not pruebaIndividualDisponible() then return false end
    player:addCustomMessage("Tactical", "lagunak_qa_mensaje", mensaje)
    return true
end

function mostrarEstadoPruebaIndividual()
    if not pruebaIndividualDisponible() then return false end
    mostrarMensajePruebaIndividual(string.format(
        "QA individual\nFase: %s\nTiempo: %s\nDistancia a Argia: %.1fU\nCasco: %.0f/%.0f\nEnergia: %.0f/%.0f",
        fase,
        formatTime(timer),
        distance(player, estacionArgia) / 1000,
        player:getHull(),
        player:getHullMax(),
        player:getEnergyLevel(),
        player:getEnergyLevelMax()
    ))
    return true
end

function restaurarNavePruebaIndividual()
    if not pruebaIndividualDisponible() then return false end
    local escudos = {}
    for indice = 0, player:getShieldCount() - 1 do
        table.insert(escudos, player:getShieldMax(indice))
    end
    player:setHull(player:getHullMax())
    player:setEnergyLevel(player:getEnergyLevelMax())
    player:setShields(table.unpack(escudos))
    mostrarMensajePruebaIndividual("QA individual: casco, escudos y energia restaurados.")
    return true
end

function detenerNavePruebaIndividual()
    if not pruebaIndividualDisponible() then return false end
    player:commandImpulse(0)
    player:commandWarp(0)
    player:commandAbortJump()
    return true
end

function saltarEncuentroPruebaIndividual()
    if not pruebaIndividualDisponible() or fase ~= "guardia" then return false end
    detenerNavePruebaIndividual()
    player:setPosition(9500, -5500):setHeading(120)
    mostrarMensajePruebaIndividual(
        "QA individual: situada antes del encuentro. Los Exuari siguen activos; combate o esquiva."
    )
    return true
end

function prepararLlegadaPruebaIndividual()
    if not pruebaIndividualDisponible() or fase ~= "guardia" then return false end
    detenerNavePruebaIndividual()
    player:setPosition(26400, -16000):setHeading(90)
    mostrarMensajePruebaIndividual(
        "QA individual: Argia esta a 1.6U. Avanza para activar la llegada normal."
    )
    return true
end

function instalarControlesPruebaIndividual()
    if not pruebaIndividualDisponible() then return false end
    player:addCustomInfo(
        "Tactical",
        "lagunak_qa_info",
        "PRUEBA INDIVIDUAL ACTIVA — ayudas excluidas del modo normal.",
        -10
    )
    player:addCustomButton(
        "Tactical", "lagunak_qa_estado", "QA: estado", mostrarEstadoPruebaIndividual, 0
    )
    player:addCustomButton(
        "Tactical", "lagunak_qa_restaurar", "QA: restaurar nave", restaurarNavePruebaIndividual, 1
    )
    player:addCustomButton(
        "Tactical", "lagunak_qa_encuentro", "QA: ir al encuentro", saltarEncuentroPruebaIndividual, 2
    )
    player:addCustomButton(
        "Tactical", "lagunak_qa_llegada", "QA: preparar llegada", prepararLlegadaPruebaIndividual, 3
    )
    return true
end

-- Catalogo cerrado de arquetipos que ESTE escenario sabe materializar. Foundry
-- (via el puente) elige el arquetipo; el escenario es dueno del COMO: plantilla,
-- faccion, distancia, estado y orden de IA. El puente puede anunciar mas
-- arquetipos en su enum, pero cualquiera que no este aqui degrada a
-- not_supported (return false) en vez de inventar un objeto.
local ARQUETIPOS_ENCUENTRO = {
    -- Pecio a la deriva: nave civil averiada y quieta (encuentro de rescate).
    derelict = {
        indicativo = "Hondar", template = "Flavia", faccion = "Independent",
        distancia = 15000, orden = "idle",
        casco_max = 50, casco = 15,
        averias = { impulse = -0.5, reactor = -0.25 },
        -- Nave fantasma: nombre de casco de terror cosmico (topónimos de Lovecraft, DP).
        tema_dp = "lovecraft",
    },
    -- Patrulla hostil: cazador Exuari en ronda (encuentro de combate).
    patrol = {
        indicativo = "Ehiztari", template = "Dagger", faccion = "Exuari",
        distancia = 18000, orden = "roaming",
    },
    -- Mercante civil: transporte neutral (encuentro de comercio/escolta).
    freighter = {
        indicativo = "Merkatari", template = "Personnel Freighter 1",
        faccion = "Independent", distancia = 12000, orden = "idle",
        -- Mercante civil: nombre de casco de aventura clasica (Verne, DP).
        tema_dp = "verne",
    },
    -- Centinela: plataforma de defensa hostil que guarda su posicion.
    sentry = {
        indicativo = "Zaindari", template = "Defense platform", faccion = "Kraylor",
        distancia = 16000, orden = "standground",
    },
}

-- Encuentro inyectado por el GM via el puente (#117). Foundry decide el QUE
-- (arquetipo de un catalogo cerrado); este escenario decide el COMO: posicion
-- concreta, faccion, estado. El rumbo es una sugerencia gruesa relativa a la
-- nave, nunca una coordenada — el escenario puede honrarlo laxamente.
function lagunakSpawnEncounter(arquetipo, rumbo)
    local nave = getPlayerShip(-1)
    if nave == nil then
        return false
    end
    -- `ambush` (#484) no es una nave suelta: es un grupo con maquina de estados
    -- propia. Se despacha antes que la tabla de arquetipos de una sola nave
    -- porque no comparte forma con ella, no porque sea un caso especial del
    -- catalogo — para el puente y para Foundry es un arquetipo mas.
    if arquetipo == "ambush" then
        local crisis = lagunakCrisisEmboscada(nave, rumbo)
        if crisis == nil then
            return false
        end
        table.insert(crisisActivas, crisis)
        return true
    end

    local spec = ARQUETIPOS_ENCUENTRO[arquetipo]
    if spec == nil then
        return false
    end

    local desvios = { ahead = 0, starboard = 90, astern = 180, port = 270 }
    local desvio = desvios[rumbo] or 0
    -- A rango largo de sensores: visible en ciencia, sin caer encima.
    local distancia = spec.distancia + math.random(-2000, 2000)
    local angulo = math.rad(nave:getHeading() + desvio + math.random(-15, 15))
    local x, y = nave:getPosition()

    contadorEncuentros = (contadorEncuentros or 0) + 1
    -- El indicativo vasco (+ contador) sigue siendo el identificador rastreable por
    -- puente y Foundry. El nombre de casco DP vive solo en la descripcion cientifica:
    -- nunca altera el contrato de contactos ni eventos.
    local indicativo = string.format("%s %d", spec.indicativo, contadorEncuentros)
    local objeto = CpuShip()
        :setTemplate(spec.template)
        :setFaction(spec.faccion)
        :setCallSign(indicativo)
        :setPosition(x + math.sin(angulo) * distancia, y - math.cos(angulo) * distancia)

    if spec.tema_dp ~= nil then
        -- El catalogo es una capa cosmetica: un tema retirado o invalido no debe
        -- impedir que el GM materialice el encuentro autorizado.
        local ok, nombre = pcall(getPublicDomainName, spec.tema_dp)
        if ok and type(nombre) == "string" and nombre ~= "" then
            objeto:setDescription(nombre)
        end
    end

    if spec.casco_max ~= nil then
        objeto:setHullMax(spec.casco_max):setHull(spec.casco or spec.casco_max)
    end
    for sistema, valor in pairs(spec.averias or {}) do
        objeto:setSystemHealth(sistema, valor)
    end

    if spec.orden == "roaming" then
        objeto:orderRoaming()
    elseif spec.orden == "standground" then
        objeto:orderStandGround()
    else
        objeto:orderIdle()
    end

    -- /v1/events solo normaliza derelict por ahora. Los arquetipos nuevos son
    -- visibles en contactos, pero no crean un evento de Journal ficticio.
    if arquetipo == "derelict" then
        -- Artifact es el canal persistente y acotado que /v1/events puede leer
        -- desde el entorno aislado de /exec.lua. El prefijo y todos sus campos
        -- son cerrados; Foundry nunca aporta el ID ni el indicativo.
        local marcador = Artifact()
            :setPosition(x, y)
            :setCallSign(string.format(
                "LAGUNAK_EVT_encounter_started_s90_%s_%06d_derelict",
                eventoLlegadaId,
                contadorEncuentros
            ))
            :setRadarSignatureInfo(0, 0, 0)
            :allowPickup(false)
        table.insert(marcadoresEventosEncuentro, marcador)
    end
    return true
end

function actualizarMarcadoresEventosEncuentro()
    if player == nil or not player:isValid() then return end
    local x, y = player:getPosition()
    for _, marcadores in ipairs({
        marcadoresEventosEncuentro or {},
        marcadoresEventosReposicion or {},
    }) do
        for _, marcador in ipairs(marcadores) do
            if marcador:isValid() then
                -- Mantener cada marcador junto a la nave evita perder el evento
                -- si esta recorre mas de 5U entre dos sondeos del modulo.
                marcador:setPosition(x, y)
            end
        end
    end
end

-- Reposicion de la nave pedida por el GM via el puente (#176). Foundry decide
-- el DONDE eligiendo un ancla de un catalogo cerrado; este escenario es dueno
-- de la coordenada exacta que cada nombre resuelve. Nunca se aceptan
-- coordenadas crudas: seria doble autoridad sobre la posicion de la nave
-- (ADR-0002). Deja la nave JUNTO al ancla, no encima, y detiene su empuje para
-- que el salto no herede la velocidad previa.
local MAX_SECUENCIA_REPOSICION = 999999

function lagunakRepositionShip(ancla)
    local nave = getPlayerShip(-1)
    if nave == nil then
        return false
    end
    local anclas = {
        lagunak = { x = 0, y = 0 },
        argia = { x = 28000, y = -16000 },
    }
    local destino = anclas[ancla]
    if destino == nil then
        return false
    end
    -- El marcador y los validadores del puente/Foundry fijan seis digitos. Al
    -- agotarlos, rechazar antes de tocar la nave conserva la garantia de que
    -- toda reposicion aceptada produce un evento normalizable y deduplicable.
    if (contadorReposiciones or 0) >= MAX_SECUENCIA_REPOSICION then
        return false
    end
    -- Desplazamiento fijo (no aleatorio): la reposicion del GM es determinista y
    -- reproducible. 1500U deja la nave a la vista del ancla sin colisionar.
    nave:setPosition(destino.x + 1500, destino.y + 1500)
    nave:commandImpulse(0)
    nave:commandWarp(0)
    nave:commandAbortJump()

    -- Publicar solo despues de completar la reposicion. El ID incorpora la
    -- sesion, una secuencia monotona, el ancla y el tiempo confirmado por el
    -- escenario (decimas) para que cada orden aceptada sea estable y
    -- deduplicable. Ninguno de esos campos procede libremente del cliente.
    contadorReposiciones = (contadorReposiciones or 0) + 1
    local tiempoDecimas = math.max(0, math.floor(getScenarioTime() * 10 + 0.5))
    local marcador = Artifact()
        :setPosition(destino.x + 1500, destino.y + 1500)
        :setCallSign(string.format(
            "LAGUNAK_EVT_ship_repositioned_s90_%s_%06d_%s_%010d",
            eventoLlegadaId,
            contadorReposiciones,
            ancla,
            tiempoDecimas
        ))
        :setRadarSignatureInfo(0, 0, 0)
        :allowPickup(false)
    table.insert(marcadoresEventosReposicion, marcador)
    return true
end

function publicarEventoLlegada()
    local x, y = player:getPosition()
    marcadorEventoLlegada = Artifact()
        :setPosition(x, y)
        :setCallSign("LAGUNAK_EVT_arrival_s90_" .. eventoLlegadaId)
        :setRadarSignatureInfo(0, 0, 0)
        :allowPickup(false)
end

function enviarBrief()
    estacionLagunak:sendCommsMessage(player, _("goal-incCall", [[Aqui control de Lagunak.

Primera guardia de esta tripulacion: llevad la Itsaso 1 hasta el puesto avanzado Argia, rumbo aproximado 120, a unas 32U de aqui.

Aviso de trafico: naves Exuari merodean el corredor a mitad de ruta. No teneis orden de limpiarlo — llegar enteros ES la mision. Combatir o esquivar, decision vuestra.

Control de Lagunak, corto.]]))
end

function finCompletada(delta)
    cierreTimer = cierreTimer - delta
    if cierreTimer < 0 then
        victory("Human Navy")
    end
    if not cierreAnunciado then
        cierreAnunciado = true
        globalMessage(string.format(_("msgMainscreen", [[Guardia completada.
La Itsaso 1 ha llegado al puesto avanzado Argia.
Tiempo de guardia: %s

Espaciokoop Lagunak — primera guardia superada.]]), formatTime(timer)))
    end
end

-- Avanza cada crisis multipuesto viva y retira las ya resueltas. El desenlace
-- se anuncia a toda la mesa pero NO termina el escenario: la crisis es un
-- encuentro dentro de la guardia, no la guardia. Perder los senuelos no hace
-- fracasar la mision — deja constancia de que se resolvio mal, que es
-- exactamente lo que #484 pide poder observar.
function actualizarCrisis(delta)
    for indice = #crisisActivas, 1, -1 do
        local crisis = crisisActivas[indice]
        local desenlace = crisis:actualizar(delta)
        if desenlace ~= nil then
            table.remove(crisisActivas, indice)
            if desenlace == "resuelta" then
                globalMessage(_("msgMainscreen", [[Amenaza neutralizada.

El buque trampa ha caido y los dos cargueros civiles siguen enteros. Asi se hace.]]))
            elseif desenlace == "con_bajas" then
                globalMessage(_("msgMainscreen", [[Amenaza neutralizada, con bajas civiles.

El buque trampa ha caido, pero no todos los supervivientes del convoy llegaran a Argia.]]))
            end
        end
    end
end

function update(delta)
    timer = timer + delta
    actualizarMarcadoresEventosEncuentro()
    actualizarCrisis(delta)

    if fase == "guardia" then
        if not briefEnviado and timer > 5.0 then
            briefEnviado = true
            enviarBrief()
        end
        if not player:isValid() then
            fase = "derrota"
            globalMessage(_("msgMainscreen", "La Itsaso 1 se ha perdido con toda su tripulacion.\nLa primera guardia termina aqui."))
            victory("Exuari")
        elseif distance(player, estacionArgia) < 1500 then
            fase = "completada"
            publicarEventoLlegada()
        end
    elseif fase == "completada" then
        finCompletada(delta)
    end
end
