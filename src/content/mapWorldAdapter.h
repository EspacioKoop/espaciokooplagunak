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

private:
    std::unordered_map<std::string, sp::ecs::Entity> entities;
};
