#pragma once

#include <cstddef>
#include <string>

// Versioned envelope for campaign checkpoints (issue #766). It carries three
// opaque JSON object bodies -- simulation (C++ ship state), campaign (Lua
// scenario state) and seeds (deterministic procedural-art/minigame seeds) --
// without knowing their internal schema, which later PRs (#766.2, #766.3)
// define. This codec only guarantees the envelope round-trips losslessly and
// reuses the validation idioms of contentResource.cpp (duplicate-key
// rejection, closed field sets, explicit size limits).
constexpr int CAMPAIGN_CHECKPOINT_SCHEMA_VERSION = 1;
constexpr std::size_t CAMPAIGN_CHECKPOINT_MAX_BYTES = 8 * 1024 * 1024;

enum class CampaignCheckpointError
{
    None,
    ImportTooLarge,
    InvalidJson,
    DuplicateJsonKeys,
    UnknownFields,
    UnsupportedFormatOrVersion,
    InvalidSimulationSection,
    InvalidCampaignSection,
    InvalidSeedsSection,
};

struct CampaignCheckpoint
{
    int version = CAMPAIGN_CHECKPOINT_SCHEMA_VERSION;
    // Each field holds a serialized JSON object body ("{}" at minimum).
    std::string simulation = "{}";
    std::string campaign = "{}";
    // JSON object of string keys to integer seed values.
    std::string seeds = "{}";
};

// Structural equality of the decoded JSON, independent of key order or
// whitespace -- two checkpoints that carry the same data compare equal even
// if their section strings differ byte-for-byte.
bool operator==(const CampaignCheckpoint& lhs, const CampaignCheckpoint& rhs);
bool operator!=(const CampaignCheckpoint& lhs, const CampaignCheckpoint& rhs);

std::string serializeCampaignCheckpoint(const CampaignCheckpoint& checkpoint, int indent = -1);
CampaignCheckpointError parseCampaignCheckpoint(const std::string& input, CampaignCheckpoint& checkpoint);
