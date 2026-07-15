#include "content/contentResource.h"

#include <algorithm>
#include <cstdlib>
#include <cstdint>
#include <iostream>
#include <limits>
#include <string>
#include <utility>
#include <vector>
#include <nlohmann/json.hpp>

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

ContentResource validResource(ContentResourceType type)
{
    ContentResource resource;
    resource.type = type;
    resource.description = "Description";
    switch(type)
    {
    case ContentResourceType::Campaign:
        resource.id = "campaign-1";
        resource.name = "Campaign";
        resource.primary = "map-1, map-2";
        resource.secondary = "map-1";
        resource.tertiary = "character-1";
        resource.quaternary = "ship-1";
        resource.quinary = "map-1>map-2";
        break;
    case ContentResourceType::Map:
        resource.id = "map-1";
        resource.name = "Map";
        resource.primary = "scenario_00_basic.lua";
        resource.secondary = "4";
        break;
    case ContentResourceType::Character:
        resource.id = "character-1";
        resource.name = "Character";
        resource.primary = "helms";
        resource.secondary = "Pilot";
        resource.tertiary = "captain, veteran";
        resource.quaternary = "ship-1";
        break;
    case ContentResourceType::Ship:
        resource.id = "ship-1";
        resource.name = "Ship";
        resource.primary = "Phobos M3P";
        resource.secondary = "Human Navy";
        resource.ship_document.systems = {
            {ShipSystemId::Reactor, 0.75f},
            {ShipSystemId::FrontShield, -0.25f},
        };
        resource.ship_document.resources = {{"energy", 800.0f}, {"coolant", 10.0f}};
        resource.ship_document.cargo = {{"medicine", 4}, {"spare-parts", 2}};
        resource.ship_document.crew_position_ids = {"helms", "engineering"};
        break;
    }
    return resource;
}

ContentResourceError parseJson(const nlohmann::json& document, ContentResource& output)
{
    return parseContentResource(document.dump(), output);
}
}

