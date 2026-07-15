#include "content/shipTemplateCatalog.h"

#include <algorithm>
#include <cctype>

namespace
{
std::string asciiLower(std::string value)
{
    std::transform(value.begin(), value.end(), value.begin(), [](unsigned char character) {
        return static_cast<char>(std::tolower(character));
    });
    return value;
}
}

const ShipTemplateCatalogEntry* findShipTemplate(
    const std::vector<ShipTemplateCatalogEntry>& catalog,
    const std::string& canonical_id)
{
    for (const auto& entry : catalog)
    {
        if (entry.canonical_id == canonical_id) return &entry;
    }
    return nullptr;
}

ShipTemplateValidation validateShipTemplateSelection(
    const std::vector<ShipTemplateCatalogEntry>& catalog,
    const std::string& canonical_id)
{
    if (catalog.empty()) return ShipTemplateValidation::CatalogUnavailable;
    const auto* entry = findShipTemplate(catalog, canonical_id);
    if (!entry) return ShipTemplateValidation::TemplateNotFound;
    if (entry->model_id.empty() || !entry->model_exists)
        return ShipTemplateValidation::ModelMissing;
    return ShipTemplateValidation::Available;
}

std::vector<std::size_t> filterSelectableShipTemplates(
    const std::vector<ShipTemplateCatalogEntry>& catalog,
    const std::string& query)
{
    const auto needle = asciiLower(query);
    std::vector<std::size_t> result;
    for (std::size_t index = 0; index < catalog.size(); ++index)
    {
        const auto& entry = catalog[index];
        if (entry.hidden || entry.model_id.empty() || !entry.model_exists) continue;
        const auto haystack = asciiLower(
            entry.canonical_id + "\n" + entry.label + "\n" + entry.type + "\n" + entry.model_id);
        if (needle.empty() || haystack.find(needle) != std::string::npos)
            result.push_back(index);
    }
    return result;
}
