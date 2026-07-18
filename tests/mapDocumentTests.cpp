#include "content/mapDocument.h"

#include <cstdlib>
#include <iostream>
#include <limits>
#include <string>
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

nlohmann::json asteroid(const std::string& id = "asteroid-1")
{
    return {{"id", id}, {"kind", "asteroid"}, {"position", {1200.0, -300.0}},
            {"rotation", 45.0}, {"properties", {{"size", 150.0}}}};
}

nlohmann::json nebula(const std::string& id = "nebula-1")
{
    return {{"id", id}, {"kind", "nebula"}, {"position", {8000.0, 5000.0}},
            {"rotation", 0.0}, {"properties", nlohmann::json::object()}};
}
}

int main()
{
    MapDocument parsed;
    expect(parseMapDocumentObjects(nlohmann::json::array(), parsed) == MapDocumentError::None
            && parsed.objects.empty(), "empty document parses");

    const nlohmann::json source = nlohmann::json::array({asteroid(), nebula()});
    expect(parseMapDocumentObjects(source, parsed) == MapDocumentError::None,
        "asteroid and nebula parse");
    expect(parsed.objects.size() == 2 && parsed.objects[0].kind == MapObjectKind::Asteroid
            && parsed.objects[1].kind == MapObjectKind::Nebula,
        "supported kinds are typed");
    MapDocument reparsed;
    expect(parseMapDocumentObjects(mapDocumentObjectsJson(parsed), reparsed) == MapDocumentError::None
            && reparsed == parsed, "supported objects round-trip");

    nlohmann::json future = {{"id", "future-1"}, {"kind", "comet"},
        {"position", {1, 2}}, {"rotation", 3}, {"properties", {{"tail", 10}}},
        {"constructor", "os.execute('never')"}};
    expect(parseMapDocumentObjects(nlohmann::json::array({future}), parsed) == MapDocumentError::None
            && parsed.objects[0].kind == MapObjectKind::Unsupported,
        "future kind is retained as unsupported");
    const auto future_round_trip = mapDocumentObjectsJson(parsed);
    expect(future_round_trip[0] == future, "unsupported object survives semantically unchanged");
    expect(validateMapDocument(parsed) == MapDocumentError::None,
        "preserved unsupported object remains a valid document");

    auto invalid = source;
    invalid.push_back(asteroid("asteroid-1"));
    expect(parseMapDocumentObjects(invalid, parsed) == MapDocumentError::DuplicateId,
        "duplicate IDs are rejected");
    invalid = nlohmann::json::array({asteroid("Uppercase")});
    expect(parseMapDocumentObjects(invalid, parsed) == MapDocumentError::InvalidId,
        "non-portable IDs are rejected");
    invalid = nlohmann::json::array({asteroid()});
    invalid[0]["lua"] = "Asteroid()";
    expect(parseMapDocumentObjects(invalid, parsed) == MapDocumentError::UnknownFields,
        "executable-looking field on supported kind is rejected");
    invalid = nlohmann::json::array({nebula()});
    invalid[0]["properties"]["size"] = 10;
    expect(parseMapDocumentObjects(invalid, parsed) == MapDocumentError::InvalidProperties,
        "nebula rejects unsupported properties");
    invalid = nlohmann::json::array({asteroid()});
    invalid[0]["properties"]["size"] = -1;
    expect(parseMapDocumentObjects(invalid, parsed) == MapDocumentError::InvalidProperties,
        "invalid asteroid size is rejected");
    invalid = nlohmann::json::array({asteroid()});
    invalid[0]["position"][0] = static_cast<double>(MAP_COORDINATE_LIMIT) + 1.0;
    expect(parseMapDocumentObjects(invalid, parsed) == MapDocumentError::InvalidNumber,
        "out-of-range coordinate is rejected");
    invalid = nlohmann::json::array({asteroid()});
    invalid[0]["rotation"] = 361.0;
    expect(parseMapDocumentObjects(invalid, parsed) == MapDocumentError::InvalidNumber,
        "out-of-range rotation is rejected");
    expect(parseMapDocumentObjects(nlohmann::json::object(), parsed) == MapDocumentError::InvalidStructure,
        "objects must be an array");

    nlohmann::json too_many = nlohmann::json::array();
    for (std::size_t index = 0; index <= MAP_DOCUMENT_MAX_OBJECTS; ++index)
        too_many.push_back(asteroid("a-" + std::to_string(index)));
    expect(parseMapDocumentObjects(too_many, parsed) == MapDocumentError::TooManyObjects,
        "object count is bounded before parsing entries");

    future["payload"] = std::string(MAP_OBJECT_MAX_OPAQUE_BYTES, 'x');
    expect(parseMapDocumentObjects(nlohmann::json::array({future}), parsed) == MapDocumentError::OpaqueTooLarge,
        "opaque future object size is bounded");

    MapDocument duplicate_opaque;
    MapObject duplicate_object;
    duplicate_object.id = "future-duplicate";
    duplicate_object.kind = MapObjectKind::Unsupported;
    duplicate_object.opaque_json =
        R"({"id":"future-duplicate","kind":"comet","payload":1,"payload":2})";
    duplicate_opaque.objects.push_back(duplicate_object);
    expect(validateMapDocument(duplicate_opaque) == MapDocumentError::DuplicateJsonKeys,
        "programmatic unsupported object rejects duplicate JSON keys before canonicalization");

    nlohmann::json oversized_document = nlohmann::json::array();
    for (int index = 0; index < 14; ++index)
    {
        nlohmann::json item = {{"id", "future-" + std::to_string(index)}, {"kind", "comet"},
            {"payload", std::string(3600, 'x')}};
        oversized_document.push_back(std::move(item));
    }
    expect(parseMapDocumentObjects(oversized_document, parsed) == MapDocumentError::TooLarge,
        "combined map object payload is bounded below the resource import limit");

    MapDocument unchanged;
    MapObject sentinel;
    sentinel.id = "sentinel";
    sentinel.kind = MapObjectKind::Nebula;
    unchanged.objects.push_back(sentinel);
    const auto before = unchanged;
    expect(parseMapDocumentObjects(nlohmann::json::array({42}), unchanged) == MapDocumentError::InvalidStructure,
        "failed parse reports an error");
    expect(unchanged == before, "failed parse does not partially mutate output");

    MapDocument direct;
    MapObject non_finite;
    non_finite.id = "bad-number";
    non_finite.kind = MapObjectKind::Asteroid;
    non_finite.transform.x = std::numeric_limits<float>::infinity();
    direct.objects.push_back(non_finite);
    expect(validateMapDocument(direct) == MapDocumentError::InvalidNumber,
        "non-finite in-memory coordinate is rejected");

    // --- Colocación de objetos nuevos desde el radar GM (issue #204) ---

    MapDocument placement;
    // makeMapObject: valores por defecto cerrados y objeto válido por tipo.
    MapObject new_asteroid = makeMapObject(MapObjectKind::Asteroid, 1500.0f, -2500.0f);
    new_asteroid.id = nextMapObjectId(placement, MapObjectKind::Asteroid);
    expect(new_asteroid.id == "asteroid-1", "first asteroid id is asteroid-1");
    expect(new_asteroid.transform.x == 1500.0f && new_asteroid.transform.y == -2500.0f
            && new_asteroid.transform.rotation == 0.0f, "new object takes the clicked position, rotation 0");
    expect(new_asteroid.size == MAP_ASTEROID_DEFAULT_SIZE, "asteroid gets a valid default size");
    placement.objects.push_back(new_asteroid);
    expect(validateMapDocument(placement) == MapDocumentError::None, "placed asteroid validates");

    MapObject new_nebula = makeMapObject(MapObjectKind::Nebula, 0.0f, 0.0f);
    new_nebula.id = nextMapObjectId(placement, MapObjectKind::Nebula);
    expect(new_nebula.id == "nebula-1", "first nebula id is nebula-1 (independent per kind)");
    placement.objects.push_back(new_nebula);
    expect(validateMapDocument(placement) == MapDocumentError::None,
        "placed nebula validates (no properties serialized)");

    // Ids deterministas: el siguiente sufijo libre por tipo, saltando huecos.
    expect(nextMapObjectId(placement, MapObjectKind::Asteroid) == "asteroid-2",
        "next asteroid id skips the taken one");
    MapDocument gapped;
    gapped.objects.push_back(makeMapObject(MapObjectKind::Asteroid, 0, 0));
    gapped.objects.back().id = "asteroid-5";
    expect(nextMapObjectId(gapped, MapObjectKind::Asteroid) == "asteroid-1",
        "next id is the first free suffix from 1, not max+1");

    expect(nextMapObjectId(placement, MapObjectKind::Unsupported).empty(),
        "unsupported kind yields no id");

    std::cout << "MAP_DOCUMENT_TESTS_OK checks=" << checks << "\n";
    return 0;
}
