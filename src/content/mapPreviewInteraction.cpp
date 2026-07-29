#include "content/mapPreviewInteraction.h"

#include <algorithm>
#include <cmath>
#include <utility>
#include <vector>

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

bool MapPreviewDragSession::isSelected(const std::string& id) const
{
    return std::find(selected_ids.begin(), selected_ids.end(), id) != selected_ids.end();
}

MapDocumentError MapPreviewDragSession::pick(
    const MapEditSession& session,
    MapPreviewPoint world_position,
    float world_to_screen_scale,
    std::string& hit
) const
{
    return hitTestMapPreviewObject(
        session.document(), world_position, world_to_screen_scale, hit);
}

void MapPreviewDragSession::rebuildMembers(
    const MapEditSession& session, MapPreviewPoint world_position)
{
    const auto& document = session.document();
    members.clear();
    for (const auto& id : selected_ids)
    {
        const auto object = std::find_if(document.objects.begin(), document.objects.end(),
            [&](const MapObject& item) { return item.id == id; });
        if (object == document.objects.end()) continue;
        // Each member keeps its OWN offset to the pointer. Without this the
        // group would collapse onto the anchor on the first move, which reads as
        // the editor eating the map.
        members.push_back({
            id,
            object->transform,
            {object->transform.x - world_position.x, object->transform.y - world_position.y},
        });
    }
}

MapDocumentError MapPreviewDragSession::begin(
    const MapEditSession& session,
    MapPreviewPoint world_position,
    float world_to_screen_scale
)
{
    cancel();
    const auto& document = session.document();
    std::string hit;
    const auto error = pick(session, world_position, world_to_screen_scale, hit);
    if (error != MapDocumentError::None)
    {
        clearSelection();
        return error;
    }

    dragging = false;
    if (hit.empty())
    {
        // Clicking empty space clears the selection. It is the only gesture that
        // can drop a group without picking its members off one by one.
        clearSelection();
        return MapDocumentError::None;
    }

    // Grabbing a member of the current selection drags the WHOLE group; grabbing
    // anything else starts a fresh selection of one. Otherwise a stray click
    // inside a group would silently shrink it to a single object and the next
    // drag would move only that one.
    if (!isSelected(hit)) selected_ids.assign(1, hit);
    selected_id = hit;

    const auto object = std::find_if(document.objects.begin(), document.objects.end(),
        [&](const MapObject& item) { return item.id == selected_id; });
    if (object == document.objects.end())
    {
        clearSelection();
        return MapDocumentError::InvalidStructure;
    }
    original_transform = object->transform;
    provisional_transform = original_transform;
    pointer_offset = {
        original_transform.x - world_position.x,
        original_transform.y - world_position.y,
    };
    rebuildMembers(session, world_position);
    source_session_id = session.sessionId();
    source_revision = session.revision();
    dragging = true;
    return MapDocumentError::None;
}

MapDocumentError MapPreviewDragSession::toggleAt(
    const MapEditSession& session,
    MapPreviewPoint world_position,
    float world_to_screen_scale
)
{
    cancel();
    std::string hit;
    const auto error = pick(session, world_position, world_to_screen_scale, hit);
    if (error != MapDocumentError::None) return error;
    // A ctrl+click on empty space does NOT clear the selection: the modifier
    // means "adjust what I have", and losing a carefully built group to a miss
    // is the kind of thing that makes people stop using multi-selection.
    if (hit.empty()) return MapDocumentError::None;

    const auto it = std::find(selected_ids.begin(), selected_ids.end(), hit);
    if (it != selected_ids.end())
    {
        selected_ids.erase(it);
        selected_id = selected_ids.empty() ? std::string{} : selected_ids.back();
    }
    else
    {
        selected_ids.push_back(hit);
        selected_id = hit;
    }
    members.clear();
    return MapDocumentError::None;
}

