#include "content/mapDocument.h"

#include <algorithm>
#include <cmath>
#include <map>
#include <set>
#include <utility>
#include <nlohmann/json.hpp>

namespace
{
bool asciiLower(char c) { return c >= 'a' && c <= 'z'; }
bool asciiDigit(char c) { return c >= '0' && c <= '9'; }

bool validId(const std::string& value)
{
    if (value.empty() || value.size() > 64) return false;
    for (char c : value)
        if (!(asciiLower(c) || asciiDigit(c) || c == '_' || c == '-')) return false;
    return asciiLower(value.front()) || asciiDigit(value.front());
}

bool finiteInRange(float value, float limit)
{
    return std::isfinite(value) && value >= -limit && value <= limit;
}

bool readFiniteFloat(const nlohmann::json& value, float& output)
{
    if (!value.is_number()) return false;
    try
    {
        const auto number = value.get<double>();
        const auto coordinate_limit = static_cast<double>(MAP_COORDINATE_LIMIT);
        if (!std::isfinite(number) || number < -coordinate_limit
            || number > coordinate_limit) return false;
        output = static_cast<float>(number);
        return std::isfinite(output);
    }
    catch (...) { return false; }
}

bool exactKeys(const nlohmann::json& object, const std::set<std::string>& allowed)
{
    if (!object.is_object() || object.size() != allowed.size()) return false;
    for (auto it = object.begin(); it != object.end(); ++it)
        if (!allowed.count(it.key())) return false;
    return true;
}

bool hasDuplicateJsonKeys(const std::string& input)
{
    bool duplicate = false;
    std::map<int, std::set<std::string>> keys_by_depth;
    auto callback = [&duplicate, &keys_by_depth](int depth, nlohmann::json::parse_event_t event,
                                                 nlohmann::json& parsed) {
        if (event == nlohmann::json::parse_event_t::object_start) keys_by_depth[depth + 1].clear();
        else if (event == nlohmann::json::parse_event_t::key)
        {
            const auto key = parsed.get<std::string>();
            if (!keys_by_depth[depth].insert(key).second) duplicate = true;
        }
        return true;
    };
    [[maybe_unused]] const auto checked = nlohmann::json::parse(input, callback, false, false);
    return duplicate;
}

MapDocumentError validateUnsupported(const MapObject& object)
{
    if (object.opaque_json.empty() || object.opaque_json.size() > MAP_OBJECT_MAX_OPAQUE_BYTES)
        return MapDocumentError::OpaqueTooLarge;
    if (hasDuplicateJsonKeys(object.opaque_json)) return MapDocumentError::DuplicateJsonKeys;
    const auto opaque = nlohmann::json::parse(object.opaque_json, nullptr, false, false);
    if (opaque.is_discarded() || !opaque.is_object()) return MapDocumentError::InvalidStructure;
    const auto id = opaque.find("id");
    const auto kind = opaque.find("kind");
    if (id == opaque.end() || !id->is_string() || id->get<std::string>() != object.id
        || kind == opaque.end() || !kind->is_string()) return MapDocumentError::InvalidStructure;
    const auto kind_id = kind->get<std::string>();
    if (kind_id == "asteroid" || kind_id == "nebula") return MapDocumentError::InvalidStructure;
    return MapDocumentError::None;
}
}

std::string mapObjectKindId(MapObjectKind kind)
{
    switch(kind)
    {
    case MapObjectKind::Asteroid: return "asteroid";
    case MapObjectKind::Nebula: return "nebula";
    case MapObjectKind::Unsupported: return "unsupported";
    }
    return "unsupported";
}

std::string nextMapObjectId(const MapDocument& document, MapObjectKind kind)
{
    if (kind == MapObjectKind::Unsupported) return "";
    const std::string prefix = mapObjectKindId(kind) + "-";
    // Scan for the first free suffix from 1 upwards; deterministic regardless of
    // the order or the ids already present (including gaps).
    for (std::size_t candidate = 1; candidate <= document.objects.size() + 1; ++candidate)
    {
        const std::string id = prefix + std::to_string(candidate);
        bool taken = false;
        for (const auto& object : document.objects)
            if (object.id == id) { taken = true; break; }
        if (!taken) return id;
    }
    return "";
}

MapObject makeMapObject(MapObjectKind kind, float x, float y)
{
    MapObject object;
    object.kind = kind;
    object.transform = {x, y, 0.0f};
    // Nebulae carry no properties; the default size is only meaningful for
    // asteroids (and only asteroids serialize it), but keeping it valid keeps
    // the object accepted by validateMapDocument() whatever the kind.
    object.size = MAP_ASTEROID_DEFAULT_SIZE;
    return object;
}

