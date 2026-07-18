#pragma once

#include "content/mapApplySession.h"

#include "ecs/entity.h"

#include <unordered_map>

// Owns the batch handle -> entity mapping and builds the allowlisted entities.
// This is the only place where the map apply vertical touches the ECS world.
class MapWorldAdapter
{
public:
    MapApplySession::Create creator();
    MapApplySession::Destroy destroyer();

    bool empty() const { return entities.empty(); }
    void clear() { entities.clear(); }

    // Batch entity for a handle, or a null entity when the handle is unknown.
    sp::ecs::Entity find(const std::string& handle) const
    {
        auto it = entities.find(handle);
        return it == entities.end() ? sp::ecs::Entity{} : it->second;
    }

private:
    std::unordered_map<std::string, sp::ecs::Entity> entities;
};
