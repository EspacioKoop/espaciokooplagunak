"""Fragmentos Lua fijos que el puente envía al ``/exec.lua`` heredado del juego.

Extraído de ``app.py`` (que ya supera las 700 líneas) porque este Lua, al vivir
dentro de strings de Python, es invisible para cualquier herramienta Lua
(``luac -p`` del job LuaTest, el language server, el resaltado del editor).
Aislarlo aquí no cambia el contrato: sigue siendo Lua fijo definido en el
servidor — ``app.py`` nunca reenvía Lua recibido por la red (ver cabecera de
``app.py`` y docs/FOUNDRY.md).
"""

from __future__ import annotations

# --- Lua fijo del servidor ---------------------------------------------------

_SYSTEMS = (
    "reactor",
    "beamweapons",
    "missilesystem",
    "maneuver",
    "impulse",
    "warp",
    "jumpdrive",
    "frontshield",
    "rearshield",
)

# Escapador JSON compartido por las plantillas Lua (#391). Vivía dentro de
# `_CONTACTS_LUA`; cuando `/v1/state` empezó a publicar indicativos de atraque
# hizo falta el mismo, y copiarlo habría dejado dos escapadores que se separan en
# cuanto alguien arregle un caso raro en uno solo. `%q` de Lua NO vale: escapa
# para Lua, no para JSON.
#
# Va en cadena "raw" y se concatena DESPUÉS del `%` de las plantillas que
# formatean, para que sus `%c` y `%04x` no haya que duplicarlos.
_JSON_ESCAPE_LUA = r"""
local function json_escape(s)
    s = string.gsub(s, '[%c"\\]', function(c)
        if c == '"' then return '\\"' end
        if c == '\\' then return '\\\\' end
        return string.format('\\u%04x', string.byte(c))
    end)
    return '"' .. s .. '"'
end
"""

