#include "content/campaignGraph.h"

#include <cstdlib>
#include <iostream>

namespace
{
int checks = 0;

void expect(bool condition, const char* message)
{
    ++checks;
    if (!condition)
    {
        std::cerr << "FAIL: " << message << "\n";
        std::exit(1);
    }
}

ContentResource libraryEntry(ContentResourceType type, const std::string& id)
{
    ContentResource resource;
    resource.type = type;
    resource.id = id;
    resource.name = id;
    return resource;
}

ContentResource campaign(
    const std::string& maps,
    const std::string& starting,
    const std::string& transitions,
    const std::string& characters = "",
    const std::string& ships = "")
{
    ContentResource resource;
    resource.type = ContentResourceType::Campaign;
    resource.id = "c-1";
    resource.name = "Campaign";
    resource.primary = maps;
    resource.secondary = starting;
    resource.tertiary = characters;
    resource.quaternary = ships;
    resource.quinary = transitions;
    return resource;
}

const CampaignGraphNode* node(const CampaignGraph& graph, const std::string& id)
{
    for (const auto& candidate : graph.nodes)
        if (candidate.id == id) return &candidate;
    return nullptr;
}
}

int main()
{
    std::vector<ContentResource> library = {
        libraryEntry(ContentResourceType::Map, "m-1"),
        libraryEntry(ContentResourceType::Map, "m-2"),
        libraryEntry(ContentResourceType::Map, "m-3"),
        libraryEntry(ContentResourceType::Map, "m-4"),
        libraryEntry(ContentResourceType::Character, "p-1"),
        libraryEntry(ContentResourceType::Ship, "s-1"),
    };

    // Non-campaigns and unparseable campaigns never build a graph.
    {
        CampaignGraph graph;
        expect(!buildCampaignGraph(libraryEntry(ContentResourceType::Map, "m-1"), library, graph)
                && graph.nodes.empty(),
            "a non-campaign resource builds no graph");
        expect(!buildCampaignGraph(campaign("not a::valid list", "", ""), library, graph),
            "a campaign with unparseable fields builds no graph");
    }

    // Diamond with a tail: deterministic layered layout from the starting map.
    {
        CampaignGraph graph;
        expect(buildCampaignGraph(
                campaign("m-1, m-2, m-3, m-4", "m-1", "m-1>m-2, m-1>m-3, m-2>m-4, m-3>m-4"),
                library, graph),
            "a valid campaign builds a graph");
        expect(graph.nodes.size() == 4 && graph.edges.size() == 4,
            "every map and transition is represented");
        expect(graph.has_starting_map && node(graph, "m-1")->starting
                && !node(graph, "m-2")->starting,
            "only the starting map is flagged as starting");
        expect(node(graph, "m-1")->column == 0 && node(graph, "m-2")->column == 1
                && node(graph, "m-3")->column == 1 && node(graph, "m-4")->column == 2,
            "columns follow the longest path from the starting map");
        expect(node(graph, "m-2")->row == 0 && node(graph, "m-3")->row == 1,
            "rows preserve the campaign map order inside a column");
        expect(graph.columns == 3 && graph.rows == 2,
            "grid bounds cover the produced layout");
        expect(graph.unreachable_maps == 0 && graph.missing_maps == 0
                && graph.missing_characters == 0 && graph.missing_ships == 0,
            "a complete reachable campaign raises no warnings");

        // Edges reference node indexes, deterministically in transition order.
        expect(graph.nodes[graph.edges[0].from].id == "m-1"
                && graph.nodes[graph.edges[0].to].id == "m-2",
            "edges preserve transition order and endpoints");
    }

    // Unreachable maps are flagged and parked after the deepest column.
    {
        CampaignGraph graph;
        expect(buildCampaignGraph(
                campaign("m-1, m-2, m-3", "m-1", "m-1>m-2"), library, graph),
            "campaign with an unreachable map still builds");
        const auto* orphan = node(graph, "m-3");
        expect(graph.unreachable_maps == 1 && orphan->unreachable && !node(graph, "m-2")->unreachable,
            "exactly the unreachable map is flagged");
        expect(orphan->column == 2, "unreachable maps park after the deepest reachable column");
    }

    // Without a starting map nothing is judged unreachable.
    {
        CampaignGraph graph;
        expect(buildCampaignGraph(campaign("m-1, m-2", "", "m-1>m-2"), library, graph),
            "campaign without starting map still builds");
        expect(!graph.has_starting_map && graph.unreachable_maps == 0
                && !graph.nodes[0].unreachable && !graph.nodes[1].unreachable,
            "reachability is only judged when a starting map exists");
    }

    // Missing references in the library are counted per type.
    {
        CampaignGraph graph;
        expect(buildCampaignGraph(
                campaign("m-1, m-9", "m-1", "", "p-1, p-9", "s-1, s-9"), library, graph),
            "campaign with dangling references still builds");
        expect(node(graph, "m-9")->missing_in_library && !node(graph, "m-1")->missing_in_library,
            "exactly the dangling map is flagged as missing");
        expect(graph.missing_maps == 1 && graph.missing_characters == 1 && graph.missing_ships == 1,
            "missing references are counted per type");
    }

    // A defensive cycle in a hand-built resource must not hang or crash.
    {
        ContentResource looped = campaign("m-1, m-2", "m-1", "");
        looped.quinary = "m-1>m-2, m-2>m-1";
        CampaignGraph graph;
        expect(buildCampaignGraph(looped, library, graph) && graph.nodes.size() == 2,
            "a cyclic hand-built resource degrades safely");
    }

    std::cout << "CAMPAIGN_GRAPH_TESTS_OK checks=" << checks << "\n";
    return 0;
}
