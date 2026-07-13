#include "contentEditor.h"
#include "clipboard.h"
#include "i18n.h"
#include "gui/gui2_button.h"
#include "gui/gui2_label.h"
#include "gui/gui2_listbox.h"
#include "gui/gui2_panel.h"
#include "gui/gui2_selector.h"
#include "gui/gui2_textentry.h"

namespace
{
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
        if (parseContentResourceType(value, type)) requestSetType(type);
    });
    for (auto type : {ContentResourceType::Campaign, ContentResourceType::Map,
                      ContentResourceType::Character, ContentResourceType::Ship})
        type_selector->addEntry(typeLabel(type), contentResourceTypeId(type));
    type_selector->setSelectionIndex(0)->setPosition(30, 70, sp::Alignment::TopLeft)->setSize(300, 45);

    resource_list = new GuiListbox(box, "RESOURCES", [this](int index, string) {
        if (index >= 0 && index < int(visible_indices.size()))
            requestLoadResource(visible_indices[index]);
    });
    resource_list->setPosition(30, 125, sp::Alignment::TopLeft)->setSize(300, 430);

    (new GuiButton(box, "NEW", tr("content_editor", "New"), [this]() { requestClearForm(); }))
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
    status_label->setPosition(x, 510)->setSize(690, 70);

    (new GuiLabel(
        box,
        "SESSION_WARNING",
        tr("content_editor", "Session-only library: export important resources before closing."),
        16
    ))->setPosition(x, 585)->setSize(690, 35);

    (new GuiButton(box, "CLOSE", tr("button", "Close"), [this]() { requestClose(); }))
        ->setPosition(-30, -25, sp::Alignment::BottomRight)->setSize(180, 45);

    setType(ContentResourceType::Campaign);
}

bool GuiContentEditor::onMouseDown(sp::io::Pointer::Button, glm::vec2, sp::io::Pointer::ID)
{
    return true;
}

void GuiContentEditor::requestSetType(ContentResourceType type)
{
    if (type == current_type)
    {
        type_selector->setSelectionIndex(static_cast<int>(current_type));
        return;
    }
    if (!confirmDiscard("type:" + contentResourceTypeId(type)))
    {
        type_selector->setSelectionIndex(static_cast<int>(current_type));
        return;
    }
    setType(type);
}

void GuiContentEditor::setType(ContentResourceType type)
{
    current_type = type;
    type_selector->setSelectionIndex(static_cast<int>(type));
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
    syncListSelection();
}

void GuiContentEditor::syncListSelection()
{
    int visible_selection = -1;
    for (int index = 0; index < int(visible_indices.size()); ++index)
        if (visible_indices[index] == selected_index) visible_selection = index;
    resource_list->setSelectionIndex(visible_selection);
}

void GuiContentEditor::requestClearForm()
{
    if (confirmDiscard("new")) clearForm();
}

void GuiContentEditor::clearForm()
{
    selected_index = -1;
    pending_import = "";
    pending_save = "";
    pending_delete_key = "";
    discard_guard.reset();
    id_entry->setText("");
    name_entry->setText("");
    description_entry->setText("");
    primary_entry->setText("");
    secondary_entry->setText("");
    clean_snapshot = formResource();
    syncListSelection();
    setStatus(tr("content_editor", "Create a resource or import one from the clipboard."));
}

void GuiContentEditor::requestLoadResource(int index)
{
    if (!confirmDiscard("load:" + string(index)))
    {
        syncListSelection();
        return;
    }
    loadResource(index);
}

void GuiContentEditor::loadResource(int index)
{
    if (index < 0 || index >= int(resources.size())) return;
    selected_index = index;
    const auto& resource = resources[index];
    if (current_type != resource.type)
    {
        current_type = resource.type;
        type_selector->setSelectionIndex(static_cast<int>(resource.type));
        auto labels = fieldLabels(resource.type);
        primary_label->setText(labels.first);
        secondary_label->setText(labels.second);
        refreshList();
    }
    id_entry->setText(resource.id);
    name_entry->setText(resource.name);
    description_entry->setText(resource.description);
    primary_entry->setText(resource.primary);
    secondary_entry->setText(resource.secondary);
    clean_snapshot = resource;
    pending_import = "";
    pending_save = "";
    pending_delete_key = "";
    discard_guard.reset();
    syncListSelection();
    setStatus(tr("content_editor", "Resource loaded."));
}

