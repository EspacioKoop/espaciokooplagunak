#include "content/checkpointState.h"

#include <cmath>
#include <map>
#include <set>
#include <nlohmann/json.hpp>

namespace
{
bool asciiLower(char c) { return c >= 'a' && c <= 'z'; }
bool asciiDigit(char c) { return c >= '0' && c <= '9'; }

bool validId(const std::string& value)
{
    if (value.empty() || value.size() > 64) return false;
    for (char c : value)
        if (!(asciiLower(c) || asciiDigit(c) || c == '_' || c == '-')) return false;
    return asciiLower(value.front()) || asciiDigit(value.front());
}

bool finiteUnit(float value)
{
    return std::isfinite(value) && value >= 0.0f && value <= 1.0f;
}

bool finiteCoordinate(float value)
{
    constexpr float limit = 1000000.0f;
    return std::isfinite(value) && value >= -limit && value <= limit;
}

bool exactKeys(const nlohmann::json& object, const std::set<std::string>& allowed)
{
    if (!object.is_object() || object.size() != allowed.size()) return false;
    for (auto it = object.begin(); it != object.end(); ++it)
        if (!allowed.count(it.key())) return false;
    return true;
}

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

bool readFloat(const nlohmann::json& value, float& output)
{
    if (!value.is_number()) return false;
    try
    {
        const auto number = value.get<double>();
        if (!std::isfinite(number)) return false;
        output = static_cast<float>(number);
        return std::isfinite(output);
    }
    catch (...) { return false; }
}
}

CheckpointError validateCheckpointState(const CheckpointState& state)
{
    if (state.ship_systems.size() > CHECKPOINT_MAX_SHIP_SYSTEMS) return CheckpointError::TooManySystems;
    if (state.contacts.size() > CHECKPOINT_MAX_CONTACTS) return CheckpointError::TooManyContacts;
    if (state.seeds.size() > CHECKPOINT_MAX_SEEDS) return CheckpointError::TooManySeeds;
    if (state.campaign_flags.size() > CHECKPOINT_MAX_FLAGS) return CheckpointError::TooManyFlags;

    std::set<std::string> system_ids;
    for (const auto& system : state.ship_systems)
    {
        if (!validId(system.id)) return CheckpointError::InvalidId;
        if (!system_ids.insert(system.id).second) return CheckpointError::DuplicateId;
        if (!finiteUnit(system.health) || !finiteUnit(system.energy)) return CheckpointError::InvalidNumber;
    }

    std::set<std::string> contact_ids;
    for (const auto& contact : state.contacts)
    {
        if (!validId(contact.id)) return CheckpointError::InvalidId;
        if (!contact_ids.insert(contact.id).second) return CheckpointError::DuplicateId;
        if (!finiteCoordinate(contact.x) || !finiteCoordinate(contact.y)) return CheckpointError::InvalidNumber;
    }

    for (const auto& [key, value] : state.seeds)
        if (!validId(key)) return CheckpointError::InvalidId;

    for (const auto& [key, value] : state.campaign_flags)
        if (!validId(key)) return CheckpointError::InvalidId;

    if (serializeCheckpointState(state).size() > CHECKPOINT_MAX_SERIALIZED_BYTES)
        return CheckpointError::TooLarge;
    return CheckpointError::None;
}

std::string serializeCheckpointState(const CheckpointState& state, int indent)
{
    nlohmann::json ship_systems = nlohmann::json::array();
    for (const auto& system : state.ship_systems)
    {
        ship_systems.push_back({
            {"id", system.id},
            {"health", system.health},
            {"energy", system.energy},
            {"operational", system.operational},
        });
    }

    nlohmann::json contacts = nlohmann::json::array();
    for (const auto& contact : state.contacts)
    {
        contacts.push_back({
            {"id", contact.id},
            {"faction", contact.faction},
            {"position", {contact.x, contact.y}},
            {"identified", contact.identified},
        });
    }

    nlohmann::json seeds = nlohmann::json::object();
    for (const auto& [key, value] : state.seeds) seeds[key] = value;

    nlohmann::json campaign_flags = nlohmann::json::object();
    for (const auto& [key, value] : state.campaign_flags) campaign_flags[key] = value;

    const nlohmann::json document = {
        {"format", CHECKPOINT_FORMAT_ID},
        {"version", CHECKPOINT_SCHEMA_VERSION},
        {"simulation", {
            {"ship_systems", std::move(ship_systems)},
            {"contacts", std::move(contacts)},
        }},
        {"seeds", std::move(seeds)},
        {"campaign", std::move(campaign_flags)},
    };
    return document.dump(indent);
}

