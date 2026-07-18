#include "content/contentResource.h"
#include "crewPosition.h"

#include <algorithm>
#include <cstdint>
#include <functional>
#include <map>
#include <set>
#include <sstream>
#include <utility>
#include <vector>
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

std::string trim(const std::string& value)
{
    const auto first = value.find_first_not_of(" \t");
    if (first == std::string::npos) return {};
    return value.substr(first, value.find_last_not_of(" \t") - first + 1);
}

bool parseIdList(const std::string& value, std::vector<std::string>& output, bool allow_empty = true)
{
    output.clear();
    if (value.empty()) return allow_empty;
    std::set<std::string> unique;
    std::stringstream stream(value);
    std::string item;
    while (std::getline(stream, item, ','))
    {
        item = trim(item);
        if (!validId(item) || !unique.insert(item).second) return false;
        output.push_back(item);
    }
    return !output.empty();
}

bool validIdList(const std::string& value, bool allow_empty = true)
{
    std::vector<std::string> ignored;
    return parseIdList(value, ignored, allow_empty);
}

using Transition = std::pair<std::string, std::string>;

bool parseTransitions(const std::string& value, std::vector<Transition>& output)
{
    output.clear();
    if (value.empty()) return true;
    std::set<Transition> unique;
    std::stringstream stream(value);
    std::string item;
    while (std::getline(stream, item, ','))
    {
        item = trim(item);
        const auto separator = item.find('>');
        if (separator == std::string::npos || item.find('>', separator + 1) != std::string::npos)
            return false;
        Transition transition{trim(item.substr(0, separator)), trim(item.substr(separator + 1))};
        if (!validId(transition.first) || !validId(transition.second)
            || transition.first == transition.second || !unique.insert(transition).second)
            return false;
        output.push_back(std::move(transition));
    }
    return true;
}

std::string serializeIdList(const std::vector<std::string>& ids)
{
    std::ostringstream output;
    for (std::size_t index = 0; index < ids.size(); ++index)
    {
        if (index > 0) output << ", ";
        output << ids[index];
    }
    return output.str();
}

void replaceIdList(std::string& value, const std::string& old_id, const std::string& new_id)
{
    std::vector<std::string> ids;
    if (!parseIdList(value, ids)) return;
    bool changed = false;
    for (auto& id : ids)
    {
        if (id != old_id) continue;
        id = new_id;
        changed = true;
    }
    if (changed) value = serializeIdList(ids);
}

void replaceTransitions(std::string& value, const std::string& old_id, const std::string& new_id)
{
    std::vector<Transition> transitions;
    if (!parseTransitions(value, transitions)) return;
    bool changed = false;
    for (auto& transition : transitions)
    {
        if (transition.first == old_id)
        {
            transition.first = new_id;
            changed = true;
        }
        if (transition.second == old_id)
        {
            transition.second = new_id;
            changed = true;
        }
    }
    if (!changed) return;
    std::ostringstream output;
    for (std::size_t index = 0; index < transitions.size(); ++index)
    {
        if (index > 0) output << ", ";
        output << transitions[index].first << '>' << transitions[index].second;
    }
    value = output.str();
}

bool uniqueResourceIds(const std::vector<ContentResource>& resources)
{
    std::set<std::pair<ContentResourceType, std::string>> identities;
    for (const auto& resource : resources)
        if (!identities.insert({resource.type, resource.id}).second) return false;
    return true;
}

bool transitionCycle(const std::vector<Transition>& transitions)
{
    std::map<std::string, std::vector<std::string>> graph;
    for (const auto& transition : transitions) graph[transition.first].push_back(transition.second);
    std::map<std::string, int> state;
    std::function<bool(const std::string&)> visit = [&](const std::string& node) {
        if (state[node] == 1) return true;
        if (state[node] == 2) return false;
        state[node] = 1;
        for (const auto& next : graph[node]) if (visit(next)) return true;
        state[node] = 2;
        return false;
    };
    for (const auto& entry : graph) if (visit(entry.first)) return true;
    return false;
}

bool validCrewPosition(const std::string& value)
{
    return isCanonicalCrewPositionId(value);
}