bool MapPreviewDragSession::update(MapPreviewPoint world_position)
{
    if (!dragging || !validPoint(world_position)) return false;
    // pointer_offset can span thousands of world units at low zoom, so a valid
    // pointer can still project the object past MAP_COORDINATE_LIMIT; clamp so
    // the provisional (and therefore commit()) never leaves the document contract.
    provisional_transform.x = std::clamp(world_position.x + pointer_offset.x,
        -MAP_COORDINATE_LIMIT, MAP_COORDINATE_LIMIT);
    provisional_transform.y = std::clamp(world_position.y + pointer_offset.y,
        -MAP_COORDINATE_LIMIT, MAP_COORDINATE_LIMIT);
    return true;
}

MapEditError MapPreviewDragSession::commit(MapEditSession& session)
{
    if (!dragging) return MapEditError::NotFound;
    dragging = false;
    if (session.sessionId() != source_session_id || session.revision() != source_revision)
        return MapEditError::SessionChanged;

    // The whole group moves by the same delta as the anchor, and it goes through
    // the batch call so the move is ONE undo entry - dragging five rocks and
    // undoing it must put the five back at once.
    const float dx = provisional_transform.x - original_transform.x;
    const float dy = provisional_transform.y - original_transform.y;
    std::vector<std::pair<std::string, MapObjectTransform>> moves;
    moves.reserve(members.size());
    for (const auto& member : members)
    {
        auto transform = member.original_transform;
        if (member.id == selected_id)
        {
            transform = provisional_transform;
        }
        else
        {
            transform.x = std::clamp(member.original_transform.x + dx,
                -MAP_COORDINATE_LIMIT, MAP_COORDINATE_LIMIT);
            transform.y = std::clamp(member.original_transform.y + dy,
                -MAP_COORDINATE_LIMIT, MAP_COORDINATE_LIMIT);
        }
        moves.emplace_back(member.id, transform);
    }
    if (moves.empty()) return MapEditError::NotFound;
    return session.moveObjects(moves);
}

void MapPreviewDragSession::cancel()
{
    dragging = false;
    provisional_transform = original_transform;
}

void MapPreviewDragSession::clearSelection()
{
    cancel();
    selected_id.clear();
    selected_ids.clear();
    members.clear();
    source_session_id = 0;
    source_revision = 0;
}

void MapPreviewDragSession::applyProvisional(std::vector<MapPreviewMarker>& markers) const
{
    if (!dragging) return;
    const float dx = provisional_transform.x - original_transform.x;
    const float dy = provisional_transform.y - original_transform.y;
    for (const auto& member : members)
    {
        const auto marker = std::find_if(markers.begin(), markers.end(),
            [&](const MapPreviewMarker& item) { return item.id == member.id; });
        if (marker == markers.end()) continue;
        if (member.id == selected_id)
        {
            marker->x = provisional_transform.x;
            marker->y = provisional_transform.y;
            marker->rotation = provisional_transform.rotation;
            continue;
        }
        // Same clamp as the commit: what the preview shows and what the commit
        // writes have to be the same number, or the group jumps on mouse-up.
        marker->x = std::clamp(member.original_transform.x + dx,
            -MAP_COORDINATE_LIMIT, MAP_COORDINATE_LIMIT);
        marker->y = std::clamp(member.original_transform.y + dy,
            -MAP_COORDINATE_LIMIT, MAP_COORDINATE_LIMIT);
    }
}

const MapObject* editableMapPreviewSelection(
    const MapEditSession& session,
    const MapPreviewDragSession& selection,
    bool edit_mode
)
{
    if (!edit_mode || selection.selectedId().empty()) return nullptr;
    const auto& objects = session.document().objects;
    const auto selected = std::find_if(objects.begin(), objects.end(), [&](const MapObject& object) {
        return object.id == selection.selectedId() && object.kind != MapObjectKind::Unsupported;
    });
    return selected == objects.end() ? nullptr : &*selected;
}
