#include "contentEditor.h"
#include "clipboard.h"
#include "i18n.h"
#include "io/json.h"
#include "gui/gui2_button.h"
#include "gui/gui2_label.h"
#include "gui/gui2_listbox.h"
#include "gui/gui2_panel.h"
#include "gui/gui2_selector.h"
#include "gui/gui2_textentry.h"
#include <algorithm>
#include <cctype>
#include <set>
#include <sstream>

namespace
{
constexpr int CONTENT_SCHEMA_VERSION = 1;
constexpr size_t MAX_IMPORT_BYTES = 64 * 1024;

string typeId(ContentResourceType type)
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

string typeLabel(ContentResourceType type)
{
    switch(type)
    {
    case ContentResourceType::Campaign: return tr("content_editor", "Campaign");
    case ContentResourceType::Map: return tr("content_editor", "Map");
    case ContentResourceType::Character: return tr("content_editor", "Character");
    case ContentResourceType::Ship: return tr("content_editor", "Ship");
    }
    return "";
}

bool parseType(const std::string& value, ContentResourceType& type)
{
    if (value == "campaign") type = ContentResourceType::Campaign;
    else if (value == "map") type = ContentResourceType::Map;
    else if (value == "character") type = ContentResourceType::Character;
    else if (value == "ship") type = ContentResourceType::Ship;
    else return false;
    return true;
}

std::pair<string, string> fieldLabels(ContentResourceType type)
{
    switch(type)
    {
    case ContentResourceType::Campaign:
        return {tr("content_editor", "Map IDs (comma separated)"), tr("content_editor", "Starting map ID")};
    case ContentResourceType::Map:
        return {tr("content_editor", "Scenario file"), tr("content_editor", "Recommended player count")};
    case ContentResourceType::Character:
        return {tr("content_editor", "Role"), tr("content_editor", "Callsign")};
    case ContentResourceType::Ship:
        return {tr("content_editor", "Ship template"), tr("content_editor", "Faction")};
    }
    return {"", ""};
}

bool validId(const string& value)
{
    if (value.empty() || value.size() > 64) return false;
    for (char c : value)
        if (!(std::islower(static_cast<unsigned char>(c))
            || std::isdigit(static_cast<unsigned char>(c))
            || c == '_' || c == '-')) return false;
    return std::isalnum(static_cast<unsigned char>(value.front()));
}

bool validIdList(const string& value)
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

bool validScenarioFile(const string& value)
{
    if (!value.startswith("scenario_") || !value.endswith(".lua") || value.find("..") >= 0)
        return false;
    return std::all_of(value.begin(), value.end(), [](unsigned char c) {
        return std::isalnum(c) || c == '_' || c == '-' || c == '.';
    });
}

bool validPlayerCount(const string& value)
{
    if (value.empty()) return true;
    if (!std::all_of(value.begin(), value.end(), [](unsigned char c) { return std::isdigit(c); }))
        return false;
    try
    {
        int count = std::stoi(value);
        return count >= 1 && count <= 64;
    }
    catch (...)
    {
        return false;
    }
}

string validateResource(const ContentResource& resource)
{
    if (!validId(resource.id))
        return tr("content_editor", "ID must use 1-64 lowercase letters, numbers, '_' or '-'.");
    if (resource.name.empty() || resource.name.size() > 120)
        return tr("content_editor", "Name is required and must be at most 120 characters.");
    if (resource.description.size() > 4000)
        return tr("content_editor", "Description is too long (maximum 4000 characters).");
    if (resource.primary.size() > 1000 || resource.secondary.size() > 1000)
        return tr("content_editor", "A type-specific field is too long.");
    if (resource.type != ContentResourceType::Campaign && resource.primary.empty())
        return tr("content_editor", "The first type-specific field is required.");
    if (resource.type == ContentResourceType::Campaign
        && (!validIdList(resource.primary)
            || (!resource.secondary.empty() && !validId(resource.secondary))))
        return tr("content_editor", "Campaign map IDs are invalid.");
    if (resource.type == ContentResourceType::Map && !validScenarioFile(resource.primary))
        return tr("content_editor", "Scenario file must be a safe scenario_*.lua filename.");
    if (resource.type == ContentResourceType::Map && !validPlayerCount(resource.secondary))
        return tr("content_editor", "Recommended player count must be between 1 and 64.");
    return "";
}

nlohmann::json serializeResource(const ContentResource& resource)
{
    auto labels = fieldLabels(resource.type);
    (void)labels;
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
    return {
        {"format", "espaciokoop-content"},
        {"version", CONTENT_SCHEMA_VERSION},
        {"type", typeId(resource.type)},
        {"id", resource.id},
        {"name", resource.name},
        {"description", resource.description},
        {"fields", fields},
    };
}

bool readString(
    const nlohmann::json& object,
    const char* key,
    string& output,
    size_t maximum,
    string& error
)
{
    auto it = object.find(key);
    if (it == object.end() || !it->is_string())
    {
        error = tr("content_editor", "Imported document has a missing or invalid text field.");
        return false;
    }
    std::string value = it->get<std::string>();
    if (value.size() > maximum)
    {
        error = tr("content_editor", "Imported text exceeds the allowed size.");
        return false;
    }
    output = value;
    return true;
}

bool parseResource(const string& input, ContentResource& resource, string& error)
{
    if (input.size() > MAX_IMPORT_BYTES)
    {
        error = tr("content_editor", "Import is larger than 64 KiB.");
        return false;
    }

    std::string parse_error;
    auto parsed = sp::json::parse(std::string(input), parse_error);
    if (!parsed || !parsed->is_object())
    {
        error = tr("content_editor", "Clipboard does not contain valid content JSON.");
        return false;
    }
    const auto& document = *parsed;
    const std::set<std::string> allowed = {
        "format", "version", "type", "id", "name", "description", "fields"
    };
    for (auto it = document.begin(); it != document.end(); ++it)
        if (!allowed.count(it.key()))
        {
            error = tr("content_editor", "Imported document contains unknown fields.");
            return false;
        }

    auto format_it = document.find("format");
    auto version_it = document.find("version");
    if (format_it == document.end() || !format_it->is_string()
        || format_it->get<std::string>() != "espaciokoop-content"
        || version_it == document.end() || !version_it->is_number_integer()
        || version_it->get<int>() != CONTENT_SCHEMA_VERSION)
    {
        error = tr("content_editor", "Unsupported content format or version.");
        return false;
    }

    auto type_it = document.find("type");
    if (type_it == document.end() || !type_it->is_string()
        || !parseType(type_it->get<std::string>(), resource.type))
    {
        error = tr("content_editor", "Unknown content type.");
        return false;
    }
    if (!readString(document, "id", resource.id, 64, error)
        || !readString(document, "name", resource.name, 120, error)
        || !readString(document, "description", resource.description, 4000, error))
        return false;

    auto fields_it = document.find("fields");
    if (fields_it == document.end() || !fields_it->is_object())
    {
        error = tr("content_editor", "Imported document has invalid type-specific fields.");
        return false;
    }

    const char* primary_key = "";
    const char* secondary_key = "";
    switch(resource.type)
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
        if (!allowed_fields.count(it.key()))
        {
            error = tr("content_editor", "Imported document contains unknown type-specific fields.");
            return false;
        }
    if (!readString(*fields_it, primary_key, resource.primary, 1000, error)
        || !readString(*fields_it, secondary_key, resource.secondary, 1000, error))
        return false;

    error = validateResource(resource);
    return error.empty();
}
}

