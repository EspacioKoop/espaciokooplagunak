#pragma once

#include "gui/gui2_overlay.h"
#include "stringImproved.h"
#include <vector>

class GuiLabel;
class GuiListbox;
class GuiSelector;
class GuiTextEntry;

enum class ContentResourceType
{
    Campaign,
    Map,
    Character,
    Ship,
};

struct ContentResource
{
    ContentResourceType type = ContentResourceType::Campaign;
    string id;
    string name;
    string description;
    string primary;
    string secondary;
};

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
    int selected_index = -1;
    string pending_import;
    string pending_delete_key;

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

    void setType(ContentResourceType type);
    void refreshList();
    void clearForm();
    void loadResource(int index);
    ContentResource formResource() const;
    void saveResource();
    void deleteResource();
    void exportResource();
    void importResource();
    int findResource(ContentResourceType type, const string& id) const;
    void setStatus(const string& text);
};
