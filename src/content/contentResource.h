#pragma once

#include <cstddef>
#include <string>

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
};

inline bool operator==(const ContentResource& lhs, const ContentResource& rhs)
{
    return lhs.type == rhs.type
        && lhs.id == rhs.id
        && lhs.name == rhs.name
        && lhs.description == rhs.description
        && lhs.primary == rhs.primary
        && lhs.secondary == rhs.secondary;
}

inline bool operator!=(const ContentResource& lhs, const ContentResource& rhs)
{
    return !(lhs == rhs);
}

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
    UnsafeScenarioFile,
    InvalidPlayerCount,
};

constexpr int CONTENT_RESOURCE_SCHEMA_VERSION = 1;
constexpr std::size_t CONTENT_RESOURCE_MAX_IMPORT_BYTES = 64 * 1024;

std::string contentResourceTypeId(ContentResourceType type);
bool parseContentResourceType(const std::string& value, ContentResourceType& type);
ContentResourceError validateContentResource(const ContentResource& resource);
std::string serializeContentResource(const ContentResource& resource, int indent = -1);
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
