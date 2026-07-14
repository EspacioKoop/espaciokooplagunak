#pragma once

#include "mapDocument.h"

#include <cstddef>
#include <vector>

enum class MapPreviewMarkerKind
{
    Asteroid,
    Nebula,
};

struct MapPreviewMarker
{
    std::string id;
    MapPreviewMarkerKind kind = MapPreviewMarkerKind::Asteroid;
    float x = 0.0f;
    float y = 0.0f;
    float rotation = 0.0f;
    float radius_pixels = 0.0f;
};

constexpr float MAP_PREVIEW_ASTEROID_MIN_RADIUS_PIXELS = 3.0f;
constexpr float MAP_PREVIEW_ASTEROID_MAX_RADIUS_PIXELS = 64.0f;
constexpr float MAP_PREVIEW_NEBULA_RADIUS_PIXELS = 28.0f;

std::size_t countUnsupportedMapPreviewObjects(const MapDocument& document);

MapDocumentError buildMapPreviewMarkers(
    const MapDocument& document,
    float world_to_screen_scale,
    std::vector<MapPreviewMarker>& output
);
