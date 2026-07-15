#include "content/shipTemplateCatalog.h"

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
