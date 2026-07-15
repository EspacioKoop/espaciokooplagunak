#pragma once

#include "content/mapDocument.h"

#include <cstddef>
#include <string>
#include <vector>

enum class MapEditError
{
    None,
    InvalidDocument,
    DuplicateId,
    NotFound,
    WrongKind,
    SessionChanged,
};

class MapEditSession
{
public:
    explicit MapEditSession(MapDocument clean_document = {});

    const MapDocument& document() const { return current_document; }
    const MapDocument& cleanDocument() const { return clean_document; }

    MapEditError addObject(MapObject object);
    MapEditError moveObject(const std::string& id, MapObjectTransform transform);
    MapEditError resizeAsteroid(const std::string& id, float size);
    MapEditError removeObject(const std::string& id);

    bool canUndo() const { return !undo_history.empty(); }
    bool canRedo() const { return !redo_history.empty(); }
    bool undo();
    bool redo();
    bool isDirty() const { return current_document != clean_document; }
    void markSaved();
    void rollback();

private:
    static constexpr std::size_t history_limit = 100;

    MapEditError commit(MapDocument next);
    static MapObject* findObject(MapDocument& document, const std::string& id);

    MapDocument clean_document;
    MapDocument current_document;
    std::vector<MapDocument> undo_history;
    std::vector<MapDocument> redo_history;
};
