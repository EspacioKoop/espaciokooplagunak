#include "content/mapEditSession.h"

#include <cstdlib>
#include <iostream>
#include <limits>
#include <string>

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

MapObject asteroid(const std::string& id = "asteroid-1")
{
    MapObject object;
    object.id = id;
    object.kind = MapObjectKind::Asteroid;
    object.transform = {10.0f, 20.0f, 30.0f};
    object.size = 150.0f;
    return object;
}

MapObject nebula(const std::string& id = "nebula-1")
{
    MapObject object;
    object.id = id;
    object.kind = MapObjectKind::Nebula;
    object.transform = {100.0f, 200.0f, 0.0f};
    return object;
}
}

int main()
{
    MapEditSession session;
    expect(!session.isDirty() && !session.canUndo() && !session.canRedo(),
        "new session is clean with empty history");
    expect(session.addObject(asteroid()) == MapEditError::None && session.isDirty(),
        "adding a valid object dirties staging");
    expect(session.addObject(asteroid()) == MapEditError::DuplicateId,
        "duplicate add is rejected");
    expect(session.undo() && !session.isDirty() && session.canRedo(),
        "undo returns to the clean snapshot");
    expect(session.redo() && session.isDirty(), "redo restores the edit");

    expect(session.moveObject("missing", {1, 2, 3}) == MapEditError::NotFound,
        "missing move does not mutate staging");
    expect(session.moveObject("asteroid-1", {50, 60, 70}) == MapEditError::None
            && session.document().objects[0].transform.x == 50,
        "move updates a supported object");
    expect(session.resizeAsteroid("asteroid-1", 400) == MapEditError::None
            && session.document().objects[0].size == 400,
        "asteroid resize is staged");
    expect(session.resizeAsteroid("asteroid-1", -1) == MapEditError::InvalidDocument
            && session.document().objects[0].size == 400,
        "invalid resize leaves document unchanged");

    expect(session.addObject(nebula()) == MapEditError::None, "nebula can be staged");
    expect(session.resizeAsteroid("nebula-1", 10) == MapEditError::WrongKind,
        "nebula cannot use asteroid properties");
    session.markSaved();
    expect(!session.isDirty() && session.cleanDocument() == session.document(),
        "markSaved redefines the clean snapshot");

    expect(session.removeObject("asteroid-1") == MapEditError::None && session.isDirty(),
        "remove dirties the saved document");
    expect(session.undo() && !session.isDirty(),
        "undo after remove returns exactly to saved snapshot");
    expect(session.redo() && session.isDirty(), "redo reapplies remove");
    session.rollback();
    expect(!session.isDirty() && !session.canUndo() && !session.canRedo()
            && session.document().objects.size() == 2,
        "rollback restores saved snapshot and clears history");

    MapObject unsupported;
    unsupported.id = "future-1";
    unsupported.kind = MapObjectKind::Unsupported;
    unsupported.opaque_json = R"({"id":"future-1","kind":"comet","payload":{"tail":10}})";
    expect(session.addObject(unsupported) == MapEditError::None,
        "opaque unsupported object can be staged without interpretation");
    expect(session.moveObject("future-1", {1, 2, 3}) == MapEditError::WrongKind,
        "unsupported object cannot be transformed by the allowlist editor");
    expect(session.undo() && session.document().objects.size() == 2,
        "undo removes unsupported object without corrupting clean objects");
    expect(session.redo() && session.document().objects.back().opaque_json == unsupported.opaque_json,
        "redo preserves opaque bytes");

    MapEditSession invalid_history;
    auto bad = asteroid("bad");
    bad.transform.x = std::numeric_limits<float>::infinity();
    expect(invalid_history.addObject(bad) == MapEditError::InvalidDocument
            && !invalid_history.isDirty() && !invalid_history.canUndo(),
        "invalid operation creates no history entry");

    MapEditSession duplicate_opaque_session;
    MapObject duplicate_opaque;
    duplicate_opaque.id = "future-duplicate";
    duplicate_opaque.kind = MapObjectKind::Unsupported;
    duplicate_opaque.opaque_json =
        R"({"id":"future-duplicate","kind":"comet","payload":1,"payload":2})";
    expect(duplicate_opaque_session.addObject(duplicate_opaque) == MapEditError::InvalidDocument,
        "staging rejects duplicate keys in a programmatic unsupported object");
    expect(duplicate_opaque_session.document().objects.empty()
            && !duplicate_opaque_session.isDirty() && !duplicate_opaque_session.canUndo()
            && !duplicate_opaque_session.canRedo(),
        "rejected opaque object leaves document, dirty state and history untouched");

    MapDocument history_base;
    history_base.objects.push_back(asteroid("history"));

    MapEditSession versioned(history_base);
    MapEditSession copied(versioned);
    expect(copied.sessionId() != versioned.sessionId(),
        "copied session receives a distinct stable identity");
    const auto original_identity = versioned.sessionId();
    versioned = MapEditSession(history_base);
    expect(versioned.sessionId() != original_identity && versioned.revision() == 0,
        "reassigned session receives a new identity and initial revision");
    auto revision = versioned.revision();
    expect(versioned.moveObject("history", {10, 20, 30}) == MapEditError::None
            && versioned.revision() == revision,
        "no-op edit does not advance revision");
    expect(versioned.moveObject("history", {11, 20, 30}) == MapEditError::None
            && versioned.revision() > revision,
        "committed edit advances revision");
    revision = versioned.revision();
    expect(versioned.undo() && versioned.revision() > revision,
        "undo advances revision even when bytes return to an earlier snapshot");
    revision = versioned.revision();
    expect(versioned.redo() && versioned.revision() > revision,
        "redo advances revision");
    revision = versioned.revision();
    versioned.markSaved();
    expect(versioned.revision() > revision, "markSaved advances revision");
    revision = versioned.revision();
    versioned.rollback();
    expect(versioned.revision() > revision, "rollback advances revision");

    MapEditSession bounded(history_base);
    for (int index = 1; index <= 101; ++index)
        expect(bounded.moveObject("history", {static_cast<float>(index), 20, 30}) == MapEditError::None,
            "history move succeeds");
    int undo_count = 0;
    while (bounded.undo()) ++undo_count;
    expect(undo_count == 100 && bounded.document().objects[0].transform.x == 1,
        "history retains the newest 100 snapshots");
    expect(bounded.moveObject("history", {500, 20, 30}) == MapEditError::None
            && !bounded.canRedo(), "new edit after undo clears redo");

    std::cout << "MAP_EDIT_SESSION_TESTS_OK checks=" << checks << "\n";
    return 0;
}
