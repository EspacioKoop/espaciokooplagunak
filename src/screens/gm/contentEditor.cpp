#include "contentEditor.h"
#include "clipboard.h"
#include "i18n.h"
#include "gui/gui2_button.h"
#include "gui/gui2_label.h"
#include "gui/gui2_listbox.h"
#include "gui/gui2_panel.h"
#include "gui/gui2_selector.h"
#include "gui/gui2_textentry.h"
#include "gui/gui2_togglebutton.h"

#include <array>
#include <utility>

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

std::array<string, 5> fieldLabels(ContentResourceType type)
{
    switch(type)
    {
    case ContentResourceType::Campaign:
        return {
            tr("content_editor", "Map IDs (ordered, comma separated)"),
            tr("content_editor", "Starting map ID"),
            tr("content_editor", "Character IDs (comma separated)"),
            tr("content_editor", "Ship IDs (comma separated)"),
            tr("content_editor", "Transitions (from>to, comma separated)"),
        };
    case ContentResourceType::Map:
        return {tr("content_editor", "Scenario file"), tr("content_editor", "Recommended player count"), "", "", ""};
    case ContentResourceType::Character:
        return {
            tr("content_editor", "Crew position ID"), tr("content_editor", "Callsign"),
            tr("content_editor", "Tags (comma separated)"), tr("content_editor", "Ship ID (optional)"),
            tr("content_editor", "Legacy role (clear after assigning a crew position)"),
        };
    case ContentResourceType::Ship:
        return {tr("content_editor", "Ship template"), tr("content_editor", "Faction"), "", "", ""};
    }
    return {"", "", "", "", ""};
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
    resource_list->setPosition(30, 125, sp::Alignment::TopLeft)->setSize(300, 300);

    (new GuiLabel(box, "INBOX_LABEL", tr("content_editor", "Import inbox"), 18))
        ->setPosition(30, 435, sp::Alignment::TopLeft)->setSize(300, 30);
    inbox_selector = new GuiSelector(box, "INBOX", [this](int, string) {
        pending_file_import = "";
    });
    inbox_selector->setPosition(30, 465, sp::Alignment::TopLeft)->setSize(300, 40);
    (new GuiButton(box, "IMPORT_FILE", tr("content_editor", "Import file"), [this]() {
        importFromManagedFile();
    }))->setPosition(30, 515, sp::Alignment::TopLeft)->setSize(300, 40);

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
    description_entry->setMultiline()->setPosition(x + 190, 160)->setSize(500, 105);

    primary_label = new GuiLabel(box, "PRIMARY_LABEL", "", 18);
    primary_label->setPosition(x, 280)->setSize(180, 30);
    primary_entry = new GuiTextEntry(box, "PRIMARY", "");
    primary_entry->setPosition(x + 190, 280)->setSize(500, 30);

    secondary_label = new GuiLabel(box, "SECONDARY_LABEL", "", 18);
    secondary_label->setPosition(x, 320)->setSize(180, 30);
    secondary_entry = new GuiTextEntry(box, "SECONDARY", "");
    secondary_entry->setPosition(x + 190, 320)->setSize(500, 30);

    tertiary_label = new GuiLabel(box, "TERTIARY_LABEL", "", 18);
    tertiary_label->setPosition(x, 360)->setSize(180, 30);
    tertiary_entry = new GuiTextEntry(box, "TERTIARY", "");
    tertiary_entry->setPosition(x + 190, 360)->setSize(500, 30);

    quaternary_label = new GuiLabel(box, "QUATERNARY_LABEL", "", 18);
    quaternary_label->setPosition(x, 400)->setSize(180, 30);
    quaternary_entry = new GuiTextEntry(box, "QUATERNARY", "");
    quaternary_entry->setPosition(x + 190, 400)->setSize(500, 30);

    quinary_label = new GuiLabel(box, "QUINARY_LABEL", "", 18);
    quinary_label->setPosition(x, 440)->setSize(180, 30);
    quinary_entry = new GuiTextEntry(box, "QUINARY", "");
    quinary_entry->setPosition(x + 190, 440)->setSize(500, 30);

    preview_toggle = new GuiToggleButton(
        box,
        "MAP_PREVIEW",
        tr("content_editor", "Preview on radar"),
        [this](bool value) { preview_enabled = value; }
    );
    preview_toggle->setPosition(x, 360)->setSize(250, 40)->hide();

    (new GuiButton(box, "SAVE", tr("content_editor", "Save"), [this]() { saveResource(); }))
        ->setPosition(x, 490)->setSize(150, 45);
    (new GuiButton(box, "EXPORT", tr("content_editor", "Export"), [this]() { exportToClipboard(); }))
        ->setPosition(x + 165, 490)->setSize(150, 45);
    (new GuiButton(box, "IMPORT", tr("content_editor", "Import"), [this]() { importFromClipboard(); }))
        ->setPosition(x + 330, 490)->setSize(150, 45);
    (new GuiButton(box, "EXPORT_FILE", tr("content_editor", "Export file"), [this]() {
        exportToManagedFile();
    }))->setPosition(x + 495, 490)->setSize(195, 45);

    status_label = new GuiLabel(box, "STATUS", "", 18);
    status_label->setPosition(x, 545)->setSize(690, 55);

    (new GuiLabel(
        box,
        "SESSION_WARNING",
        tr("content_editor", "Private library: managed files stay inside the game configuration directory."),
        16
    ))->setPosition(x, 585)->setSize(690, 35);

    (new GuiButton(box, "CLOSE", tr("button", "Close"), [this]() { requestClose(); }))
        ->setPosition(-30, -25, sp::Alignment::BottomRight)->setSize(180, 45);

    setType(ContentResourceType::Campaign);
    const auto load_result = store.load(resources);
    refreshList();
    refreshInbox();
    if (load_result.error != ContentStoreError::None)
        setStatus(storeErrorText(load_result.error));
    else if (load_result.recovered)
        setStatus(tr("content_editor", "Private library recovered after an interrupted write."));
    else if (load_result.migrated)
        setStatus(tr("content_editor", "Private library migrated to the current format."));
    else
        setStatus(tr("content_editor", "Private library loaded."));
}

