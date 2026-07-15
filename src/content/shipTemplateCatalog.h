#pragma once

#include <cstddef>
#include <string>
#include <vector>

struct ShipTemplateCatalogEntry
{
    std::string canonical_id;
    std::string label;
    std::string type;
    std::string model_id;
    bool hidden = false;
    bool model_exists = false;
};

enum class ShipTemplateValidation
{
    Available,
    CatalogUnavailable,
    TemplateNotFound,
    ModelMissing,
};

const ShipTemplateCatalogEntry* findShipTemplate(
    const std::vector<ShipTemplateCatalogEntry>& catalog,
    const std::string& canonical_id);

ShipTemplateValidation validateShipTemplateSelection(
    const std::vector<ShipTemplateCatalogEntry>& catalog,
    const std::string& canonical_id);

std::vector<std::size_t> filterSelectableShipTemplates(
    const std::vector<ShipTemplateCatalogEntry>& catalog,
    const std::string& query);
