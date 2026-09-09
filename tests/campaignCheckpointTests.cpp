#include "content/campaignCheckpoint.h"

#include <cstdlib>
#include <iostream>
#include <string>

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
}

int main()
{
    // Round-trip fidelity: a complex checkpoint survives serialize -> parse
    // -> serialize with zero data loss or field misalignment (issue #766,
    // acceptance criterion 4).
    CampaignCheckpoint original;
    original.version = 1;
    original.simulation = R"({
        "hull": 87.5,
        "systems": {
            "reactor": {"health": 1.0, "power": 3, "heat": 0.42},
            "shields": {"health": 0.65, "power": 2, "heat": 0.1}
        },
        "rooms": [
            {"id": "puente", "status": "nominal"},
            {"id": "reactor", "status": "damaged"}
        ],
        "contacts": [{"id": "trampa-1", "x": 120.5, "y": -44.25, "identified": false}]
    })";
    original.campaign = R"({
        "crisis": {"active": ["ambush-1"], "solved": []},
        "flags": {"met_faction_kraylor": true, "waypoint_03_complete": false},
        "log": ["arribo a sector 4", "primer contacto hostil"],
        "alert_level": "yellow"
    })";
    original.seeds = R"({"nave_pixelart": 918273645, "musica": 42, "npc_taberna_1": 7})";

    const auto encoded = serializeCampaignCheckpoint(original);
    CampaignCheckpoint decoded;
    expect(parseCampaignCheckpoint(encoded, decoded) == CampaignCheckpointError::None,
        "a well-formed checkpoint parses cleanly");
    expect(decoded == original, "decoding a valid checkpoint loses no data");
    expect(decoded.version == 1, "version round-trips");

    const auto re_encoded = serializeCampaignCheckpoint(decoded);
    CampaignCheckpoint re_decoded;
    expect(parseCampaignCheckpoint(re_encoded, re_decoded) == CampaignCheckpointError::None,
        "a re-serialized checkpoint parses cleanly");
    expect(re_decoded == original, "a second round trip still loses no data");

    // Minimal, empty-section checkpoint is still valid.
    CampaignCheckpoint empty;
    const auto empty_encoded = serializeCampaignCheckpoint(empty);
    CampaignCheckpoint empty_decoded;
    expect(parseCampaignCheckpoint(empty_encoded, empty_decoded) == CampaignCheckpointError::None,
        "the default checkpoint (empty sections) round-trips");
    expect(empty_decoded == empty, "empty sections compare equal after round-trip");

    // Envelope contract.
    expect(parseCampaignCheckpoint("not json", decoded) == CampaignCheckpointError::InvalidJson,
        "malformed JSON is rejected");
    expect(parseCampaignCheckpoint("[]", decoded) == CampaignCheckpointError::InvalidJson,
        "a non-object top level is rejected");
    expect(parseCampaignCheckpoint(
            R"({"format":"espaciokoop-campaign-checkpoint","version":1,"simulation":{},"campaign":{},"seeds":{},"extra":true})",
            decoded) == CampaignCheckpointError::UnknownFields,
        "unknown top-level fields are rejected");
    expect(parseCampaignCheckpoint(
            R"({"format":"wrong-format","version":1,"simulation":{},"campaign":{},"seeds":{}})",
            decoded) == CampaignCheckpointError::UnsupportedFormatOrVersion,
        "a wrong format id is rejected");
    expect(parseCampaignCheckpoint(
            R"({"format":"espaciokoop-campaign-checkpoint","version":2,"simulation":{},"campaign":{},"seeds":{}})",
            decoded) == CampaignCheckpointError::UnsupportedFormatOrVersion,
        "a future version is rejected");
    expect(parseCampaignCheckpoint(
            R"({"format":"espaciokoop-campaign-checkpoint","version":0,"simulation":{},"campaign":{},"seeds":{}})",
            decoded) == CampaignCheckpointError::UnsupportedFormatOrVersion,
        "version zero is rejected");
    expect(parseCampaignCheckpoint(
            R"({"format":"espaciokoop-campaign-checkpoint","version":1,"simulation":[],"campaign":{},"seeds":{}})",
            decoded) == CampaignCheckpointError::InvalidSimulationSection,
        "a non-object simulation section is rejected");
    expect(parseCampaignCheckpoint(
            R"({"format":"espaciokoop-campaign-checkpoint","version":1,"simulation":{},"campaign":"nope","seeds":{}})",
            decoded) == CampaignCheckpointError::InvalidCampaignSection,
        "a non-object campaign section is rejected");
    expect(parseCampaignCheckpoint(
            R"({"format":"espaciokoop-campaign-checkpoint","version":1,"simulation":{},"campaign":{},"seeds":{"a":1.5}})",
            decoded) == CampaignCheckpointError::InvalidSeedsSection,
        "a non-integer seed value is rejected")
        ;
    expect(parseCampaignCheckpoint(
            R"({"format":"espaciokoop-campaign-checkpoint","version":1,"simulation":{},"campaign":{},"seeds":["nope"]})",
            decoded) == CampaignCheckpointError::InvalidSeedsSection,
        "a non-object seeds section is rejected");
    expect(parseCampaignCheckpoint(
            R"({"format":"espaciokoop-campaign-checkpoint","version":1,"simulation":{"a":1,"a":2},"campaign":{},"seeds":{}})",
            decoded) == CampaignCheckpointError::DuplicateJsonKeys,
        "duplicate keys anywhere in the document are rejected");
    expect(parseCampaignCheckpoint(
            std::string(CAMPAIGN_CHECKPOINT_MAX_BYTES + 1, ' '), decoded)
            == CampaignCheckpointError::ImportTooLarge,
        "an oversized checkpoint is rejected before parsing");

    // Structural equality ignores key order and whitespace.
    CampaignCheckpoint reordered = original;
    reordered.simulation = R"({"contacts":[{"id":"trampa-1","x":120.5,"y":-44.25,"identified":false}],)"
        R"("rooms":[{"id":"puente","status":"nominal"},{"id":"reactor","status":"damaged"}],)"
        R"("systems":{"shields":{"health":0.65,"power":2,"heat":0.1},)"
        R"("reactor":{"health":1.0,"power":3,"heat":0.42}},"hull":87.5})";
    expect(reordered == original, "structural equality ignores JSON key order");

    std::cout << "CAMPAIGN_CHECKPOINT_TESTS_OK checks=" << checks << "\n";
    return 0;
}
