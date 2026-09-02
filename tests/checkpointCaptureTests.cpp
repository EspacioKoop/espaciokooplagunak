#include "content/checkpointCapture.h"

#include "components/reactor.h"
#include "components/shields.h"
#include "components/impulse.h"

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
    auto bare = sp::ecs::Entity::create();
    expect(captureShipSystems(bare).empty(), "an entity with no ship components captures nothing");

    // Hull is deliberately not exercised here: it embeds sp::script::Callback
    // members, and constructing/moving a Hull component touches the global
    // Lua registry (lua_rawgetp) even off-heap, which segfaults without a
    // running script engine. Its capture path is one `current/max` division
    // (see checkpointCapture.cpp) — covered by manual headless QA instead.
    auto ship = sp::ecs::Entity::create();

    auto& reactor = ship.addComponent<Reactor>();
    reactor.health = 0.75f;
    reactor.power_level = 1.5f;

    auto& impulse = ship.addComponent<ImpulseEngine>();
    impulse.health = 0.0f;
    impulse.power_level = 1.0f;

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
    expect(impulse_entry != nullptr && !impulse_entry->operational,
        "a system at zero health is captured as not operational");

    const auto* frontshield_entry = find(captured, "frontshield");
    expect(frontshield_entry != nullptr && frontshield_entry->energy == 1.0f,
        "front shield is captured from the Shields component, energy clamped to unit range");
    expect(find(captured, "rearshield") == nullptr,
        "a single-entry Shields component does not report a rear shield");

    expect(find(captured, "warpdrive") == nullptr, "components never added are absent, not zeroed");

    CheckpointState state;
    state.ship_systems = captured;
    expect(validateCheckpointState(state) == CheckpointError::None,
        "captured systems pass validateCheckpointState unmodified");

    std::cout << checks << " checkpoint capture checks passed\n";
    return 0;
}
