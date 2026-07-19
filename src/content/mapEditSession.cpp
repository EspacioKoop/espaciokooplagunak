#include "content/mapEditSession.h"

#include <algorithm>
#include <atomic>
#include <cstdint>
#include <utility>

namespace
{
std::atomic<std::uint64_t> next_session_id{1};
}

MapEditSession::MapEditSession(MapDocument clean_document)
: session_id(nextSessionId()), clean_document(std::move(clean_document)),
  current_document(this->clean_document)
{
}

MapEditSession::MapEditSession(const MapEditSession& other)
: session_id(nextSessionId()), clean_document(other.clean_document),
  current_document(other.current_document), undo_history(other.undo_history),
  redo_history(other.redo_history)
{
}

MapEditSession::MapEditSession(MapEditSession&& other) noexcept
: session_id(nextSessionId()), clean_document(std::move(other.clean_document)),
  current_document(std::move(other.current_document)), undo_history(std::move(other.undo_history)),
  redo_history(std::move(other.redo_history))
{
}

MapEditSession& MapEditSession::operator=(const MapEditSession& other)
{
    if (this == &other) return *this;
    clean_document = other.clean_document;
    current_document = other.current_document;
    undo_history = other.undo_history;
    redo_history = other.redo_history;
    session_id = nextSessionId();
    session_revision = 0;
    return *this;
}

MapEditSession& MapEditSession::operator=(MapEditSession&& other) noexcept
{
    if (this == &other) return *this;
    clean_document = std::move(other.clean_document);
    current_document = std::move(other.current_document);
    undo_history = std::move(other.undo_history);
    redo_history = std::move(other.redo_history);
    session_id = nextSessionId();
    session_revision = 0;
    return *this;
}

std::uint64_t MapEditSession::nextSessionId()
{
    return next_session_id.fetch_add(1, std::memory_order_relaxed);
}

void MapEditSession::advanceRevision()
{
    ++session_revision;
}

MapObject* MapEditSession::findObject(MapDocument& document, const std::string& id)
{
    const auto it = std::find_if(document.objects.begin(), document.objects.end(),
        [&](const MapObject& object) { return object.id == id; });
    return it == document.objects.end() ? nullptr : &*it;
}

MapEditError MapEditSession::commit(MapDocument next)
{
    if (validateMapDocument(next) != MapDocumentError::None) return MapEditError::InvalidDocument;
    if (next == current_document) return MapEditError::None;
    undo_history.push_back(current_document);
    if (undo_history.size() > history_limit) undo_history.erase(undo_history.begin());
    current_document = std::move(next);
    redo_history.clear();
    advanceRevision();
    return MapEditError::None;
}

MapEditError MapEditSession::addObject(MapObject object)
{
    if (findObject(current_document, object.id)) return MapEditError::DuplicateId;
    auto next = current_document;
    next.objects.push_back(std::move(object));
    return commit(std::move(next));
}

MapEditError MapEditSession::addObject(
    MapObjectKind kind,
    MapObjectTransform transform,
    std::string* created_id)
{
    if (created_id) created_id->clear();
    if (kind != MapObjectKind::Asteroid && kind != MapObjectKind::Nebula)
        return MapEditError::WrongKind;

    const std::string prefix = kind == MapObjectKind::Asteroid ? "asteroid-" : "nebula-";
    std::string id;
    for (std::size_t suffix = 1; suffix <= MAP_DOCUMENT_MAX_OBJECTS + 1; ++suffix)
    {
        const auto candidate = prefix + std::to_string(suffix);
        if (!findObject(current_document, candidate))
        {
            id = candidate;
            break;
        }
    }
    if (id.empty()) return MapEditError::InvalidDocument;

    MapObject object;
    object.id = id;
    object.kind = kind;
    object.transform = transform;
    object.size = 120.0f;
    const auto result = addObject(std::move(object));
    if (result == MapEditError::None && created_id) *created_id = id;
    return result;
}

MapEditError MapEditSession::moveObject(const std::string& id, MapObjectTransform transform)
{
    auto next = current_document;
    auto* object = findObject(next, id);
    if (!object) return MapEditError::NotFound;
    if (object->kind == MapObjectKind::Unsupported) return MapEditError::WrongKind;
    object->transform = transform;
    return commit(std::move(next));
}

MapEditError MapEditSession::resizeAsteroid(const std::string& id, float size)
{
    auto next = current_document;
    auto* object = findObject(next, id);
    if (!object) return MapEditError::NotFound;
    if (object->kind != MapObjectKind::Asteroid) return MapEditError::WrongKind;
    object->size = size;
    return commit(std::move(next));
}

MapEditError MapEditSession::removeObject(const std::string& id)
{
    auto next = current_document;
    const auto it = std::find_if(next.objects.begin(), next.objects.end(),
        [&](const MapObject& object) { return object.id == id; });
    if (it == next.objects.end()) return MapEditError::NotFound;
    next.objects.erase(it);
    return commit(std::move(next));
}

bool MapEditSession::undo()
{
    if (undo_history.empty()) return false;
    redo_history.push_back(current_document);
    current_document = std::move(undo_history.back());
    undo_history.pop_back();
    advanceRevision();
    return true;
}

bool MapEditSession::redo()
{
    if (redo_history.empty()) return false;
    undo_history.push_back(current_document);
    if (undo_history.size() > history_limit) undo_history.erase(undo_history.begin());
    current_document = std::move(redo_history.back());
    redo_history.pop_back();
    advanceRevision();
    return true;
}

void MapEditSession::markSaved()
{
    clean_document = current_document;
    advanceRevision();
}

void MapEditSession::rollback()
{
    current_document = clean_document;
    undo_history.clear();
    redo_history.clear();
    advanceRevision();
}
