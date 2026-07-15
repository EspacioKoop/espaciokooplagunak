#pragma once

#include <cstddef>
#include <cstdint>
#include <string>
#include <vector>
#include <nlohmann/json.hpp>

enum class ShipSystemId
{
    Reactor,
    BeamWeapons,
    MissileSystem,
    Maneuver,
    Impulse,
    Warp,
    JumpDrive,
    FrontShield,
    RearShield,
    Count,
};

struct ShipSystemOverride
{
    ShipSystemId system = ShipSystemId::Reactor;
    float health = 1.0f;
};

inline bool operator==(const ShipSystemOverride& lhs, const ShipSystemOverride& rhs)
{
    return lhs.system == rhs.system && lhs.health == rhs.health;
}

struct ShipResourceAmount
{
    std::string id;
    float amount = 0.0f;
};

inline bool operator==(const ShipResourceAmount& lhs, const ShipResourceAmount& rhs)
{
    return lhs.id == rhs.id && lhs.amount == rhs.amount;
}

struct ShipCargoAmount
{
    std::string id;
    std::uint32_t quantity = 0;
};

inline bool operator==(const ShipCargoAmount& lhs, const ShipCargoAmount& rhs)
{
    return lhs.id == rhs.id && lhs.quantity == rhs.quantity;
}

struct ShipDocument
{
    std::vector<ShipSystemOverride> systems;
    std::vector<ShipResourceAmount> resources;
    std::vector<ShipCargoAmount> cargo;
    std::vector<std::string> crew_position_ids;
};

inline bool operator==(const ShipDocument& lhs, const ShipDocument& rhs)
{
    return lhs.systems == rhs.systems && lhs.resources == rhs.resources
        && lhs.cargo == rhs.cargo && lhs.crew_position_ids == rhs.crew_position_ids;
}

inline bool operator!=(const ShipDocument& lhs, const ShipDocument& rhs)
{
    return !(lhs == rhs);
}

enum class ShipDocumentError
{
    None,
    InvalidStructure,
    UnknownFields,
    TooManyEntries,
    InvalidSystem,
    DuplicateSystem,
    InvalidSystemHealth,
    InvalidResourceId,
    DuplicateResource,
    InvalidResourceAmount,
    InvalidCargoId,
    DuplicateCargo,
    InvalidCargoQuantity,
    InvalidCrewPosition,
    DuplicateCrewPosition,
};

constexpr std::size_t SHIP_DOCUMENT_MAX_RESOURCES = 64;
constexpr std::size_t SHIP_DOCUMENT_MAX_CARGO = 64;
constexpr std::size_t SHIP_DOCUMENT_MAX_CREW_POSITIONS = 16;
constexpr float SHIP_DOCUMENT_MAX_RESOURCE_AMOUNT = 1'000'000'000.0f;
constexpr std::uint32_t SHIP_DOCUMENT_MAX_CARGO_QUANTITY = 1'000'000;

const char* shipSystemId(ShipSystemId system);
bool parseShipSystemId(const std::string& value, ShipSystemId& system);
ShipDocumentError validateShipDocument(const ShipDocument& document);
nlohmann::json shipDocumentOverridesJson(const ShipDocument& document);
ShipDocumentError parseShipDocumentOverrides(const nlohmann::json& overrides, ShipDocument& output);