bool GuiContentEditor::onMouseDown(sp::io::Pointer::Button, glm::vec2, sp::io::Pointer::ID)
{
    return true;
}

const MapDocument* GuiContentEditor::previewDocument() const
{
    if (!preview_enabled || current_type != ContentResourceType::Map) return nullptr;
    return &clean_snapshot.map_document;
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
    updateFieldPresentation(type);
    clearForm();
    refreshList();
}

void GuiContentEditor::updateFieldPresentation(ContentResourceType type)
{
    const auto labels = fieldLabels(type);
    GuiLabel* field_labels[] = {
        primary_label, secondary_label, tertiary_label, quaternary_label, quinary_label
    };
    GuiTextEntry* field_entries[] = {
        primary_entry, secondary_entry, tertiary_entry, quaternary_entry, quinary_entry
    };
    for (std::size_t index = 0; index < labels.size(); ++index)
    {
        field_labels[index]->setText(labels[index]);
        field_labels[index]->setVisible(!labels[index].empty());
        field_entries[index]->setVisible(!labels[index].empty());
    }
    const bool is_map = type == ContentResourceType::Map;
    preview_toggle->setVisible(is_map);
    if (!is_map)
    {
        preview_enabled = false;
        preview_toggle->setValue(false);
    }
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

ContentStoreError GuiContentEditor::refreshInbox()
{
    string selected_filename;
    const int previous_selection = inbox_selector->getSelectionIndex();
    if (previous_selection >= 0 && previous_selection < int(inbox_files.size()))
        selected_filename = inbox_files[previous_selection];
    inbox_selector->clear();
    inbox_files.clear();
    const auto result = store.listInbox(inbox_files);
    if (result != ContentStoreError::None)
    {
        setStatus(storeErrorText(result));
        return result;
    }
    for (const auto& filename : inbox_files)
        inbox_selector->addEntry(filename, filename);
    int selection = inbox_files.empty() ? -1 : 0;
    for (int index = 0; index < int(inbox_files.size()); ++index)
        if (inbox_files[index] == selected_filename) selection = index;
    inbox_selector->setSelectionIndex(selection);
    return ContentStoreError::None;
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
    pending_file_import = "";
    pending_file_export = "";
    discard_guard.reset();
    id_entry->setText("");
    name_entry->setText("");
    description_entry->setText("");
    primary_entry->setText("");
    secondary_entry->setText("");
    tertiary_entry->setText("");
    quaternary_entry->setText("");
    quinary_entry->setText("");
    clean_snapshot = ContentResource{};
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
        updateFieldPresentation(resource.type);
        refreshList();
    }
    id_entry->setText(resource.id);
    name_entry->setText(resource.name);
    description_entry->setText(resource.description);
    primary_entry->setText(resource.primary);
    secondary_entry->setText(resource.secondary);
    tertiary_entry->setText(resource.tertiary);
    quaternary_entry->setText(resource.quaternary);
    quinary_entry->setText(resource.quinary);
    clean_snapshot = resource;
    pending_import = "";
    pending_save = "";
    pending_delete_key = "";
    pending_file_export = "";
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
    ContentResource resource;
    resource.type = current_type;
    resource.id = id_entry->getText();
    resource.name = name_entry->getText();
    resource.description = description_entry->getText();
    resource.primary = primary_entry->getText();
    resource.secondary = secondary_entry->getText();
    resource.tertiary = tertiary_entry->getText();
    resource.quaternary = quaternary_entry->getText();
    resource.quinary = quinary_entry->getText();
    if (current_type == ContentResourceType::Map && clean_snapshot.type == ContentResourceType::Map)
        resource.map_document = clean_snapshot.map_document;
    return resource;
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

    auto candidate = resources;
    int target_index = selected_index;
    string success;
    if (replacing_other)
    {
        candidate[existing] = resource;
        if (selected)
        {
            const int original = selected_index;
            candidate.erase(candidate.begin() + original);
            if (original < existing) --existing;
        }
        target_index = existing;
        success = tr("content_editor", "Resource replaced after confirmation.");
    }
    else if (selected)
    {
        candidate[selected_index] = resource;
        target_index = selected_index;
        success = tr("content_editor", "Resource updated.");
    }
    else
    {
        candidate.push_back(resource);
        target_index = int(candidate.size()) - 1;
        success = tr("content_editor", "Resource created.");
    }
    const auto library_error = validateContentLibrary(candidate);
    if (library_error != ContentResourceError::None) return setStatus(errorText(library_error));
    const auto store_error = store.save(candidate);
    if (store_error != ContentStoreError::None) return setStatus(storeErrorText(store_error));
    resources = std::move(candidate);
    selected_index = target_index;
    clean_snapshot = resource;
    pending_import = "";
    pending_save = "";
    pending_delete_key = "";
    pending_file_export = "";
    discard_guard.reset();
    refreshList();
    setStatus(success);
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
    auto candidate = resources;
    candidate.erase(candidate.begin() + selected_index);
    const auto library_error = validateContentLibrary(candidate);
    if (library_error != ContentResourceError::None) return setStatus(errorText(library_error));
    const auto store_error = store.save(candidate);
    if (store_error != ContentStoreError::None) return setStatus(storeErrorText(store_error));
    resources = std::move(candidate);
    clearForm();
    refreshList();
    setStatus(tr("content_editor", "Resource deleted."));
}

