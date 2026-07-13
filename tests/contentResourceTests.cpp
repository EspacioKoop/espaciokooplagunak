#include "content/contentResource.h"

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
    switch(type)
    {
    case ContentResourceType::Campaign:
        return {type, "campaign-1", "Campaign", "Description", "map-1, map-2", "map-1"};
    case ContentResourceType::Map:
        return {type, "map-1", "Map", "Description", "scenario_00_basic.lua", "4"};
    case ContentResourceType::Character:
        return {type, "character-1", "Character", "Description", "helms", "Pilot"};
    case ContentResourceType::Ship:
        return {type, "ship-1", "Ship", "Description", "Phobos M3P", "Human Navy"};
    }
    std::abort();
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
    document["version"] = 2;
    expect(parseJson(document, parsed) == ContentResourceError::UnsupportedFormatOrVersion,
        "future version is rejected");
    document["version"] = 1.0;
    expect(parseJson(document, parsed) == ContentResourceError::UnsupportedFormatOrVersion,
        "floating-point version is rejected");
    document["version"] = std::numeric_limits<std::uint64_t>::max();
    expect(parseJson(document, parsed) == ContentResourceError::UnsupportedFormatOrVersion,
        "out-of-range unsigned version is rejected without throwing");

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