GuiContentEditor::GuiContentEditor(GuiContainer* owner)
: GuiOverlay(owner, "CONTENT_EDITOR", glm::u8vec4(0, 0, 0, 160))
{
    auto box = new GuiPanel(this, "CONTENT_EDITOR_FRAME");
    box->setPosition(0, 0, sp::Alignment::Center)->setSize(1100, 700);

    (new GuiLabel(box, "TITLE", tr("content_editor", "Content editor"), 32))
        ->setPosition(30, 15, sp::Alignment::TopLeft)->setSize(1040, 45);

    type_selector = new GuiSelector(box, "TYPE", [this](int, string value) {
        ContentResourceType type;
        if (parseType(value, type)) setType(type);
    });
    for (auto type : {ContentResourceType::Campaign, ContentResourceType::Map,
                      ContentResourceType::Character, ContentResourceType::Ship})
        type_selector->addEntry(typeLabel(type), typeId(type));
    type_selector->setSelectionIndex(0)->setPosition(30, 70, sp::Alignment::TopLeft)->setSize(300, 45);

    resource_list = new GuiListbox(box, "RESOURCES", [this](int index, string) {
        if (index >= 0 && index < int(visible_indices.size()))
            loadResource(visible_indices[index]);
    });
    resource_list->setPosition(30, 125, sp::Alignment::TopLeft)->setSize(300, 430);

    (new GuiButton(box, "NEW", tr("content_editor", "New"), [this]() { clearForm(); }))
        ->setPosition(30, 570, sp::Alignment::TopLeft)->setSize(140, 45);
    (new GuiButton(box, "DELETE", tr("content_editor", "Delete"), [this]() { deleteResource(); }))
        ->setPosition(190, 570, sp::Alignment::TopLeft)->setSize(140, 45);

    const float x = 360;
    (new GuiLabel(box, "ID_LABEL", tr("content_editor", "ID"), 20))->setPosition(x, 70)->setSize(180, 35);
    id_entry = new GuiTextEntry(box, "ID", "");
    id_entry->setPosition(x + 190, 70)->setSize(500, 35);

    (new GuiLabel(box, "NAME_LABEL", tr("content_editor", "Name"), 20))->setPosition(x, 115)->setSize(180, 35);
    name_entry = new GuiTextEntry(box, "NAME", "");
    name_entry->setPosition(x + 190, 115)->setSize(500, 35);

    (new GuiLabel(box, "DESCRIPTION_LABEL", tr("content_editor", "Description"), 20))->setPosition(x, 160)->setSize(180, 35);
    description_entry = new GuiTextEntry(box, "DESCRIPTION", "");
    description_entry->setMultiline()->setPosition(x + 190, 160)->setSize(500, 150);

    primary_label = new GuiLabel(box, "PRIMARY_LABEL", "", 20);
    primary_label->setPosition(x, 330)->setSize(180, 35);
    primary_entry = new GuiTextEntry(box, "PRIMARY", "");
    primary_entry->setPosition(x + 190, 330)->setSize(500, 35);

    secondary_label = new GuiLabel(box, "SECONDARY_LABEL", "", 20);
    secondary_label->setPosition(x, 375)->setSize(180, 35);
    secondary_entry = new GuiTextEntry(box, "SECONDARY", "");
    secondary_entry->setPosition(x + 190, 375)->setSize(500, 35);

    (new GuiButton(box, "SAVE", tr("content_editor", "Save"), [this]() { saveResource(); }))
        ->setPosition(x, 445)->setSize(160, 45);
    (new GuiButton(box, "EXPORT", tr("content_editor", "Export"), [this]() { exportResource(); }))
        ->setPosition(x + 180, 445)->setSize(160, 45);
    (new GuiButton(box, "IMPORT", tr("content_editor", "Import"), [this]() { importResource(); }))
        ->setPosition(x + 360, 445)->setSize(160, 45);

    status_label = new GuiLabel(box, "STATUS", "", 18);
    status_label->setPosition(x, 510)->setSize(690, 80);

    (new GuiButton(box, "CLOSE", tr("button", "Close"), [this]() { hide(); }))
        ->setPosition(-30, -25, sp::Alignment::BottomRight)->setSize(180, 45);

    setType(ContentResourceType::Campaign);
    clearForm();
}

