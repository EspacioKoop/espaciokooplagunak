#include "content/shipDocument.h"

#include <cmath>
#include <cstdlib>
#include <iostream>
#include <limits>
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

ShipDocument validDocument()
{
    ShipDocument document;
    document.hull_max = 250.0f;
    document.front_shield_max = 120.0f;
    document.rear_shield_max = 90.0f;
    document.systems = {
        {ShipSystemId::Reactor, 0.5f},
        {ShipSystemId::FrontShield, -0.25f},
    };
    document.resources = {{"energy", 800.0f}, {"coolant", 10.0f}};
    document.cargo = {{"medicine", 4}, {"spare-parts", 2}};
    document.impulse_speed_max = 90.0f;
    document.turn_speed_max = 12.5f;
    document.warp_speed_per_level = 1200.0f;
    // Nukes explicitly at zero: this ship is allowed to carry none, which is a
    // DIFFERENT statement from not overriding the missile at all.
    document.missile_storage = {{ShipMissileId::Homing, 12}, {ShipMissileId::Nuke, 0}};
    document.crew_position_ids = {"helms", "engineering", "relay"};
    return document;
}
}

int main()
{
    const auto valid = validDocument();
    expect(validateShipDocument({}) == ShipDocumentError::None,
        "all ship overrides are optional");
    expect(validateShipDocument(valid) == ShipDocumentError::None,
        "typed ship document validates");

    for (const float hull_max : {
        0.0f, -1.0f, SHIP_DOCUMENT_MAX_HULL + 1.0f,
        std::numeric_limits<float>::infinity(), std::numeric_limits<float>::quiet_NaN(),
    })
    {
        auto invalid_hull = valid;
        invalid_hull.hull_max = hull_max;
        expect(validateShipDocument(invalid_hull) == ShipDocumentError::InvalidHullMax,
            "maximum hull must be finite, positive and bounded");
    }

    for (const float shield_max : {
        0.0f, -1.0f, SHIP_DOCUMENT_MAX_SHIELD + 1.0f,
        std::numeric_limits<float>::infinity(), std::numeric_limits<float>::quiet_NaN(),
    })
    {
        auto invalid_shield = valid;
        invalid_shield.front_shield_max = shield_max;
        expect(validateShipDocument(invalid_shield) == ShipDocumentError::InvalidShieldMax,
            "shield maximum must be finite, positive and bounded");
    }

    for (int index = 0; index < static_cast<int>(ShipSystemId::Count); ++index)
    {
        const auto system = static_cast<ShipSystemId>(index);
        ShipSystemId parsed = ShipSystemId::Count;
        expect(std::string(shipSystemId(system)).size() > 0,
            "each system has a canonical ID");
        expect(parseShipSystemId(shipSystemId(system), parsed) && parsed == system,
            "each canonical system ID round-trips");
    }
    ShipSystemId parsed = ShipSystemId::Reactor;
    expect(!parseShipSystemId("weapons", parsed),
        "unknown or ambiguous system aliases are rejected");

    auto document = valid;
    document.systems[0].system = ShipSystemId::Count;
    expect(validateShipDocument(document) == ShipDocumentError::InvalidSystem,
        "out-of-range system enum is rejected");
    document = valid;
    document.systems.push_back(document.systems.front());
    expect(validateShipDocument(document) == ShipDocumentError::DuplicateSystem,
        "duplicate system override is rejected");
    for (const float health : {
        -1.01f, 1.01f, std::numeric_limits<float>::infinity(),
        std::numeric_limits<float>::quiet_NaN(),
    })
    {
        document = valid;
        document.systems[0].health = health;
        expect(validateShipDocument(document) == ShipDocumentError::InvalidSystemHealth,
            "system health must be finite and within [-1, 1]");
    }

    document = valid;
    document.resources[0].id = "Uppercase";
    expect(validateShipDocument(document) == ShipDocumentError::InvalidResourceId,
        "resource IDs are portable lowercase identifiers");
    document = valid;
    document.resources.push_back(document.resources.front());
    expect(validateShipDocument(document) == ShipDocumentError::DuplicateResource,
        "duplicate resource is rejected");
    for (const float amount : {
        -0.01f, SHIP_DOCUMENT_MAX_RESOURCE_AMOUNT + 128.0f,
        std::numeric_limits<float>::infinity(), std::numeric_limits<float>::quiet_NaN(),
    })
    {
        document = valid;
        document.resources[0].amount = amount;
        expect(validateShipDocument(document) == ShipDocumentError::InvalidResourceAmount,
            "resource amount must be finite and bounded");
    }

    document = valid;
    document.cargo[0].id = "../medicine";
    expect(validateShipDocument(document) == ShipDocumentError::InvalidCargoId,
        "cargo IDs reject paths and punctuation");
    document = valid;
    document.cargo.push_back(document.cargo.front());
    expect(validateShipDocument(document) == ShipDocumentError::DuplicateCargo,
        "duplicate cargo is rejected");
    for (const std::uint32_t quantity : {0u, SHIP_DOCUMENT_MAX_CARGO_QUANTITY + 1u})
    {
        document = valid;
        document.cargo[0].quantity = quantity;
        expect(validateShipDocument(document) == ShipDocumentError::InvalidCargoQuantity,
            "cargo quantity must be positive and bounded");
    }

    document = valid;
    document.crew_position_ids[0] = "helmsofficer";
    expect(validateShipDocument(document) == ShipDocumentError::InvalidCrewPosition,
        "crew positions require canonical IDs rather than accepted legacy aliases");
    document = valid;
    document.crew_position_ids.push_back("helms");
    expect(validateShipDocument(document) == ShipDocumentError::DuplicateCrewPosition,
        "duplicate crew position is rejected");

    document = valid;
    document.resources.resize(SHIP_DOCUMENT_MAX_RESOURCES + 1);
    expect(validateShipDocument(document) == ShipDocumentError::TooManyEntries,
        "oversized resource collections are rejected before item validation");

    const auto overrides = shipDocumentOverridesJson(valid);
    expect(overrides["hull_max"] == 250.0f,
        "canonical overrides include the optional maximum hull");
    expect(overrides["front_shield_max"] == 120.0f
            && overrides["rear_shield_max"] == 90.0f,
        "canonical overrides include independent shield maxima");
    ShipDocument parsed_document;
    expect(parseShipDocumentOverrides(overrides, parsed_document) == ShipDocumentError::None
            && parsed_document == valid,
        "ship overrides round-trip through canonical JSON");

    const auto parsed_before_error = parsed_document;
    auto hostile = overrides;
    hostile["callback"] = "never()";
    expect(parseShipDocumentOverrides(hostile, parsed_document) == ShipDocumentError::UnknownFields,
        "unknown override fields are rejected");
    expect(parsed_document == parsed_before_error, "failed override parse does not mutate output");

    auto legacy_v4 = overrides;
    legacy_v4.erase("hull_max");
    legacy_v4.erase("front_shield_max");
    legacy_v4.erase("rear_shield_max");
    legacy_v4.erase("impulse_speed_max");
    legacy_v4.erase("turn_speed_max");
    legacy_v4.erase("warp_speed_per_level");
    legacy_v4.erase("missile_storage");
    ShipDocument migrated_v4;
    expect(parseShipDocumentOverrides(legacy_v4, migrated_v4, 4) == ShipDocumentError::None
            && !migrated_v4.hull_max,
        "v4 overrides migrate in memory without inventing a hull value");
    expect(parseShipDocumentOverrides(legacy_v4, migrated_v4, 5)
            == ShipDocumentError::InvalidStructure,
        "v5 overrides require an explicit nullable hull field");

    auto legacy_v5 = overrides;
    legacy_v5.erase("front_shield_max");
    legacy_v5.erase("rear_shield_max");
    legacy_v5.erase("impulse_speed_max");
    legacy_v5.erase("turn_speed_max");
    legacy_v5.erase("warp_speed_per_level");
    legacy_v5.erase("missile_storage");
    ShipDocument migrated_v5;
    expect(parseShipDocumentOverrides(legacy_v5, migrated_v5, 5) == ShipDocumentError::None
            && migrated_v5.hull_max == 250.0f
            && !migrated_v5.front_shield_max && !migrated_v5.rear_shield_max,
        "v5 overrides migrate without inventing shield maxima");

    hostile = overrides;
    hostile["hull_max"] = 0;
    expect(parseShipDocumentOverrides(hostile, parsed_document) == ShipDocumentError::InvalidHullMax,
        "non-positive hull JSON is rejected");
    hostile = overrides;
    hostile["rear_shield_max"] = -1;
    expect(parseShipDocumentOverrides(hostile, parsed_document) == ShipDocumentError::InvalidShieldMax,
        "non-positive shield JSON is rejected without mutating output");
    expect(parsed_document == parsed_before_error,
        "failed shield parse does not partially mutate output");
    hostile = overrides;
    hostile.erase("cargo");
    expect(parseShipDocumentOverrides(hostile, parsed_document) == ShipDocumentError::InvalidStructure,
        "all canonical override collections are required");
    hostile = overrides;
    hostile["systems"][0]["health"] = "perfect";
    expect(parseShipDocumentOverrides(hostile, parsed_document) == ShipDocumentError::InvalidStructure,
        "system health must be numeric JSON");
    hostile = overrides;
    hostile["systems"][0]["lua"] = "setSystemHealth()";
    expect(parseShipDocumentOverrides(hostile, parsed_document) == ShipDocumentError::UnknownFields,
        "system entries reject executable-looking extra fields");
    hostile = overrides;
    hostile["resources"][0]["amount"] = -1;
    expect(parseShipDocumentOverrides(hostile, parsed_document) == ShipDocumentError::InvalidResourceAmount,
        "negative resource JSON values are rejected");
    hostile = overrides;
    hostile["cargo"][0]["quantity"] = 1.5;
    expect(parseShipDocumentOverrides(hostile, parsed_document) == ShipDocumentError::InvalidCargoQuantity,
        "fractional cargo JSON values are rejected");
    hostile = overrides;
    hostile["crew_positions"][0] = "helmsofficer";
    expect(parseShipDocumentOverrides(hostile, parsed_document) == ShipDocumentError::InvalidCrewPosition,
        "legacy crew aliases are rejected in v4 overrides");

    // --- Motores y armamento permitido (#55) ---------------------------------

    expect(overrides["impulse_speed_max"] == 90.0f && overrides["turn_speed_max"] == 12.5f
            && overrides["warp_speed_per_level"] == 1200.0f,
        "canonical overrides include the three engine speeds");
    expect(overrides["missile_storage"].size() == 2
            && overrides["missile_storage"][1]["missile"] == "nuke"
            && overrides["missile_storage"][1]["capacity"] == 0,
        "canonical overrides carry allowed armament, zero capacity included");

    // Zero is a statement and absence is a different one. If these two collapsed
    // into the same document, "carries no nukes" and "inherits the template's
    // nukes" would be impossible to tell apart.
    ShipDocument no_nukes;
    no_nukes.missile_storage = {{ShipMissileId::Nuke, 0}};
    expect(no_nukes != ShipDocument{},
        "declaring zero capacity is not the same document as declaring nothing");

    auto engines = overrides;
    for (const char* key : {"impulse_speed_max", "turn_speed_max", "warp_speed_per_level"})
    {
        engines = overrides;
        engines[key] = 0;
        expect(parseShipDocumentOverrides(engines, parsed_document) == ShipDocumentError::InvalidEngineSpeed,
            "a non-positive engine speed is rejected");
        engines[key] = -5;
        expect(parseShipDocumentOverrides(engines, parsed_document) == ShipDocumentError::InvalidEngineSpeed,
            "a negative engine speed is rejected");
        engines[key] = "fast";
        expect(parseShipDocumentOverrides(engines, parsed_document) == ShipDocumentError::InvalidEngineSpeed,
            "a non-numeric engine speed is rejected instead of coerced");
    }
    engines = overrides;
    engines["turn_speed_max"] = SHIP_DOCUMENT_MAX_TURN_SPEED + 1.0f;
    expect(parseShipDocumentOverrides(engines, parsed_document) == ShipDocumentError::InvalidEngineSpeed,
        "an engine speed over its ceiling is rejected");

    auto armament = overrides;
    armament["missile_storage"][0]["missile"] = "photon";
    expect(parseShipDocumentOverrides(armament, parsed_document) == ShipDocumentError::InvalidMissile,
        "a missile outside the closed allowlist is rejected");
    armament = overrides;
    armament["missile_storage"][1]["missile"] = "homing";
    expect(parseShipDocumentOverrides(armament, parsed_document) == ShipDocumentError::DuplicateMissile,
        "the same missile cannot be declared twice");
    armament = overrides;
    armament["missile_storage"][0]["capacity"] = -1;
    expect(parseShipDocumentOverrides(armament, parsed_document) == ShipDocumentError::InvalidMissileCapacity,
        "a negative capacity is rejected, not clamped to zero");
    armament = overrides;
    armament["missile_storage"][0]["capacity"] = SHIP_DOCUMENT_MAX_MISSILE_CAPACITY + 1;
    expect(parseShipDocumentOverrides(armament, parsed_document) == ShipDocumentError::InvalidMissileCapacity,
        "a capacity over the ceiling is rejected");
    armament = overrides;
    armament["missile_storage"][0]["warhead"] = "antimatter";
    expect(parseShipDocumentOverrides(armament, parsed_document) == ShipDocumentError::UnknownFields,
        "unknown armament fields are rejected");

    // A v6 document has no engines and no armament, and parsing it must not
    // invent either: absence means "inherit from the template".
    auto legacy_v6 = overrides;
    legacy_v6.erase("impulse_speed_max");
    legacy_v6.erase("turn_speed_max");
    legacy_v6.erase("warp_speed_per_level");
    legacy_v6.erase("missile_storage");
    ShipDocument migrated_v6;
    expect(parseShipDocumentOverrides(legacy_v6, migrated_v6, 6) == ShipDocumentError::None
            && !migrated_v6.impulse_speed_max && !migrated_v6.turn_speed_max
            && !migrated_v6.warp_speed_per_level && migrated_v6.missile_storage.empty()
            && migrated_v6.hull_max == 250.0f,
        "v6 overrides migrate without inventing engines or armament");
    expect(parseShipDocumentOverrides(legacy_v6, migrated_v6, 7) == ShipDocumentError::InvalidStructure,
        "v7 overrides require the engine and armament fields to be present");

    // The document enum is independent from the engine's on purpose, so its
    // wire names are part of the format and must not drift.
    expect(std::string(shipMissileId(ShipMissileId::HVLI)) == "hvli", "missile ids are stable");
    ShipMissileId round_trip = ShipMissileId::Count;
    expect(parseShipMissileId("emp", round_trip) && round_trip == ShipMissileId::EMP,
        "missile ids parse back");
    expect(!parseShipMissileId("", round_trip) && !parseShipMissileId("torpedo", round_trip),
        "unknown missile ids do not parse");

    std::cout << "SHIP_DOCUMENT_TESTS_OK checks=" << checks << "\n";
    return 0;
}
