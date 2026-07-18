#pragma once

#include "content/contentResource.h"

#include <cstddef>
#include <string>
#include <vector>

// Read-only analysis and deterministic layout of a campaign's map graph.
// Pure data in, pure data out: no GUI, no ECS, no serialized v4 strings.

struct CampaignGraphNode
{
    std::string id;
    // Deterministic grid cell. Columns follow the longest transition path from
    // the starting map; rows preserve the campaign's map order per column.
    int column = 0;
    int row = 0;
    bool starting = false;
    // The map id is referenced by the campaign but absent from the library.
    bool missing_in_library = false;
    // No transition path reaches this map from the starting map. Only computed
    // when a starting map is set; without one nothing is reachable or not.
    bool unreachable = false;
};

// Indexes into CampaignGraph::nodes. Only transitions whose two endpoints are
// campaign maps become edges; the codec already rejects everything else.
struct CampaignGraphEdge
{
    std::size_t from = 0;
    std::size_t to = 0;
};

struct CampaignGraph
{
    std::vector<CampaignGraphNode> nodes;
    std::vector<CampaignGraphEdge> edges;
    int columns = 0;
    int rows = 0;
    bool has_starting_map = false;
    std::size_t unreachable_maps = 0;
    std::size_t missing_maps = 0;
    std::size_t missing_characters = 0;
    std::size_t missing_ships = 0;
};

// False when the resource is not a campaign with parseable fields; the output
// is cleared either way. The library is only read to flag missing references.
bool buildCampaignGraph(
    const ContentResource& campaign,
    const std::vector<ContentResource>& library,
    CampaignGraph& output
);
