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
        || !std::isfinite(tolerance_pixels) || tolerance_pixels < 0.0f
        || tolerance_pixels > MAP_PREVIEW_MAX_HIT_TOLERANCE_PIXELS)
        return MapDocumentError::InvalidNumber;

    std::vector<MapPreviewMarker> markers;
    const auto error = buildMapPreviewMarkers(document, world_to_screen_scale, markers);
    if (error != MapDocumentError::None) return error;

    std::string candidate;
    for (auto marker = markers.rbegin(); marker != markers.rend(); ++marker)
    {
        const double scale = static_cast<double>(world_to_screen_scale);
        const double dx_pixels = static_cast<double>(marker->x - world_position.x) * scale;
        const double dy_pixels = static_cast<double>(marker->y - world_position.y) * scale;
        const double radius = static_cast<double>(marker->radius_pixels)
            + static_cast<double>(tolerance_pixels);
        constexpr double HIT_EPSILON_PIXELS = 0.0001;
        if (std::hypot(dx_pixels, dy_pixels) <= radius + HIT_EPSILON_PIXELS)
        {
            candidate = marker->id;
            break;
        }
    }
    object_id = std::move(candidate);
    return MapDocumentError::None;
}

MapDocumentError MapPreviewDragSession::begin(
    const MapEditSession& session,
    MapPreviewPoint world_position,
    float world_to_screen_scale
)
{
    cancel();
    selected_id.clear();
    source_session = nullptr;
    source_document = {};
    const auto& document = session.document();
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
    pointer_offset = {
        original_transform.x - world_position.x,
        original_transform.y - world_position.y,
    };
    source_session = &session;
    source_document = document;
    dragging = true;
    return MapDocumentError::None;
}

bool MapPreviewDragSession::update(MapPreviewPoint world_position)
{
    if (!dragging || !validPoint(world_position)) return false;
    provisional_transform.x = world_position.x + pointer_offset.x;
    provisional_transform.y = world_position.y + pointer_offset.y;
    return true;
}

MapEditError MapPreviewDragSession::commit(MapEditSession& session)
{
    if (!dragging) return MapEditError::NotFound;
    dragging = false;
    if (&session != source_session || session.document() != source_document)
        return MapEditError::SessionChanged;
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
