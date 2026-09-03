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

// power_level runs 0.0-3.0 for every captured system: Reactor, BeamWeaponSys,
// MissileTubes, ManeuveringThrusters, ImpulseEngine, WarpDrive and JumpDrive
// all derive from ShipSystem (src/components/shipsystem.h), and Shields'
// front_system/rear_system are ShipSystem instances directly — there is no
// per-component override of that range. The guarantee is the base class
// field's own docstring: "float power_level = 1.0f; //0.0-3.0, default 1.0"
// (shipsystem.h). Normalized here to the checkpoint's 0.0-1.0 "energy" range;
// unitClamp() below also absorbs any out-of-convention value (e.g. hacked or
// scripted power_level beyond 0-3) instead of letting it leak into the JSON.
float energyFromPowerLevel(float power_level)
{
    return unitClamp(power_level / 3.0f);
}
}

// Pure: no Hull, no ECS. See declaration in checkpointCapture.h for why this
// is split out from the Hull-reading branch of captureShipSystems() below.
float hullHealthFromCurrentMax(float current, float max)
{
    if (!std::isfinite(current) || !std::isfinite(max) || max <= 0.0f) return 0.0f;
    return unitClamp(current / max);
}

namespace
{
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
        entry.health = hullHealthFromCurrentMax(hull->current, hull->max);
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