int main()
{
    for (const auto type : {
        ContentResourceType::Campaign,
        ContentResourceType::Map,
        ContentResourceType::Character,
        ContentResourceType::Ship,
    })
    {
        const auto source = validResource(type);
        ContentResource parsed;
        expect(parseContentResource(serializeContentResource(source, 2), parsed) == ContentResourceError::None,
            "each resource type round-trips");
        expect(parsed == source, "round-trip preserves every field");
    }

    const auto valid_map = validResource(ContentResourceType::Map);
    const auto compact = serializeContentResource(valid_map);
    std::string at_limit = compact;
    at_limit.append(CONTENT_RESOURCE_MAX_IMPORT_BYTES - at_limit.size(), ' ');
    ContentResource parsed;
    expect(parseContentResource(at_limit, parsed) == ContentResourceError::None,
        "document exactly at 64 KiB is accepted");
    at_limit.push_back(' ');
    expect(parseContentResource(at_limit, parsed) == ContentResourceError::ImportTooLarge,
        "document above 64 KiB is rejected before parsing");

    const std::string duplicate_root =
        R"({"format":"espaciokoop-content","version":1,"type":"map","id":"map-1","id":"map-2","name":"Map","description":"","fields":{"scenario_file":"scenario_00_basic.lua","recommended_players":"4"}})";
    expect(parseContentResource(duplicate_root, parsed) == ContentResourceError::DuplicateJsonKeys,
        "duplicate root key is rejected");

    const std::string duplicate_nested =
        R"({"format":"espaciokoop-content","version":1,"type":"map","id":"map-1","name":"Map","description":"","fields":{"scenario_file":"scenario_00_basic.lua","scenario_file":"scenario_01_waves.lua","recommended_players":"4"}})";
    expect(parseContentResource(duplicate_nested, parsed) == ContentResourceError::DuplicateJsonKeys,
        "duplicate nested key is rejected");

    const std::string duplicate_map_object =
        R"({"format":"espaciokoop-content","version":3,"type":"map","id":"map-1","name":"Map","description":"","fields":{"scenario_file":"scenario_00_basic.lua","recommended_players":"4","objects":[{"id":"asteroid-1","id":"asteroid-2","kind":"asteroid","position":[0,0],"rotation":0,"properties":{"size":120}}]}})";
    expect(parseContentResource(duplicate_map_object, parsed) == ContentResourceError::DuplicateJsonKeys,
        "duplicate key inside a v3 map object is rejected before canonicalization");

    const std::string duplicate_ship_override =
        R"({"format":"espaciokoop-content","version":4,"type":"ship","id":"ship-1","name":"Ship","description":"","fields":{"template":"Phobos M3P","faction":"Human Navy","overrides":{"systems":[],"resources":[{"id":"energy","id":"coolant","amount":10}],"cargo":[],"crew_positions":[]}}})";
    expect(parseContentResource(duplicate_ship_override, parsed) == ContentResourceError::DuplicateJsonKeys,
        "duplicate key inside a v4 ship override is rejected before canonicalization");

    auto sibling_keys = nlohmann::json::parse(compact);
    sibling_keys["extra_a"] = {{"same", 1}};
    sibling_keys["extra_b"] = {{"same", 2}};
    expect(parseJson(sibling_keys, parsed) == ContentResourceError::UnknownFields,
        "same keys in sibling objects are not false duplicates");

    expect(parseContentResource("{broken", parsed) == ContentResourceError::InvalidJson,
        "malformed JSON is rejected");
    expect(parseContentResource("[]", parsed) == ContentResourceError::InvalidJson,
        "non-object JSON is rejected");

    auto document = nlohmann::json::parse(compact);
    document["unknown"] = true;
    expect(parseJson(document, parsed) == ContentResourceError::UnknownFields,
        "unknown top-level field is rejected");

    document = nlohmann::json::parse(compact);
    document["version"] = 5;
    expect(parseJson(document, parsed) == ContentResourceError::UnsupportedFormatOrVersion,
        "future version is rejected");
    document["version"] = 1.0;
    expect(parseJson(document, parsed) == ContentResourceError::UnsupportedFormatOrVersion,
        "floating-point version is rejected");
    document["version"] = std::numeric_limits<std::uint64_t>::max();
    expect(parseJson(document, parsed) == ContentResourceError::UnsupportedFormatOrVersion,
        "out-of-range unsigned version is rejected without throwing");

    auto visual_map = valid_map;
    MapObject visual_asteroid;
    visual_asteroid.id = "asteroid-1";
    visual_asteroid.kind = MapObjectKind::Asteroid;
    visual_asteroid.transform = {1200.0f, -300.0f, 45.0f};
    visual_asteroid.size = 150.0f;
    visual_map.map_document.objects.push_back(visual_asteroid);
    const auto visual_json = nlohmann::json::parse(serializeContentResource(visual_map, 2));
    expect(visual_json["version"] == 4 && visual_json["fields"]["objects"].size() == 1,
        "map serialization writes canonical v4 resources");
    expect(parseJson(visual_json, parsed) == ContentResourceError::None && parsed == visual_map,
        "v4 map object document round-trips through ContentResource");

    auto future_visual = visual_json;
    const nlohmann::json future_object = {
        {"id", "future-1"}, {"kind", "comet"}, {"position", {0, 0}},
        {"rotation", 0}, {"properties", {{"tail", 10}}}, {"callback", "never()"},
    };
    future_visual["fields"]["objects"].push_back(future_object);
    expect(parseJson(future_visual, parsed) == ContentResourceError::None
            && parsed.map_document.objects.back().kind == MapObjectKind::Unsupported,
        "v4 resource preserves a future map object without interpreting it");
    const auto future_reserialized = nlohmann::json::parse(serializeContentResource(parsed));
    expect(future_reserialized["fields"]["objects"].back() == future_object,
        "future object survives the complete resource round-trip");

    auto legacy_map = visual_json;
    legacy_map["version"] = 2;
    legacy_map["fields"].erase("objects");
    expect(parseJson(legacy_map, parsed) == ContentResourceError::None
            && parsed.map_document.objects.empty(),
        "v2 map migrates in memory to an empty object document");
    const auto migrated_map = nlohmann::json::parse(serializeContentResource(parsed));
    expect(migrated_map["version"] == 4 && migrated_map["fields"]["objects"].empty(),
        "saving a migrated map emits canonical v4");

    auto invalid_visual = visual_json;
    invalid_visual["fields"]["objects"][0]["lua"] = "Asteroid()";
    const auto output_before_invalid_map = parsed;
    expect(parseJson(invalid_visual, parsed) == ContentResourceError::InvalidMapDocument,
        "supported map object rejects executable-looking extra fields");
    expect(parsed == output_before_invalid_map,
        "invalid map document does not partially mutate ContentResource output");

    auto non_map_with_objects = validResource(ContentResourceType::Ship);
    non_map_with_objects.map_document.objects.push_back(visual_asteroid);
    expect(validateContentResource(non_map_with_objects) == ContentResourceError::InvalidMapDocument,
        "non-map resource cannot carry a map document");

    auto non_ship_with_overrides = valid_map;
    non_ship_with_overrides.ship_document.systems.push_back({ShipSystemId::Reactor, 0.5f});
    expect(validateContentResource(non_ship_with_overrides) == ContentResourceError::InvalidShipDocument,
        "non-ship resource cannot carry ship overrides");

    const auto ship_v4 = nlohmann::json::parse(
        serializeContentResource(validResource(ContentResourceType::Ship), 2));
    expect(ship_v4["version"] == 4 && ship_v4["fields"]["overrides"]["systems"].size() == 2,
        "ship serialization writes canonical v4 overrides");
    expect(parseJson(ship_v4, parsed) == ContentResourceError::None
            && parsed == validResource(ContentResourceType::Ship),
        "v4 ship overrides round-trip through ContentResource");

    auto legacy_ship = ship_v4;
    legacy_ship["version"] = 3;
    legacy_ship["fields"].erase("overrides");
    expect(parseJson(legacy_ship, parsed) == ContentResourceError::None
            && parsed.ship_document == ShipDocument{},
        "v3 ship migrates in memory to an empty override document");
    const auto migrated_ship = nlohmann::json::parse(serializeContentResource(parsed));
    expect(migrated_ship["version"] == 4
            && migrated_ship["fields"]["overrides"]["systems"].empty(),
        "saving a migrated ship emits canonical v4 empty overrides");

    auto missing_overrides = ship_v4;
    missing_overrides["fields"].erase("overrides");
    const auto output_before_invalid_ship = parsed;
    expect(parseJson(missing_overrides, parsed) == ContentResourceError::InvalidShipDocument,
        "v4 ship requires an explicit override document");
    expect(parsed == output_before_invalid_ship,
        "invalid ship document does not partially mutate ContentResource output");

    auto invalid_ship = ship_v4;
    invalid_ship["fields"]["overrides"]["systems"][0]["lua"] = "setSystemHealth()";
    expect(parseJson(invalid_ship, parsed) == ContentResourceError::InvalidShipDocument,
        "v4 ship override rejects executable-looking extra fields");

    document = nlohmann::json::parse(compact);
    document["type"] = "planet";
    expect(parseJson(document, parsed) == ContentResourceError::UnknownType,
        "unknown resource type is rejected");
    document = nlohmann::json::parse(compact);
    document["name"] = 42;
    expect(parseJson(document, parsed) == ContentResourceError::MissingOrInvalidText,
        "wrong text type is rejected");
    document = nlohmann::json::parse(compact);
    document["fields"] = "not-an-object";
    expect(parseJson(document, parsed) == ContentResourceError::InvalidTypeFields,
        "wrong fields type is rejected");
    document = nlohmann::json::parse(compact);
    document["fields"]["unsafe"] = "value";
    expect(parseJson(document, parsed) == ContentResourceError::UnknownTypeFields,
        "unknown type-specific field is rejected");

    for (const auto unsafe : {
        "../scenario_00_basic.lua",
        "folder/scenario_00_basic.lua",
        "scenario_00_basic.lua/extra",
        "scenario_.lua..",
        "not_a_scenario.lua",
    })
    {
        auto resource = valid_map;
        resource.primary = unsafe;
        expect(validateContentResource(resource) == ContentResourceError::UnsafeScenarioFile,
            "unsafe scenario filename is rejected");
    }

    for (const auto count : {"0", "65", "-1", "4.5", "999999999999999999999999"})
    {
        auto resource = valid_map;
        resource.secondary = count;
        expect(validateContentResource(resource) == ContentResourceError::InvalidPlayerCount,
            "invalid recommended player count is rejected");
    }

    auto invalid = valid_map;
    invalid.id = "Uppercase";
    expect(validateContentResource(invalid) == ContentResourceError::InvalidId,
        "non-portable ID is rejected");
    invalid.id = "map-á";
    expect(validateContentResource(invalid) == ContentResourceError::InvalidId,
        "non-ASCII ID is rejected independently of locale");
    invalid = valid_map;
    invalid.name.clear();
    expect(validateContentResource(invalid) == ContentResourceError::InvalidName,
        "empty name is rejected");
    invalid = valid_map;
    invalid.description.assign(4001, 'x');
    expect(validateContentResource(invalid) == ContentResourceError::DescriptionTooLong,
        "oversized description is rejected");

    ContentResource unchanged = validResource(ContentResourceType::Ship);
    const auto before = unchanged;
    expect(parseContentResource("{broken", unchanged) == ContentResourceError::InvalidJson,
        "failed parse reports an error");
    expect(unchanged == before, "failed parse does not partially mutate output");

    auto campaign = validResource(ContentResourceType::Campaign);
    campaign.quinary = "map-1>map-2,map-2>map-1";
    expect(validateContentResource(campaign) == ContentResourceError::CampaignTransitionCycle,
        "campaign transition cycles are rejected");
    campaign.quinary = "map-1>missing";
    expect(validateContentResource(campaign) == ContentResourceError::InvalidCampaignTransitions,
        "campaign transitions cannot reference maps outside the campaign");

    auto character = validResource(ContentResourceType::Character);
    character.primary = "helmsofficer";
    expect(validateContentResource(character) == ContentResourceError::InvalidCrewPosition,
        "crew position aliases are rejected in favor of canonical IDs");
    character.primary = "helms";
    character.tertiary = "captain,captain";
    expect(validateContentResource(character) == ContentResourceError::InvalidCharacterTags,
        "duplicate character tags are rejected");

    const auto map_one = validResource(ContentResourceType::Map);
    auto map_two = map_one;
    map_two.id = "map-2";
    const auto ship = validResource(ContentResourceType::Ship);
    character = validResource(ContentResourceType::Character);
    campaign = validResource(ContentResourceType::Campaign);
    const std::vector<ContentResource> complete_library{map_one, map_two, ship, character, campaign};
    expect(validateContentLibrary(complete_library) == ContentResourceError::None,
        "campaign and character references resolve in a complete library");
    expect(validateContentLibrary({map_one, map_two, character, campaign}) == ContentResourceError::MissingDependency,
        "missing campaign or character dependency blocks library validation");

    const auto exported = nlohmann::json::parse(serializeContentResourceExport(campaign, complete_library, 2));
    expect(exported["dependencies"].is_array() && exported["dependencies"].size() == 4,
        "individual campaign export has a closed dependency manifest");
    expect(std::none_of(exported["dependencies"].begin(), exported["dependencies"].end(),
                        [](const nlohmann::json& dependency) { return dependency["missing"].get<bool>(); }),
        "complete export manifest marks no dependencies missing");
    const auto incomplete_export = nlohmann::json::parse(serializeContentResourceExport(campaign, {map_one}, 2));
    expect(std::any_of(incomplete_export["dependencies"].begin(), incomplete_export["dependencies"].end(),
                       [](const nlohmann::json& dependency) { return dependency["missing"].get<bool>(); }),
        "incomplete export manifest warns about missing dependencies");
    expect(parseContentResource(exported.dump(), parsed) == ContentResourceError::None && parsed == campaign,
        "resource with a valid dependency manifest imports without executable callbacks");
    auto tampered_manifest = exported;
    tampered_manifest["dependencies"].erase(tampered_manifest["dependencies"].begin());
    expect(parseJson(tampered_manifest, parsed) == ContentResourceError::InvalidTypeFields,
        "dependency manifest must match declarative references");

    nlohmann::json legacy_character = {
        {"format", "espaciokoop-content"}, {"version", 1}, {"type", "character"},
        {"id", "legacy-character"}, {"name", "Legacy"}, {"description", ""},
        {"fields", {{"role", "helms"}, {"callsign", "Old"}}},
    };
    expect(parseJson(legacy_character, parsed) == ContentResourceError::None
            && parsed.primary == "helms" && parsed.tertiary.empty() && parsed.quaternary.empty(),
        "v1 character imports migrate in memory to the extended model");

    legacy_character["fields"]["role"] = "helmsofficer";
    expect(parseJson(legacy_character, parsed) == ContentResourceError::None
            && parsed.primary == "helms" && parsed.quinary.empty(),
        "v1 crew position aliases migrate to their canonical ID");

    legacy_character["fields"]["role"] = "captain";
    expect(parseJson(legacy_character, parsed) == ContentResourceError::None
            && parsed.primary.empty() && parsed.quinary == "captain",
        "free-form v1 roles remain importable without inventing a crew position");
    ContentResource reparsed_legacy;
    expect(parseContentResource(serializeContentResource(parsed), reparsed_legacy) == ContentResourceError::None
            && reparsed_legacy == parsed,
        "free-form v1 roles survive migration and a v4 round-trip");

    ContentDiscardGuard guard;
    auto clean = valid_map;
    auto dirty = clean;
    dirty.name = "Edited map";
    expect(guard.confirm("close", clean, clean), "clean form needs no confirmation");
    expect(!guard.confirm("close", dirty, clean), "first destructive action is blocked");
    expect(guard.confirm("close", dirty, clean), "identical second action is confirmed");
    expect(!guard.confirm("new", dirty, clean), "different action needs its own confirmation");
    dirty.description = "Changed after warning";
    expect(!guard.confirm("new", dirty, clean), "editing after warning invalidates confirmation");
    expect(guard.confirm("new", dirty, clean), "repeated action for unchanged edited form confirms");
    guard.reset();
    expect(!guard.confirm("new", dirty, clean), "explicit reset clears pending confirmation");

    std::cout << "CONTENT_RESOURCE_TESTS_OK checks=" << checks << "\n";
    return 0;
}