MapDocumentError validateMapDocument(const MapDocument& document)
{
    if (document.objects.size() > MAP_DOCUMENT_MAX_OBJECTS)
        return MapDocumentError::TooManyObjects;
    std::set<std::string> ids;
    for (const auto& object : document.objects)
    {
        if (!validId(object.id)) return MapDocumentError::InvalidId;
        if (!ids.insert(object.id).second) return MapDocumentError::DuplicateId;
        if (object.kind == MapObjectKind::Unsupported)
        {
            const auto result = validateUnsupported(object);
            if (result != MapDocumentError::None) return result;
            continue;
        }
        if (!object.opaque_json.empty()) return MapDocumentError::InvalidStructure;
        if (!finiteInRange(object.transform.x, MAP_COORDINATE_LIMIT)
            || !finiteInRange(object.transform.y, MAP_COORDINATE_LIMIT)
            || !finiteInRange(object.transform.rotation, 360.0f))
            return MapDocumentError::InvalidNumber;
        if (object.kind == MapObjectKind::Asteroid
            && (!std::isfinite(object.size) || object.size < MAP_ASTEROID_MIN_SIZE
                || object.size > MAP_ASTEROID_MAX_SIZE))
            return MapDocumentError::InvalidProperties;
    }
    if (mapDocumentObjectsJson(document).dump().size() > MAP_DOCUMENT_MAX_SERIALIZED_BYTES)
        return MapDocumentError::TooLarge;
    return MapDocumentError::None;
}

nlohmann::json mapDocumentObjectsJson(const MapDocument& document)
{
    nlohmann::json result = nlohmann::json::array();
    for (const auto& object : document.objects)
    {
        if (object.kind == MapObjectKind::Unsupported)
        {
            result.push_back(nlohmann::json::parse(object.opaque_json));
            continue;
        }
        nlohmann::json properties = nlohmann::json::object();
        if (object.kind == MapObjectKind::Asteroid) properties["size"] = object.size;
        result.push_back({
            {"id", object.id},
            {"kind", mapObjectKindId(object.kind)},
            {"position", {object.transform.x, object.transform.y}},
            {"rotation", object.transform.rotation},
            {"properties", std::move(properties)},
        });
    }
    return result;
}

MapDocumentError parseMapDocumentObjects(const nlohmann::json& objects, MapDocument& output)
{
    if (!objects.is_array()) return MapDocumentError::InvalidStructure;
    if (objects.size() > MAP_DOCUMENT_MAX_OBJECTS) return MapDocumentError::TooManyObjects;
    MapDocument candidate;
    candidate.objects.reserve(objects.size());
    std::set<std::string> ids;
    for (const auto& value : objects)
    {
        if (!value.is_object()) return MapDocumentError::InvalidStructure;
        const auto id_it = value.find("id");
        const auto kind_it = value.find("kind");
        if (id_it == value.end() || !id_it->is_string()
            || kind_it == value.end() || !kind_it->is_string())
            return MapDocumentError::InvalidStructure;

        MapObject object;
        object.id = id_it->get<std::string>();
        if (!validId(object.id)) return MapDocumentError::InvalidId;
        if (!ids.insert(object.id).second) return MapDocumentError::DuplicateId;
        const auto kind = kind_it->get<std::string>();
        if (kind != "asteroid" && kind != "nebula")
        {
            object.kind = MapObjectKind::Unsupported;
            object.opaque_json = value.dump();
            if (object.opaque_json.size() > MAP_OBJECT_MAX_OPAQUE_BYTES)
                return MapDocumentError::OpaqueTooLarge;
            candidate.objects.push_back(std::move(object));
            continue;
        }

        static const std::set<std::string> object_keys = {
            "id", "kind", "position", "rotation", "properties"
        };
        if (!exactKeys(value, object_keys)) return MapDocumentError::UnknownFields;
        const auto& position = value["position"];
        if (!position.is_array() || position.size() != 2
            || !readFiniteFloat(position[0], object.transform.x)
            || !readFiniteFloat(position[1], object.transform.y)
            || !readFiniteFloat(value["rotation"], object.transform.rotation)
            || object.transform.rotation < -360.0f || object.transform.rotation > 360.0f)
            return MapDocumentError::InvalidNumber;
        const auto& properties = value["properties"];
        if (!properties.is_object()) return MapDocumentError::InvalidProperties;

        if (kind == "asteroid")
        {
            object.kind = MapObjectKind::Asteroid;
            static const std::set<std::string> asteroid_keys = {"size"};
            if (!exactKeys(properties, asteroid_keys)
                || !readFiniteFloat(properties["size"], object.size)
                || object.size < MAP_ASTEROID_MIN_SIZE || object.size > MAP_ASTEROID_MAX_SIZE)
                return MapDocumentError::InvalidProperties;
        }
        else
        {
            object.kind = MapObjectKind::Nebula;
            if (!properties.empty()) return MapDocumentError::InvalidProperties;
        }
        candidate.objects.push_back(std::move(object));
    }
    const auto result = validateMapDocument(candidate);
    if (result != MapDocumentError::None) return result;
    output = std::move(candidate);
    return MapDocumentError::None;
}
