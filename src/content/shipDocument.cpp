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

const char* shipMissileId(ShipMissileId missile)
{
    switch(missile)
    {
    case ShipMissileId::Homing: return "homing";
    case ShipMissileId::Nuke: return "nuke";
    case ShipMissileId::Mine: return "mine";
    case ShipMissileId::EMP: return "emp";
    case ShipMissileId::HVLI: return "hvli";
    case ShipMissileId::Count: break;
    }
    return "";
}

bool parseShipMissileId(const std::string& value, ShipMissileId& missile)
{
    for (int index = 0; index < static_cast<int>(ShipMissileId::Count); ++index)
    {
        const auto candidate = static_cast<ShipMissileId>(index);
        if (value == shipMissileId(candidate))
        {
            missile = candidate;
            return true;
        }
    }
    return false;
}

std::optional<float>& shipEngineSpeed(ShipDocument& document, ShipEngineId engine)
{
    switch(engine)
    {
    case ShipEngineId::Turn: return document.turn_speed_max;
    case ShipEngineId::Warp: return document.warp_speed_per_level;
    case ShipEngineId::Impulse:
    case ShipEngineId::Count: break;
    }
    return document.impulse_speed_max;
}

const std::optional<float>& shipEngineSpeed(const ShipDocument& document, ShipEngineId engine)
{
    return shipEngineSpeed(const_cast<ShipDocument&>(document), engine);
}

float shipEngineSpeedCeiling(ShipEngineId engine)
{
    switch(engine)
    {
    case ShipEngineId::Turn: return SHIP_DOCUMENT_MAX_TURN_SPEED;
    case ShipEngineId::Warp: return SHIP_DOCUMENT_MAX_WARP_SPEED;
    case ShipEngineId::Impulse:
    case ShipEngineId::Count: break;
    }
    return SHIP_DOCUMENT_MAX_IMPULSE_SPEED;
}

ShipDocumentError validateShipDocument(const ShipDocument& document)
{
    if (document.hull_max
        && (!std::isfinite(*document.hull_max) || *document.hull_max <= 0.0f
            || *document.hull_max > SHIP_DOCUMENT_MAX_HULL))
        return ShipDocumentError::InvalidHullMax;
    for (const auto shield_max : {document.front_shield_max, document.rear_shield_max})
        if (shield_max
            && (!std::isfinite(*shield_max) || *shield_max <= 0.0f
                || *shield_max > SHIP_DOCUMENT_MAX_SHIELD))
            return ShipDocumentError::InvalidShieldMax;
    // Engine speeds share one error because they share one rule: a speed is a
    // positive, finite number under its ceiling. Splitting it into three errors
    // would give the GM three ways to read the same sentence.
    for (const auto& speed : {std::pair{document.impulse_speed_max, SHIP_DOCUMENT_MAX_IMPULSE_SPEED},
                              std::pair{document.turn_speed_max, SHIP_DOCUMENT_MAX_TURN_SPEED},
                              std::pair{document.warp_speed_per_level, SHIP_DOCUMENT_MAX_WARP_SPEED}})
        if (speed.first
            && (!std::isfinite(*speed.first) || *speed.first <= 0.0f || *speed.first > speed.second))
            return ShipDocumentError::InvalidEngineSpeed;

    if (document.missile_storage.size() > static_cast<std::size_t>(ShipMissileId::Count))
        return ShipDocumentError::TooManyEntries;
    std::set<ShipMissileId> missiles;
    for (const auto& item : document.missile_storage)
    {
        if (item.missile < ShipMissileId::Homing || item.missile >= ShipMissileId::Count)
            return ShipDocumentError::InvalidMissile;
        if (!missiles.insert(item.missile).second) return ShipDocumentError::DuplicateMissile;
        // Zero IS allowed here, unlike cargo: "carries no nukes" is exactly the
        // kind of thing a variant exists to say, and forcing it to be expressed
        // by absence would make it indistinguishable from "inherits from the
        // template".
        if (item.capacity > SHIP_DOCUMENT_MAX_MISSILE_CAPACITY)
            return ShipDocumentError::InvalidMissileCapacity;
    }

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

    nlohmann::json missile_storage = nlohmann::json::array();
    for (const auto& item : document.missile_storage)
        missile_storage.push_back({{"missile", shipMissileId(item.missile)}, {"capacity", item.capacity}});

    const auto optional_number = [](const std::optional<float>& value) {
        return value ? nlohmann::json(*value) : nlohmann::json(nullptr);
    };

    return {{"hull_max", document.hull_max ? nlohmann::json(*document.hull_max) : nlohmann::json(nullptr)},
            {"front_shield_max", document.front_shield_max ? nlohmann::json(*document.front_shield_max) : nlohmann::json(nullptr)},
            {"rear_shield_max", document.rear_shield_max ? nlohmann::json(*document.rear_shield_max) : nlohmann::json(nullptr)},
            {"impulse_speed_max", optional_number(document.impulse_speed_max)},
            {"turn_speed_max", optional_number(document.turn_speed_max)},
            {"warp_speed_per_level", optional_number(document.warp_speed_per_level)},
            {"missile_storage", std::move(missile_storage)},
            {"systems", std::move(systems)},
            {"resources", std::move(resources)},
            {"cargo", std::move(cargo)},
            {"crew_positions", document.crew_position_ids}};
}

