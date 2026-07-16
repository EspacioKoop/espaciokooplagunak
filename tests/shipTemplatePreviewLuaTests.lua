function createClass() return {} end

dofile(arg[1])

__model_data = {
    scout = {mesh_render = {
        mesh = "mesh/scout.model",
        texture = "mesh/scout.png",
        illumination_texture = "mesh/scout-glow.png",
        mesh_offset = {1, -2, 3},
        scale = 4,
    }},
    missing_texture = {mesh_render = {mesh = "mesh/broken.model"}},
    bad_scale = {mesh_render = {mesh = "m", texture = "t", scale = 0}},
    huge_path = {mesh_render = {mesh = string.rep("x", 1025), texture = "t"}},
}
__ship_templates = {
    Scout = {__model_data_name = "scout", __type = "playership"},
    Failing = {__model_data_name = "scout", __type = "playership"},
    Broken = {__model_data_name = "missing_texture"},
    BadScale = {__model_data_name = "bad_scale"},
    HugePath = {__model_data_name = "huge_path"},
}

local valid = getShipTemplatePreview("Scout")
assert(#valid == 9)
assert(valid[1] == "mesh/scout.model" and valid[2] == "mesh/scout.png")
assert(valid[3] == "" and valid[4] == "mesh/scout-glow.png" and valid[5] == "")
assert(valid[6] == 1 and valid[7] == -2 and valid[8] == 3 and valid[9] == 4)
assert(#getShipTemplatePreview("Unknown") == 0)
assert(#getShipTemplatePreview(42) == 0)
assert(#getShipTemplatePreview("Broken") == 0)
assert(#getShipTemplatePreview("BadScale") == 0)
assert(#getShipTemplatePreview("HugePath") == 0)

local applied = {}
local destroyed = false
function PlayerSpaceship()
    local entity = {}
    function entity:setFaction(value) applied.faction = value; return self end
    function entity:setTemplate(value)
        if value == "Failing" then error("template failed") end
        applied.template = value
        return self
    end
    function entity:setCallSign(value) applied.callsign = value; return self end
    function entity:setPosition(x, y) applied.x = x; applied.y = y; return self end
    function entity:setRotation(value) applied.rotation = value; return self end
    function entity:destroy() destroyed = true end
    return entity
end
local spawned = spawnContentEditorShip("Scout", "Human Navy", "Rescue One", 12, -4, true, 90)
assert(spawned ~= nil and applied.template == "Scout" and applied.faction == "Human Navy")
assert(applied.callsign == "Rescue One" and applied.x == 12 and applied.y == -4 and applied.rotation == 90)
assert(not pcall(spawnContentEditorShip, "Broken", "Human Navy", "No", 0, 0, false, 0))
assert(not pcall(spawnContentEditorShip, "Scout", "Human Navy", "No", "0", 0, false, 0))
assert(not pcall(spawnContentEditorShip, "Failing", "Human Navy", "No", 0, 0, false, 0) and destroyed)

print("SHIP_TEMPLATE_PREVIEW_LUA_OK checks=15")
