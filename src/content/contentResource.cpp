#include "content/contentResource.h"

#include <algorithm>
#include <cstdint>
#include <map>
#include <set>
#include <sstream>
#include <nlohmann/json.hpp>

namespace
{
bool asciiLower(char c)
{
    return c >= 'a' && c <= 'z';
}

bool asciiDigit(char c)
{
    return c >= '0' && c <= '9';
}

bool validId(const std::string& value)
{
    if (value.empty() || value.size() > 64) return false;
    for (char c : value)
        if (!(asciiLower(c) || asciiDigit(c) || c == '_' || c == '-'))
            return false;
    return asciiLower(value.front()) || asciiDigit(value.front());
}

bool validIdList(const std::string& value)
{
    if (value.empty()) return true;
    std::stringstream stream(value);
    std::string item;
    while (std::getline(stream, item, ','))
    {
        const auto first = item.find_first_not_of(" \t");
        const auto last = item.find_last_not_of(" \t");
        if (first == std::string::npos || !validId(item.substr(first, last - first + 1)))
            return false;
    }
    return true;
}

bool validScenarioFile(const std::string& value)
{
    constexpr const char* prefix = "scenario_";
    constexpr const char* suffix = ".lua";
    if (value.rfind(prefix, 0) != 0
        || value.size() < 4
        || value.compare(value.size() - 4, 4, suffix) != 0
        || value.find("..") != std::string::npos)
        return false;
    return std::all_of(value.begin(), value.end(), [](unsigned char c) {
        return asciiLower(static_cast<char>(c)) || asciiDigit(static_cast<char>(c))
            || c == '_' || c == '-' || c == '.';
    });
}

bool validPlayerCount(const std::string& value)
{
    if (value.empty()) return true;
    if (!std::all_of(value.begin(), value.end(), [](char c) { return asciiDigit(c); }))
        return false;
    try
    {
        const auto count = std::stoll(value);
        return count >= 1 && count <= 64;
    }
    catch (...)
    {
        return false;
    }
}

bool hasDuplicateJsonKeys(const std::string& input)
{
    bool duplicate = false;
    std::map<int, std::set<std::string>> keys_by_depth;
    auto callback = [&duplicate, &keys_by_depth](
        int depth,
        nlohmann::json::parse_event_t event,
        nlohmann::json& parsed
    ) {
        if (event == nlohmann::json::parse_event_t::object_start)
            keys_by_depth[depth + 1].clear();
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

ContentResourceError readString(
    const nlohmann::json& object,
    const char* key,
    std::string& output,
    std::size_t maximum
)
{
    const auto it = object.find(key);
    if (it == object.end() || !it->is_string())
        return ContentResourceError::MissingOrInvalidText;
    const auto value = it->get<std::string>();
    if (value.size() > maximum)
        return ContentResourceError::TextTooLong;
    output = value;
    return ContentResourceError::None;
}

bool supportedVersion(const nlohmann::json& version)
{
    if (version.is_number_unsigned())
        return version.get<std::uint64_t>() == CONTENT_RESOURCE_SCHEMA_VERSION;
    if (version.is_number_integer())
        return version.get<std::int64_t>() == CONTENT_RESOURCE_SCHEMA_VERSION;
    return false;
}
}

std::string contentResourceTypeId(ContentResourceType type)
{
    switch(type)
    {
    case ContentResourceType::Campaign: return "campaign";
    case ContentResourceType::Map: return "map";
    case ContentResourceType::Character: return "character";
    case ContentResourceType::Ship: return "ship";
    }
    return "";
}

bool parseContentResourceType(const std::string& value, ContentResourceType& type)
{
    if (value == "campaign") type = ContentResourceType::Campaign;
    else if (value == "map") type = ContentResourceType::Map;
    else if (value == "character") type = ContentResourceType::Character;
    else if (value == "ship") type = ContentResourceType::Ship;
    else return false;
    return true;
}

ContentResourceError validateContentResource(const ContentResource& resource)
{
    if (!validId(resource.id)) return ContentResourceError::InvalidId;
    if (resource.name.empty() || resource.name.size() > 120) return ContentResourceError::InvalidName;
    if (resource.description.size() > 4000) return ContentResourceError::DescriptionTooLong;
    if (resource.primary.size() > 1000 || resource.secondary.size() > 1000)
        return ContentResourceError::TypeFieldTooLong;
    if (resource.type != ContentResourceType::Campaign && resource.primary.empty())
        return ContentResourceError::MissingPrimaryField;
    if (resource.type == ContentResourceType::Campaign
        && (!validIdList(resource.primary)
            || (!resource.secondary.empty() && !validId(resource.secondary))))
        return ContentResourceError::InvalidCampaignMapIds;
    if (resource.type == ContentResourceType::Map && !validScenarioFile(resource.primary))
        return ContentResourceError::UnsafeScenarioFile;
    if (resource.type == ContentResourceType::Map && !validPlayerCount(resource.secondary))
        return ContentResourceError::InvalidPlayerCount;
    return ContentResourceError::None;
}

std::string serializeContentResource(const ContentResource& resource, int indent)
{
    nlohmann::json fields;
    switch(resource.type)
    {
    case ContentResourceType::Campaign:
        fields = {{"map_ids", resource.primary}, {"starting_map_id", resource.secondary}};
        break;
    case ContentResourceType::Map:
        fields = {{"scenario_file", resource.primary}, {"recommended_players", resource.secondary}};
        break;
    case ContentResourceType::Character:
        fields = {{"role", resource.primary}, {"callsign", resource.secondary}};
        break;
    case ContentResourceType::Ship:
        fields = {{"template", resource.primary}, {"faction", resource.secondary}};
        break;
    }
    return nlohmann::json{
        {"format", "espaciokoop-content"},
        {"version", CONTENT_RESOURCE_SCHEMA_VERSION},
        {"type", contentResourceTypeId(resource.type)},
        {"id", resource.id},
        {"name", resource.name},
        {"description", resource.description},
        {"fields", fields},
    }.dump(indent);
}

ContentResourceError parseContentResource(const std::string& input, ContentResource& resource)
{
    if (input.size() > CONTENT_RESOURCE_MAX_IMPORT_BYTES)
        return ContentResourceError::ImportTooLarge;

    const auto document = nlohmann::json::parse(input, nullptr, false, false);
    if (document.is_discarded() || !document.is_object())
        return ContentResourceError::InvalidJson;
    if (hasDuplicateJsonKeys(input))
        return ContentResourceError::DuplicateJsonKeys;

    const std::set<std::string> allowed = {
        "format", "version", "type", "id", "name", "description", "fields"
    };
    for (auto it = document.begin(); it != document.end(); ++it)
        if (!allowed.count(it.key())) return ContentResourceError::UnknownFields;

    const auto format_it = document.find("format");
    const auto version_it = document.find("version");
    if (format_it == document.end() || !format_it->is_string()
        || format_it->get<std::string>() != "espaciokoop-content"
        || version_it == document.end() || !supportedVersion(*version_it))
        return ContentResourceError::UnsupportedFormatOrVersion;

    ContentResource candidate;
    const auto type_it = document.find("type");
    if (type_it == document.end() || !type_it->is_string()
        || !parseContentResourceType(type_it->get<std::string>(), candidate.type))
        return ContentResourceError::UnknownType;

    for (const auto result : {
        readString(document, "id", candidate.id, 64),
        readString(document, "name", candidate.name, 120),
        readString(document, "description", candidate.description, 4000),
    })
        if (result != ContentResourceError::None) return result;

    const auto fields_it = document.find("fields");
    if (fields_it == document.end() || !fields_it->is_object())
        return ContentResourceError::InvalidTypeFields;

    const char* primary_key = "";
    const char* secondary_key = "";
    switch(candidate.type)
    {
    case ContentResourceType::Campaign:
        primary_key = "map_ids"; secondary_key = "starting_map_id"; break;
    case ContentResourceType::Map:
        primary_key = "scenario_file"; secondary_key = "recommended_players"; break;
    case ContentResourceType::Character:
        primary_key = "role"; secondary_key = "callsign"; break;
    case ContentResourceType::Ship:
        primary_key = "template"; secondary_key = "faction"; break;
    }
    const std::set<std::string> allowed_fields = {primary_key, secondary_key};
    for (auto it = fields_it->begin(); it != fields_it->end(); ++it)
        if (!allowed_fields.count(it.key())) return ContentResourceError::UnknownTypeFields;

    auto result = readString(*fields_it, primary_key, candidate.primary, 1000);
    if (result != ContentResourceError::None) return result;
    result = readString(*fields_it, secondary_key, candidate.secondary, 1000);
    if (result != ContentResourceError::None) return result;

    result = validateContentResource(candidate);
    if (result != ContentResourceError::None) return result;
    resource = std::move(candidate);
    return ContentResourceError::None;
}

bool ContentDiscardGuard::confirm(
    const std::string& action,
    const ContentResource& current,
    const ContentResource& clean_snapshot
)
{
    if (current == clean_snapshot)
    {
        reset();
        return true;
    }
    const auto signature = action + "\n" + serializeContentResource(current);
    if (pending_signature != signature)
    {
        pending_signature = signature;
        return false;
    }
    reset();
    return true;
}

void ContentDiscardGuard::reset()
{
    pending_signature.clear();
}
