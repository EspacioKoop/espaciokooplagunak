#include "content/checkpointCapture.h"

#include "components/reactor.h"
#include "components/shields.h"
#include "components/impulse.h"
#include "components/warpdrive.h"

#include <cmath>
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

const CheckpointShipSystem* find(const std::vector<CheckpointShipSystem>& systems, const std::string& id)
{
    for (const auto& system : systems)
        if (system.id == id) return &system;
    return nullptr;
}
}

int main()
{
    // hullHealthFromCurrentMax is pure: no Hull, no ECS, no Lua registry, so
    // it can cover Hull's boundary cases without the segfault described below.
    expect(hullHealthFromCurrentMax(100.0f, 100.0f) == 1.0f, "hull health: current==max is full health");
    expect(hullHealthFromCurrentMax(0.0f, 100.0f) == 0.0f, "hull health: current==0 is zero health");
    expect(hullHealthFromCurrentMax(150.0f, 100.0f) == 1.0f, "hull health: current>max clamps to 1.0");
    expect(hullHealthFromCurrentMax(50.0f, 0.0f) == 0.0f, "hull health: max==0 avoids division by zero");
    expect(hullHealthFromCurrentMax(-10.0f, 100.0f) == 0.0f, "hull health: negative current clamps to 0.0");
    expect(hullHealthFromCurrentMax(NAN, 100.0f) == 0.0f, "hull health: non-finite current is treated as zero");
    expect(hullHealthFromCurrentMax(50.0f, NAN) == 0.0f, "hull health: non-finite max is treated as zero");
    expect(hullHealthFromCurrentMax(INFINITY, 100.0f) == 0.0f, "hull health: infinite current is treated as zero");

    auto bare = sp::ecs::Entity::create();
    expect(captureShipSystems(bare).empty(), "an entity with no ship components captures nothing");

    // The real Hull *component* is deliberately not exercised here: it embeds
    // sp::script::Callback members, and constructing/moving a Hull touches the
    // global Lua registry (lua_rawgetp) even off-heap, which segfaults without
    // a running script engine. Its normalization logic (current/max, with all
    // its boundary cases) is exercised above via hullHealthFromCurrentMax()
    // instead, which is the same function captureShipSystems() calls for the
    // Hull branch — so this test still covers the real code path, just not
    // through a live Hull component. Wiring the Hull ECS branch itself is
    // covered by manual headless QA.
    auto ship = sp::ecs::Entity::create();

    auto& reactor = ship.addComponent<Reactor>();
    reactor.health = 0.75f;
    reactor.power_level = 1.5f;

    auto& impulse = ship.addComponent<ImpulseEngine>();
    impulse.health = 0.0f;
    impulse.power_level = 0.0f;

    auto& warpdrive = ship.addComponent<WarpDrive>();
    warpdrive.health = 1.0f;
    warpdrive.power_level = 6.0f; // out of the 0.0-3.0 convention (e.g. hacked/scripted)

    auto& shields = ship.addComponent<Shields>();
    shields.front_system.health = 0.9f;
    shields.front_system.power_level = 3.0f;

    const auto captured = captureShipSystems(ship);

    expect(find(captured, "hull") == nullptr, "no hull component means no hull entry");

    const auto* reactor_entry = find(captured, "reactor");
    expect(reactor_entry != nullptr && reactor_entry->health == 0.75f
            && reactor_entry->energy == 0.5f && reactor_entry->operational,
        "reactor health and normalized energy (power_level/3) are captured");

    const auto* impulse_entry = find(captured, "impulse");
    expect(impulse_entry != nullptr && !impulse_entry->operational && impulse_entry->energy == 0.0f,
        "a system at zero health is captured as not operational; power_level 0.0 normalizes to energy 0.0");

    const auto* warpdrive_entry = find(captured, "warpdrive");
    expect(warpdrive_entry != nullptr && warpdrive_entry->energy == 1.0f,
        "power_level beyond the 0.0-3.0 convention still normalizes into the 0.0-1.0 energy range");

    const auto* frontshield_entry = find(captured, "frontshield");
    expect(frontshield_entry != nullptr && frontshield_entry->energy == 1.0f,
        "front shield is captured from the Shields component, power_level 3.0 (top of range) normalizes to energy 1.0");
    expect(find(captured, "rearshield") == nullptr,
        "a single-entry Shields component does not report a rear shield");

    CheckpointState state;
    state.ship_systems = captured;
    expect(validateCheckpointState(state) == CheckpointError::None,
        "captured systems pass validateCheckpointState unmodified");

    std::cout << checks << " checkpoint capture checks passed\n";
    return 0;
}