bool validScenarioFile(const std::string& value)
{
    constexpr const char* prefix = "scenario_";
    constexpr const char* suffix = ".lua";
    if (value.rfind(prefix, 0) != 0 || value.size() < 4
        || value.compare(value.size() - 4, 4, suffix) != 0 || value.find("..") != std::string::npos)
        return false;
    return std::all_of(value.begin(), value.end(), [](unsigned char c) {
        return asciiLower(static_cast<char>(c)) || asciiDigit(static_cast<char>(c))
            || c == '_' || c == '-' || c == '.';
    });
}

bool validPlayerCount(const std::string& value)
{
    if (value.empty()) return true;
    if (!std::all_of(value.begin(), value.end(), [](char c) { return asciiDigit(c); })) return false;
    try
    {
        const auto count = std::stoll(value);
        return count >= 1 && count <= 64;
    }
    catch (...) { return false; }
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

ContentResourceError readString(const nlohmann::json& object, const char* key,
                                std::string& output, std::size_t maximum)
{
    const auto it = object.find(key);
    if (it == object.end() || !it->is_string()) return ContentResourceError::MissingOrInvalidText;
    const auto value = it->get<std::string>();
    if (value.size() > maximum) return ContentResourceError::TextTooLong;
    output = value;
    return ContentResourceError::None;
}

bool readVersion(const nlohmann::json& version, int& output)
{
    std::int64_t value = -1;
    if (version.is_number_unsigned())
    {
        const auto unsigned_value = version.get<std::uint64_t>();
        if (unsigned_value > static_cast<std::uint64_t>(CONTENT_RESOURCE_SCHEMA_VERSION)) return false;
        value = static_cast<std::int64_t>(unsigned_value);
    }
    else if (version.is_number_integer()) value = version.get<std::int64_t>();
    else return false;
    if (value < 1 || value > CONTENT_RESOURCE_SCHEMA_VERSION) return false;
    output = static_cast<int>(value);
    return true;
}

std::vector<std::pair<ContentResourceType, std::string>> dependencies(const ContentResource& resource)
{
    std::vector<std::pair<ContentResourceType, std::string>> result;
    std::vector<std::string> ids;
    if (resource.type == ContentResourceType::Campaign)
    {
        parseIdList(resource.primary, ids);
        for (const auto& id : ids) result.emplace_back(ContentResourceType::Map, id);
        parseIdList(resource.tertiary, ids);
        for (const auto& id : ids) result.emplace_back(ContentResourceType::Character, id);
        parseIdList(resource.quaternary, ids);
        for (const auto& id : ids) result.emplace_back(ContentResourceType::Ship, id);
    }
    else if (resource.type == ContentResourceType::Character && !resource.quaternary.empty())
        result.emplace_back(ContentResourceType::Ship, resource.quaternary);
    return result;
}

bool resourceExists(const std::vector<ContentResource>& resources, ContentResourceType type,
                    const std::string& id)
{
    return std::any_of(resources.begin(), resources.end(), [&](const ContentResource& item) {
        return item.type == type && item.id == id;
    });
}

nlohmann::json resourceDocument(const ContentResource& resource)
{
    nlohmann::json fields;
    switch(resource.type)
    {
    case ContentResourceType::Campaign:
        fields = {{"map_ids", resource.primary}, {"starting_map_id", resource.secondary},
                  {"character_ids", resource.tertiary}, {"ship_ids", resource.quaternary},
                  {"transitions", resource.quinary}};
        break;
    case ContentResourceType::Map:
        fields = {{"scenario_file", resource.primary}, {"recommended_players", resource.secondary},
                  {"objects", mapDocumentObjectsJson(resource.map_document)}};
        break;
    case ContentResourceType::Character:
        fields = {{"crew_position_id", resource.primary}, {"callsign", resource.secondary},
                  {"tags", resource.tertiary}, {"ship_id", resource.quaternary},
                  {"legacy_role", resource.quinary}};
        break;
    case ContentResourceType::Ship:
        fields = {{"template", resource.primary}, {"faction", resource.secondary},
                  {"overrides", shipDocumentOverridesJson(resource.ship_document)}};
        break;
    }
    return {{"format", "espaciokoop-content"}, {"version", CONTENT_RESOURCE_SCHEMA_VERSION},
            {"type", contentResourceTypeId(resource.type)}, {"id", resource.id},
            {"name", resource.name}, {"description", resource.description}, {"fields", fields}};
}

bool validTypedFields(const ContentResource& resource)
{
    auto probe = resource;
    probe.id = "staged";
    probe.name = "Staged";
    probe.description.clear();
    return validateContentResource(probe) == ContentResourceError::None;
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
    if (contentResourceTypeId(resource.type).empty()) return ContentResourceError::UnknownType;
    if (!validId(resource.id)) return ContentResourceError::InvalidId;
    if (resource.name.empty() || resource.name.size() > 120) return ContentResourceError::InvalidName;
    if (resource.description.size() > 4000) return ContentResourceError::DescriptionTooLong;
    if (resource.primary.size() > 1000 || resource.secondary.size() > 1000
        || resource.tertiary.size() > 1000 || resource.quaternary.size() > 1000
        || resource.quinary.size() > 1000) return ContentResourceError::TypeFieldTooLong;
    if (resource.type != ContentResourceType::Campaign && resource.primary.empty()
        && !(resource.type == ContentResourceType::Character && !resource.quinary.empty()))
        return ContentResourceError::MissingPrimaryField;
    if ((resource.type == ContentResourceType::Map || resource.type == ContentResourceType::Ship)
        && (!resource.tertiary.empty() || !resource.quaternary.empty() || !resource.quinary.empty()))
        return ContentResourceError::UnknownTypeFields;
    if (resource.type != ContentResourceType::Map && !resource.map_document.objects.empty())
        return ContentResourceError::InvalidMapDocument;
    if (resource.type != ContentResourceType::Ship && resource.ship_document != ShipDocument{})
        return ContentResourceError::InvalidShipDocument;

    if (resource.type == ContentResourceType::Campaign)
    {
        std::vector<std::string> maps;
        if (!parseIdList(resource.primary, maps)
            || (!resource.secondary.empty() && !validId(resource.secondary)))
            return ContentResourceError::InvalidCampaignMapIds;
        if ((!resource.secondary.empty()
             && std::find(maps.begin(), maps.end(), resource.secondary) == maps.end())
            || !validIdList(resource.tertiary) || !validIdList(resource.quaternary))
            return ContentResourceError::InvalidCampaignReferences;
        std::vector<Transition> transitions;
        if (!parseTransitions(resource.quinary, transitions))
            return ContentResourceError::InvalidCampaignTransitions;
        for (const auto& transition : transitions)
            if (std::find(maps.begin(), maps.end(), transition.first) == maps.end()
                || std::find(maps.begin(), maps.end(), transition.second) == maps.end())
                return ContentResourceError::InvalidCampaignTransitions;
        if (transitionCycle(transitions)) return ContentResourceError::CampaignTransitionCycle;
    }
    if (resource.type == ContentResourceType::Map && !validScenarioFile(resource.primary))
        return ContentResourceError::UnsafeScenarioFile;
    if (resource.type == ContentResourceType::Map && !validPlayerCount(resource.secondary))
        return ContentResourceError::InvalidPlayerCount;
    if (resource.type == ContentResourceType::Map
        && validateMapDocument(resource.map_document) != MapDocumentError::None)
        return ContentResourceError::InvalidMapDocument;
    if (resource.type == ContentResourceType::Ship
        && validateShipDocument(resource.ship_document) != ShipDocumentError::None)
        return ContentResourceError::InvalidShipDocument;
    if (resource.type == ContentResourceType::Character)
    {
        if (!resource.primary.empty() && !validCrewPosition(resource.primary))
            return ContentResourceError::InvalidCrewPosition;
        if (!validIdList(resource.tertiary)) return ContentResourceError::InvalidCharacterTags;
        if (!resource.quaternary.empty() && !validId(resource.quaternary))
            return ContentResourceError::InvalidCharacterShipId;
    }
    return ContentResourceError::None;
}

ContentResourceError validateContentLibrary(const std::vector<ContentResource>& resources)
{
    for (const auto& resource : resources)
    {
        const auto validation = validateContentResource(resource);
        if (validation != ContentResourceError::None) return validation;
        for (const auto& dependency : dependencies(resource))
            if (!resourceExists(resources, dependency.first, dependency.second))
                return ContentResourceError::MissingDependency;
    }
    return ContentResourceError::None;
}

bool addContentReference(ContentResource& resource,
                         const std::vector<ContentResource>& library,
                         ContentReferenceKind kind,
                         const std::string& id)
{
    if (resource.type != ContentResourceType::Campaign) return false;
    ContentResourceType expected_type = ContentResourceType::Map;
    std::string* field = &resource.primary;
    if (kind == ContentReferenceKind::CampaignCharacter)
    {
        expected_type = ContentResourceType::Character;
        field = &resource.tertiary;
    }
    else if (kind == ContentReferenceKind::CampaignShip)
    {
        expected_type = ContentResourceType::Ship;
        field = &resource.quaternary;
    }
    if (!resourceExists(library, expected_type, id)) return false;
    std::vector<std::string> ids;
    if (!parseIdList(*field, ids) || std::find(ids.begin(), ids.end(), id) != ids.end()) return false;
    ids.push_back(id);
    auto candidate = resource;
    std::string* candidate_field = &candidate.primary;
    if (kind == ContentReferenceKind::CampaignCharacter) candidate_field = &candidate.tertiary;
    else if (kind == ContentReferenceKind::CampaignShip) candidate_field = &candidate.quaternary;
    *candidate_field = serializeIdList(ids);
    if (!validTypedFields(candidate)) return false;
    resource = std::move(candidate);
    return true;
}

bool removeContentReference(ContentResource& resource, ContentReferenceKind kind,
                            const std::string& id)
{
    if (resource.type != ContentResourceType::Campaign) return false;
    std::string* field = &resource.primary;
    if (kind == ContentReferenceKind::CampaignCharacter) field = &resource.tertiary;
    else if (kind == ContentReferenceKind::CampaignShip) field = &resource.quaternary;
    std::vector<std::string> ids;
    if (!parseIdList(*field, ids)) return false;
    const auto found = std::find(ids.begin(), ids.end(), id);
    if (found == ids.end()) return false;
    ids.erase(found);
    auto candidate = resource;
    std::string* candidate_field = &candidate.primary;
    if (kind == ContentReferenceKind::CampaignCharacter) candidate_field = &candidate.tertiary;
    else if (kind == ContentReferenceKind::CampaignShip) candidate_field = &candidate.quaternary;
    *candidate_field = serializeIdList(ids);
    if (kind == ContentReferenceKind::CampaignMap)
    {
        if (candidate.secondary == id) candidate.secondary.clear();
        std::vector<Transition> transitions;
        if (!parseTransitions(candidate.quinary, transitions)) return false;
        transitions.erase(std::remove_if(transitions.begin(), transitions.end(), [&](const Transition& item) {
            return item.first == id || item.second == id;
        }), transitions.end());
        std::ostringstream output;
        for (std::size_t index = 0; index < transitions.size(); ++index)
        {
            if (index > 0) output << ", ";
            output << transitions[index].first << '>' << transitions[index].second;
        }
        candidate.quinary = output.str();
    }
    if (!validTypedFields(candidate)) return false;
    resource = std::move(candidate);
    return true;
}

bool moveCampaignMap(ContentResource& resource, const std::string& id, int direction)
{
    if (resource.type != ContentResourceType::Campaign || (direction != -1 && direction != 1)) return false;
    std::vector<std::string> ids;
    if (!parseIdList(resource.primary, ids)) return false;
    const auto found = std::find(ids.begin(), ids.end(), id);
    if (found == ids.end()) return false;
    const auto index = static_cast<std::ptrdiff_t>(found - ids.begin());
    const auto target = index + direction;
    if (target < 0 || target >= static_cast<std::ptrdiff_t>(ids.size())) return false;
    std::swap(ids[static_cast<std::size_t>(index)], ids[static_cast<std::size_t>(target)]);
    resource.primary = serializeIdList(ids);
    return true;
}

bool setCampaignStartingMap(ContentResource& resource, const std::string& id)
{
    if (resource.type != ContentResourceType::Campaign) return false;
    std::vector<std::string> ids;
    if (!parseIdList(resource.primary, ids)
        || (!id.empty() && std::find(ids.begin(), ids.end(), id) == ids.end())) return false;
    resource.secondary = id;
    return true;
}

bool addCampaignTransition(ContentResource& resource, const std::string& from_id,
                           const std::string& to_id)
{
    if (resource.type != ContentResourceType::Campaign) return false;
    std::vector<Transition> transitions;
    if (!parseTransitions(resource.quinary, transitions)) return false;
    const Transition transition{from_id, to_id};
    if (std::find(transitions.begin(), transitions.end(), transition) != transitions.end()) return false;
    auto candidate = resource;
    if (!candidate.quinary.empty()) candidate.quinary += ", ";
    candidate.quinary += from_id + ">" + to_id;
    if (!validTypedFields(candidate)) return false;
    resource = std::move(candidate);
    return true;
}

bool removeCampaignTransition(ContentResource& resource, const std::string& from_id,
                              const std::string& to_id)
{
    if (resource.type != ContentResourceType::Campaign) return false;
    std::vector<Transition> transitions;
    if (!parseTransitions(resource.quinary, transitions)) return false;
    const auto found = std::find(transitions.begin(), transitions.end(), Transition{from_id, to_id});
    if (found == transitions.end()) return false;
    transitions.erase(found);
    std::ostringstream output;
    for (std::size_t index = 0; index < transitions.size(); ++index)
    {
        if (index > 0) output << ", ";
        output << transitions[index].first << '>' << transitions[index].second;
    }
    resource.quinary = output.str();
    return true;
}

bool setCharacterCrewPosition(ContentResource& resource, const std::string& crew_position_id)
{
    if (resource.type != ContentResourceType::Character
        || (!crew_position_id.empty() && !validCrewPosition(crew_position_id))) return false;
    if (crew_position_id.empty() && resource.quinary.empty()) return false;
    resource.primary = crew_position_id;
    return true;
}

bool setCharacterShipReference(ContentResource& resource,
                               const std::vector<ContentResource>& library,
                               const std::string& ship_id)
{
    if (resource.type != ContentResourceType::Character
        || (!ship_id.empty() && !resourceExists(library, ContentResourceType::Ship, ship_id))) return false;
    resource.quaternary = ship_id;
    return true;
}

std::string normalizeCharacterTag(const std::string& raw_tag)
{
    std::string tag;
    for (char c : trim(raw_tag))
    {
        if (c >= 'A' && c <= 'Z') c = static_cast<char>(c - 'A' + 'a');
        if (c == ' ' || c == '\t') c = '-';
        if (c == '-' && !tag.empty() && tag.back() == '-') continue;
        tag += c;
    }
    return validId(tag) ? tag : std::string{};
}

bool addCharacterTag(ContentResource& resource, const std::string& raw_tag)
{
    if (resource.type != ContentResourceType::Character) return false;
    const auto tag = normalizeCharacterTag(raw_tag);
    if (tag.empty()) return false;
    std::vector<std::string> tags;
    if (!parseIdList(resource.tertiary, tags)
        || std::find(tags.begin(), tags.end(), tag) != tags.end()) return false;
    tags.push_back(tag);
    resource.tertiary = serializeIdList(tags);
    return true;
}

bool removeCharacterTag(ContentResource& resource, const std::string& tag)
{
    if (resource.type != ContentResourceType::Character) return false;
    std::vector<std::string> tags;
    if (!parseIdList(resource.tertiary, tags)) return false;
    const auto found = std::find(tags.begin(), tags.end(), tag);
    if (found == tags.end()) return false;
    tags.erase(found);
    resource.tertiary = serializeIdList(tags);
    return true;
}

bool moveCharacterTag(ContentResource& resource, const std::string& tag, int direction)
{
    if (resource.type != ContentResourceType::Character || (direction != -1 && direction != 1)) return false;
    std::vector<std::string> tags;
    if (!parseIdList(resource.tertiary, tags)) return false;
    const auto found = std::find(tags.begin(), tags.end(), tag);
    if (found == tags.end()) return false;
    const auto index = static_cast<std::ptrdiff_t>(found - tags.begin());
    const auto target = index + direction;
    if (target < 0 || target >= static_cast<std::ptrdiff_t>(tags.size())) return false;
    std::swap(tags[static_cast<std::size_t>(index)], tags[static_cast<std::size_t>(target)]);
    resource.tertiary = serializeIdList(tags);
    return true;
}

bool clearCharacterLegacyRole(ContentResource& resource)
{
    if (resource.type != ContentResourceType::Character || resource.quinary.empty()) return false;
    resource.quinary.clear();
    return true;
}

ContentRenameError renameContentResource(std::vector<ContentResource>& resources,
                                         ContentResourceType type,
                                         const std::string& old_id,
                                         const std::string& new_id)
{
    if (contentResourceTypeId(type).empty()) return ContentRenameError::InvalidType;
    if (!uniqueResourceIds(resources)
        || validateContentLibrary(resources) != ContentResourceError::None)
        return ContentRenameError::InvalidLibrary;
    if (!validId(new_id)) return ContentRenameError::InvalidNewId;

    const auto source = std::find_if(resources.begin(), resources.end(), [&](const ContentResource& item) {
        return item.type == type && item.id == old_id;
    });
    if (source == resources.end()) return ContentRenameError::SourceNotFound;
    if (old_id == new_id) return ContentRenameError::None;
    if (resourceExists(resources, type, new_id)) return ContentRenameError::TargetAlreadyExists;

    auto candidate = resources;
    for (auto& resource : candidate)
    {
        if (resource.type == type && resource.id == old_id) resource.id = new_id;
        if (resource.type == ContentResourceType::Campaign)
        {
            if (type == ContentResourceType::Map)
            {
                replaceIdList(resource.primary, old_id, new_id);
                if (resource.secondary == old_id) resource.secondary = new_id;
                replaceTransitions(resource.quinary, old_id, new_id);
            }
            else if (type == ContentResourceType::Character)
                replaceIdList(resource.tertiary, old_id, new_id);
            else if (type == ContentResourceType::Ship)
                replaceIdList(resource.quaternary, old_id, new_id);
        }
        if (type == ContentResourceType::Ship
            && resource.type == ContentResourceType::Character
            && resource.quaternary == old_id)
            resource.quaternary = new_id;
    }

    if (!uniqueResourceIds(candidate)
        || validateContentLibrary(candidate) != ContentResourceError::None)
        return ContentRenameError::InvalidLibrary;
    resources = std::move(candidate);
    return ContentRenameError::None;
}

bool contentResourceHasMissingDependencies(
    const ContentResource& resource,
    const std::vector<ContentResource>& library
)
{
    for (const auto& dependency : dependencies(resource))
        if (!resourceExists(library, dependency.first, dependency.second)) return true;
    return false;
}

std::string serializeContentResource(const ContentResource& resource, int indent)
{
    return resourceDocument(resource).dump(indent);
}

std::string serializeContentResourceExport(const ContentResource& resource,
                                           const std::vector<ContentResource>& library, int indent)
{
    auto document = resourceDocument(resource);
    nlohmann::json manifest = nlohmann::json::array();
    for (const auto& dependency : dependencies(resource))
        manifest.push_back({{"type", contentResourceTypeId(dependency.first)}, {"id", dependency.second},
                            {"missing", !resourceExists(library, dependency.first, dependency.second)}});
    document["dependencies"] = std::move(manifest);
    return document.dump(indent);
}

ContentResourceError parseContentResource(const std::string& input, ContentResource& resource)
{
    if (input.size() > CONTENT_RESOURCE_MAX_IMPORT_BYTES) return ContentResourceError::ImportTooLarge;
    const auto document = nlohmann::json::parse(input, nullptr, false, false);
    if (document.is_discarded() || !document.is_object()) return ContentResourceError::InvalidJson;
    if (hasDuplicateJsonKeys(input)) return ContentResourceError::DuplicateJsonKeys;
    const std::set<std::string> allowed = {
        "format", "version", "type", "id", "name", "description", "fields", "dependencies"
    };
    for (auto it = document.begin(); it != document.end(); ++it)
        if (!allowed.count(it.key())) return ContentResourceError::UnknownFields;

    const auto format_it = document.find("format");
    const auto version_it = document.find("version");
    int version = 0;
    if (format_it == document.end() || !format_it->is_string()
        || format_it->get<std::string>() != "espaciokoop-content"
        || version_it == document.end() || !readVersion(*version_it, version))
        return ContentResourceError::UnsupportedFormatOrVersion;

    ContentResource candidate;
    const auto type_it = document.find("type");
    if (type_it == document.end() || !type_it->is_string()
        || !parseContentResourceType(type_it->get<std::string>(), candidate.type))
        return ContentResourceError::UnknownType;
    for (const auto result : {readString(document, "id", candidate.id, 64),
                              readString(document, "name", candidate.name, 120),
                              readString(document, "description", candidate.description, 4000)})
        if (result != ContentResourceError::None) return result;

    const auto fields_it = document.find("fields");
    if (fields_it == document.end() || !fields_it->is_object())
        return ContentResourceError::InvalidTypeFields;
    std::vector<const char*> keys;
    switch(candidate.type)
    {
    case ContentResourceType::Campaign:
        keys = version == 1
            ? std::vector<const char*>{"map_ids", "starting_map_id"}
            : std::vector<const char*>{"map_ids", "starting_map_id", "character_ids", "ship_ids", "transitions"};
        break;
    case ContentResourceType::Map: keys = {"scenario_file", "recommended_players"}; break;
    case ContentResourceType::Character:
        keys = version == 1
            ? std::vector<const char*>{"role", "callsign"}
            : std::vector<const char*>{"crew_position_id", "callsign", "tags", "ship_id", "legacy_role"};
        break;
    case ContentResourceType::Ship: keys = {"template", "faction"}; break;
    }
    std::set<std::string> allowed_fields(keys.begin(), keys.end());
    if (candidate.type == ContentResourceType::Map && version >= 3)
        allowed_fields.insert("objects");
    if (candidate.type == ContentResourceType::Ship && version >= 4)
        allowed_fields.insert("overrides");
    for (auto it = fields_it->begin(); it != fields_it->end(); ++it)
        if (!allowed_fields.count(it.key())) return ContentResourceError::UnknownTypeFields;
    std::string* outputs[] = {&candidate.primary, &candidate.secondary, &candidate.tertiary,
                              &candidate.quaternary, &candidate.quinary};
    for (std::size_t index = 0; index < keys.size(); ++index)
    {
        const auto result = readString(*fields_it, keys[index], *outputs[index], 1000);
        if (result != ContentResourceError::None) return result;
    }
    if (candidate.type == ContentResourceType::Map && version >= 3)
    {
        const auto objects_it = fields_it->find("objects");
        if (objects_it == fields_it->end()
            || parseMapDocumentObjects(*objects_it, candidate.map_document) != MapDocumentError::None)
            return ContentResourceError::InvalidMapDocument;
    }
    if (candidate.type == ContentResourceType::Ship && version >= 4)
    {
        const auto overrides_it = fields_it->find("overrides");
        if (overrides_it == fields_it->end()
            || parseShipDocumentOverrides(*overrides_it, candidate.ship_document)
                != ShipDocumentError::None)
            return ContentResourceError::InvalidShipDocument;
    }

    if (version == 1 && candidate.type == ContentResourceType::Character)
    {
        const auto crew_position = tryParseCrewPosition(candidate.primary.c_str());
        if (crew_position)
            candidate.primary = crewPositionToString(*crew_position).c_str();
        else
        {
            candidate.quinary = candidate.primary;
            candidate.primary.clear();
        }
    }

    if (document.contains("dependencies"))
    {
        if (!document["dependencies"].is_array()) return ContentResourceError::InvalidTypeFields;
        std::set<std::pair<std::string, std::string>> declared;
        for (const auto& dependency : document["dependencies"])
        {
            if (!dependency.is_object() || dependency.size() != 3
                || !dependency.contains("type") || !dependency["type"].is_string()
                || !dependency.contains("id") || !dependency["id"].is_string()
                || !dependency.contains("missing") || !dependency["missing"].is_boolean())
                return ContentResourceError::InvalidTypeFields;
            ContentResourceType dependency_type;
            const auto type = dependency["type"].get<std::string>();
            const auto id = dependency["id"].get<std::string>();
            if (!parseContentResourceType(type, dependency_type) || !validId(id)
                || !declared.insert({type, id}).second) return ContentResourceError::InvalidTypeFields;
        }
        std::set<std::pair<std::string, std::string>> expected;
        for (const auto& dependency : dependencies(candidate))
            expected.insert({contentResourceTypeId(dependency.first), dependency.second});
        if (declared != expected) return ContentResourceError::InvalidTypeFields;
    }

    const auto result = validateContentResource(candidate);
    if (result != ContentResourceError::None) return result;
    resource = std::move(candidate);
    return ContentResourceError::None;
}

bool ContentDiscardGuard::confirm(const std::string& action, const ContentResource& current,
                                  const ContentResource& clean_snapshot)
{
    if (current == clean_snapshot) { reset(); return true; }
    const auto signature = action + "\n" + serializeContentResource(current);
    if (pending_signature != signature) { pending_signature = signature; return false; }
    reset();
    return true;
}

void ContentDiscardGuard::reset() { pending_signature.clear(); }