void GuiContentEditor::exportToClipboard()
{
    auto resource = formResource();
    auto error = validateContentResource(resource);
    if (error != ContentResourceError::None) return setStatus(errorText(error));
    Clipboard::setClipboard(serializeContentResourceExport(resource, resources, 2));
    setStatus(contentResourceHasMissingDependencies(resource, resources)
        ? tr("content_editor", "Resource exported with missing dependencies listed in its manifest.")
        : tr("content_editor", "Resource exported to the clipboard with its dependency manifest."));
}

void GuiContentEditor::importFromClipboard()
{
    const string input = Clipboard::readClipboard();
    ContentResource resource;
    const auto error = parseContentResource(input, resource);
    if (error != ContentResourceError::None) return setStatus(errorText(error));
    applyImportedResource(resource, "clipboard:" + input);
}

bool GuiContentEditor::applyImportedResource(const ContentResource& resource, const string& import_key)
{
    int existing = findResource(resource.type, resource.id);
    const bool replacing = existing >= 0;
    if (replacing && pending_import != import_key)
    {
        pending_import = import_key;
        setStatus(tr("content_editor", "This ID already exists. Repeat the import action to replace it."));
        return false;
    }
    if (!confirmDiscard("import:" + import_key)) return false;

    auto candidate = resources;
    if (replacing)
        candidate[existing] = resource;
    else
    {
        candidate.push_back(resource);
        existing = int(candidate.size()) - 1;
    }
    const auto library_error = validateContentLibrary(candidate);
    if (library_error != ContentResourceError::None)
    {
        setStatus(errorText(library_error));
        return false;
    }
    const auto store_error = store.save(candidate);
    if (store_error != ContentStoreError::None)
    {
        setStatus(storeErrorText(store_error));
        return false;
    }
    resources = std::move(candidate);
    selected_index = existing;
    current_type = resource.type;
    type_selector->setSelectionIndex(static_cast<int>(resource.type));
    updateFieldPresentation(resource.type);
    refreshList();
    loadResource(selected_index);
    pending_import = "";
    pending_save = "";
    setStatus(replacing
        ? tr("content_editor", "Imported resource replaced after confirmation.")
        : tr("content_editor", "Resource imported."));
    return true;
}