_STATE_LUA = """
local ship = getPlayerShip(-1)
if ship == nil then
    return '{"ship":null}'
end
local x, y = ship:getPosition()
local vx, vy = ship:getVelocity()
local destination = nil
for _, object in ipairs(getObjectsInRadius(x, y, 1000000)) do
    if (object:getCallSign() or "") == "LAGUNAK_ROUTE_s90_argia" then
        local destination_x, destination_y = object:getPosition()
        destination = {name = "Argia", x = destination_x, y = destination_y}
        break
    end
end
local destination_json = "null"
local distance_json = "null"
local eta_json = "null"
if destination ~= nil then
    local dx = destination.x - x
    local dy = destination.y - y
    local distance = math.sqrt(dx * dx + dy * dy)
    local speed = math.sqrt(vx * vx + vy * vy)
    destination_json = string.format(
        '{"name":"Argia","position":{"x":%%.1f,"y":%%.1f}}',
        destination.x, destination.y)
    distance_json = string.format("%%.1f", distance)
    if speed > 0.01 then
        eta_json = string.format("%%.1f", distance / speed)
    end
end
-- Alcance real del radar de la nave propia (#331 paso 3). Sale del componente
-- `long_range_radar`, que ya expone `short_range` y `long_range` a Lua: sin esto,
-- degradar los contactos de la tripulación por distancia obligaría a inventarse
-- dos constantes, y una banda inventada es una mentira con forma de sensor.
--
-- Es opcional como todo lo demás: sin componente, `null`. Y ahí la degradación
-- falla cerrada —no se publica ningún contacto— en vez de abrir de par en par.
local radar_json = "null"
local ok_radar, radar = pcall(function() return ship.components.long_range_radar end)
if ok_radar and radar ~= nil then
    local ok_short, short_range = pcall(function() return radar.short_range end)
    local ok_long, long_range = pcall(function() return radar.long_range end)
    if ok_short and ok_long and type(short_range) == "number"
        and type(long_range) == "number" then
        radar_json = string.format(
            '{"short_range":%%.1f,"long_range":%%.1f}', short_range, long_range)
    end
end
-- Atraque de la nave propia (#391). El componente `docking_port` ya expone
-- `state` y `target` a Lua (src/script/components.cpp), así que esto no necesita
-- una sola línea de C++ nueva: es la regla de divergencia cero de #362.
--
-- El binding entrega el enum como cadena en minúsculas y con guión bajo
-- (`src/script/enum.h`, Convert<DockingPort::State>::toLua): "not_docking",
-- "docking", "docked", "none". Se normaliza a minúsculas antes de comparar —así
-- una recapitalización aguas arriba no apaga el atraque— y CUALQUIER OTRA COSA
-- es null, `not_docking` incluido. Un estado inventado sería peor que no
-- publicar nada: la consola dibujaría un atraque que no existe.
local docking_json = "null"
local ok_port, port = pcall(function() return ship.components.docking_port end)
if ok_port and port ~= nil then
    local ok_state, raw_state = pcall(function() return port.state end)
    local estado = nil
    if ok_state and type(raw_state) == "string" then
        local normalizado = string.lower(raw_state)
        if normalizado == "docking" then estado = "docking" end
        if normalizado == "docked" then estado = "docked" end
    end
    if estado ~= nil then
        -- Sin objetivo legible se publica el estado igualmente: «estamos
        -- atracando» es cierto aunque no se sepa contra qué, y callarlo entero
        -- perdería el dato que sí hay.
        local objetivo_json = "null"
        local ok_target, target = pcall(function() return port.target end)
        if ok_target and target ~= nil then
            local ok_cs, target_callsign = pcall(function() return target:getCallSign() end)
            local callsign_json = "null"
            if ok_cs and target_callsign ~= nil and target_callsign ~= "" then
                callsign_json = json_escape(target_callsign)
            end
            local class_json = "null"
            local ok_tp, target_port = pcall(function() return target.components.docking_port end)
            if ok_tp and target_port ~= nil then
                local ok_c, target_class = pcall(function() return target_port.dock_class end)
                if ok_c and target_class ~= nil and target_class ~= "" then
                    class_json = json_escape(target_class)
                end
            end
            if callsign_json ~= "null" or class_json ~= "null" then
                objetivo_json = string.format(
                    '{"callsign":%%s,"class":%%s}', callsign_json, class_json)
            end
        end
        docking_json = string.format(
            '{"state":"%%s","target":%%s}', estado, objetivo_json)
    end
end
-- Reparación automática de tripulación (#464/#466). `internal_rooms` ya expone
-- `auto_repair_enabled` a Lua (`src/script/components.cpp`), sin cambios en
-- C++: mismo patrón opcional con pcall que `docking_json` arriba. Un tipo no
-- booleano (o el componente ausente) publica `null`, nunca un valor inventado
-- — el casco 3D de ingeniería (#419) lee este campo para pintar las regiones
-- dañadas como "reparando" o no.
local auto_repair_json = "null"
local ok_rooms, rooms = pcall(function() return ship.components.internal_rooms end)
if ok_rooms and rooms ~= nil then
    local ok_auto, auto = pcall(function() return rooms.auto_repair_enabled end)
    if ok_auto and type(auto) == "boolean" then
        auto_repair_json = tostring(auto)
    end
end
-- Carga de la maniobra de combate (#519). `combat_maneuvering_thrusters` ya
-- expone `charge` a Lua (src/script/components.cpp), así que esto tampoco
-- necesita C++ nuevo: mismo patrón opcional con pcall que `docking_json`.
--
-- Se publica para que la consola de navegación NO tenga que estimar cuánta
-- maniobra queda. Sin componente (una nave que sencillamente no la tiene) el
-- valor es `null`, y la interfaz debe pintar "no hay lectura", no un cero: un
-- cero dice "sin carga", que es una afirmación distinta y falsa.
local combat_maneuver_json = "null"
local ok_cm, cm = pcall(function() return ship.components.combat_maneuvering_thrusters end)
if ok_cm and cm ~= nil then
    local ok_charge, charge = pcall(function() return cm.charge end)
    if ok_charge and type(charge) == "number" then
        combat_maneuver_json = string.format('{"charge":%%.3f}', charge)
    end
end
-- Autodestrucción (#518). `self_destruct` expone `active` y `countdown` a Lua,
-- y NO expone `code` ni `confirmed` (src/script/components.cpp). Esa ausencia
-- es deliberada aguas arriba y aquí se respeta: publicar los códigos sería
-- disolver el puzle cooperativo del puesto, y además la telemetría que el GM
-- reparte a la tripulación viaja por un ajuste de mundo que toda la mesa puede
-- leer. Lo que se publica es solo si está armada y cuánto queda.
--
-- `countdown` se publica solo con la secuencia armada: sin armar, el campo del
-- motor no significa "cero segundos para estallar".
local self_destruct_json = "null"
local ok_sd, sd = pcall(function() return ship.components.self_destruct end)
if ok_sd and sd ~= nil then
    local ok_active, active = pcall(function() return sd.active end)
    if ok_active and type(active) == "boolean" then
        local countdown_json = "null"
        if active then
            local ok_cd, countdown = pcall(function() return sd.countdown end)
            if ok_cd and type(countdown) == "number" then
                countdown_json = string.format("%%.1f", countdown)
            end
        end
        self_destruct_json = string.format(
            '{"active":%%s,"countdown":%%s}', tostring(active), countdown_json)
    end
end
-- Frecuencia de escudos y su recalibrado (#518). `shields` expone `frequency`
-- y `calibration_delay`. Una frecuencia de -1 significa "estos escudos no
-- tienen frecuencia" (src/components/shields.h) y se publica como null, no
-- como el número -1: un consumidor lo pintaría como una frecuencia válida.
local shield_frequency_json = "null"
local ok_sh, shields = pcall(function() return ship.components.shields end)
if ok_sh and shields ~= nil then
    local ok_freq, frequency = pcall(function() return shields.frequency end)
    if ok_freq and type(frequency) == "number" and frequency >= 0 then
        local calibrando_json = "null"
        local ok_delay, delay = pcall(function() return shields.calibration_delay end)
        if ok_delay and type(delay) == "number" then
            calibrando_json = string.format("%%.1f", delay)
        end
        shield_frequency_json = string.format(
            '{"frequency":%%d,"calibration_delay":%%s}', frequency, calibrando_json)
    end
end
-- Condición de alerta DECLARADA por la tripulación (#517). `player_control` ya
-- expone `alert_level` a Lua (src/script/components.cpp): sin C++ nuevo, mismo
-- patrón opcional con pcall que `docking_json`.
--
-- No confundir con el nivel de alerta que el módulo Foundry deriva del daño
-- (`nivel-alerta.mjs`, #338): aquello describe cómo está la nave, esto declara
-- en qué postura la ha puesto su tripulación. Son cosas distintas y por eso
-- conviven; lo que no puede pasar es que el puesto que fija la condición no
-- pueda leerla de vuelta y tenga que suponerla.
--
-- El binding entrega el enum con las cadenas de `Convert<AlertLevel>::toLua`
-- ("Normal", "YELLOW ALERT", "RED ALERT"). Se normalizan a los mismos valores
-- que acepta la orden `set_alert_level` (normal/yellow/red) para que el
-- contrato del puente sea uno solo en las dos direcciones. Cualquier otra cosa
-- es null: un nivel inventado sería peor que no publicar ninguno.
local alert_level_json = "null"
local ok_control, control = pcall(function() return ship.components.player_control end)
if ok_control and control ~= nil then
    local ok_level, raw_level = pcall(function() return control.alert_level end)
    if ok_level and type(raw_level) == "string" then
        local normalizado = string.lower(raw_level)
        if normalizado == "normal" then alert_level_json = '"normal"' end
        if normalizado == "yellow alert" or normalizado == "yellow" then
            alert_level_json = '"yellow"'
        end
        if normalizado == "red alert" or normalizado == "red" then
            alert_level_json = '"red"'
        end
    end
end
-- Sondas disponibles (#517). `scan_probe_launcher` ya expone `stock` y `max`.
-- Lanzar una sonda es una decisión con coste, y sin esta lectura el puesto de
-- Relay tendría que contarlas de memoria. Se publican las dos: "quedan 3" sin
-- saber de cuántas es la mitad de la frase.
local probes_json = "null"
local ok_launcher, launcher = pcall(function() return ship.components.scan_probe_launcher end)
if ok_launcher and launcher ~= nil then
    local ok_stock, stock = pcall(function() return launcher.stock end)
    local ok_max, max_probes = pcall(function() return launcher.max end)
    if ok_stock and ok_max and type(stock) == "number" and type(max_probes) == "number" then
        probes_json = string.format('{"stock":%%d,"max":%%d}', stock, max_probes)
    end
end
-- Enlace sonda→ciencia (#520). `radar_link` ya expone `linked_entity` a Lua
-- (src/script/components.cpp), así que esto tampoco necesita C++ nuevo.
--
-- Lo que habilita es la VISTA DE SONDA: la pantalla nativa de Science, con una
-- sonda enlazada, recentra el radar en ella conservando los alcances de la
-- nave (src/screens/crew6/scienceScreen.cpp). Publicar la posición de la sonda
-- permite hacer lo mismo en Foundry sin inventarse un alcance para la sonda,
-- que no lo tiene propio.
local science_link_json = "null"
local ok_link, radar_link = pcall(function() return ship.components.radar_link end)
if ok_link and radar_link ~= nil then
    local ok_ent, enlazada = pcall(function() return radar_link.linked_entity end)
    if ok_ent and enlazada ~= nil and enlazada then
        local ok_pos, px, py = pcall(function() return enlazada:getPosition() end)
        if ok_pos and type(px) == "number" and type(py) == "number" then
            local cs_json = "null"
            local ok_cs, cs = pcall(function() return enlazada:getCallSign() end)
            if ok_cs and type(cs) == "string" and cs ~= "" then cs_json = json_escape(cs) end
            science_link_json = string.format(
                '{"callsign":%%s,"position":{"x":%%.1f,"y":%%.1f}}', cs_json, px, py)
        end
-- Interior de la nave y equipos de reparación (#522). `internal_rooms` expone
-- las salas (posición, tamaño y sistema) y `internal_crew` la posición y el
-- destino de cada equipo, todo ya en Lua (src/script/components.cpp): esto NO
-- necesita C++ nuevo, en contra de lo que suponía el issue.
--
-- Se publica la planta REAL del motor, no una parecida. La sección de la nave
-- de Foundry (#427) tiene su propia planta declarativa, pensada para andar por
-- ella; pintar equipos de reparación sobre aquella sería pintar sobre un plano
-- que no es el de esta nave. Las dos plantas pueden convivir mientras cada una
-- diga de dónde sale.
local internal_json = "null"
local ok_rooms2, rooms2 = pcall(function() return ship.components.internal_rooms end)
if ok_rooms2 and rooms2 ~= nil then
    local salas = {}
    local ok_lista = pcall(function()
        for i = 1, math.min(#rooms2, 64) do
            local sala = rooms2[i]
            local sistema_json = "null"
            if type(sala.system) == "string" and sala.system ~= "" then
                sistema_json = json_escape(sala.system)
            end
            salas[#salas + 1] = string.format(
                '{"x":%%d,"y":%%d,"w":%%d,"h":%%d,"system":%%s}',
                sala.position.x, sala.position.y, sala.size.x, sala.size.y, sistema_json)
        end
    end)
    if not ok_lista then salas = {} end
    -- Equipos: se identifican por DÓNDE ESTÁN, no por un índice. El orden en
    -- que el motor devuelve las entidades no está garantizado, así que un
    -- índice podría referirse a un equipo distinto entre dos sondeos — y mover
    -- al equipo equivocado en mitad de una avería es peor que no moverlo.
    local equipos = {}
    local ok_crew = pcall(function()
        for _, entidad in ipairs(getEntitiesWithComponent("internal_crew")) do
            local ic = entidad.components.internal_crew
            if ic ~= nil and ic.ship == ship and #equipos < 16 then
                local destino_json = "null"
                if ic.target_position ~= nil then
                    destino_json = string.format('{"x":%%d,"y":%%d}',
                        ic.target_position.x, ic.target_position.y)
                end
                equipos[#equipos + 1] = string.format(
                    '{"position":{"x":%%d,"y":%%d},"target":%%s}',
                    ic.position.x, ic.position.y, destino_json)
            end
        end
    end)
    if not ok_crew then equipos = {} end
    if #salas > 0 then
        internal_json = string.format('{"rooms":[%%s],"crews":[%%s]}',
            table.concat(salas, ","), table.concat(equipos, ","))
    end
end
local systems = {}
for _, name in ipairs({%s}) do
    systems[#systems + 1] = string.format(
        '"%%s":{"health":%%.3f,"heat":%%.3f,"power":%%.3f,"coolant":%%.3f}',
        name, ship:getSystemHealth(name), ship:getSystemHeat(name),
        ship:getSystemPower(name), ship:getSystemCoolant(name))
end
return string.format(
    '{"ship":{"callsign":%%q,"position":{"x":%%.1f,"y":%%.1f},"heading":%%.2f,'
    .. '"velocity":{"x":%%.2f,"y":%%.2f},"destination":%%s,'
    .. '"distance_to_destination":%%s,"eta_seconds":%%s,'
    .. '"hull":%%.1f,"hull_max":%%.1f,"energy":%%.1f,"energy_max":%%.1f,'
    .. '"shields_active":%%s,"repair_crew":%%d,"radar":%%s,"docking":%%s,'
    .. '"auto_repair":%%s,"combat_maneuver":%%s,"self_destruct":%%s,'
    .. '"shield_calibration":%%s,"alert_level":%%s,"probes":%%s,'
    .. '"science_link":%%s,"systems":{%%s}}}',
    .. '"auto_repair":%%s,"internal":%%s,"systems":{%%s}}}',
    ship:getCallSign() or "?", x, y, ship:getHeading(), vx, vy,
    destination_json, distance_json, eta_json,
    ship:getHull(), ship:getHullMax(),
    ship:getEnergyLevel(), ship:getEnergyLevelMax(),
    tostring(ship:getShieldsActive()), ship:getRepairCrewCount(),
    radar_json, docking_json, auto_repair_json, combat_maneuver_json,
    self_destruct_json, shield_frequency_json, alert_level_json, probes_json,
    science_link_json, table.concat(systems, ","))
    radar_json, docking_json, auto_repair_json, internal_json,
    table.concat(systems, ","))
""" % ", ".join(f'"{name}"' for name in _SYSTEMS)
_STATE_LUA = _JSON_ESCAPE_LUA + _STATE_LUA

