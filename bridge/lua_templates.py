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
    .. '"shields_active":%%s,"repair_crew":%%d,"systems":{%%s}}}',
    ship:getCallSign() or "?", x, y, ship:getHeading(), vx, vy,
    destination_json, distance_json, eta_json,
    ship:getHull(), ship:getHullMax(),
    ship:getEnergyLevel(), ship:getEnergyLevelMax(),
    tostring(ship:getShieldsActive()), ship:getRepairCrewCount(),
    table.concat(systems, ","))
""" % ", ".join(f'"{name}"' for name in _SYSTEMS)

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
# indicativo y facción de todo objeto en radio sin filtrar por detección
# (isScannedBy / nivel de identificación). Es deliberado — la consume la
# ventana de mapa vivo, solo-GM, detrás del Bearer que solo tiene el GM — y NO
# debe reutilizarse como contrato para jugadores sin añadir ese filtrado.
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
_CONTACTS_LUA = r"""
local function json_escape(s)
    s = string.gsub(s, '[%c"\\]', function(c)
        if c == '"' then return '\\"' end
        if c == '\\' then return '\\\\' end
        return string.format('\\u%04x', string.byte(c))
    end)
    return '"' .. s .. '"'
end
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
local function entrada(object, ox, oy, es_jugador)
    local ok_cs, callsign = pcall(function() return object:getCallSign() end)
    if not ok_cs or callsign == nil then callsign = "?" end
    local faction_json = "null"
    local ok_f, faction = pcall(function() return object:getFaction() end)
    if ok_f and faction ~= nil and faction ~= "" then
        faction_json = json_escape(faction)
    end
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
        '{"callsign":%s,"position":{"x":%.1f,"y":%.1f},"faction":%s,"type":%s,"class":%s,"subclass":%s,"is_player":%s}',
        json_escape(callsign), ox, oy, faction_json, type_json, class_json, subclass_json, es_jugador)
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