void GuiContentEditor::exportToManagedFile()
{
    const auto resource = formResource();
    const auto validation_error = validateContentResource(resource);
    if (validation_error != ContentResourceError::None) return setStatus(errorText(validation_error));
    const string signature = serializeContentResource(resource);
    const bool overwrite = pending_file_export == signature;
    std::string filename;
    const auto result = store.exportResource(resource, resources, overwrite, filename);
    if (result == ContentStoreError::AlreadyExists)
    {
        pending_file_export = signature;
        return setStatus(tr("content_editor", "Export file already exists. Press Export file again to replace it."));
    }
    if (result != ContentStoreError::None) return setStatus(storeErrorText(result));
    pending_file_export = "";
    setStatus(contentResourceHasMissingDependencies(resource, resources)
        ? tr("content_editor", "Resource exported with missing dependencies listed in its manifest.")
        : tr("content_editor", "Resource exported to managed file with its dependency manifest: {filename}")
            .format({{"filename", filename}}));
}

void GuiContentEditor::importFromManagedFile()
{
    if (refreshInbox() != ContentStoreError::None) return;
    const int selection = inbox_selector->getSelectionIndex();
    if (selection < 0 || selection >= int(inbox_files.size()))
        return setStatus(tr("content_editor", "No managed import files are available."));
    const auto& filename = inbox_files[selection];
    ContentResource resource;
    const auto result = store.importFromInbox(filename, resource);
    if (result != ContentStoreError::None)
    {
        refreshInbox();
        return setStatus(storeErrorText(result));
    }
    const string preview_key = filename + "\n" + serializeContentResource(resource);
    if (pending_file_import != preview_key)
    {
        pending_file_import = preview_key;
        return setStatus(tr("content_editor", "Import preview: {type} {id} from {filename}. Press Import file again.")
            .format({{"type", typeLabel(resource.type)}, {"id", resource.id}, {"filename", filename}}));
    }
    if (applyImportedResource(resource, "file:" + preview_key))
    {
        pending_file_import = "";
        refreshInbox();
    }
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
        return tr("content_editor", "Campaign map IDs or starting map are invalid.");
    case ContentResourceError::InvalidCampaignReferences:
        return tr("content_editor", "Campaign character or ship IDs are invalid.");
    case ContentResourceError::InvalidCampaignTransitions:
        return tr("content_editor", "Campaign transitions must use map-id>map-id and reference campaign maps.");
    case ContentResourceError::CampaignTransitionCycle:
        return tr("content_editor", "Campaign transitions contain a cycle.");
    case ContentResourceError::InvalidCrewPosition:
        return tr("content_editor", "Crew position must use a canonical game identifier.");
    case ContentResourceError::InvalidCharacterTags:
        return tr("content_editor", "Character tags must be unique lowercase IDs.");
    case ContentResourceError::InvalidCharacterShipId:
        return tr("content_editor", "Character ship ID is invalid.");
    case ContentResourceError::MissingDependency:
        return tr("content_editor", "A referenced map, character or ship is missing from the library.");
    case ContentResourceError::UnsafeScenarioFile:
        return tr("content_editor", "Scenario file must be a safe scenario_*.lua filename.");
    case ContentResourceError::InvalidPlayerCount:
        return tr("content_editor", "Recommended player count must be between 1 and 64.");
    case ContentResourceError::InvalidMapDocument:
        return tr("content_editor", "Imported document has invalid type-specific fields.");
    }
    return tr("content_editor", "Clipboard does not contain valid content JSON.");
}