_SCENARIO_LUA = """
return string.format('{"scenario_time":%.1f,"paused":%s}',
    getScenarioTime(), tostring(isGamePaused()))
"""

_HEALTH_LUA = """
return '{"ok":true}'
"""

_EVENTS_LUA = """
local ship = getPlayerShip(-1)
if ship == nil then
    return '{"events":[]}'
end
local x, y = ship:getPosition()
local events = {}
for _, object in ipairs(getObjectsInRadius(x, y, 5000)) do
    local call_sign = object:getCallSign() or ""
    local suffix = string.match(call_sign, "^LAGUNAK_EVT_arrival_s90_(%d+)$")
    if suffix ~= nil then
        events[#events + 1] = string.format(
            '{"id":"arrival-s90-%s","type":"arrival",'
            .. '"scenario":"scenario_90_lagunak_primera_guardia",'
            .. '"destination":"Argia","scenario_time":%.1f}',
            suffix, getScenarioTime())
    end
    local session_id, sequence = string.match(
        call_sign,
        "^LAGUNAK_EVT_encounter_started_s90_(%d%d%d%d%d%d)_(%d%d%d%d%d%d)_derelict$")
    if session_id ~= nil and sequence ~= nil then
        events[#events + 1] = string.format(
            '{"id":"encounter-started-s90-%s-%s","type":"encounter_started",'
            .. '"scenario":"scenario_90_lagunak_primera_guardia",'
            .. '"archetype":"derelict","encounter_callsign":"Hondar %d",'
            .. '"scenario_time":%.1f}',
            session_id, sequence, tonumber(sequence), getScenarioTime())
    end
    local reposition_session, reposition_sequence, anchor, scenario_time_tenths =
        string.match(
            call_sign,
            "^LAGUNAK_EVT_ship_repositioned_s90_(%d%d%d%d%d%d)_(%d%d%d%d%d%d)_([%a]+)_(%d%d%d%d%d%d%d%d%d%d)$")
    local valid_anchor = anchor == "lagunak" or anchor == "argia"
    if reposition_session ~= nil and reposition_sequence ~= nil
        and scenario_time_tenths ~= nil and valid_anchor then
        events[#events + 1] = string.format(
            '{"id":"ship-repositioned-s90-%s-%s-%s-%s",'
            .. '"type":"ship_repositioned",'
            .. '"scenario":"scenario_90_lagunak_primera_guardia",'
            .. '"anchor":"%s","scenario_time":%.1f}',
            reposition_session, reposition_sequence, anchor, scenario_time_tenths,
            anchor, tonumber(scenario_time_tenths) / 10)
    end
end
return '{"events":[' .. table.concat(events, ",") .. ']}'
"""

