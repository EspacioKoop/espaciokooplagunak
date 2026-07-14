#pragma once

#include <cstddef>
#include <string>
#include <vector>
#include <nlohmann/json.hpp>

enum class MapObjectKind
{
    Asteroid,
    Nebula,
    Unsupported,
};

struct MapObjectTransform
{
    float x = 0.0f;
    float y = 0.0f;
    float rotation = 0.0f;
};

inline bool operator==(const MapObjectTransform& lhs, const MapObjectTransform& rhs)
{
    return lhs.x == rhs.x && lhs.y == rhs.y && lhs.rotation == rhs.rotation;
}

struct MapObject
{
    std::string id;
    MapObjectKind kind = MapObjectKind::Unsupported;
    MapObjectTransform transform;
    float size = 120.0f;
    // Canonical JSON for future kinds. It is preserved but never interpreted or executed.
    std::string opaque_json;
};

inline bool operator==(const MapObject& lhs, const MapObject& rhs)
{
    return lhs.id == rhs.id && lhs.kind == rhs.kind && lhs.transform == rhs.transform
        && lhs.size == rhs.size && lhs.opaque_json == rhs.opaque_json;
}

struct MapDocument
{
    std::vector<MapObject> objects;
};

inline bool operator==(const MapDocument& lhs, const MapDocument& rhs)
{
    return lhs.objects == rhs.objects;
}

inline bool operator!=(const MapDocument& lhs, const MapDocument& rhs)
{
    return !(lhs == rhs);
}

enum class MapDocumentError
{
    None,
    InvalidStructure,
    TooManyObjects,
    InvalidId,
    DuplicateId,
    UnknownFields,
    InvalidNumber,
    InvalidProperties,
    OpaqueTooLarge,
    TooLarge,
};

constexpr std::size_t MAP_DOCUMENT_MAX_OBJECTS = 1024;
constexpr std::size_t MAP_OBJECT_MAX_OPAQUE_BYTES = 4096;
constexpr std::size_t MAP_DOCUMENT_MAX_SERIALIZED_BYTES = 48 * 1024;
constexpr float MAP_COORDINATE_LIMIT = 1000000.0f;
constexpr float MAP_ASTEROID_MIN_SIZE = 2.0f;
constexpr float MAP_ASTEROID_MAX_SIZE = 5000.0f;

std::string mapObjectKindId(MapObjectKind kind);
MapDocumentError validateMapDocument(const MapDocument& document);
nlohmann::json mapDocumentObjectsJson(const MapDocument& document);
MapDocumentError parseMapDocumentObjects(const nlohmann::json& objects, MapDocument& output);