ShipDocumentError parseShipDocumentOverrides(
    const nlohmann::json& overrides, ShipDocument& output, int schema_version)
{
    if (!overrides.is_object()) return ShipDocumentError::InvalidStructure;
    if (schema_version < 4 || schema_version > 7) return ShipDocumentError::InvalidStructure;
    std::set<std::string> allowed{"systems", "resources", "cargo", "crew_positions"};
    if (schema_version >= 5) allowed.insert("hull_max");
    if (schema_version >= 6)
    {
        allowed.insert("front_shield_max");
        allowed.insert("rear_shield_max");
    }
    // Schema 7 is engines and allowed armament (#55). Older documents keep
    // parsing untouched and simply inherit both from their template, which is
    // what the absence of an override has always meant here.
    if (schema_version >= 7)
    {
        allowed.insert("impulse_speed_max");
        allowed.insert("turn_speed_max");
        allowed.insert("warp_speed_per_level");
        allowed.insert("missile_storage");
    }
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
    if (schema_version >= 5)
    {
        const auto& hull_max = overrides["hull_max"];
        if (!hull_max.is_null())
        {
            if (!hull_max.is_number()) return ShipDocumentError::InvalidHullMax;
            const double value = hull_max.get<double>();
            if (!std::isfinite(value) || value <= 0.0
                || value > static_cast<double>(SHIP_DOCUMENT_MAX_HULL))
                return ShipDocumentError::InvalidHullMax;
            candidate.hull_max = static_cast<float>(value);
        }
    }
    if (schema_version >= 6)
    {
        const auto parse_shield_max = [&](const char* key, std::optional<float>& output) {
            const auto& shield_max = overrides[key];
            if (shield_max.is_null()) return ShipDocumentError::None;
            if (!shield_max.is_number()) return ShipDocumentError::InvalidShieldMax;
            const double value = shield_max.get<double>();
            if (!std::isfinite(value) || value <= 0.0
                || value > static_cast<double>(SHIP_DOCUMENT_MAX_SHIELD))
                return ShipDocumentError::InvalidShieldMax;
            output = static_cast<float>(value);
            return ShipDocumentError::None;
        };
        if (parse_shield_max("front_shield_max", candidate.front_shield_max)
                != ShipDocumentError::None
            || parse_shield_max("rear_shield_max", candidate.rear_shield_max)
                != ShipDocumentError::None)
            return ShipDocumentError::InvalidShieldMax;
    }
    if (schema_version >= 7)
    {
        const auto parse_speed = [&](const char* key, float ceiling, std::optional<float>& output) {
            const auto& speed = overrides[key];
            if (speed.is_null()) return true;
            if (!speed.is_number()) return false;
            const double value = speed.get<double>();
            if (!std::isfinite(value) || value <= 0.0 || value > static_cast<double>(ceiling))
                return false;
            output = static_cast<float>(value);
            return true;
        };
        if (!parse_speed("impulse_speed_max", SHIP_DOCUMENT_MAX_IMPULSE_SPEED, candidate.impulse_speed_max)
            || !parse_speed("turn_speed_max", SHIP_DOCUMENT_MAX_TURN_SPEED, candidate.turn_speed_max)
            || !parse_speed("warp_speed_per_level", SHIP_DOCUMENT_MAX_WARP_SPEED, candidate.warp_speed_per_level))
            return ShipDocumentError::InvalidEngineSpeed;

        const auto& missile_storage = overrides["missile_storage"];
        if (!missile_storage.is_array()) return ShipDocumentError::InvalidStructure;
        if (missile_storage.size() > static_cast<std::size_t>(ShipMissileId::Count))
            return ShipDocumentError::TooManyEntries;
        for (const auto& item : missile_storage)
        {
            if (!item.is_object()) return ShipDocumentError::InvalidStructure;
            for (auto it = item.begin(); it != item.end(); ++it)
                if (it.key() != "missile" && it.key() != "capacity")
                    return ShipDocumentError::UnknownFields;
            if (item.size() != 2 || !item.contains("missile") || !item["missile"].is_string()
                || !item.contains("capacity")) return ShipDocumentError::InvalidStructure;
            ShipMissileStorage value;
            if (!parseShipMissileId(item["missile"].get<std::string>(), value.missile))
                return ShipDocumentError::InvalidMissile;
            if (!item["capacity"].is_number_unsigned())
            {
                // A negative capacity is not a rounding accident, it is a broken
                // document: reject it instead of clamping it to zero, which
                // would silently turn "corrupt" into "carries none".
                if (!item["capacity"].is_number_integer())
                    return ShipDocumentError::InvalidMissileCapacity;
                if (item["capacity"].get<std::int64_t>() < 0)
                    return ShipDocumentError::InvalidMissileCapacity;
            }
            const auto capacity = item["capacity"].get<std::uint64_t>();
            if (capacity > SHIP_DOCUMENT_MAX_MISSILE_CAPACITY)
                return ShipDocumentError::InvalidMissileCapacity;
            value.capacity = static_cast<std::uint32_t>(capacity);
            candidate.missile_storage.push_back(value);
        }
    }

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