# Contactos cercanos a la nave del jugador: base de datos para un mapa vivo en
# Foundry (starfield + puntos). VISTA GM OMNISCIENTE, no de sensores: publica
# indicativo y facción de todo objeto en radio SIN recortar por nivel de
# detección — eso sigue siendo deliberado, la consume la ventana de mapa vivo,
# solo-GM, detrás del Bearer que solo tiene el GM. Lo que NO es omnisciente es
# el campo `scan_state` (#462): es el `ScanState::State` real del juego para la
# facción de `ship` (ver `estado_escaneo` más abajo), así que un consumidor
# pensado para tripulación (`contactos-degradados.mjs`) puede degradar
# indicativo/facción por ese campo en vez de aproximarlos por distancia. Seguir
# publicando indicativo/facción crudos aquí sigue exigiendo ese filtrado en el
# consumidor — este endpoint no lo hace por sí mismo.
#
# Solo lectura, radio y número acotados para limitar el tamaño de la
# respuesta. El truncamiento es honesto: se ordenan TODOS los objetos del
# radio por distancia y se devuelven los `limite` más cercanos (el índice
# espacial de getObjectsInRadius no garantiza orden), con el jugador SIEMPRE
# incluido (se separa por identidad de objeto — __eq del binding de
# SeriousProton — y encabeza la lista), y `truncated`/`total` en la respuesta
# para que el consumidor sepa si hay más. Cada accesor opcional va en pcall:
# objetos como asteroides o nebulosas no responden a getFaction y no deben
# romper la lista. json_escape serializa cada string como JSON válido
# (comillas, barra inversa y controles como \\u00XX); %q de Lua escapa para
# Lua, no para JSON. Cadena "raw" de Python para que las barras invertidas
# lleguen intactas a Lua.
_CONTACTS_LUA = _JSON_ESCAPE_LUA + r"""
local ship = getPlayerShip(-1)
if ship == nil then
    return '{"contacts":[],"truncated":false,"total":0}'
end
local x, y = ship:getPosition()
local limite = 60
local otros = {}
for _, object in ipairs(getObjectsInRadius(x, y, 30000)) do
    local ok_cs, call_sign = pcall(function() return object:getCallSign() end)
    local marcador_evento = ok_cs
        and type(call_sign) == "string"
        and string.match(call_sign, "^LAGUNAK_EVT_") ~= nil
    if object ~= ship and not marcador_evento then
        local ox, oy = object:getPosition()
        local dx = ox - x
        local dy = oy - y
        otros[#otros + 1] = {obj = object, ox = ox, oy = oy, d2 = dx * dx + dy * dy}
    end
end
table.sort(otros, function(a, b) return a.d2 < b.d2 end)
-- Estado de escaneo REAL del juego (ScanState::State, ver src/script/enum.h),
-- relativo a la facción de `ship` — no una aproximación por distancia. Sin
-- componente `scan_state` el objeto nace ya escaneado del todo (asteroides,
-- estaciones de escenario…, ver scripts/api/entity/spaceobject.lua); con
-- componente pero sin entrada para esta facción, el estado es "none". Los
-- valores posibles son exactamente "none"/"fof"/"simple"/"full" — el propio
-- Convert<ScanState::State>::toLua los fija, así que no hace falta traducirlos.
local function estado_escaneo(object, ship)
    local ok, estado = pcall(function()
        local ss = object.components.scan_state
        if ss == nil then return "full" end
        local mi_faccion = ship:getFactionId()
        for n = 1, #ss do
            if ss[n].faction == mi_faccion then return ss[n].state end
        end
        return "none"
    end)
    if ok and type(estado) == "string" then return estado end
    return "full"
end
local function entrada(object, ox, oy, es_jugador)
    local ok_cs, callsign = pcall(function() return object:getCallSign() end)
    if not ok_cs or callsign == nil then callsign = "?" end
    local faction_json = "null"
    local ok_f, faction = pcall(function() return object:getFaction() end)
    if ok_f and faction ~= nil and faction ~= "" then
        faction_json = json_escape(faction)
    end
    -- La nave propia no se escanea a sí misma: siempre se conoce entera.
    local scan_state = es_jugador == "true" and "full" or estado_escaneo(object, ship)
    local type_json = "null"
    -- Contrato real del juego: el componente ECS `typename` (registrado en
    -- src/script/components.cpp) con su campo `type_name`. Las entidades sin
    -- ese componente (asteroides…) hacen fallar el pcall y quedan en null.
    local ok_t, tname = pcall(function() return object.components.typename.type_name end)
    if ok_t and tname ~= nil and tname ~= "" then
        type_json = json_escape(tname)
    end
    local class_json = "null"
    local subclass_json = "null"
    -- ShipTemplate:setClass() copia la clasificación semántica al componente
    -- `docking_port`. Es opcional: estaciones y objetos de escenario pueden
    -- no publicarlo, por lo que cada acceso permanece dentro de pcall.
    local ok_dp, docking = pcall(function() return object.components.docking_port end)
    if ok_dp and docking ~= nil then
        local ok_c, class = pcall(function() return docking.dock_class end)
        if ok_c and class ~= nil and class ~= "" then class_json = json_escape(class) end
        local ok_sc, subclass = pcall(function() return docking.dock_subclass end)
        if ok_sc and subclass ~= nil and subclass ~= "" then subclass_json = json_escape(subclass) end
    end
    return string.format(
        '{"callsign":%s,"position":{"x":%.1f,"y":%.1f},"faction":%s,"type":%s,"class":%s,"subclass":%s,'
        .. '"is_player":%s,"scan_state":%s}',
        json_escape(callsign), ox, oy, faction_json, type_json, class_json, subclass_json, es_jugador,
        json_escape(scan_state))
end
local contacts = {entrada(ship, x, y, "true")}
for i = 1, math.min(#otros, limite - 1) do
    contacts[#contacts + 1] = entrada(otros[i].obj, otros[i].ox, otros[i].oy, "false")
end
return string.format('{"contacts":[%s],"truncated":%s,"total":%d}',
    table.concat(contacts, ","), tostring(#otros > limite - 1), #otros + 1)
"""


