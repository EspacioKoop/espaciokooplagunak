#include "content/campaignGraph.h"

#include <algorithm>
#include <functional>
#include <map>

namespace
{
bool libraryHas(
    const std::vector<ContentResource>& library,
    ContentResourceType type,
    const std::string& id)
{
    return std::any_of(library.begin(), library.end(), [&](const ContentResource& resource) {
        return resource.type == type && resource.id == id;
    });
}

std::size_t countMissing(
    const std::vector<ContentResource>& library,
    ContentResourceType type,
    const std::vector<std::string>& ids)
{
    std::size_t missing = 0;
    for (const auto& id : ids)
        if (!libraryHas(library, type, id)) ++missing;
    return missing;
}
}

bool buildCampaignGraph(
    const ContentResource& campaign,
    const std::vector<ContentResource>& library,
    CampaignGraph& output)
{
    output = {};
    CampaignFields fields;
    if (!campaignFields(campaign, fields)) return false;

    std::map<std::string, std::size_t> index_by_id;
    output.nodes.reserve(fields.map_ids.size());
    for (const auto& id : fields.map_ids)
    {
        CampaignGraphNode node;
        node.id = id;
        node.starting = id == fields.starting_map_id;
        node.missing_in_library = !libraryHas(library, ContentResourceType::Map, id);
        if (node.missing_in_library) ++output.missing_maps;
        index_by_id[id] = output.nodes.size();
        output.nodes.push_back(std::move(node));
    }

    // Transitions naming maps outside the campaign are a validation error
    // upstream; here they are simply not drawable, so they are skipped.
    std::vector<std::vector<std::size_t>> successors(output.nodes.size());
    for (const auto& transition : fields.transitions)
    {
        const auto from = index_by_id.find(transition.first);
        const auto to = index_by_id.find(transition.second);
        if (from == index_by_id.end() || to == index_by_id.end()) continue;
        output.edges.push_back({from->second, to->second});
        successors[from->second].push_back(to->second);
    }

    output.has_starting_map = !fields.starting_map_id.empty()
        && index_by_id.count(fields.starting_map_id) > 0;

    // Longest-path depth from the starting map. The codec guarantees acyclic
    // transitions, but the visit guard keeps hand-built resources safe too.
    std::vector<int> depth(output.nodes.size(), -1);
    if (output.has_starting_map)
    {
        std::vector<char> on_stack(output.nodes.size(), 0);
        std::function<void(std::size_t, int)> visit = [&](std::size_t node, int level) {
            if (on_stack[node]) return;
            if (depth[node] >= level && depth[node] >= 0) return;
            depth[node] = std::max(depth[node], level);
            on_stack[node] = 1;
            for (const auto next : successors[node]) visit(next, level + 1);
            on_stack[node] = 0;
        };
        visit(index_by_id[fields.starting_map_id], 0);
    }

    int max_depth = -1;
    for (const auto value : depth) max_depth = std::max(max_depth, value);
    for (std::size_t index = 0; index < output.nodes.size(); ++index)
    {
        auto& node = output.nodes[index];
        if (depth[index] >= 0)
        {
            node.column = depth[index];
            continue;
        }
        node.unreachable = output.has_starting_map;
        if (node.unreachable) ++output.unreachable_maps;
        // Unclassified maps line up after the deepest reachable column.
        node.column = max_depth + 1;
    }

    std::map<int, int> next_row;
    for (auto& node : output.nodes)
    {
        node.row = next_row[node.column]++;
        output.columns = std::max(output.columns, node.column + 1);
        output.rows = std::max(output.rows, node.row + 1);
    }

    output.missing_characters = countMissing(library, ContentResourceType::Character, fields.character_ids);
    output.missing_ships = countMissing(library, ContentResourceType::Ship, fields.ship_ids);
    return true;
}
