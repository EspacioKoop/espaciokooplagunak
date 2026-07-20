#include "content/mapPreviewInteraction.h"

#include <cstdlib>
#include <iostream>
#include <limits>
#include <string>
#include <utility>
#include <vector>

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

MapObject asteroid(std::string id, float x, float y, float size = 20.0f)
{
    MapObject object;
    object.id = std::move(id);
    object.kind = MapObjectKind::Asteroid;
    object.transform = {x, y, 35.0f};
    object.size = size;
    return object;
}

MapObject nebula(std::string id, float x, float y)
{
    MapObject object;
    object.id = std::move(id);
    object.kind = MapObjectKind::Nebula;
    object.transform = {x, y, 15.0f};
    return object;
}
}

int main()
{
    MapDocument hit_document;
    hit_document.objects.push_back(asteroid("asteroid", 100.0f, 50.0f));
    std::string hit = "unchanged";
    expect(hitTestMapPreviewObject(hit_document, {128.0f, 50.0f}, 0.5f, hit)
            == MapDocumentError::None && hit == "asteroid",
        "asteroid hit uses marker radius plus pixel tolerance");
    expect(hitTestMapPreviewObject(hit_document, {180.0f, 50.0f}, 0.1f, hit)
            == MapDocumentError::None && hit == "asteroid",
        "same visual tolerance remains usable at a different zoom");
    expect(hitTestMapPreviewObject(hit_document, {1000.0f, 1000.0f}, 0.5f, hit)
            == MapDocumentError::None && hit.empty(),
        "miss clears selection without reporting a document error");

    hit = "stable";
    expect(hitTestMapPreviewObject(hit_document, {0.0f, 0.0f}, 0.0f, hit)
            == MapDocumentError::InvalidNumber && hit == "stable",
        "invalid scale leaves hit output unchanged");
    expect(hitTestMapPreviewObject(hit_document,
                                  {std::numeric_limits<float>::infinity(), 0.0f}, 1.0f, hit)
            == MapDocumentError::InvalidNumber && hit == "stable",
        "invalid pointer position leaves hit output unchanged");
    expect(hitTestMapPreviewObject(hit_document, {100.0f, 50.0f}, 1.0f, hit,
                                  MAP_PREVIEW_MAX_HIT_TOLERANCE_PIXELS + 1.0f)
            == MapDocumentError::InvalidNumber && hit == "stable",
        "excessive public tolerance is rejected before geometry can overflow");

    hit_document.objects.push_back(nebula("nebula-top", 100.0f, 50.0f));
    expect(hitTestMapPreviewObject(hit_document, {100.0f, 50.0f}, 1.0f, hit)
            == MapDocumentError::None && hit == "nebula-top",
        "hit-test selects the last rendered supported marker");
    MapObject opaque;
    opaque.id = "future";
    opaque.kind = MapObjectKind::Unsupported;
    opaque.transform = {400.0f, 500.0f, 0.0f};
    opaque.opaque_json = R"({"id":"future","kind":"comet","payload":{"tail":10}})";
    hit_document.objects.push_back(opaque);
    expect(hitTestMapPreviewObject(hit_document, {400.0f, 500.0f}, 1.0f, hit)
            == MapDocumentError::None && hit.empty(),
        "opaque object never participates in hit-test");

    MapDocument drag_document;
    drag_document.objects.push_back(asteroid("dragged", 10.0f, 20.0f, 100.0f));
    drag_document.objects.push_back(opaque);
    MapEditSession session(drag_document);
    MapPreviewDragSession drag;

    expect(drag.begin(session, {40.0f, 20.0f}, 1.0f) == MapDocumentError::None
            && drag.update({100.0f, 120.0f})
            && drag.provisionalTransform().x == 70.0f
            && drag.provisionalTransform().y == 120.0f,
        "drag started off-centre preserves pointer-to-object offset");
    drag.cancel();
    expect(session.document() == drag_document && !session.isDirty(),
        "offset regression probe remains provisional when cancelled");

    expect(drag.begin(session, {10.0f, 20.0f}, 1.0f) == MapDocumentError::None
            && drag.update({90.0f, 100.0f}),
        "active drag prepares failed-begin regression");
    expect(drag.begin(session, {10.0f, 20.0f}, 0.0f) == MapDocumentError::InvalidNumber
            && !drag.isDragging() && drag.commit(session) == MapEditError::NotFound
            && session.document() == drag_document,
        "failed begin cancels the previous provisional drag");

    expect(drag.begin(session, {10.0f, 20.0f}, 1.0f) == MapDocumentError::None
            && drag.update({110.0f, 120.0f})
            && session.moveObject("dragged", {30.0f, 40.0f, 75.0f}) == MapEditError::None,
        "intervening staged edit prepares stale-session rejection");
    expect(drag.commit(session) == MapEditError::SessionChanged
            && session.document().objects.front().transform.x == 30.0f
            && session.document().objects.front().transform.rotation == 75.0f,
        "stale drag cannot overwrite a newer transform or rotation");
    session.rollback();

    MapEditSession different_session(drag_document);
    expect(drag.begin(session, {10.0f, 20.0f}, 1.0f) == MapDocumentError::None
            && drag.update({60.0f, 70.0f})
            && drag.commit(different_session) == MapEditError::SessionChanged
            && different_session.document() == drag_document,
        "drag cannot commit into another session with an identical document");

    expect(drag.begin(session, {10.0f, 20.0f}, 1.0f) == MapDocumentError::None
            && drag.update({80.0f, 90.0f}),
        "same-address replacement regression starts a drag");
    const auto replaced_session_id = session.sessionId();
    session = MapEditSession(drag_document);
    expect(session.sessionId() != replaced_session_id
            && drag.commit(session) == MapEditError::SessionChanged
            && session.document() == drag_document,
        "reassigned session at the same address has a new stable identity");

    expect(drag.begin(session, {10.0f, 20.0f}, 1.0f) == MapDocumentError::None
            && drag.update({120.0f, 130.0f}),
        "ABA revision regression starts a drag");
    const auto drag_revision = session.revision();
    expect(session.moveObject("dragged", {30.0f, 40.0f, 35.0f}) == MapEditError::None
            && session.undo() && session.document() == drag_document
            && session.revision() > drag_revision,
        "edit plus undo restores bytes but advances session revision");
    expect(drag.commit(session) == MapEditError::SessionChanged
            && session.document() == drag_document,
        "stale drag cannot commit after an edit-undo ABA cycle");

    expect(drag.begin(session, {10.0f, 20.0f}, 1.0f) == MapDocumentError::None
            && drag.isDragging() && drag.selectedId() == "dragged",
        "drag starts on a supported staged object");
    expect(drag.update({200.0f, 300.0f}) && drag.update({250.0f, 350.0f}),
        "multiple pointer updates only change provisional transform");
    expect(session.document() == drag_document && !session.isDirty() && !session.canUndo(),
        "provisional drag does not mutate document or history");

    std::vector<MapPreviewMarker> markers;
    expect(buildMapPreviewMarkers(session.document(), 1.0f, markers) == MapDocumentError::None,
        "drag fixture projects before provisional overlay");
    drag.applyProvisional(markers);
    expect(markers.front().x == 250.0f && markers.front().y == 350.0f
            && markers.front().rotation == 35.0f,
        "provisional overlay moves marker while preserving rotation");
    expect(drag.commit(session) == MapEditError::None && !drag.isDragging()
            && session.document().objects.front().transform.x == 250.0f
            && session.document().objects.front().transform.y == 350.0f,
        "mouse-up equivalent commits the final transform once");
    expect(session.canUndo() && session.undo()
            && session.document().objects.front().transform.x == 10.0f
            && !session.canUndo(),
        "one undo reverses the entire multi-update drag");
    expect(session.document().objects.back().opaque_json == opaque.opaque_json,
        "undo preserves opaque object bytes");
    expect(session.redo() && session.document().objects.front().transform.x == 250.0f
            && session.document().objects.back().opaque_json == opaque.opaque_json,
        "redo restores exact position and opaque bytes");

    session.rollback();
    expect(drag.begin(session, {10.0f, 20.0f}, 1.0f) == MapDocumentError::None
            && drag.update({500.0f, 600.0f}),
        "second drag can start from rolled-back staging");
    drag.cancel();
    expect(!drag.isDragging() && session.document() == drag_document
            && !session.isDirty() && !session.canUndo(),
        "cancelled drag leaves staging and history clean");
    expect(drag.commit(session) == MapEditError::NotFound,
        "cancelled drag cannot commit later");

    expect(drag.begin(session, {10.0f, 20.0f}, 1.0f) == MapDocumentError::None,
        "no-op drag can select an object");
    const auto before_invalid_update = drag.provisionalTransform();
    expect(!drag.update({std::numeric_limits<float>::quiet_NaN(), 0.0f})
            && drag.provisionalTransform() == before_invalid_update,
        "invalid drag update is rejected without changing provisional state");
    expect(drag.commit(session) == MapEditError::None
            && !session.isDirty() && !session.canUndo(),
        "click without movement creates no history entry");

    MapDocument edge_document;
    edge_document.objects.push_back(asteroid("edge", 999000.0f, 0.0f));
    MapEditSession edge_session(edge_document);
    MapPreviewDragSession edge_drag;
    expect(edge_drag.begin(edge_session, {995000.0f, 0.0f}, 0.001f) == MapDocumentError::None
            && edge_drag.isDragging() && edge_drag.selectedId() == "edge",
        "low-zoom grab far from centre is accepted within pixel tolerance");
    expect(edge_drag.update({999999.0f, 0.0f})
            && edge_drag.provisionalTransform().x == MAP_COORDINATE_LIMIT
            && edge_drag.provisionalTransform().y == 0.0f,
        "valid pointer plus large offset clamps provisional to the coordinate limit");
    expect(edge_drag.commit(edge_session) == MapEditError::None
            && validateMapDocument(edge_session.document()) == MapDocumentError::None
            && edge_session.document().objects.front().transform.x == MAP_COORDINATE_LIMIT,
        "committed drag never stages a document outside the validator contract");

    expect(drag.begin(session, {400.0f, 500.0f}, 1.0f) == MapDocumentError::None
            && !drag.isDragging() && drag.selectedId().empty(),
        "opaque position cannot begin a drag");

    expect(drag.begin(session, {10.0f, 20.0f}, 1.0f) == MapDocumentError::None
            && drag.update({30.0f, 40.0f}) && drag.commit(session) == MapEditError::None,
        "first committed drag prepares redo invalidation test");
    expect(session.undo() && session.canRedo(), "undo exposes redo before a new edit");
    expect(drag.begin(session, {10.0f, 20.0f}, 1.0f) == MapDocumentError::None
            && drag.update({70.0f, 80.0f}) && drag.commit(session) == MapEditError::None
            && !session.canRedo(),
        "new committed drag after undo invalidates redo");

    MapPreviewDragSession selection;
    expect(selection.begin(session, {70.0f, 80.0f}, 1.0f) == MapDocumentError::None
            && selection.selectedId() == "dragged",
        "supported radar hit exposes the selected object after the drag");
    selection.cancel();
    expect(selection.selectedId() == "dragged",
        "cancelling movement preserves selection for explicit staging actions");
    selection.clearSelection();
    expect(selection.selectedId().empty() && !selection.isDragging()
            && selection.commit(session) == MapEditError::NotFound,
        "explicit clear disables later actions and cannot commit stale movement");

    std::cout << "MAP_PREVIEW_INTERACTION_TESTS_OK checks=" << checks << "\n";
    return 0;
}
