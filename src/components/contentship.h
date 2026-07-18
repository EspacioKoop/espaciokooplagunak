#pragma once

#include "content/shipDocument.h"

#include <string>
#include <vector>

// Server-authoritative receipt of declarative cargo/resources applied by the
// content editor. Gameplay systems consume energy/coolant directly; generic
// cargo remains typed metadata until a dedicated cargo system owns it.
class ContentShipManifest
{
public:
    std::string resource_id;
    std::vector<ShipResourceAmount> resources;
    std::vector<ShipCargoAmount> cargo;
};
