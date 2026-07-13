#pragma once

#include "content/contentResource.h"
#include "gui/gui2_overlay.h"
#include "stringImproved.h"
#include <vector>

class GuiLabel;
class GuiListbox;
class GuiSelector;
class GuiTextEntry;

class GuiContentEditor : public GuiOverlay
{
public:
    explicit GuiContentEditor(GuiContainer* owner);

    virtual bool onMouseDown(
        sp::io::Pointer::Button button,
        glm::vec2 position,
        sp::io::Pointer::ID id
    ) override;

private:
    std::vector<ContentResource> resources;
    std::vector<int> visible_indices;
    ContentResourceType current_type = ContentResourceType::Campaign;
    ContentResource clean_snapshot;
    int selected_index = -1;
    string pending_import;
    string pending_save;
    string pending_delete_key;
    ContentDiscardGuard discard_guard;

    GuiSelector* type_selector;
    GuiListbox* resource_list;
    GuiTextEntry* id_entry;
    GuiTextEntry* name_entry;
    GuiTextEntry* description_entry;
    GuiLabel* primary_label;
    GuiTextEntry* primary_entry;
    GuiLabel* secondary_label;
    GuiTextEntry* secondary_entry;
    GuiLabel* status_label;

    void requestSetType(ContentResourceType type);
    void setType(ContentResourceType type);
    void refreshList();
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
    void exportResource();
    void importResource();
    int findResource(ContentResourceType type, const string& id) const;
    string errorText(ContentResourceError error) const;
    void setStatus(const string& text);
};
