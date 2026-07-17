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
    Scout = {__model_data_name = "scout"},
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

print("SHIP_TEMPLATE_PREVIEW_LUA_OK checks=10")
