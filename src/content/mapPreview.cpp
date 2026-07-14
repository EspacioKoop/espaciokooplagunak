#include "mapPreview.h"

#include <algorithm>
#include <cmath>
#include <utility>

MapDocumentError buildMapPreviewMarkers(
    const MapDocument& document,
    float world_to_screen_scale,
    std::vector<MapPreviewMarker>& output
)
{
    if (!std::isfinite(world_to_screen_scale) || world_to_screen_scale <= 0.0f)
        return MapDocumentError::InvalidNumber;
    const auto validation = validateMapDocument(document);
    if (validation != MapDocumentError::None) return validation;

    std::vector<MapPreviewMarker> candidate;
    candidate.reserve(document.objects.size());
    for (const auto& object : document.objects)
    {
        if (object.kind == MapObjectKind::Unsupported) continue;

        MapPreviewMarker marker;
        marker.id = object.id;
        marker.x = object.transform.x;
        marker.y = object.transform.y;
        marker.rotation = object.transform.rotation;
        if (object.kind == MapObjectKind::Asteroid)
        {
            marker.kind = MapPreviewMarkerKind::Asteroid;
            marker.radius_pixels = std::clamp(
                object.size * world_to_screen_scale,
                MAP_PREVIEW_ASTEROID_MIN_RADIUS_PIXELS,
                MAP_PREVIEW_ASTEROID_MAX_RADIUS_PIXELS
            );
        }
        else
        {
            marker.kind = MapPreviewMarkerKind::Nebula;
            // Nebula has no physical size in the v3 document. This is a symbolic marker,
            // deliberately constant across zoom levels rather than invented world geometry.
            marker.radius_pixels = MAP_PREVIEW_NEBULA_RADIUS_PIXELS;
        }
        candidate.push_back(std::move(marker));
    }
    output = std::move(candidate);
    return MapDocumentError::None;
}