void GuiContentEditor::requestClose()
{
    if (confirmDiscard("close")) hide();
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

bool GuiContentEditor::isFormDirty() const
{
    return formResource() != clean_snapshot;
}

bool GuiContentEditor::confirmDiscard(const string& action)
{
    if (discard_guard.confirm(action, formResource(), clean_snapshot)) return true;
    setStatus(tr("content_editor", "Unsaved changes. Repeat the action to discard them."));
    return false;
}

void GuiContentEditor::saveResource()
{
    auto resource = formResource();
    auto error = validateContentResource(resource);
    if (error != ContentResourceError::None) return setStatus(errorText(error));

    int existing = findResource(resource.type, resource.id);
    const bool selected = selected_index >= 0 && selected_index < int(resources.size());
    const bool replacing_other = existing >= 0 && existing != selected_index;
    const string save_signature = serializeContentResource(resource);
    if (replacing_other && pending_save != save_signature)
    {
        pending_save = save_signature;
        return setStatus(tr("content_editor", "This ID already exists. Press Save again to replace it."));
    }

    if (replacing_other)
    {
        resources[existing] = resource;
        if (selected)
        {
            const int original = selected_index;
            resources.erase(resources.begin() + original);
            if (original < existing) --existing;
        }
        selected_index = existing;
        setStatus(tr("content_editor", "Resource replaced after confirmation."));
    }
    else if (selected)
    {
        resources[selected_index] = resource;
        setStatus(tr("content_editor", "Resource updated."));
    }
    else
    {
        resources.push_back(resource);
        selected_index = int(resources.size()) - 1;
        setStatus(tr("content_editor", "Resource created."));
    }
    clean_snapshot = resource;
    pending_import = "";
    pending_save = "";
    pending_delete_key = "";
    discard_guard.reset();
    refreshList();
}

void GuiContentEditor::deleteResource()
{
    if (selected_index < 0 || selected_index >= int(resources.size()))
        return setStatus(tr("content_editor", "Select a saved resource first."));
    string key = contentResourceTypeId(resources[selected_index].type)
        + ":" + resources[selected_index].id + "\n" + serializeContentResource(formResource());
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
    auto error = validateContentResource(resource);
    if (error != ContentResourceError::None) return setStatus(errorText(error));
    Clipboard::setClipboard(serializeContentResource(resource, 2));
    setStatus(tr("content_editor", "Resource exported to the clipboard."));
}

void GuiContentEditor::importResource()
{
    const string input = Clipboard::readClipboard();
    ContentResource resource;
    const auto error = parseContentResource(input, resource);
    if (error != ContentResourceError::None) return setStatus(errorText(error));

    int existing = findResource(resource.type, resource.id);
    if (existing >= 0 && pending_import != input)
    {
        pending_import = input;
        return setStatus(tr("content_editor", "This ID already exists. Press Import again to replace it."));
    }
    if (!confirmDiscard("import:" + input)) return;

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
    auto labels = fieldLabels(resource.type);
    primary_label->setText(labels.first);
    secondary_label->setText(labels.second);
    refreshList();
    loadResource(selected_index);
    pending_import = "";
    pending_save = "";
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

string GuiContentEditor::errorText(ContentResourceError error) const
{
    switch(error)
    {
    case ContentResourceError::None: return "";
    case ContentResourceError::ImportTooLarge:
        return tr("content_editor", "Import is larger than 64 KiB.");
    case ContentResourceError::InvalidJson:
        return tr("content_editor", "Clipboard does not contain valid content JSON.");
    case ContentResourceError::DuplicateJsonKeys:
        return tr("content_editor", "Imported document contains duplicate JSON keys.");
    case ContentResourceError::UnknownFields:
        return tr("content_editor", "Imported document contains unknown fields.");
    case ContentResourceError::UnsupportedFormatOrVersion:
        return tr("content_editor", "Unsupported content format or version.");
    case ContentResourceError::UnknownType:
        return tr("content_editor", "Unknown content type.");
    case ContentResourceError::MissingOrInvalidText:
        return tr("content_editor", "Imported document has a missing or invalid text field.");
    case ContentResourceError::TextTooLong:
        return tr("content_editor", "Imported text exceeds the allowed size.");
    case ContentResourceError::InvalidTypeFields:
        return tr("content_editor", "Imported document has invalid type-specific fields.");
    case ContentResourceError::UnknownTypeFields:
        return tr("content_editor", "Imported document contains unknown type-specific fields.");
    case ContentResourceError::InvalidId:
        return tr("content_editor", "ID must use 1-64 lowercase letters, numbers, '_' or '-'.");
    case ContentResourceError::InvalidName:
        return tr("content_editor", "Name is required and must be at most 120 characters.");
    case ContentResourceError::DescriptionTooLong:
        return tr("content_editor", "Description is too long (maximum 4000 characters).");
    case ContentResourceError::TypeFieldTooLong:
        return tr("content_editor", "A type-specific field is too long.");
    case ContentResourceError::MissingPrimaryField:
        return tr("content_editor", "The first type-specific field is required.");
    case ContentResourceError::InvalidCampaignMapIds:
        return tr("content_editor", "Campaign map IDs are invalid.");
    case ContentResourceError::UnsafeScenarioFile:
        return tr("content_editor", "Scenario file must be a safe scenario_*.lua filename.");
    case ContentResourceError::InvalidPlayerCount:
        return tr("content_editor", "Recommended player count must be between 1 and 64.");
    }
    return tr("content_editor", "Clipboard does not contain valid content JSON.");
}

void GuiContentEditor::setStatus(const string& text)
{
    status_label->setText(text);
}
