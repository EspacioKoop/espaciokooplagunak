#include "content/shipTemplateCatalog.h"

#include <cstdlib>
#include <iostream>
#include <vector>

namespace
{
int checks = 0;

void expect(bool condition, const char* message)
{
    ++checks;
    if (!condition)
    {
        std::cerr << "FAIL: " << message << "\n";
        std::exit(1);
    }
}
}

int main()
{
    const std::vector<ShipTemplateCatalogEntry> unavailable;
    expect(validateShipTemplateSelection(unavailable, "Phobos T3")
            == ShipTemplateValidation::CatalogUnavailable,
        "an unavailable runtime catalog is distinct from an unknown template");

    const std::vector<ShipTemplateCatalogEntry> catalog = {
        {"Adder MK5", "Adder MK5", "ship", "AdderMK5", false, true},
        {"Hidden legacy", "Legacy", "ship", "Legacy", true, true},
        {"Broken model", "Broken", "playership", "MissingModel", false, false},
        {"No model", "No model", "station", "", false, false},
    };

    const auto* adder = findShipTemplate(catalog, "Adder MK5");
    expect(adder && adder->model_id == "AdderMK5", "canonical IDs resolve exactly");
    expect(findShipTemplate(catalog, "adder mk5") == nullptr,
        "localized or case-folded aliases are not accepted as canonical IDs");
    expect(validateShipTemplateSelection(catalog, "Unknown")
            == ShipTemplateValidation::TemplateNotFound,
        "a missing template is rejected when the runtime catalog is available");
    expect(validateShipTemplateSelection(catalog, "Broken model")
            == ShipTemplateValidation::ModelMissing,
        "a template referencing an absent model is rejected");
    expect(validateShipTemplateSelection(catalog, "No model")
            == ShipTemplateValidation::ModelMissing,
        "a template without a model is rejected");
    expect(validateShipTemplateSelection(catalog, "Adder MK5")
            == ShipTemplateValidation::Available,
        "an existing template with a registered model validates");
    expect(validateShipTemplateSelection(catalog, "Hidden legacy")
            == ShipTemplateValidation::Available,
        "hidden templates remain valid for backward-compatible documents");

    const auto all_selectable = filterSelectableShipTemplates(catalog, "");
    expect(all_selectable.size() == 1 && all_selectable.front() == 0,
        "picker excludes hidden templates and templates without valid models");
    const auto by_label = filterSelectableShipTemplates(catalog, "ADDER");
    expect(by_label.size() == 1 && by_label.front() == 0,
        "picker search is ASCII case-insensitive across labels and IDs");
    const auto by_model = filterSelectableShipTemplates(catalog, "addermk5");
    expect(by_model.size() == 1 && by_model.front() == 0,
        "picker search includes canonical model IDs");
    expect(filterSelectableShipTemplates(catalog, "unknown query").empty(),
        "picker returns no entries for an unmatched query");

    std::cout << "SHIP_TEMPLATE_CATALOG_TESTS_OK checks=" << checks << "\n";
    return 0;
}
