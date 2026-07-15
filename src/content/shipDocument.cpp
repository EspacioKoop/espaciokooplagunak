#include "content/shipDocument.h"
#include "crewPosition.h"

#include <cmath>
#include <set>

namespace
{
bool validPortableId(const std::string& value)
{
    if (value.empty() || value.size() > 64) return false;
    for (char c : value)
    {
        const bool lower = c >= 'a' && c <= 'z';
        const bool digit = c >= '0' && c <= '9';
        if (!(lower || digit || c == '_' || c == '-')) return false;
    }
    return (value.front() >= 'a' && value.front() <= 'z')
        || (value.front() >= '0' && value.front() <= '9');
}
}

const char* shipSystemId(ShipSystemId system)
{
    switch(system)
    {
    case ShipSystemId::Reactor: return "reactor";
    case ShipSystemId::BeamWeapons: return "beamweapons";
    case ShipSystemId::MissileSystem: return "missilesystem";
    case ShipSystemId::Maneuver: return "maneuver";
    case ShipSystemId::Impulse: return "impulse";
    case ShipSystemId::Warp: return "warp";
    case ShipSystemId::JumpDrive: return "jumpdrive";
    case ShipSystemId::FrontShield: return "frontshield";
    case ShipSystemId::RearShield: return "rearshield";
    case ShipSystemId::Count: break;
    }
    return "";
}

bool parseShipSystemId(const std::string& value, ShipSystemId& system)
{
    for (int index = 0; index < static_cast<int>(ShipSystemId::Count); ++index)
    {
        const auto candidate = static_cast<ShipSystemId>(index);
        if (value == shipSystemId(candidate))
        {
            system = candidate;
            return true;
        }
    }
    return false;
}

ShipDocumentError validateShipDocument(const ShipDocument& document)
{
    if (document.systems.size() > static_cast<std::size_t>(ShipSystemId::Count)
        || document.resources.size() > SHIP_DOCUMENT_MAX_RESOURCES
        || document.cargo.size() > SHIP_DOCUMENT_MAX_CARGO
        || document.crew_position_ids.size() > SHIP_DOCUMENT_MAX_CREW_POSITIONS)
        return ShipDocumentError::TooManyEntries;

    std::set<ShipSystemId> systems;
    for (const auto& item : document.systems)
    {
        if (item.system < ShipSystemId::Reactor || item.system >= ShipSystemId::Count)
            return ShipDocumentError::InvalidSystem;
        if (!systems.insert(item.system).second) return ShipDocumentError::DuplicateSystem;
        if (!std::isfinite(item.health) || item.health < -1.0f || item.health > 1.0f)
            return ShipDocumentError::InvalidSystemHealth;
    }

    std::set<std::string> resources;
    for (const auto& item : document.resources)
    {
        if (!validPortableId(item.id)) return ShipDocumentError::InvalidResourceId;
        if (!resources.insert(item.id).second) return ShipDocumentError::DuplicateResource;
        if (!std::isfinite(item.amount) || item.amount < 0.0f
            || item.amount > SHIP_DOCUMENT_MAX_RESOURCE_AMOUNT)
            return ShipDocumentError::InvalidResourceAmount;
    }

    std::set<std::string> cargo;
    for (const auto& item : document.cargo)
    {
        if (!validPortableId(item.id)) return ShipDocumentError::InvalidCargoId;
        if (!cargo.insert(item.id).second) return ShipDocumentError::DuplicateCargo;
        if (item.quantity == 0 || item.quantity > SHIP_DOCUMENT_MAX_CARGO_QUANTITY)
            return ShipDocumentError::InvalidCargoQuantity;
    }

    std::set<std::string> crew_positions;
    for (const auto& id : document.crew_position_ids)
    {
        if (!isCanonicalCrewPositionId(id)) return ShipDocumentError::InvalidCrewPosition;
        if (!crew_positions.insert(id).second) return ShipDocumentError::DuplicateCrewPosition;
    }
    return ShipDocumentError::None;
}
