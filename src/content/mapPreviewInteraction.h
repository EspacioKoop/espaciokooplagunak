#pragma once

#include "content/mapEditSession.h"
#include "content/mapPreview.h"

#include <cstddef>
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

// Selection and dragging over the staged map document (#54).
//
// The selection is a LIST, and the single-object case is just a list of one.
// Keeping a separate "one object" path next to a "many objects" path is how the
// two drift apart: the group would end up with its own rotation rules, or its
// own idea of what happens when part of it is unsupported.
//
// The anchor is the object the pointer grabbed. Everything else in the selection
// follows it by its own offset, so the group keeps its shape - dragging by a
// different member of the same group must not rearrange it.
class MapPreviewDragSession
{
public:
    MapDocumentError begin(
        const MapEditSession& session,
        MapPreviewPoint world_position,
        float world_to_screen_scale
    );
    // Additive pick (ctrl/shift+click): adds the object under the pointer to the
    // selection, or removes it if it was already there. Never starts a drag -
    // building a selection and moving it are separate gestures, and merging them
    // would move the group by accident on the click that completes it.
    MapDocumentError toggleAt(
        const MapEditSession& session,
        MapPreviewPoint world_position,
        float world_to_screen_scale
    );
    bool update(MapPreviewPoint world_position);
    MapEditError commit(MapEditSession& session);
    void cancel();
    void clearSelection();

    bool isDragging() const { return dragging; }
    // The anchor: the object being dragged, or the last one picked.
    const std::string& selectedId() const { return selected_id; }
    const std::vector<std::string>& selectedIds() const { return selected_ids; }
    bool isSelected(const std::string& id) const;
    std::size_t selectionSize() const { return selected_ids.size(); }
    const MapObjectTransform& provisionalTransform() const { return provisional_transform; }
    void applyProvisional(std::vector<MapPreviewMarker>& markers) const;

private:
    struct Member
    {
        std::string id;
        MapObjectTransform original_transform;
        MapPreviewPoint pointer_offset;
    };

    MapDocumentError pick(
        const MapEditSession& session,
        MapPreviewPoint world_position,
        float world_to_screen_scale,
        std::string& hit
    ) const;
    void rebuildMembers(const MapEditSession& session, MapPreviewPoint world_position);

    std::string selected_id;
    std::vector<std::string> selected_ids;
    std::vector<Member> members;
    std::uint64_t source_session_id = 0;
    std::uint64_t source_revision = 0;
    MapPreviewPoint pointer_offset;
    MapObjectTransform original_transform;
    MapObjectTransform provisional_transform;
    bool dragging = false;
};

const MapObject* editableMapPreviewSelection(
    const MapEditSession& session,
    const MapPreviewDragSession& selection,
    bool edit_mode
);
