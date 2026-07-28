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

    std::cout << "SHIP_DOCUMENT_TESTS_OK checks=" << checks << "\n";
    return 0;
}
