#include "content/shipEditSession.h"

#include <algorithm>
#include <utility>

ShipEditSession::ShipEditSession(ShipDocument clean_document)
: clean_document(std::move(clean_document)), current_document(this->clean_document)
{
}

ShipEditError ShipEditSession::commit(ShipDocument next)
{
    if (validateShipDocument(next) != ShipDocumentError::None)
        return ShipEditError::InvalidDocument;
    if (next == current_document) return ShipEditError::None;
    undo_history.push_back(current_document);
    if (undo_history.size() > history_limit) undo_history.erase(undo_history.begin());
    current_document = std::move(next);
    redo_history.clear();
    return ShipEditError::None;
}

ShipEditError ShipEditSession::setSystemHealth(ShipSystemId system, float health)
{
    auto next = current_document;
    const auto it = std::find_if(next.systems.begin(), next.systems.end(),
        [system](const ShipSystemOverride& item) { return item.system == system; });
    if (it == next.systems.end()) next.systems.push_back({system, health});
    else it->health = health;
    return commit(std::move(next));
}

ShipEditError ShipEditSession::removeSystemOverride(ShipSystemId system)
{
    auto next = current_document;
    const auto it = std::find_if(next.systems.begin(), next.systems.end(),
        [system](const ShipSystemOverride& item) { return item.system == system; });
    if (it == next.systems.end()) return ShipEditError::NotFound;
    next.systems.erase(it);
    return commit(std::move(next));
}

ShipEditError ShipEditSession::setHullMax(float hull_max)
{
    auto next = current_document;
    next.hull_max = hull_max;
    return commit(std::move(next));
}

ShipEditError ShipEditSession::removeHullOverride()
{
    if (!current_document.hull_max) return ShipEditError::NotFound;
    auto next = current_document;
    next.hull_max.reset();
    return commit(std::move(next));
}

ShipEditError ShipEditSession::setShieldMax(bool front, float shield_max)
{
    auto next = current_document;
    (front ? next.front_shield_max : next.rear_shield_max) = shield_max;
    return commit(std::move(next));
}

ShipEditError ShipEditSession::removeShieldOverride(bool front)
{
    const auto& current = front
        ? current_document.front_shield_max : current_document.rear_shield_max;
    if (!current) return ShipEditError::NotFound;
    auto next = current_document;
    (front ? next.front_shield_max : next.rear_shield_max).reset();
    return commit(std::move(next));
}

ShipEditError ShipEditSession::setEngineSpeed(ShipEngineId engine, float speed)
{
    if (engine < ShipEngineId::Impulse || engine >= ShipEngineId::Count)
        return ShipEditError::InvalidDocument;
    auto next = current_document;
    shipEngineSpeed(next, engine) = speed;
    return commit(std::move(next));
}

ShipEditError ShipEditSession::removeEngineOverride(ShipEngineId engine)
{
    if (engine < ShipEngineId::Impulse || engine >= ShipEngineId::Count)
        return ShipEditError::NotFound;
    if (!shipEngineSpeed(current_document, engine)) return ShipEditError::NotFound;
    auto next = current_document;
    shipEngineSpeed(next, engine).reset();
    return commit(std::move(next));
}

ShipEditError ShipEditSession::setMissileCapacity(ShipMissileId missile, std::uint32_t capacity)
{
    auto next = current_document;
    const auto it = std::find_if(next.missile_storage.begin(), next.missile_storage.end(),
        [missile](const ShipMissileStorage& entry) { return entry.missile == missile; });
    if (it != next.missile_storage.end()) it->capacity = capacity;
    else next.missile_storage.push_back({missile, capacity});
    return commit(std::move(next));
}

ShipEditError ShipEditSession::removeMissileOverride(ShipMissileId missile)
{
    auto next = current_document;
    const auto it = std::find_if(next.missile_storage.begin(), next.missile_storage.end(),
        [missile](const ShipMissileStorage& entry) { return entry.missile == missile; });
    if (it == next.missile_storage.end()) return ShipEditError::NotFound;
    next.missile_storage.erase(it);
    return commit(std::move(next));
}

ShipEditError ShipEditSession::setResourceAmount(const std::string& id, float amount)
{
    auto next = current_document;
    const auto it = std::find_if(next.resources.begin(), next.resources.end(),
        [&id](const ShipResourceAmount& item) { return item.id == id; });
    if (it == next.resources.end()) next.resources.push_back({id, amount});
    else it->amount = amount;
    return commit(std::move(next));
}

ShipEditError ShipEditSession::removeResource(const std::string& id)
{
    auto next = current_document;
    const auto it = std::find_if(next.resources.begin(), next.resources.end(),
        [&id](const ShipResourceAmount& item) { return item.id == id; });
    if (it == next.resources.end()) return ShipEditError::NotFound;
    next.resources.erase(it);
    return commit(std::move(next));
}

ShipEditError ShipEditSession::setCargoQuantity(const std::string& id, std::uint32_t quantity)
{
    auto next = current_document;
    const auto it = std::find_if(next.cargo.begin(), next.cargo.end(),
        [&id](const ShipCargoAmount& item) { return item.id == id; });
    if (it == next.cargo.end()) next.cargo.push_back({id, quantity});
    else it->quantity = quantity;
    return commit(std::move(next));
}

ShipEditError ShipEditSession::removeCargo(const std::string& id)
{
    auto next = current_document;
    const auto it = std::find_if(next.cargo.begin(), next.cargo.end(),
        [&id](const ShipCargoAmount& item) { return item.id == id; });
    if (it == next.cargo.end()) return ShipEditError::NotFound;
    next.cargo.erase(it);
    return commit(std::move(next));
}

ShipEditError ShipEditSession::setCrewPosition(const std::string& id, bool enabled)
{
    auto next = current_document;
    const auto it = std::find(next.crew_position_ids.begin(), next.crew_position_ids.end(), id);
    if (enabled)
    {
        if (it == next.crew_position_ids.end()) next.crew_position_ids.push_back(id);
    }
    else
    {
        if (it == next.crew_position_ids.end()) return ShipEditError::NotFound;
        next.crew_position_ids.erase(it);
    }
    return commit(std::move(next));
}

bool ShipEditSession::undo()
{
    if (undo_history.empty()) return false;
    redo_history.push_back(current_document);
    current_document = std::move(undo_history.back());
    undo_history.pop_back();
    return true;
}

bool ShipEditSession::redo()
{
    if (redo_history.empty()) return false;
    undo_history.push_back(current_document);
    if (undo_history.size() > history_limit) undo_history.erase(undo_history.begin());
    current_document = std::move(redo_history.back());
    redo_history.pop_back();
    return true;
}

void ShipEditSession::markSaved()
{
    clean_document = current_document;
}

void ShipEditSession::rollback()
{
    current_document = clean_document;
    undo_history.clear();
    redo_history.clear();
}
