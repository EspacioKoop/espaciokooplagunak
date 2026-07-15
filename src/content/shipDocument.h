#pragma once

#include <cstddef>
#include <cstdint>
#include <string>
#include <vector>

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

struct ShipResourceAmount
{
    std::string id;
    float amount = 0.0f;
};

struct ShipCargoAmount
{
    std::string id;
    std::uint32_t quantity = 0;
};

struct ShipDocument
{
    std::vector<ShipSystemOverride> systems;
    std::vector<ShipResourceAmount> resources;
    std::vector<ShipCargoAmount> cargo;
    std::vector<std::string> crew_position_ids;
};

enum class ShipDocumentError
{
    None,
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