def _command_lua(call: str) -> str:
    return (
        "local ship = getPlayerShip(-1)\n"
        "if ship == nil then return '{\"ok\":false,\"reason\":\"no_ship\"}' end\n"
        f"{call}\n"
        "return '{\"ok\":true}'"
    )


def _lua_string_literal(value: str) -> str:
    """Escapa ``value`` como literal de cadena Lua de una sola línea.

    Uso estrecho: incrustar UN valor ya validado por Pydantic (whitelist de
    caracteres, ver ``ScanObject.callsign`` en ``command_models.py``) en un
    hueco de cadena de Lua fijo generado desde Python. Esto NO reabre la
    prohibición de reenviar Lua recibido por la red (cabecera de
    ``app.py``): el valor nunca se ejecuta como código, solo se compara
    contra un indicativo con ``==`` dentro del Lua fijo de este módulo.
    """
    escaped = (
        value.replace("\\", "\\\\")
        .replace('"', '\\"')
        .replace("\n", "\\n")
        .replace("\r", "\\r")
    )
    return f'"{escaped}"'


def _find_target_lua(callsign: str) -> str:
    """Fragmento Lua fijo compartido: busca entre los objetos cercanos a la
    nave del jugador el que tiene este indicativo y lo deja en la variable
    local ``target``. Si no aparece, la propia plantilla ya hace ``return``
    con ``target_not_found`` — quien la use solo tiene que añadir la orden
    que hace falta con ``target`` ya resuelto.

    Compartido por toda orden que referencia un objetivo por indicativo
    (``scan_object``, ``set_weapon_target``, ``fire_tube``, #462/#465): mismo
    radio y mismo criterio de búsqueda para todas, así que un ajuste futuro
    (radio, prioridad de desempate) no se puede arreglar en una y olvidar en
    las demás.
    """
    literal = _lua_string_literal(callsign)
    return (
        "local ship = getPlayerShip(-1)\n"
        "if ship == nil then return '{\"ok\":false,\"reason\":\"no_ship\"}' end\n"
        "local sx, sy = ship:getPosition()\n"
        "local target = nil\n"
        "for _, object in ipairs(getObjectsInRadius(sx, sy, 30000)) do\n"
        "  local ok_cs, cs = pcall(function() return object:getCallSign() end)\n"
        f"  if ok_cs and cs == {literal} then\n"
        "    target = object\n"
        "    break\n"
        "  end\n"
        "end\n"
        "if target == nil then return '{\"ok\":false,\"reason\":\"target_not_found\"}' end\n"
    )


