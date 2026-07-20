#pragma once

#include "content/mapEditSession.h"
#include "content/mapPreview.h"

#include <cstdint>
#include <string>
#include <vector>

struct MapPreviewPoint
{
    float x = 0.0f;
    float y = 0.0f;
};

constexpr float MAP_PREVIEW_HIT_TOLERANCE_PIXELS = 5.0f;
constexpr float MAP_PREVIEW_MAX_HIT_TOLERANCE_PIXELS = 128.0f;

MapDocumentError hitTestMapPreviewObject(
    const MapDocument& document,
    MapPreviewPoint world_position,
    float world_to_screen_scale,
    std::string& object_id,
    float tolerance_pixels = MAP_PREVIEW_HIT_TOLERANCE_PIXELS
);

class MapPreviewDragSession
{
public:
    MapDocumentError begin(
        const MapEditSession& session,
        MapPreviewPoint world_position,
        float world_to_screen_scale
    );
    bool update(MapPreviewPoint world_position);
    MapEditError commit(MapEditSession& session);
    void cancel();
    void clearSelection();

    bool isDragging() const { return dragging; }
    const std::string& selectedId() const { return selected_id; }
    const MapObjectTransform& provisionalTransform() const { return provisional_transform; }
    void applyProvisional(std::vector<MapPreviewMarker>& markers) const;

private:
    std::string selected_id;
    std::uint64_t source_session_id = 0;
    std::uint64_t source_revision = 0;
    MapPreviewPoint pointer_offset;
    MapObjectTransform original_transform;
    MapObjectTransform provisional_transform;
    bool dragging = false;
};
