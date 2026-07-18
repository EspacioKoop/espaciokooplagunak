#include "content/mapWorldAdapter.h"

#include "components/avoidobject.h"
#include "components/collision.h"
#include "components/missile.h"
#include "components/radar.h"
#include "components/radarblock.h"
#include "components/rendering.h"
#include "components/spin.h"

#include <cstdlib>
#include <iostream>
#include <string>

namespace
{
int checks = 0;

void expect(bool condition, const char* message)
{
    ++checks;
    if (!condition)
    {
        std::cerr << "FAIL: " << message << "\n";
        std::exit(1);
    }
}

MapObject asteroid(const std::string& id, float rotation)
{
    MapObject object;
    object.id = id;
    object.kind = MapObjectKind::Asteroid;
    object.transform = {1000.0f, 2000.0f, rotation};
    object.size = 150.0f;
    return object;
}

MapObject nebula(const std::string& id, float rotation)
{
    MapObject object;
    object.id = id;
    object.kind = MapObjectKind::Nebula;
    object.transform = {-5000.0f, 3000.0f, rotation};
    return object;
}
}

int main()
{
    MapDocument document;
    document.objects.push_back(asteroid("a-1", 45.0f));
    document.objects.push_back(nebula("n-1", 270.0f));

    MapApplyPlan plan;
    expect(buildMapApplyPlan(document, true, plan) == MapApplyError::None && plan.items.size() == 2,
        "document plans both allowlisted objects");

    // A sentinel entity outside the batch must survive apply and rollback.
    auto sentinel = sp::ecs::Entity::create();
    sentinel.addComponent<sp::Transform>();

    MapWorldAdapter adapter;
    MapApplySession session;
    expect(session.apply(plan, adapter.creator(), adapter.destroyer()) == MapApplyError::None,
        "apply through the real adapter succeeds");

    // Asteroid: essential ECS components and the document rotation, not a derived one.
    {
        auto entity = adapter.find("a-1");
        expect(bool(entity), "asteroid entity is alive after apply");
        auto transform = entity.getComponent<sp::Transform>();
        expect(transform && transform->getPosition().x == 1000.0f
                && transform->getPosition().y == 2000.0f && transform->getRotation() == 45.0f,
            "asteroid keeps the staged position and rotation snapshot");
        auto mesh = entity.getComponent<MeshRenderComponent>();
        const auto params = computeMapVisualParams(plan.items[0]);
        expect(mesh && mesh->scale == 150.0f
                && mesh->mesh.name == "Astroid_" + string(params.model_number) + ".model",
            "asteroid mesh derives from the deterministic model number and staged size");
        auto spin = entity.getComponent<Spin>();
        expect(spin && spin->rate == params.spin_rate, "asteroid spin uses the deterministic rate");
        expect(entity.hasComponent<sp::Physics>() && entity.hasComponent<RadarTrace>()
                && entity.hasComponent<AvoidObject>() && entity.hasComponent<ExplodeOnTouch>()
                && entity.hasComponent<RawRadarSignatureInfo>(),
            "asteroid carries its essential gameplay components");
    }

    // Nebula: essential ECS components, document rotation and deterministic clouds.
    {
        auto entity = adapter.find("n-1");
        expect(bool(entity), "nebula entity is alive after apply");
        auto transform = entity.getComponent<sp::Transform>();
        expect(transform && transform->getRotation() == 270.0f,
            "nebula keeps the staged rotation snapshot");
        auto renderer = entity.getComponent<NebulaRenderer>();
        expect(renderer && renderer->clouds.size() == 32, "nebula renders its full cloud set");
        expect(entity.hasComponent<RadarBlock>() && entity.hasComponent<NeverRadarBlocked>()
                && entity.hasComponent<RadarTrace>() && entity.hasComponent<RawRadarSignatureInfo>(),
            "nebula carries its essential gameplay components");
    }

    // Defense: a handle already tracked by the adapter is rejected before creating.
    {
        std::string handle;
        MapApplyItem duplicate = plan.items[0];
        expect(!adapter.creator()(duplicate, handle) && handle.empty(),
            "adapter rejects a duplicate id without creating an entity");
    }

    // Rollback destroys exactly the batch entities and nothing else.
    auto applied_asteroid = adapter.find("a-1");
    auto applied_nebula = adapter.find("n-1");
    std::size_t destroyed = 0, missing = 0;
    expect(session.rollback(true, adapter.destroyer(), &destroyed, &missing) == MapApplyError::None
            && destroyed == 2 && missing == 0,
        "rollback destroys the whole batch through the real adapter");
    expect(!applied_asteroid && !applied_nebula, "batch entities are dead after rollback");
    expect(bool(sentinel), "sentinel entity outside the batch survives rollback");
    expect(adapter.empty(), "adapter keeps no handles after rollback");

    sentinel.destroy();
    std::cout << "MAP_WORLD_ADAPTER_TESTS_OK checks=" << checks << "\n";
    return 0;
}