def _scan_object_lua(callsign: str) -> str:
    """Ordena el escaneo (``ship:commandScan``, ver
    ``scripts/api/entity/playerspaceship.lua``) del objeto con este
    indicativo — la misma orden que emite el botón "Scan" nativo de Science.
    La resolución por indicativo, no por un id de entidad, porque es el único
    identificador estable que el puente expone hoy (``/v1/contacts``); ver la
    nota de ``ScanObject`` sobre esa limitación.
    """
    return _find_target_lua(callsign) + 'ship:commandScan(target)\nreturn \'{"ok":true}\''


def _set_weapon_target_lua(callsign: str) -> str:
    """Fija el objetivo de armas (``ship:commandSetTarget``) al objeto con
    este indicativo — habilita el fuego automático de los haces (beams) que
    ya estén cargados y con arco de tiro; los tubos de misiles siguen
    necesitando ``fire_tube`` para disparar de verdad (#465).
    """
    return _find_target_lua(callsign) + 'ship:commandSetTarget(target)\nreturn \'{"ok":true}\''


def _fire_tube_lua(callsign: str, index: int) -> str:
    """Dispara el tubo ``index`` contra el objeto con este indicativo
    (``ship:commandFireTubeAtTarget``, #465). ``index`` ya viene validado
    como entero no negativo por Pydantic antes de llegar aquí — el propio
    juego rechaza (sin efecto) un índice de tubo que la nave no tenga, así
    que no hace falta que el puente conozca cuántos tubos existen.
    """
    return (
        _find_target_lua(callsign)
        + f"ship:commandFireTubeAtTarget({int(index)}, target)\n"
        + 'return \'{"ok":true}\''
    )


