#pragma once

#include "content/contentLibraryStore.h"
#include "content/shipEditSession.h"
#include "gui/gui2_overlay.h"
#include "stringImproved.h"
#include <vector>

class GuiLabel;
class GuiButton;
class GuiListbox;
class GuiSelector;
class GuiTextEntry;
class GuiToggleButton;

class GuiContentEditor : public GuiOverlay
{
public:
    explicit GuiContentEditor(GuiContainer* owner);

    const MapDocument* previewDocument() const;

    virtual bool onMouseDown(
        sp::io::Pointer::Button button,
        glm::vec2 position,
        sp::io::Pointer::ID id
    ) override;

private:
    ContentLibraryStore store;
    std::vector<ContentResource> resources;
    std::vector<int> visible_indices;
    std::vector<std::string> inbox_files;
    ContentResourceType current_type = ContentResourceType::Campaign;
    ContentResource clean_snapshot;
    int selected_index = -1;
    string pending_import;
    string pending_save;
    string pending_delete_key;
    string pending_file_import;
    string pending_file_export;
    ContentDiscardGuard discard_guard;
    ShipEditSession ship_edit_session;
    bool preview_enabled = false;

    GuiSelector* type_selector;
    GuiSelector* inbox_selector;
    GuiListbox* resource_list;
    GuiTextEntry* id_entry;
    GuiTextEntry* name_entry;
    GuiTextEntry* description_entry;
    GuiLabel* primary_label;
    GuiTextEntry* primary_entry;
    GuiLabel* secondary_label;
    GuiTextEntry* secondary_entry;
    GuiLabel* tertiary_label;
    GuiTextEntry* tertiary_entry;
    GuiLabel* quaternary_label;
    GuiTextEntry* quaternary_entry;
    GuiLabel* quinary_label;
    GuiTextEntry* quinary_entry;
    GuiLabel* status_label;
    GuiToggleButton* preview_toggle;
    GuiLabel* preview_status_label;
    GuiLabel* ship_system_label;
    GuiSelector* ship_system_selector;
    GuiLabel* ship_health_label;
    GuiTextEntry* ship_health_entry;
    GuiButton* ship_set_system_button;
    GuiButton* ship_remove_system_button;
    GuiButton* ship_undo_button;
    GuiButton* ship_redo_button;

    void requestSetType(ContentResourceType type);
    void setType(ContentResourceType type);
    void updateFieldPresentation(ContentResourceType type);
    void refreshList();
    ContentStoreError refreshInbox();
    void syncListSelection();
    void requestClearForm();
    void clearForm();
    void requestLoadResource(int index);
    void loadResource(int index);
    void requestClose();
    ContentResource formResource() const;
    bool isFormDirty() const;
    bool confirmDiscard(const string& action);
    void saveResource();
    void deleteResource();
    void exportToClipboard();
    void importFromClipboard();
    void exportToManagedFile();
    void importFromManagedFile();
    bool applyImportedResource(const ContentResource& resource, const string& import_key);
    int findResource(ContentResourceType type, const string& id) const;
    string errorText(ContentResourceError error) const;
    string storeErrorText(ContentStoreError error) const;
    void setStatus(const string& text);
    void updatePreviewStatus();
    void updateShipSystemEditor();
    void setShipSystemOverride();
    void removeShipSystemOverride();
    void undoShipEdit();
    void redoShipEdit();
};