CheckpointError parseCheckpointState(const std::string& input, CheckpointState& output)
{
    if (input.size() > CHECKPOINT_MAX_SERIALIZED_BYTES) return CheckpointError::TooLarge;
    if (hasDuplicateJsonKeys(input)) return CheckpointError::DuplicateJsonKeys;

    const auto document = nlohmann::json::parse(input, nullptr, false, false);
    if (document.is_discarded() || !document.is_object()) return CheckpointError::InvalidStructure;

    static const std::set<std::string> top_keys = {"format", "version", "simulation", "seeds", "campaign"};
    if (!exactKeys(document, top_keys)) return CheckpointError::UnknownFields;

    const auto format_it = document.find("format");
    const auto version_it = document.find("version");
    if (format_it == document.end() || !format_it->is_string()
        || format_it->get<std::string>() != CHECKPOINT_FORMAT_ID
        || version_it == document.end() || !version_it->is_number_integer()
        || *version_it != CHECKPOINT_SCHEMA_VERSION)
        return CheckpointError::UnsupportedFormatOrVersion;

    const auto& simulation = document["simulation"];
    static const std::set<std::string> simulation_keys = {"ship_systems", "contacts"};
    if (!exactKeys(simulation, simulation_keys)) return CheckpointError::UnknownFields;

    const auto& ship_systems = simulation["ship_systems"];
    if (!ship_systems.is_array()) return CheckpointError::InvalidStructure;
    if (ship_systems.size() > CHECKPOINT_MAX_SHIP_SYSTEMS) return CheckpointError::TooManySystems;

    CheckpointState candidate;
    candidate.ship_systems.reserve(ship_systems.size());
    std::set<std::string> system_ids;
    static const std::set<std::string> system_keys = {"id", "health", "energy", "operational"};
    for (const auto& value : ship_systems)
    {
        if (!exactKeys(value, system_keys)) return CheckpointError::UnknownFields;
        CheckpointShipSystem system;
        const auto id_it = value.find("id");
        if (id_it == value.end() || !id_it->is_string()) return CheckpointError::InvalidStructure;
        system.id = id_it->get<std::string>();
        if (!validId(system.id)) return CheckpointError::InvalidId;
        if (!system_ids.insert(system.id).second) return CheckpointError::DuplicateId;
        if (!readFloat(value["health"], system.health) || !finiteUnit(system.health))
            return CheckpointError::InvalidNumber;
        if (!readFloat(value["energy"], system.energy) || !finiteUnit(system.energy))
            return CheckpointError::InvalidNumber;
        if (!value["operational"].is_boolean()) return CheckpointError::InvalidStructure;
        system.operational = value["operational"].get<bool>();
        candidate.ship_systems.push_back(std::move(system));
    }

    const auto& contacts = simulation["contacts"];
    if (!contacts.is_array()) return CheckpointError::InvalidStructure;
    if (contacts.size() > CHECKPOINT_MAX_CONTACTS) return CheckpointError::TooManyContacts;

    candidate.contacts.reserve(contacts.size());
    std::set<std::string> contact_ids;
    static const std::set<std::string> contact_keys = {"id", "faction", "position", "identified"};
    for (const auto& value : contacts)
    {
        if (!exactKeys(value, contact_keys)) return CheckpointError::UnknownFields;
        CheckpointContact contact;
        const auto id_it = value.find("id");
        const auto faction_it = value.find("faction");
        if (id_it == value.end() || !id_it->is_string()
            || faction_it == value.end() || !faction_it->is_string())
            return CheckpointError::InvalidStructure;
        contact.id = id_it->get<std::string>();
        if (!validId(contact.id)) return CheckpointError::InvalidId;
        if (!contact_ids.insert(contact.id).second) return CheckpointError::DuplicateId;
        contact.faction = faction_it->get<std::string>();
        const auto& position = value["position"];
        if (!position.is_array() || position.size() != 2
            || !readFloat(position[0], contact.x) || !finiteCoordinate(contact.x)
            || !readFloat(position[1], contact.y) || !finiteCoordinate(contact.y))
            return CheckpointError::InvalidNumber;
        if (!value["identified"].is_boolean()) return CheckpointError::InvalidStructure;
        contact.identified = value["identified"].get<bool>();
        candidate.contacts.push_back(std::move(contact));
    }

    const auto& seeds = document["seeds"];
    if (!seeds.is_object()) return CheckpointError::InvalidStructure;
    if (seeds.size() > CHECKPOINT_MAX_SEEDS) return CheckpointError::TooManySeeds;
    for (auto it = seeds.begin(); it != seeds.end(); ++it)
    {
        if (!validId(it.key())) return CheckpointError::InvalidId;
        if (!it.value().is_number_unsigned()) return CheckpointError::InvalidNumber;
        candidate.seeds[it.key()] = it.value().get<std::uint64_t>();
    }

    const auto& campaign = document["campaign"];
    if (!campaign.is_object()) return CheckpointError::InvalidStructure;
    if (campaign.size() > CHECKPOINT_MAX_FLAGS) return CheckpointError::TooManyFlags;
    for (auto it = campaign.begin(); it != campaign.end(); ++it)
    {
        if (!validId(it.key())) return CheckpointError::InvalidId;
        if (!it.value().is_string()) return CheckpointError::InvalidStructure;
        candidate.campaign_flags[it.key()] = it.value().get<std::string>();
    }

    const auto validation = validateCheckpointState(candidate);
    if (validation != CheckpointError::None) return validation;
    output = std::move(candidate);
    return CheckpointError::None;
}