# Base de datos científica (#520): el árbol de fichas que la pantalla nativa de
# Science deja consultar. Es CONSULTA, no orden — información asimétrica pura,
# el pilar 1 del roadmap de producto sin tocar la autoridad de nadie.
#
# Por qué un recurso propio y no un campo de /v1/state: el estado se sondea cada
# pocos segundos y describe lo que CAMBIA; esto es contenido de referencia, casi
# inmóvil y mucho más grande. Meterlo en el estado multiplicaría el tamaño de
# cada sondeo para reenviar siempre lo mismo.
#
# Las entradas son entidades con componente `science_database`, encadenadas por
# `parent` (src/components/database.h). El identificador es la RUTA de nombres
# ("Naves/Exuari/Cazador"), que es como se navega el árbol en la pantalla nativa
# y sobrevive a que las entidades se recreen — un índice de entidad no.
#
# Cotas: número de entradas y de pares clave/valor. Una base de datos de mesa no
# se acerca a ellas; están para que un escenario patológico no tumbe la
# respuesta. El truncamiento se declara (`truncated`) en vez de disimularse.
_DATABASE_LUA = _JSON_ESCAPE_LUA + r"""
local limite = 400
local limite_kv = 24
local entradas = {}
local ok_todas, todas = pcall(function()
    return getEntitiesWithComponent("science_database")
end)
if not ok_todas or todas == nil then
    return '{"entries":[],"truncated":false,"total":0}'
end

-- Nombre de una entrada, o nil si no lo tiene: sin nombre no hay ruta, y sin
-- ruta no hay identificador estable, así que la entrada se descarta entera en
-- vez de colarse con un id inventado.
local function nombre_de(entidad)
    local ok, db = pcall(function() return entidad.components.science_database end)
    if not ok or db == nil then return nil end
    local ok_n, n = pcall(function() return db.name end)
    if not ok_n or type(n) ~= "string" or n == "" then return nil end
    return n
end

-- Ruta completa subiendo por `parent`. El tope de profundidad no es decorativo:
-- un `parent` en ciclo (dato corrupto o escenario raro) colgaría el juego
-- entero dentro de /exec.lua, y el puente solo vería un timeout.
local function ruta_de(entidad)
    local partes = {}
    local actual = entidad
    for _ = 1, 16 do
        if actual == nil or not actual then break end
        local n = nombre_de(actual)
        if n == nil then return nil end
        table.insert(partes, 1, n)
        local ok_p, padre = pcall(function() return actual.components.science_database.parent end)
        if not ok_p or padre == nil or not padre then break end
        actual = padre
    end
    if #partes == 0 then return nil end
    return table.concat(partes, "/")
end

local total = 0
for _, entidad in ipairs(todas) do
    local ruta = ruta_de(entidad)
    if ruta ~= nil then
        total = total + 1
        if #entradas < limite then
            local db = entidad.components.science_database
            local descripcion_json = "null"
            local ok_d, d = pcall(function() return db.description end)
            if ok_d and type(d) == "string" and d ~= "" then descripcion_json = json_escape(d) end
            local padre_json = "null"
            local ok_pp, padre = pcall(function() return db.parent end)
            if ok_pp and padre ~= nil and padre then
                local ruta_padre = ruta_de(padre)
                if ruta_padre ~= nil then padre_json = json_escape(ruta_padre) end
            end
            local kv = {}
            local ok_kv = pcall(function()
                for i = 1, math.min(#db.key_values, limite_kv) do
                    local par = db.key_values[i]
                    if type(par.key) == "string" and par.key ~= "" then
                        kv[#kv + 1] = string.format('{"key":%s,"value":%s}',
                            json_escape(par.key), json_escape(tostring(par.value or "")))
                    end
                end
            end)
            if not ok_kv then kv = {} end
            entradas[#entradas + 1] = string.format(
                '{"id":%s,"name":%s,"parent":%s,"description":%s,"values":[%s]}',
                json_escape(ruta), json_escape(nombre_de(entidad)), padre_json,
                descripcion_json, table.concat(kv, ","))
        end
    end
end
return string.format('{"entries":[%s],"truncated":%s,"total":%d}',
    table.concat(entradas, ","), tostring(total > #entradas), total)
"""
