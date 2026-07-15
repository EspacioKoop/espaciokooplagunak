#pragma once

#include "content/mapDocument.h"
#include "content/shipDocument.h"

#include <cstddef>
#include <string>
#include <vector>

enum class ContentResourceType
{
    Campaign,
    Map,
    Character,
    Ship,
};

struct ContentResource
{
    ContentResourceType type = ContentResourceType::Campaign;
    std::string id;
    std::string name;
    std::string description;
    std::string primary;
    std::string secondary;
    // Campaign: character IDs, ship IDs and declarative map transitions.
    // Character: tags, optional ship ID and a legacy v1 role awaiting canonical migration.
    std::string tertiary;
    std::string quaternary;
    std::string quinary;
    // Declarative map staging data. It never stores ECS handles or executable Lua.
    MapDocument map_document;
    // Declarative ship overrides. They are data only and never spawn or mutate ECS entities.
    ShipDocument ship_document;
};

inline bool operator==(const ContentResource& lhs, const ContentResource& rhs)
{
    return lhs.type == rhs.type
        && lhs.id == rhs.id
        && lhs.name == rhs.name
        && lhs.description == rhs.description
        && lhs.primary == rhs.primary
        && lhs.secondary == rhs.secondary
        && lhs.tertiary == rhs.tertiary
        && lhs.quaternary == rhs.quaternary
        && lhs.quinary == rhs.quinary
        && lhs.map_document == rhs.map_document
        && lhs.ship_document == rhs.ship_document;
}

inline bool operator!=(const ContentResource& lhs, const ContentResource& rhs)
{
    return !(lhs == rhs);
}

enum class ContentRenameError
{
    None,
    InvalidLibrary,
    InvalidType,
    InvalidNewId,
    SourceNotFound,
    SourceChanged,
    TargetAlreadyExists,
};

enum class ContentResourceError
{
    None,
    ImportTooLarge,
    InvalidJson,
    DuplicateJsonKeys,
    UnknownFields,
    UnsupportedFormatOrVersion,
    UnknownType,
    MissingOrInvalidText,
    TextTooLong,
    InvalidTypeFields,
    UnknownTypeFields,
    InvalidId,
    InvalidName,
    DescriptionTooLong,
    TypeFieldTooLong,
    MissingPrimaryField,
    InvalidCampaignMapIds,
    InvalidCampaignReferences,
    InvalidCampaignTransitions,
    CampaignTransitionCycle,
    InvalidCrewPosition,
    InvalidCharacterTags,
    InvalidCharacterShipId,
    MissingDependency,
    UnsafeScenarioFile,
    InvalidPlayerCount,
    InvalidMapDocument,
    InvalidShipDocument,
};

constexpr int CONTENT_RESOURCE_SCHEMA_VERSION = 4;
constexpr std::size_t CONTENT_RESOURCE_MAX_IMPORT_BYTES = 64 * 1024;

std::string contentResourceTypeId(ContentResourceType type);
bool parseContentResourceType(const std::string& value, ContentResourceType& type);
ContentResourceError validateContentResource(const ContentResource& resource);
ContentResourceError validateContentLibrary(const std::vector<ContentResource>& resources);
ContentRenameError renameContentResource(
    std::vector<ContentResource>& resources,
    ContentResourceType type,
    const std::string& old_id,
    const std::string& new_id
);
bool contentResourceHasMissingDependencies(
    const ContentResource& resource,
    const std::vector<ContentResource>& library
);
std::string serializeContentResource(const ContentResource& resource, int indent = -1);
std::string serializeContentResourceExport(
    const ContentResource& resource,
    const std::vector<ContentResource>& library,
    int indent = -1
);
ContentResourceError parseContentResource(const std::string& input, ContentResource& resource);

class ContentDiscardGuard
{
public:
    bool confirm(
        const std::string& action,
        const ContentResource& current,
        const ContentResource& clean_snapshot
    );
    void reset();

private:
    std::string pending_signature;
};
