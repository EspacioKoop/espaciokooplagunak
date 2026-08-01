#pragma once

#include <cstddef>
#include <cstdint>
#include <optional>
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

// Missile kinds a ship may be allowed to carry. This mirrors EMissileWeapons
// from the simulation but is deliberately a separate, closed enum: the document
// is a portable format and must not change meaning because upstream reorders an
// engine enum. The mapping lives at the point of application, not here.
enum class ShipMissileId
{
    Homing,
    Nuke,
    Mine,
    EMP,
    HVLI,
    Count,
};

// How many missiles of one kind the ship may store. This is the "armamento
// permitido" of the scope: a capacity, not a weapon tuning. Zero is meaningful
// and allowed — it is how a variant declares "this ship carries no nukes" —
// which is why it is not rejected like a zero cargo quantity is.
struct ShipMissileStorage
{
    ShipMissileId missile = ShipMissileId::Homing;
    std::uint32_t capacity = 0;
};

inline bool operator==(const ShipMissileStorage& lhs, const ShipMissileStorage& rhs)
{
    return lhs.missile == rhs.missile && lhs.capacity == rhs.capacity;
}

// Which engine speed an edit refers to. It exists so the edit session can offer
// one pair of methods instead of three, and so the GUI can carry the choice in a
// selector like it already does for systems.
enum class ShipEngineId
{
    Impulse,
    Turn,
    Warp,
    Count,
};

struct ShipDocument
{
    // Structural overrides are optional: absence preserves the template value.
    std::optional<float> hull_max;
    std::optional<float> front_shield_max;
    std::optional<float> rear_shield_max;
    // Engine overrides. They are capability limits of the design ("how fast can
    // this hull go"), never operating state ("how fast is it going"), which is
    // the structural/operational split the campaign roadmap asked for: a
    // template reused in two campaigns keeps its top speed and shares none of
    // its throttle.
    std::optional<float> impulse_speed_max;
    std::optional<float> turn_speed_max;
    std::optional<float> warp_speed_per_level;
    std::vector<ShipMissileStorage> missile_storage;
    std::vector<ShipSystemOverride> systems;
    std::vector<ShipResourceAmount> resources;
    std::vector<ShipCargoAmount> cargo;
    std::vector<std::string> crew_position_ids;
};

inline bool operator==(const ShipDocument& lhs, const ShipDocument& rhs)
{
    return lhs.hull_max == rhs.hull_max
        && lhs.front_shield_max == rhs.front_shield_max
        && lhs.rear_shield_max == rhs.rear_shield_max
        && lhs.impulse_speed_max == rhs.impulse_speed_max
        && lhs.turn_speed_max == rhs.turn_speed_max
        && lhs.warp_speed_per_level == rhs.warp_speed_per_level
        && lhs.missile_storage == rhs.missile_storage
        && lhs.systems == rhs.systems && lhs.resources == rhs.resources
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
    InvalidHullMax,
    InvalidShieldMax,
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
    InvalidEngineSpeed,
    InvalidMissile,
    DuplicateMissile,
    InvalidMissileCapacity,
};

constexpr std::size_t SHIP_DOCUMENT_MAX_RESOURCES = 64;
constexpr std::size_t SHIP_DOCUMENT_MAX_CARGO = 64;
constexpr std::size_t SHIP_DOCUMENT_MAX_CREW_POSITIONS = 16;
constexpr float SHIP_DOCUMENT_MAX_HULL = 1'000'000.0f;
constexpr float SHIP_DOCUMENT_MAX_SHIELD = 1'000'000.0f;
constexpr float SHIP_DOCUMENT_MAX_RESOURCE_AMOUNT = 1'000'000'000.0f;
constexpr std::uint32_t SHIP_DOCUMENT_MAX_CARGO_QUANTITY = 1'000'000;
// Engine limits. Generous on purpose: this is a validation bound against a
// corrupt document, not a balance opinion. Deciding that a ship is too fast is
// the GM's job and the scenario's, not the codec's.
constexpr float SHIP_DOCUMENT_MAX_IMPULSE_SPEED = 100'000.0f;
constexpr float SHIP_DOCUMENT_MAX_TURN_SPEED = 3'600.0f;
constexpr float SHIP_DOCUMENT_MAX_WARP_SPEED = 100'000.0f;
constexpr std::uint32_t SHIP_DOCUMENT_MAX_MISSILE_CAPACITY = 1'000;

const char* shipSystemId(ShipSystemId system);
bool parseShipSystemId(const std::string& value, ShipSystemId& system);
const char* shipMissileId(ShipMissileId missile);
bool parseShipMissileId(const std::string& value, ShipMissileId& missile);
// The engine override a document field corresponds to, so callers never index
// ShipDocument members by hand.
std::optional<float>& shipEngineSpeed(ShipDocument& document, ShipEngineId engine);
const std::optional<float>& shipEngineSpeed(const ShipDocument& document, ShipEngineId engine);
float shipEngineSpeedCeiling(ShipEngineId engine);
ShipDocumentError validateShipDocument(const ShipDocument& document);
nlohmann::json shipDocumentOverridesJson(const ShipDocument& document);
ShipDocumentError parseShipDocumentOverrides(
    const nlohmann::json& overrides,
    ShipDocument& output,
    int schema_version = 7
);
