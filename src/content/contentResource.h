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

// Typed edits used by the GM content editor. These helpers keep the v4 string
// representation private to the codec while preventing free-form references.
enum class ContentReferenceKind
{
    CampaignMap,
    CampaignCharacter,
    CampaignShip,
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

constexpr int CONTENT_RESOURCE_SCHEMA_VERSION = 5;
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
bool addContentReference(
    ContentResource& resource,
    const std::vector<ContentResource>& library,
    ContentReferenceKind kind,
    const std::string& id
);
bool removeContentReference(
    ContentResource& resource,
    ContentReferenceKind kind,
    const std::string& id
);
// Typed, read-only view of the campaign v4 string fields. Consumers never see
// the serialized representation, which stays private to the codec.
struct CampaignFields
{
    std::vector<std::string> map_ids;
    std::string starting_map_id;
    std::vector<std::string> character_ids;
    std::vector<std::string> ship_ids;
    std::vector<std::pair<std::string, std::string>> transitions;
};

// False unless the resource is a Campaign whose fields parse cleanly.
bool campaignFields(const ContentResource& resource, CampaignFields& output);

bool moveCampaignMap(ContentResource& resource, const std::string& id, int direction);
bool setCampaignStartingMap(ContentResource& resource, const std::string& id);
bool addCampaignTransition(
    ContentResource& resource,
    const std::string& from_id,
    const std::string& to_id
);
bool removeCampaignTransition(
    ContentResource& resource,
    const std::string& from_id,
    const std::string& to_id
);
bool setCharacterCrewPosition(ContentResource& resource, const std::string& crew_position_id);
bool setCharacterShipReference(
    ContentResource& resource,
    const std::vector<ContentResource>& library,
    const std::string& ship_id
);
// Lowercases, trims and maps separators to '-'; returns "" when the result is
// not a portable ID, so free-form input can never produce an invalid tag.
std::string normalizeCharacterTag(const std::string& raw_tag);
bool addCharacterTag(ContentResource& resource, const std::string& raw_tag);
bool removeCharacterTag(ContentResource& resource, const std::string& tag);
bool moveCharacterTag(ContentResource& resource, const std::string& tag, int direction);
bool clearCharacterLegacyRole(ContentResource& resource);
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
