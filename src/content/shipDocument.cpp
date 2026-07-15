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

nlohmann::json shipDocumentOverridesJson(const ShipDocument& document)
{
    nlohmann::json systems = nlohmann::json::array();
    for (const auto& item : document.systems)
        systems.push_back({{"system", shipSystemId(item.system)}, {"health", item.health}});

    nlohmann::json resources = nlohmann::json::array();
    for (const auto& item : document.resources)
        resources.push_back({{"id", item.id}, {"amount", item.amount}});

    nlohmann::json cargo = nlohmann::json::array();
    for (const auto& item : document.cargo)
        cargo.push_back({{"id", item.id}, {"quantity", item.quantity}});

    return {{"systems", std::move(systems)},
            {"resources", std::move(resources)},
            {"cargo", std::move(cargo)},
            {"crew_positions", document.crew_position_ids}};
}

ShipDocumentError parseShipDocumentOverrides(const nlohmann::json& overrides, ShipDocument& output)
{
    if (!overrides.is_object()) return ShipDocumentError::InvalidStructure;
    const std::set<std::string> allowed{"systems", "resources", "cargo", "crew_positions"};
    for (auto it = overrides.begin(); it != overrides.end(); ++it)
        if (!allowed.count(it.key())) return ShipDocumentError::UnknownFields;
    if (overrides.size() != allowed.size()) return ShipDocumentError::InvalidStructure;

    const auto& systems = overrides["systems"];
    const auto& resources = overrides["resources"];
    const auto& cargo = overrides["cargo"];
    const auto& crew_positions = overrides["crew_positions"];
    if (!systems.is_array() || !resources.is_array() || !cargo.is_array()
        || !crew_positions.is_array()) return ShipDocumentError::InvalidStructure;
    if (systems.size() > static_cast<std::size_t>(ShipSystemId::Count)
        || resources.size() > SHIP_DOCUMENT_MAX_RESOURCES
        || cargo.size() > SHIP_DOCUMENT_MAX_CARGO
        || crew_positions.size() > SHIP_DOCUMENT_MAX_CREW_POSITIONS)
        return ShipDocumentError::TooManyEntries;

    ShipDocument candidate;
    for (const auto& item : systems)
    {
        if (!item.is_object()) return ShipDocumentError::InvalidStructure;
        for (auto it = item.begin(); it != item.end(); ++it)
            if (it.key() != "system" && it.key() != "health")
                return ShipDocumentError::UnknownFields;
        if (item.size() != 2 || !item.contains("system") || !item["system"].is_string()
            || !item.contains("health") || !item["health"].is_number())
            return ShipDocumentError::InvalidStructure;
        ShipSystemOverride value;
        if (!parseShipSystemId(item["system"].get<std::string>(), value.system))
            return ShipDocumentError::InvalidSystem;
        const double health = item["health"].get<double>();
        if (!std::isfinite(health) || health < -1.0 || health > 1.0)
            return ShipDocumentError::InvalidSystemHealth;
        value.health = static_cast<float>(health);
        candidate.systems.push_back(value);
    }

    for (const auto& item : resources)
    {
        if (!item.is_object()) return ShipDocumentError::InvalidStructure;
        for (auto it = item.begin(); it != item.end(); ++it)
            if (it.key() != "id" && it.key() != "amount")
                return ShipDocumentError::UnknownFields;
        if (item.size() != 2 || !item.contains("id") || !item["id"].is_string()
            || !item.contains("amount") || !item["amount"].is_number())
            return ShipDocumentError::InvalidStructure;
        const double amount = item["amount"].get<double>();
        if (!std::isfinite(amount) || amount < 0.0
            || amount > static_cast<double>(SHIP_DOCUMENT_MAX_RESOURCE_AMOUNT))
            return ShipDocumentError::InvalidResourceAmount;
        candidate.resources.push_back({item["id"].get<std::string>(), static_cast<float>(amount)});
    }

    for (const auto& item : cargo)
    {
        if (!item.is_object()) return ShipDocumentError::InvalidStructure;
        for (auto it = item.begin(); it != item.end(); ++it)
            if (it.key() != "id" && it.key() != "quantity")
                return ShipDocumentError::UnknownFields;
        if (item.size() != 2 || !item.contains("id") || !item["id"].is_string()
            || !item.contains("quantity")) return ShipDocumentError::InvalidStructure;
        std::uint64_t quantity = 0;
        if (item["quantity"].is_number_unsigned())
            quantity = item["quantity"].get<std::uint64_t>();
        else if (item["quantity"].is_number_integer())
        {
            const auto signed_quantity = item["quantity"].get<std::int64_t>();
            if (signed_quantity < 0) return ShipDocumentError::InvalidCargoQuantity;
            quantity = static_cast<std::uint64_t>(signed_quantity);
        }
        else return ShipDocumentError::InvalidCargoQuantity;
        if (quantity == 0 || quantity > SHIP_DOCUMENT_MAX_CARGO_QUANTITY)
            return ShipDocumentError::InvalidCargoQuantity;
        candidate.cargo.push_back({item["id"].get<std::string>(), static_cast<std::uint32_t>(quantity)});
    }

    for (const auto& item : crew_positions)
    {
        if (!item.is_string()) return ShipDocumentError::InvalidStructure;
        candidate.crew_position_ids.push_back(item.get<std::string>());
    }

    const auto validation = validateShipDocument(candidate);
    if (validation != ShipDocumentError::None) return validation;
    output = std::move(candidate);
    return ShipDocumentError::None;
}