bool GuiContentEditor::onMouseDown(sp::io::Pointer::Button, glm::vec2, sp::io::Pointer::ID)
{
    return true;
}

void GuiContentEditor::setType(ContentResourceType type)
{
    current_type = type;
    auto labels = fieldLabels(type);
    primary_label->setText(labels.first);
    secondary_label->setText(labels.second);
    clearForm();
    refreshList();
}

void GuiContentEditor::refreshList()
{
    resource_list->clear();
    visible_indices.clear();
    for (int index = 0; index < int(resources.size()); ++index)
    {
        if (resources[index].type != current_type) continue;
        visible_indices.push_back(index);
        resource_list->addEntry(resources[index].name, resources[index].id);
    }
}

void GuiContentEditor::clearForm()
{
    selected_index = -1;
    pending_import = "";
    pending_delete_key = "";
    id_entry->setText("");
    name_entry->setText("");
    description_entry->setText("");
    primary_entry->setText("");
    secondary_entry->setText("");
    setStatus(tr("content_editor", "Create a resource or import one from the clipboard."));
}

void GuiContentEditor::loadResource(int index)
{
    if (index < 0 || index >= int(resources.size())) return;
    selected_index = index;
    const auto& resource = resources[index];
    current_type = resource.type;
    id_entry->setText(resource.id);
    name_entry->setText(resource.name);
    description_entry->setText(resource.description);
    primary_entry->setText(resource.primary);
    secondary_entry->setText(resource.secondary);
    pending_import = "";
    pending_delete_key = "";
    setStatus(tr("content_editor", "Resource loaded."));
}

