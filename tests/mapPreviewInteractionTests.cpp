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
    expect(drag.begin(session.document(), {10.0f, 20.0f}, 1.0f) == MapDocumentError::None
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
    expect(drag.begin(session.document(), {10.0f, 20.0f}, 1.0f) == MapDocumentError::None
            && drag.update({500.0f, 600.0f}),
        "second drag can start from rolled-back staging");
    drag.cancel();
    expect(!drag.isDragging() && session.document() == drag_document
            && !session.isDirty() && !session.canUndo(),
        "cancelled drag leaves staging and history clean");
    expect(drag.commit(session) == MapEditError::NotFound,
        "cancelled drag cannot commit later");

    expect(drag.begin(session.document(), {10.0f, 20.0f}, 1.0f) == MapDocumentError::None,
        "no-op drag can select an object");
    const auto before_invalid_update = drag.provisionalTransform();
    expect(!drag.update({std::numeric_limits<float>::quiet_NaN(), 0.0f})
            && drag.provisionalTransform() == before_invalid_update,
        "invalid drag update is rejected without changing provisional state");
    expect(drag.commit(session) == MapEditError::None
            && !session.isDirty() && !session.canUndo(),
        "click without movement creates no history entry");

    expect(drag.begin(session.document(), {400.0f, 500.0f}, 1.0f) == MapDocumentError::None
            && !drag.isDragging() && drag.selectedId().empty(),
        "opaque position cannot begin a drag");

    expect(drag.begin(session.document(), {10.0f, 20.0f}, 1.0f) == MapDocumentError::None
            && drag.update({30.0f, 40.0f}) && drag.commit(session) == MapEditError::None,
        "first committed drag prepares redo invalidation test");
    expect(session.undo() && session.canRedo(), "undo exposes redo before a new edit");
    expect(drag.begin(session.document(), {10.0f, 20.0f}, 1.0f) == MapDocumentError::None
            && drag.update({70.0f, 80.0f}) && drag.commit(session) == MapEditError::None
            && !session.canRedo(),
        "new committed drag after undo invalidates redo");

    std::cout << "MAP_PREVIEW_INTERACTION_TESTS_OK checks=" << checks << "\n";
    return 0;
}
