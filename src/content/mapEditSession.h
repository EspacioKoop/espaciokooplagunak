#pragma once

#include "content/mapDocument.h"

#include <cstddef>
#include <cstdint>
#include <string>
#include <utility>
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
    MapEditSession(const MapEditSession& other);
    MapEditSession(MapEditSession&& other) noexcept;
    MapEditSession& operator=(const MapEditSession& other);
    MapEditSession& operator=(MapEditSession&& other) noexcept;

    const MapDocument& document() const { return current_document; }
    const MapDocument& cleanDocument() const { return clean_document; }
    std::uint64_t sessionId() const { return session_id; }
    std::uint64_t revision() const { return session_revision; }

    MapEditError addObject(MapObject object);
    MapEditError addObject(
        MapObjectKind kind,
        MapObjectTransform transform,
        std::string* created_id = nullptr);
    MapEditError moveObject(const std::string& id, MapObjectTransform transform);
    MapEditError rotateObject(const std::string& id, float delta_degrees);
    MapEditError resizeAsteroid(const std::string& id, float size);
    MapEditError removeObject(const std::string& id);

    // Batch variants for multi-selection (#54). They exist for one reason: a
    // group edit must be ONE undo entry. Looping over the single-object calls
    // would push one snapshot per object, so undoing a ten-object rotation would
    // take ten presses and each press would leave the group half-rotated - a
    // state the user never asked for and cannot name.
    //
    // All-or-nothing on purpose: if any id is missing or unsupported, nothing is
    // committed. A partially applied group edit is the worst outcome here,
    // because the selection still looks like a group afterwards.
    MapEditError moveObjects(const std::vector<std::pair<std::string, MapObjectTransform>>& moves);
    MapEditError rotateObjects(const std::vector<std::string>& ids, float delta_degrees);
    MapEditError removeObjects(const std::vector<std::string>& ids);

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
    static std::uint64_t nextSessionId();
    void advanceRevision();

    std::uint64_t session_id;
    std::uint64_t session_revision = 0;
    MapDocument clean_document;
    MapDocument current_document;
    std::vector<MapDocument> undo_history;
    std::vector<MapDocument> redo_history;
};
