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

struct ShipTemplatePreviewData
{
    std::string mesh;
    std::string texture;
    std::string specular_texture;
    std::string illumination_texture;
    std::string normal_texture;
    float mesh_offset_x = 0.0f;
    float mesh_offset_y = 0.0f;
    float mesh_offset_z = 0.0f;
    float scale = 1.0f;
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

bool isUsableShipTemplatePreview(const ShipTemplatePreviewData& preview);
