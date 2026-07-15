#include "content/mapPreviewInteraction.h"

#include <algorithm>
#include <cmath>
#include <utility>

namespace
{
bool validPoint(MapPreviewPoint point)
{
    return std::isfinite(point.x) && std::isfinite(point.y)
        && std::abs(point.x) <= MAP_COORDINATE_LIMIT
        && std::abs(point.y) <= MAP_COORDINATE_LIMIT;
}
}

MapDocumentError hitTestMapPreviewObject(
    const MapDocument& document,
    MapPreviewPoint world_position,
    float world_to_screen_scale,
    std::string& object_id,
    float tolerance_pixels
)
{
    if (!validPoint(world_position)
        || !std::isfinite(tolerance_pixels) || tolerance_pixels < 0.0f)
        return MapDocumentError::InvalidNumber;

    std::vector<MapPreviewMarker> markers;
    const auto error = buildMapPreviewMarkers(document, world_to_screen_scale, markers);
    if (error != MapDocumentError::None) return error;

    std::string candidate;
    for (auto marker = markers.rbegin(); marker != markers.rend(); ++marker)
    {
        const float dx_pixels = (marker->x - world_position.x) * world_to_screen_scale;
        const float dy_pixels = (marker->y - world_position.y) * world_to_screen_scale;
        const float radius = marker->radius_pixels + tolerance_pixels;
        if (dx_pixels * dx_pixels + dy_pixels * dy_pixels <= radius * radius)
        {
            candidate = marker->id;
            break;
        }
    }
    object_id = std::move(candidate);
    return MapDocumentError::None;
}

MapDocumentError MapPreviewDragSession::begin(
    const MapDocument& document,
    MapPreviewPoint world_position,
    float world_to_screen_scale
)
{
    std::string hit;
    const auto error = hitTestMapPreviewObject(
        document, world_position, world_to_screen_scale, hit);
    if (error != MapDocumentError::None) return error;

    dragging = false;
    selected_id = std::move(hit);
    if (selected_id.empty()) return MapDocumentError::None;
    const auto object = std::find_if(document.objects.begin(), document.objects.end(),
        [&](const MapObject& item) { return item.id == selected_id; });
    if (object == document.objects.end())
    {
        selected_id.clear();
        return MapDocumentError::InvalidStructure;
    }
    original_transform = object->transform;
    provisional_transform = original_transform;
    dragging = true;
    return MapDocumentError::None;
}

bool MapPreviewDragSession::update(MapPreviewPoint world_position)
{
    if (!dragging || !validPoint(world_position)) return false;
    provisional_transform.x = world_position.x;
    provisional_transform.y = world_position.y;
    return true;
}

MapEditError MapPreviewDragSession::commit(MapEditSession& session)
{
    if (!dragging) return MapEditError::NotFound;
    dragging = false;
    return session.moveObject(selected_id, provisional_transform);
}

void MapPreviewDragSession::cancel()
{
    dragging = false;
    provisional_transform = original_transform;
}

void MapPreviewDragSession::applyProvisional(std::vector<MapPreviewMarker>& markers) const
{
    if (!dragging) return;
    const auto marker = std::find_if(markers.begin(), markers.end(),
        [&](const MapPreviewMarker& item) { return item.id == selected_id; });
    if (marker == markers.end()) return;
    marker->x = provisional_transform.x;
    marker->y = provisional_transform.y;
    marker->rotation = provisional_transform.rotation;
}
