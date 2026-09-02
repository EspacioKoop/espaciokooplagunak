#include "content/checkpointCapture.h"

#include "components/hull.h"
#include "components/reactor.h"
#include "components/beamweapon.h"
#include "components/missiletubes.h"
#include "components/maneuveringthrusters.h"
#include "components/impulse.h"
#include "components/warpdrive.h"
#include "components/jumpdrive.h"
#include "components/shields.h"

#include <algorithm>
#include <cmath>

namespace
{
float unitClamp(float value)
{
    if (!std::isfinite(value)) return 0.0f;
    return std::clamp(value, 0.0f, 1.0f);
}

// power_level runs 0.0-3.0 by convention (ShipSystem::power_level docstring);
// normalized to the checkpoint's 0.0-1.0 "energy" range.
float energyFromPowerLevel(float power_level)
{
    return unitClamp(power_level / 3.0f);
}

template<typename T> void captureSystem(
    sp::ecs::Entity ship, const char* id, std::vector<CheckpointShipSystem>& output)
{
    auto* system = ship.getComponent<T>();
    if (!system) return;
    CheckpointShipSystem entry;
    entry.id = id;
    entry.health = unitClamp(system->health);
    entry.energy = energyFromPowerLevel(system->power_level);
    entry.operational = system->health > 0.0f;
    output.push_back(std::move(entry));
}
}

std::vector<CheckpointShipSystem> captureShipSystems(sp::ecs::Entity ship)
{
    std::vector<CheckpointShipSystem> result;

    if (auto* hull = ship.getComponent<Hull>())
    {
        CheckpointShipSystem entry;
        entry.id = "hull";
        entry.health = hull->max > 0.0f ? unitClamp(hull->current / hull->max) : 0.0f;
        entry.energy = 1.0f;
        entry.operational = hull->current > 0.0f;
        result.push_back(std::move(entry));
    }

    captureSystem<Reactor>(ship, "reactor", result);
    captureSystem<BeamWeaponSys>(ship, "beamweapons", result);
    captureSystem<MissileTubes>(ship, "missilesystem", result);
    captureSystem<ManeuveringThrusters>(ship, "maneuvering", result);
    captureSystem<ImpulseEngine>(ship, "impulse", result);
    captureSystem<WarpDrive>(ship, "warpdrive", result);
    captureSystem<JumpDrive>(ship, "jumpdrive", result);

    if (auto* shields = ship.getComponent<Shields>())
    {
        {
            CheckpointShipSystem entry;
            entry.id = "frontshield";
            entry.health = unitClamp(shields->front_system.health);
            entry.energy = energyFromPowerLevel(shields->front_system.power_level);
            entry.operational = shields->front_system.health > 0.0f;
            result.push_back(std::move(entry));
        }
        if (shields->entries.size() > 1)
        {
            CheckpointShipSystem entry;
            entry.id = "rearshield";
            entry.health = unitClamp(shields->rear_system.health);
            entry.energy = energyFromPowerLevel(shields->rear_system.power_level);
            entry.operational = shields->rear_system.health > 0.0f;
            result.push_back(std::move(entry));
        }
    }

    return result;
}
