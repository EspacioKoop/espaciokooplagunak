#include "content/mapWorldAdapter.h"

#include "components/avoidobject.h"
#include "components/collision.h"
#include "components/missile.h"
#include "components/radar.h"
#include "components/radarblock.h"
#include "components/rendering.h"
#include "components/spin.h"

#include <cmath>
#include <glm/trigonometric.hpp>

namespace
{
constexpr float NEBULA_RADIUS = 5000.0f;

// Deterministic lane generator so cloud layouts repeat across applications.
struct SeedLanes
{
    std::uint64_t state;

    explicit SeedLanes(std::uint64_t seed) : state(seed) {}

    float next()
    {
        state += 0x9e3779b97f4a7c15ull;
        auto value = state;
        value = (value ^ (value >> 30)) * 0xbf58476d1ce4e5b9ull;
        value = (value ^ (value >> 27)) * 0x94d049bb133111ebull;
        value ^= value >> 31;
        return static_cast<float>(value % 100000ull) / 100000.0f;
    }

    float range(float minimum, float maximum) { return minimum + next() * (maximum - minimum); }
};

sp::ecs::Entity createAsteroid(const MapApplyItem& item, const MapVisualParams& params)
{
    auto entity = sp::ecs::Entity::create();
    auto& transform = entity.addComponent<sp::Transform>();
    transform.setPosition({item.transform.x, item.transform.y});
    transform.setRotation(params.rotation);
    entity.addComponent<RawRadarSignatureInfo>(0.05f, 0.0f, 0.0f);

    auto model = string(params.model_number);
    auto& mesh_render = entity.addComponent<MeshRenderComponent>();
    mesh_render.mesh.name = "Astroid_" + model + ".model";
    mesh_render.texture.name = "Astroid_" + model + "_d.png";
    mesh_render.specular_texture.name = "Astroid_" + model + "_s.png";
    mesh_render.normal_texture.name = "Astroid_" + model + "_n.png";
    mesh_render.mesh_offset = {0.0f, 0.0f, params.z_offset};
    mesh_render.scale = item.size;

    entity.addComponent<sp::Physics>().setCircle(sp::Physics::Type::Sensor, item.size);

    auto& trace = entity.addComponent<RadarTrace>();
    trace.icon = "radar/blip.png";
    trace.radius = item.size;
    trace.min_size = 4.0f;
    trace.color = {255, 200, 100, 255};
    trace.flags = RadarTrace::LongRange;

    entity.addComponent<Spin>().rate = params.spin_rate;
    entity.addComponent<AvoidObject>(item.size * 2.0f);

    auto& explode = entity.addComponent<ExplodeOnTouch>();
    explode.damage_at_center = 35.0f;
    explode.damage_at_edge = 35.0f;
    explode.blast_range = item.size;
    return entity;
}

sp::ecs::Entity createNebula(const MapApplyItem& item, const MapVisualParams& params)
{
    auto entity = sp::ecs::Entity::create();
    auto& transform = entity.addComponent<sp::Transform>();
    transform.setPosition({item.transform.x, item.transform.y});
    transform.setRotation(params.rotation);
    entity.addComponent<RawRadarSignatureInfo>(0.0f, 0.8f, -1.0f);

    auto& trace = entity.addComponent<RadarTrace>();
    trace.icon = "Nebula" + string(params.nebula_texture) + ".png";
    trace.min_size = 0.0f;
    trace.max_size = 2048.0f;
    trace.radius = NEBULA_RADIUS * 1.5f;
    trace.flags = RadarTrace::Rotate | RadarTrace::LongRange | RadarTrace::BlendAdd;

    entity.addComponent<RadarBlock>().range = NEBULA_RADIUS;
    entity.addComponent<NeverRadarBlocked>();

    auto& renderer = entity.addComponent<NebulaRenderer>();
    SeedLanes lanes(item.visual_seed ^ 0xceb9fe1a85ec9deull);
    constexpr int cloud_count = 32;
    for (int n = 1; n <= cloud_count; n++)
    {
        NebulaRenderer::Cloud cloud;
        cloud.size = lanes.range(512.0f, 1024.0f * 2.0f);
        const float dist = lanes.range(cloud.size / 2.0f, NEBULA_RADIUS - cloud.size);
        const float angle = glm::radians(n * 360.0f / cloud_count);
        cloud.offset = {std::cos(angle) * dist, std::sin(angle) * dist};
        cloud.texture.name = "Nebula" + string(1 + static_cast<int>(lanes.next() * 2.99f)) + ".png";
        renderer.clouds.push_back(cloud);
    }
    return entity;
}
}

MapApplySession::Create MapWorldAdapter::creator()
{
    return [this](const MapApplyItem& item, std::string& handle)
    {
        const auto params = computeMapVisualParams(item);
        sp::ecs::Entity entity;
        switch (item.kind)
        {
        case MapObjectKind::Asteroid: entity = createAsteroid(item, params); break;
        case MapObjectKind::Nebula: entity = createNebula(item, params); break;
        case MapObjectKind::Unsupported: return false;
        }
        if (!entity)
            return false;
        handle = item.id;
        entities[handle] = entity;
        return true;
    };
}

MapApplySession::Destroy MapWorldAdapter::destroyer()
{
    return [this](const std::string& handle)
    {
        auto it = entities.find(handle);
        if (it == entities.end())
            return false;
        auto entity = it->second;
        entities.erase(it);
        if (!entity)
            return false;
        entity.destroy();
        return true;
    };
}
