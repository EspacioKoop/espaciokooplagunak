#pragma once

#include "content/contentLibraryStore.h"
#include "content/shipEditSession.h"
#include "content/shipTemplateCatalog.h"
#include "gui/gui2_overlay.h"
#include "stringImproved.h"
#include <vector>

class GuiLabel;
class GuiButton;
class GuiListbox;
class GuiSelector;
class GuiTextEntry;
class GuiToggleButton;
class GuiRotatingModelView;

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
    enum class RelationEditorMode
    {
        CampaignMaps,
        CampaignStartingMap,
        CampaignCharacters,
        CampaignShips,
        CampaignTransitions,
        CharacterCrewPosition,
        CharacterShip,
    };

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
    ContentDiscardGuard rename_guard;
    ShipEditSession ship_edit_session;
    std::vector<ShipTemplateCatalogEntry> ship_template_catalog;
    std::vector<std::size_t> visible_ship_template_indices;
    bool preview_enabled = false;

    GuiSelector* type_selector;
    GuiSelector* inbox_selector;
    GuiListbox* resource_list;
    GuiTextEntry* id_entry;
    GuiTextEntry* name_entry;
    GuiTextEntry* description_entry;
    GuiLabel* primary_label;
    GuiTextEntry* primary_entry;
    GuiButton* ship_template_picker_button;
    GuiOverlay* ship_template_picker_overlay;
    GuiTextEntry* ship_template_search_entry;
    GuiListbox* ship_template_list;
    GuiLabel* ship_template_picker_status;
    GuiRotatingModelView* ship_template_model_view;
    GuiLabel* ship_template_preview_status;
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
    GuiSelector* ship_override_selector;
    GuiSelector* ship_system_selector;
    GuiSelector* ship_crew_selector;
    GuiLabel* ship_health_label;
    GuiTextEntry* ship_health_entry;
    GuiTextEntry* ship_resource_id_entry = nullptr;
    GuiLabel* ship_resource_amount_label;
    GuiTextEntry* ship_resource_amount_entry;
    GuiButton* ship_set_system_button;
    GuiButton* ship_remove_system_button;
    GuiButton* ship_undo_button;
    GuiButton* ship_redo_button;
    GuiButton* relation_edit_buttons[5]{};
    GuiOverlay* relation_editor_overlay;
    GuiLabel* relation_editor_title;
    GuiSelector* relation_candidate_selector;
    GuiSelector* relation_destination_selector;
    GuiListbox* relation_current_list;
    GuiButton* relation_apply_button;
    GuiButton* relation_clear_button;
    GuiButton* relation_remove_button;
    GuiButton* relation_up_button;
    GuiButton* relation_down_button;
    RelationEditorMode relation_editor_mode = RelationEditorMode::CampaignMaps;

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
    string renameErrorText(ContentRenameError error) const;
    string storeErrorText(ContentStoreError error) const;
    void setStatus(const string& text);
    void updatePreviewStatus();
    void openShipTemplatePicker();
    void refreshShipTemplatePicker();
    void refreshShipTemplatePreview();
    void clearShipTemplatePreview();
    void closeShipTemplatePicker();
    void useSelectedShipTemplate();
    void updateShipOverrideEditor();
    void setShipOverride();
    void removeShipOverride();
    void undoShipEdit();
    void redoShipEdit();
    void openRelationEditor(RelationEditorMode mode);
    void closeRelationEditor();
    void refreshRelationEditor();
    void applyRelationSelection();
    void clearRelationSelection();
    void removeRelationSelection();
    void moveRelationSelection(int direction);
    void applyRelationResource(const ContentResource& resource);
};