ContentResource GuiContentEditor::formResource() const
{
    return {
        current_type,
        id_entry->getText(),
        name_entry->getText(),
        description_entry->getText(),
        primary_entry->getText(),
        secondary_entry->getText(),
    };
}

void GuiContentEditor::saveResource()
{
    auto resource = formResource();
    auto error = validateResource(resource);
    if (!error.empty()) return setStatus(error);

    int existing = findResource(resource.type, resource.id);
    if (existing >= 0)
    {
        resources[existing] = resource;
        selected_index = existing;
        setStatus(tr("content_editor", "Resource updated."));
    }
    else
    {
        resources.push_back(resource);
        selected_index = int(resources.size()) - 1;
        setStatus(tr("content_editor", "Resource created."));
    }
    pending_import = "";
    pending_delete_key = "";
    refreshList();
}

void GuiContentEditor::deleteResource()
{
    if (selected_index < 0 || selected_index >= int(resources.size()))
        return setStatus(tr("content_editor", "Select a saved resource first."));
    string key = typeId(resources[selected_index].type) + ":" + resources[selected_index].id;
    if (pending_delete_key != key)
    {
        pending_delete_key = key;
        return setStatus(tr("content_editor", "Press Delete again to confirm."));
    }
    resources.erase(resources.begin() + selected_index);
    clearForm();
    refreshList();
    setStatus(tr("content_editor", "Resource deleted."));
}

void GuiContentEditor::exportResource()
{
    auto resource = formResource();
    auto error = validateResource(resource);
    if (!error.empty()) return setStatus(error);
    Clipboard::setClipboard(serializeResource(resource).dump(2));
    setStatus(tr("content_editor", "Resource exported to the clipboard."));
}

void GuiContentEditor::importResource()
{
    string input = Clipboard::readClipboard();
    ContentResource resource;
    string error;
    if (!parseResource(input, resource, error)) return setStatus(error);

    int existing = findResource(resource.type, resource.id);
    if (existing >= 0 && pending_import != input)
    {
        pending_import = input;
        return setStatus(tr("content_editor", "This ID already exists. Press Import again to replace it."));
    }

    if (existing >= 0)
    {
        resources[existing] = resource;
        selected_index = existing;
    }
    else
    {
        resources.push_back(resource);
        selected_index = int(resources.size()) - 1;
    }
    current_type = resource.type;
    type_selector->setSelectionIndex(static_cast<int>(resource.type));
    refreshList();
    loadResource(selected_index);
    pending_import = "";
    setStatus(existing >= 0
        ? tr("content_editor", "Imported resource replaced after confirmation.")
        : tr("content_editor", "Resource imported."));
}

int GuiContentEditor::findResource(ContentResourceType type, const string& id) const
{
    for (int index = 0; index < int(resources.size()); ++index)
        if (resources[index].type == type && resources[index].id == id) return index;
    return -1;
}

void GuiContentEditor::setStatus(const string& text)
{
    status_label->setText(text);
}