string GuiContentEditor::storeErrorText(ContentStoreError error) const
{
    switch(error)
    {
    case ContentStoreError::None: return "";
    case ContentStoreError::NotConfigured:
        return tr("content_editor", "Private content storage is not configured.");
    case ContentStoreError::InvalidRoot:
        return tr("content_editor", "Private content storage has an invalid managed directory.");
    case ContentStoreError::SymlinkRejected:
        return tr("content_editor", "A symbolic link was rejected inside managed content storage.");
    case ContentStoreError::NotRegularFile:
        return tr("content_editor", "Managed content entry is not a regular file.");
    case ContentStoreError::NotFound:
        return tr("content_editor", "Managed content file was not found.");
    case ContentStoreError::InvalidFilename:
        return tr("content_editor", "Managed import filename is invalid.");
    case ContentStoreError::FileTooLarge:
        return tr("content_editor", "Managed content file exceeds the allowed size.");
    case ContentStoreError::InvalidData:
        return tr("content_editor", "Managed content file is invalid.");
    case ContentStoreError::DuplicateResource:
        return tr("content_editor", "Private library contains a duplicate type and ID.");
    case ContentStoreError::FutureVersion:
        return tr("content_editor", "Private library was created by a newer version and was not changed.");
    case ContentStoreError::PermissionDenied:
        return tr("content_editor", "Private library could not be written because permission was denied.");
    case ContentStoreError::NoSpace:
        return tr("content_editor", "Private library could not be written because storage is full.");
    case ContentStoreError::IoError:
        return tr("content_editor", "Private library I/O failed; the previous committed data was kept.");
    case ContentStoreError::AlreadyExists:
        return tr("content_editor", "Managed export already exists.");
    case ContentStoreError::Interrupted:
        return tr("content_editor", "Private library commit was interrupted and will be recovered on next load.");
    }
    return tr("content_editor", "Private library I/O failed; the previous committed data was kept.");
}

void GuiContentEditor::setStatus(const string& text)
{
    status_label->setText(text);
}
