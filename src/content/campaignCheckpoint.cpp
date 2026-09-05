#include "content/campaignCheckpoint.h"

#include <map>
#include <set>
#include <nlohmann/json.hpp>

namespace
{
constexpr const char* CAMPAIGN_CHECKPOINT_FORMAT_ID = "espaciokoop-campaign-checkpoint";

// Same duplicate-key detection idiom as contentResource.cpp's
// hasDuplicateJsonKeys: nlohmann::json::parse silently keeps the last value
// for a repeated key, which would let a crafted save file smuggle a second,
// unvalidated value past every check below.
bool hasDuplicateJsonKeys(const std::string& input)
{
    bool duplicate = false;
    std::map<int, std::set<std::string>> keys_by_depth;
    auto callback = [&duplicate, &keys_by_depth](int depth, nlohmann::json::parse_event_t event,
                                                 nlohmann::json& parsed) {
        if (event == nlohmann::json::parse_event_t::object_start) keys_by_depth[depth + 1].clear();
        else if (event == nlohmann::json::parse_event_t::key)
        {
            const auto key = parsed.get<std::string>();
            if (!keys_by_depth[depth].insert(key).second) duplicate = true;
        }
        return true;
    };
    [[maybe_unused]] const auto checked = nlohmann::json::parse(input, callback, false, false);
    return duplicate;
}

bool readVersion(const nlohmann::json& version, int& output)
{
    std::int64_t value = -1;
    if (version.is_number_unsigned())
    {
        const auto unsigned_value = version.get<std::uint64_t>();
        if (unsigned_value > static_cast<std::uint64_t>(CAMPAIGN_CHECKPOINT_SCHEMA_VERSION)) return false;
        value = static_cast<std::int64_t>(unsigned_value);
    }
    else if (version.is_number_integer()) value = version.get<std::int64_t>();
    else return false;
    if (value < 1 || value > CAMPAIGN_CHECKPOINT_SCHEMA_VERSION) return false;
    output = static_cast<int>(value);
    return true;
}

bool readObjectSection(const nlohmann::json& document, const char* key, std::string& output)
{
    const auto it = document.find(key);
    if (it == document.end() || !it->is_object()) return false;
    output = it->dump(-1);
    return true;
}

bool readSeedsSection(const nlohmann::json& document, std::string& output)
{
    const auto it = document.find("seeds");
    if (it == document.end() || !it->is_object()) return false;
    for (auto entry = it->begin(); entry != it->end(); ++entry)
        if (!entry.value().is_number_integer() && !entry.value().is_number_unsigned()) return false;
    output = it->dump(-1);
    return true;
}
}

bool operator==(const CampaignCheckpoint& lhs, const CampaignCheckpoint& rhs)
{
    if (lhs.version != rhs.version) return false;
    const auto parse = [](const std::string& value) {
        return nlohmann::json::parse(value, nullptr, false, false);
    };
    return parse(lhs.simulation) == parse(rhs.simulation)
        && parse(lhs.campaign) == parse(rhs.campaign)
        && parse(lhs.seeds) == parse(rhs.seeds);
}

bool operator!=(const CampaignCheckpoint& lhs, const CampaignCheckpoint& rhs)
{
    return !(lhs == rhs);
}

std::string serializeCampaignCheckpoint(const CampaignCheckpoint& checkpoint, int indent)
{
    nlohmann::json document;
    document["format"] = CAMPAIGN_CHECKPOINT_FORMAT_ID;
    document["version"] = checkpoint.version;
    document["simulation"] = nlohmann::json::parse(checkpoint.simulation, nullptr, false, false);
    document["campaign"] = nlohmann::json::parse(checkpoint.campaign, nullptr, false, false);
    document["seeds"] = nlohmann::json::parse(checkpoint.seeds, nullptr, false, false);
    return document.dump(indent);
}

CampaignCheckpointError parseCampaignCheckpoint(const std::string& input, CampaignCheckpoint& checkpoint)
{
    if (input.size() > CAMPAIGN_CHECKPOINT_MAX_BYTES) return CampaignCheckpointError::ImportTooLarge;
    const auto document = nlohmann::json::parse(input, nullptr, false, false);
    if (document.is_discarded() || !document.is_object()) return CampaignCheckpointError::InvalidJson;
    if (hasDuplicateJsonKeys(input)) return CampaignCheckpointError::DuplicateJsonKeys;

    static const std::set<std::string> allowed = {
        "format", "version", "simulation", "campaign", "seeds"
    };
    for (auto it = document.begin(); it != document.end(); ++it)
        if (!allowed.count(it.key())) return CampaignCheckpointError::UnknownFields;

    const auto format_it = document.find("format");
    const auto version_it = document.find("version");
    int version = 0;
    if (format_it == document.end() || !format_it->is_string()
        || format_it->get<std::string>() != CAMPAIGN_CHECKPOINT_FORMAT_ID
        || version_it == document.end() || !readVersion(*version_it, version))
        return CampaignCheckpointError::UnsupportedFormatOrVersion;

    CampaignCheckpoint candidate;
    candidate.version = version;
    if (!readObjectSection(document, "simulation", candidate.simulation))
        return CampaignCheckpointError::InvalidSimulationSection;
    if (!readObjectSection(document, "campaign", candidate.campaign))
        return CampaignCheckpointError::InvalidCampaignSection;
    if (!readSeedsSection(document, candidate.seeds))
        return CampaignCheckpointError::InvalidSeedsSection;

    checkpoint = std::move(candidate);
    return CampaignCheckpointError::None;
}
