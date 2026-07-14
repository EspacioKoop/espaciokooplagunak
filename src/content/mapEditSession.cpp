#include "content/mapEditSession.h"

#include <algorithm>
#include <utility>

MapEditSession::MapEditSession(MapDocument clean_document)
: clean_document(std::move(clean_document)), current_document(this->clean_document)
{
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
    return MapEditError::None;
}

MapEditError MapEditSession::addObject(MapObject object)
{
    if (findObject(current_document, object.id)) return MapEditError::DuplicateId;
    auto next = current_document;
    next.objects.push_back(std::move(object));
    return commit(std::move(next));
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
    return true;
}

bool MapEditSession::redo()
{
    if (redo_history.empty()) return false;
    undo_history.push_back(current_document);
    if (undo_history.size() > history_limit) undo_history.erase(undo_history.begin());
    current_document = std::move(redo_history.back());
    redo_history.pop_back();
    return true;
}

void MapEditSession::markSaved()
{
    clean_document = current_document;
}

void MapEditSession::rollback()
{
    current_document = clean_document;
    undo_history.clear();
    redo_history.clear();
}
