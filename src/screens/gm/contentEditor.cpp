#include "contentEditor.h"
#include "clipboard.h"
#include "content/mapPreview.h"
#include "components/rendering.h"
#include "gameGlobalInfo.h"
#include "multiplayer_server.h"
#include "ecs/query.h"
#include "components/faction.h"
#include "i18n.h"
#include "playerInfo.h"
#include "screenComponents/rotatingModelView.h"
#include "gui/gui2_button.h"
#include "gui/gui2_label.h"
#include "gui/gui2_listbox.h"
#include "gui/gui2_panel.h"
#include "gui/gui2_selector.h"
#include "gui/gui2_textentry.h"
#include "gui/gui2_togglebutton.h"

#include <array>
#include <cerrno>
#include <cmath>
#include <cstdlib>
#include <iomanip>
#include <limits>
#include <sstream>
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
            tr("content_editor", "Maps (ordered)"),
            tr("content_editor", "Starting map"),
            tr("content_editor", "Characters"),
            tr("content_editor", "Ships"),
            tr("content_editor", "Map transitions"),
        };
    case ContentResourceType::Map:
        return {tr("content_editor", "Scenario file"), tr("content_editor", "Recommended player count"), "", "", ""};
    case ContentResourceType::Character:
        return {
            tr("content_editor", "Crew position"), tr("content_editor", "Callsign"),
            tr("content_editor", "Tags (comma separated)"), tr("content_editor", "Ship (optional)"),
            tr("content_editor", "Legacy role (clear after assigning a crew position)"),
        };
    case ContentResourceType::Ship:
        return {tr("content_editor", "Ship template"), tr("content_editor", "Faction"), "", "", ""};
    }
    return {"", "", "", "", ""};
}

string shipSystemLabel(ShipSystemId system)
{
    switch(system)
    {
    case ShipSystemId::Reactor: return tr("content_editor", "Reactor");
    case ShipSystemId::BeamWeapons: return tr("content_editor", "Beam weapons");
    case ShipSystemId::MissileSystem: return tr("content_editor", "Missile system");
    case ShipSystemId::Maneuver: return tr("content_editor", "Maneuvering");
    case ShipSystemId::Impulse: return tr("content_editor", "Impulse");
    case ShipSystemId::Warp: return tr("content_editor", "Warp");
    case ShipSystemId::JumpDrive: return tr("content_editor", "Jump drive");
    case ShipSystemId::FrontShield: return tr("content_editor", "Front shield");
    case ShipSystemId::RearShield: return tr("content_editor", "Rear shield");
    case ShipSystemId::Count: break;
    }
    return "";
}

bool parseShipHealth(const string& input, float& output)
{
    const std::string text = input;
    if (text.empty()) return false;
    char* end = nullptr;
    errno = 0;
    const float value = std::strtof(text.c_str(), &end);
    if (errno == ERANGE || end == text.c_str() || *end != '\0' || !std::isfinite(value))
        return false;
    output = value;
    return true;
}

bool parseShipCargoQuantity(const string& input, std::uint32_t& output)
{
    const std::string text = input;
    if (text.empty() || text.front() < '0' || text.front() > '9') return false;
    char* end = nullptr;
    errno = 0;
    const auto value = std::strtoull(text.c_str(), &end, 10);
    if (errno == ERANGE || end == text.c_str() || *end != '\0'
        || value > std::numeric_limits<std::uint32_t>::max())
        return false;
    output = static_cast<std::uint32_t>(value);
    return true;
}

string formatShipHealth(float value)
{
    std::ostringstream stream;
    stream << std::fixed << std::setprecision(3) << value;
    auto text = stream.str();
    while (!text.empty() && text.back() == '0') text.pop_back();
    if (!text.empty() && text.back() == '.') text.pop_back();
    return text;
}

std::vector<std::string> relationItems(const string& value)
{
    std::vector<std::string> items;
    std::stringstream stream{std::string(value)};
    std::string item;
    while (std::getline(stream, item, ','))
    {
        const auto first = item.find_first_not_of(" \t");
        if (first == std::string::npos) continue;
        item = item.substr(first, item.find_last_not_of(" \t") - first + 1);
        items.push_back(std::move(item));
    }
    return items;
}

string relationResourceLabel(const ContentResource& resource)
{
    return resource.name == resource.id
        ? string(resource.id)
        : string(resource.name) + " - " + string(resource.id);
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
    ship_template_picker_button = new GuiButton(
        box,
        "SHIP_TEMPLATE_PICKER_OPEN",
        tr("content_editor", "Choose template"),
        [this]() { openShipTemplatePicker(); }
    );
    ship_template_picker_button->setPosition(x + 545, 280)->setSize(145, 30)->hide();

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

    const std::array<RelationEditorMode, 5> campaign_modes = {
        RelationEditorMode::CampaignMaps,
        RelationEditorMode::CampaignStartingMap,
        RelationEditorMode::CampaignCharacters,
        RelationEditorMode::CampaignShips,
        RelationEditorMode::CampaignTransitions,
    };
    for (std::size_t index = 0; index < campaign_modes.size(); ++index)
    {
        relation_edit_buttons[index] = new GuiButton(
            box, "RELATION_EDIT_" + string(static_cast<unsigned int>(index)),
            tr("content_editor", "Select"),
            [this, index, mode = campaign_modes[index]]() {
                if (current_type == ContentResourceType::Character && index == 0)
                    openRelationEditor(RelationEditorMode::CharacterCrewPosition);
                else if (current_type == ContentResourceType::Character && index == 3)
                    openRelationEditor(RelationEditorMode::CharacterShip);
                else
                    openRelationEditor(mode);
            });
        relation_edit_buttons[index]->setPosition(x + 545, 280 + 40 * index)
            ->setSize(145, 30)->hide();
    }

    preview_toggle = new GuiToggleButton(
        box,
        "MAP_PREVIEW",
        tr("content_editor", "Preview on radar"),
        [this](bool value) { preview_enabled = value; }
    );
    preview_toggle->setPosition(x, 360)->setSize(250, 40)->hide();
    preview_status_label = new GuiLabel(box, "MAP_PREVIEW_STATUS", "", 16);
    preview_status_label->setPosition(x + 270, 360)->setSize(420, 40)->hide();

    ship_override_selector = new GuiSelector(box, "SHIP_OVERRIDE_MODE", [this](int, string value) {
        if (ship_resource_id_entry)
        {
            string id = "";
            if (value == "resources" && !ship_edit_session.document().resources.empty())
                id = ship_edit_session.document().resources.front().id;
            else if (value == "cargo" && !ship_edit_session.document().cargo.empty())
                id = ship_edit_session.document().cargo.front().id;
            ship_resource_id_entry->setText(id);
        }
        updateShipOverrideEditor();
    });
    ship_override_selector->addEntry(tr("content_editor", "Systems"), "systems");
    ship_override_selector->addEntry(tr("content_editor", "Resources"), "resources");
    ship_override_selector->addEntry(tr("content_editor", "Cargo"), "cargo");
    ship_override_selector->addEntry(tr("content_editor", "Crew positions"), "crew");
    ship_override_selector->setSelectionIndex(0)->setPosition(x, 360)->setSize(170, 35)->hide();

    ship_system_selector = new GuiSelector(box, "SHIP_SYSTEM", [this](int, string) {
        updateShipOverrideEditor();
    });
    for (int index = 0; index < static_cast<int>(ShipSystemId::Count); ++index)
    {
        const auto system = static_cast<ShipSystemId>(index);
        ship_system_selector->addEntry(shipSystemLabel(system), shipSystemId(system));
    }
    ship_system_selector->setSelectionIndex(0)->setPosition(x + 180, 360)->setSize(240, 35)->hide();

    ship_crew_selector = new GuiSelector(box, "SHIP_CREW_POSITION", [this](int, string) {
        updateShipOverrideEditor();
    });
    for (int index = 0; index < static_cast<int>(CrewPosition::MAX); ++index)
    {
        const auto position = static_cast<CrewPosition>(index);
        ship_crew_selector->addEntry(getCrewPositionName(position), crewPositionToString(position));
    }
    ship_crew_selector->setSelectionIndex(0)->setPosition(x + 180, 360)->setSize(240, 35)->hide();

    ship_health_label = new GuiLabel(box, "SHIP_HEALTH_LABEL", tr("content_editor", "Health [-1, 1]"), 18);
    ship_health_label->setPosition(x + 430, 360)->setSize(130, 35)->hide();
    ship_health_entry = new GuiTextEntry(box, "SHIP_HEALTH", "");
    ship_health_entry->setSelectOnFocus()->setPosition(x + 565, 360)->setSize(125, 35)->hide();

    ship_resource_id_entry = new GuiTextEntry(box, "SHIP_RESOURCE_ID", "");
    ship_resource_id_entry->callback([this](string) { updateShipOverrideEditor(); });
    ship_resource_id_entry->setSelectOnFocus()->setPosition(x + 180, 360)->setSize(240, 35)->hide();
    ship_resource_amount_label = new GuiLabel(box, "SHIP_RESOURCE_AMOUNT_LABEL", tr("content_editor", "Amount"), 18);
    ship_resource_amount_label->setPosition(x + 430, 360)->setSize(130, 35)->hide();
    ship_resource_amount_entry = new GuiTextEntry(box, "SHIP_RESOURCE_AMOUNT", "");
    ship_resource_amount_entry->setSelectOnFocus()->setPosition(x + 565, 360)->setSize(125, 35)->hide();

    ship_set_system_button = new GuiButton(box, "SHIP_SET_OVERRIDE", tr("content_editor", "Set system"), [this]() {
        setShipOverride();
    });
    ship_set_system_button->setPosition(x, 400)->setSize(220, 35)->hide();
    ship_remove_system_button = new GuiButton(box, "SHIP_REMOVE_OVERRIDE", tr("content_editor", "Remove override"), [this]() {
        removeShipOverride();
    });
    ship_remove_system_button->setPosition(x + 235, 400)->setSize(220, 35)->hide();
    ship_undo_button = new GuiButton(box, "SHIP_UNDO", tr("content_editor", "Undo"), [this]() {
        undoShipEdit();
    });
    ship_undo_button->setPosition(x, 445)->setSize(220, 35)->hide();
    ship_redo_button = new GuiButton(box, "SHIP_REDO", tr("content_editor", "Redo"), [this]() {
        redoShipEdit();
    });
    ship_redo_button->setPosition(x + 235, 445)->setSize(220, 35)->hide();
    ship_deploy_button = new GuiButton(box, "SHIP_DEPLOY", tr("content_editor", "Deploy ship"), [this]() {
        deployShip();
    });
    ship_deploy_button->setPosition(x + 470, 400)->setSize(220, 35)->hide();
    ship_rollback_button = new GuiButton(box, "SHIP_ROLLBACK", tr("content_editor", "Rollback ship"), [this]() {
        rollbackShip();
    });
    ship_rollback_button->setPosition(x + 470, 445)->setSize(220, 35)->hide();

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

    ship_template_picker_overlay = new GuiOverlay(
        box, "SHIP_TEMPLATE_PICKER_OVERLAY", glm::u8vec4(0, 0, 0, 180));
    auto picker_panel = new GuiPanel(ship_template_picker_overlay, "SHIP_TEMPLATE_PICKER");
    picker_panel->setPosition(0, 0, sp::Alignment::Center)->setSize(760, 560);
    (new GuiLabel(
        picker_panel,
        "SHIP_TEMPLATE_PICKER_TITLE",
        tr("content_editor", "Choose ship template"),
        28
    ))->setPosition(30, 20)->setSize(700, 45);
    (new GuiLabel(
        picker_panel,
        "SHIP_TEMPLATE_SEARCH_LABEL",
        tr("content_editor", "Search"),
        18
    ))->setPosition(30, 75)->setSize(120, 35);
    ship_template_search_entry = new GuiTextEntry(picker_panel, "SHIP_TEMPLATE_SEARCH", "");
    ship_template_search_entry->callback([this](string) { refreshShipTemplatePicker(); });
    ship_template_search_entry->setSelectOnFocus()->setPosition(150, 75)->setSize(580, 35);
    ship_template_model_view = new GuiRotatingModelView(
        picker_panel, "SHIP_TEMPLATE_MODEL_PREVIEW");
    ship_template_model_view->setPosition(450, 125)->setSize(280, 260)->hide();
    ship_template_preview_status = new GuiLabel(
        picker_panel, "SHIP_TEMPLATE_PREVIEW_STATUS", "", 16);
    ship_template_preview_status->setPosition(450, 395)->setSize(280, 40);
    ship_template_list = new GuiListbox(
        picker_panel,
        "SHIP_TEMPLATE_LIST",
        [this](int, string) { refreshShipTemplatePreview(); }
    );
    ship_template_list->setTextSize(20)->setButtonHeight(38)->setPosition(30, 125)->setSize(400, 310);
    ship_template_picker_status = new GuiLabel(picker_panel, "SHIP_TEMPLATE_PICKER_STATUS", "", 17);
    ship_template_picker_status->setPosition(30, 445)->setSize(400, 35);
    (new GuiButton(
        picker_panel,
        "SHIP_TEMPLATE_USE",
        tr("content_editor", "Use template"),
        [this]() { useSelectedShipTemplate(); }
    ))->setPosition(190, 495)->setSize(180, 40);
    (new GuiButton(
        picker_panel,
        "SHIP_TEMPLATE_CANCEL",
        tr("button", "Close"),
        [this]() { closeShipTemplatePicker(); }
    ))->setPosition(390, 495)->setSize(180, 40);
    ship_template_picker_overlay->hide();

    relation_editor_overlay = new GuiOverlay(
        box, "RELATION_EDITOR_OVERLAY", glm::u8vec4(0, 0, 0, 180));
    auto relation_panel = new GuiPanel(relation_editor_overlay, "RELATION_EDITOR_PANEL");
    relation_panel->setPosition(0, 0, sp::Alignment::Center)->setSize(760, 560);
    relation_editor_title = new GuiLabel(relation_panel, "RELATION_EDITOR_TITLE", "", 28);
    relation_editor_title->setPosition(30, 20)->setSize(700, 45);
    relation_candidate_selector = new GuiSelector(
        relation_panel, "RELATION_CANDIDATE", [](int, string) {});
    relation_candidate_selector->setTextSize(20)->setPosition(30, 80)->setSize(330, 40);
    relation_destination_selector = new GuiSelector(
        relation_panel, "RELATION_DESTINATION", [](int, string) {});
    relation_destination_selector->setTextSize(20)->setPosition(380, 80)->setSize(350, 40);
    relation_apply_button = new GuiButton(
        relation_panel, "RELATION_APPLY", tr("content_editor", "Add selection"),
        [this]() { applyRelationSelection(); });
    relation_apply_button->setPosition(30, 135)->setSize(220, 40);
    relation_clear_button = new GuiButton(
        relation_panel, "RELATION_CLEAR", tr("content_editor", "Clear selection"),
        [this]() { clearRelationSelection(); });
    relation_clear_button->setPosition(270, 135)->setSize(220, 40);
    relation_current_list = new GuiListbox(
        relation_panel, "RELATION_CURRENT", [](int, string) {});
    relation_current_list->setTextSize(20)->setButtonHeight(36)
        ->setPosition(30, 190)->setSize(700, 255);
    relation_remove_button = new GuiButton(
        relation_panel, "RELATION_REMOVE", tr("content_editor", "Remove"),
        [this]() { removeRelationSelection(); });
    relation_remove_button->setPosition(30, 460)->setSize(150, 40);
    relation_up_button = new GuiButton(
        relation_panel, "RELATION_UP", tr("content_editor", "Move up"),
        [this]() { moveRelationSelection(-1); });
    relation_up_button->setPosition(195, 460)->setSize(150, 40);
    relation_down_button = new GuiButton(
        relation_panel, "RELATION_DOWN", tr("content_editor", "Move down"),
        [this]() { moveRelationSelection(1); });
    relation_down_button->setPosition(360, 460)->setSize(150, 40);
    (new GuiButton(
        relation_panel, "RELATION_CLOSE", tr("button", "Close"),
        [this]() { closeRelationEditor(); }))
        ->setPosition(550, 460)->setSize(180, 40);
    relation_editor_overlay->hide();

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
        const bool managed_campaign = type == ContentResourceType::Campaign;
        const bool managed_character = type == ContentResourceType::Character
            && (index == 0 || index == 3);
        const bool managed = managed_campaign || managed_character;
        field_entries[index]->setEnable(!managed);
        field_entries[index]->setSize(managed ? 340 : 500, 30);
        relation_edit_buttons[index]->setVisible(managed);
    }
    const bool is_map = type == ContentResourceType::Map;
    preview_toggle->setVisible(is_map);
    if (!is_map)
    {
        preview_enabled = false;
        preview_toggle->setValue(false);
    }
    const bool is_ship = type == ContentResourceType::Ship;
    const bool managed_primary = type == ContentResourceType::Campaign
        || type == ContentResourceType::Character;
    primary_entry->setSize((is_ship || managed_primary) ? 340 : 500, 30);
    ship_template_picker_button->setVisible(is_ship);
    ship_override_selector->setVisible(is_ship);
    ship_set_system_button->setVisible(is_ship);
    ship_remove_system_button->setVisible(is_ship);
    ship_undo_button->setVisible(is_ship);
    ship_redo_button->setVisible(is_ship);
    ship_deploy_button->setVisible(is_ship);
    ship_rollback_button->setVisible(is_ship && ship_deployment_session.hasActiveDeployment());
    if (is_ship)
        updateShipOverrideEditor();
    else
    {
        closeShipTemplatePicker();
        ship_system_selector->hide();
        ship_crew_selector->hide();
        ship_health_label->hide();
        ship_health_entry->hide();
        ship_resource_id_entry->hide();
        ship_resource_amount_label->hide();
        ship_resource_amount_entry->hide();
    }
    updatePreviewStatus();
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
    ship_edit_session = ShipEditSession{};
    ship_resource_id_entry->setText("");
    ship_resource_amount_entry->setText("");
    selected_index = -1;
    pending_import = "";
    pending_save = "";
    pending_delete_key = "";
    pending_file_import = "";
    pending_file_export = "";
    discard_guard.reset();
    rename_guard.reset();
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
    updateShipOverrideEditor();
    updatePreviewStatus();
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
    ship_edit_session = resource.type == ContentResourceType::Ship
        ? ShipEditSession(resource.ship_document)
        : ShipEditSession{};
    string selected_ship_item = "";
    if (resource.type == ContentResourceType::Ship)
    {
        const auto mode = ship_override_selector->getSelectionValue();
        if (mode == "resources" && !resource.ship_document.resources.empty())
            selected_ship_item = resource.ship_document.resources.front().id;
        else if (mode == "cargo" && !resource.ship_document.cargo.empty())
            selected_ship_item = resource.ship_document.cargo.front().id;
    }
    ship_resource_id_entry->setText(selected_ship_item);
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
    updateShipOverrideEditor();
    updatePreviewStatus();
    pending_import = "";
    pending_save = "";
    pending_delete_key = "";
    pending_file_export = "";
    discard_guard.reset();
    rename_guard.reset();
    syncListSelection();
    setStatus(tr("content_editor", "Resource loaded."));
}

void GuiContentEditor::requestClose()
{
    if (confirmDiscard("close"))
    {
        closeShipTemplatePicker();
        hide();
    }
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
    if (current_type == ContentResourceType::Ship)
        resource.ship_document = ship_edit_session.document();
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
    if (resource.type == ContentResourceType::Ship && gameGlobalInfo)
    {
        const auto template_status = validateShipTemplateSelection(
            gameGlobalInfo->getShipTemplateCatalog(), resource.primary);
        if (template_status == ShipTemplateValidation::TemplateNotFound)
            return setStatus(tr("content_editor", "The ship template is not available in this scenario."));
        if (template_status == ShipTemplateValidation::ModelMissing)
            return setStatus(tr("content_editor", "The ship template references a missing 3D model."));
    }

    int existing = findResource(resource.type, resource.id);
    const bool selected = selected_index >= 0 && selected_index < int(resources.size());
    const bool renaming = selected
        && resources[selected_index].type == resource.type
        && resources[selected_index].id != resource.id;
    const bool replacing_other = existing >= 0 && existing != selected_index;
    const string save_signature = serializeContentResource(resource);
    if (!renaming) rename_guard.reset();

    auto candidate = resources;
    int target_index = selected_index;
    string success;
    bool already_persisted = false;
    if (renaming)
    {
        const auto original = resources[selected_index];
        const auto rename_error = renameContentResource(
            candidate, original.type, original.id, resource.id);
        if (rename_error != ContentRenameError::None)
        {
            rename_guard.reset();
            return setStatus(renameErrorText(rename_error));
        }
        const string rename_action = "rename:" + contentResourceTypeId(original.type)
            + ":" + original.id;
        if (!rename_guard.confirm(rename_action, resource, original))
        {
            return setStatus(tr("content_editor",
                "Changing this ID updates every reference. Press Save again to confirm."));
        }
        std::vector<ContentResource> reconciled;
        const auto rename_result = store.renameResource(original, resource, reconciled);
        if (!rename_result.ok())
        {
            if (rename_result.reconciled)
            {
                resources = std::move(reconciled);
                const auto& identity = rename_result.applied ? resource : original;
                const auto actual = std::find_if(
                    resources.begin(), resources.end(), [&](const ContentResource& item) {
                        return item.type == identity.type && item.id == identity.id;
                    });
                const int actual_index = actual == resources.end()
                    ? -1 : int(actual - resources.begin());
                refreshList();
                if (actual_index >= 0) loadResource(actual_index);
                else clearForm();
            }
            pending_save = "";
            if (rename_result.rename_error != ContentRenameError::None)
                return setStatus(renameErrorText(rename_result.rename_error));
            if (rename_result.reconciled && rename_result.applied)
                return setStatus(tr("content_editor",
                    "The rename was recovered after a storage error. Review the reloaded library."));
            return setStatus(storeErrorText(rename_result.store_error));
        }
        candidate = std::move(reconciled);
        const auto target = std::find_if(candidate.begin(), candidate.end(), [&](const ContentResource& item) {
            return item.type == resource.type && item.id == resource.id;
        });
        if (target == candidate.end())
            return setStatus(tr("content_editor", "The renamed resource could not be reloaded."));
        target_index = int(target - candidate.begin());
        already_persisted = true;
        success = tr("content_editor", "Resource renamed and references updated.");
    }
    else if (replacing_other)
    {
        if (pending_save != save_signature)
        {
            pending_save = save_signature;
            return setStatus(tr("content_editor", "This ID already exists. Press Save again to replace it."));
        }
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
    if (!already_persisted)
    {
        const auto store_error = store.save(candidate);
        if (store_error != ContentStoreError::None) return setStatus(storeErrorText(store_error));
    }
    resources = std::move(candidate);
    selected_index = target_index;
    clean_snapshot = resource;
    if (current_type == ContentResourceType::Ship) ship_edit_session.markSaved();
    updateShipOverrideEditor();
    updatePreviewStatus();
    pending_import = "";
    pending_save = "";
    pending_delete_key = "";
    pending_file_export = "";
    discard_guard.reset();
    rename_guard.reset();
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
    case ContentResourceError::InvalidShipDocument:
        return tr("content_editor", "Imported document has invalid type-specific fields.");
    }
    return tr("content_editor", "Clipboard does not contain valid content JSON.");
}

string GuiContentEditor::renameErrorText(ContentRenameError error) const
{
    switch(error)
    {
    case ContentRenameError::None: return "";
    case ContentRenameError::InvalidLibrary:
        return tr("content_editor", "The library is invalid and was not changed.");
    case ContentRenameError::InvalidType:
        return tr("content_editor", "The resource type is invalid.");
    case ContentRenameError::InvalidNewId:
        return tr("content_editor", "The new ID is invalid.");
    case ContentRenameError::SourceNotFound:
        return tr("content_editor", "The resource to rename no longer exists.");
    case ContentRenameError::SourceChanged:
        return tr("content_editor", "The resource changed on disk. The latest version was reloaded.");
    case ContentRenameError::TargetAlreadyExists:
        return tr("content_editor", "Another resource of this type already uses the new ID.");
    }
    return tr("content_editor", "The resource could not be renamed.");
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

void GuiContentEditor::updatePreviewStatus()
{
    const auto count = current_type == ContentResourceType::Map
        ? countUnsupportedMapPreviewObjects(clean_snapshot.map_document)
        : 0;
    preview_status_label->setVisible(count > 0);
    if (count > 0)
        preview_status_label->setText(
            tr("content_editor", "Omitted objects (preserved): {count}")
                .format({{"count", string(static_cast<unsigned int>(count))}})
        );
}

void GuiContentEditor::openShipTemplatePicker()
{
    ship_template_catalog = gameGlobalInfo
        ? gameGlobalInfo->getShipTemplateCatalog()
        : std::vector<ShipTemplateCatalogEntry>{};
    if (ship_template_catalog.empty())
    {
        setStatus(tr("content_editor", "No ship template catalog is available in this scenario."));
        return;
    }
    ship_template_search_entry->setText("");
    refreshShipTemplatePicker();
    ship_template_picker_overlay->show();
}

void GuiContentEditor::refreshShipTemplatePicker()
{
    if (!ship_template_list) return;
    visible_ship_template_indices = filterSelectableShipTemplates(
        ship_template_catalog, ship_template_search_entry->getText());
    ship_template_list->clear();
    int selection = -1;
    const std::string current_template = primary_entry->getText();
    for (std::size_t visible_index = 0;
         visible_index < visible_ship_template_indices.size();
         ++visible_index)
    {
        const auto catalog_index = visible_ship_template_indices[visible_index];
        const auto& entry = ship_template_catalog[catalog_index];
        string display_name = entry.label;
        if (entry.label != entry.canonical_id)
            display_name += " - " + string(entry.canonical_id);
        ship_template_list->addEntry(display_name, entry.canonical_id);
        if (entry.canonical_id == current_template)
            selection = static_cast<int>(visible_index);
    }
    if (selection < 0 && !visible_ship_template_indices.empty()) selection = 0;
    ship_template_list->setSelectionIndex(selection);
    if (selection >= 0) ship_template_list->scrollTo(selection);
    if (visible_ship_template_indices.empty())
        ship_template_picker_status->setText(tr("content_editor", "No matching ship templates."));
    else
        ship_template_picker_status->setText(
            string(static_cast<unsigned int>(visible_ship_template_indices.size())) + " "
            + tr("content_editor", "templates available"));
    refreshShipTemplatePreview();
}

void GuiContentEditor::refreshShipTemplatePreview()
{
    clearShipTemplatePreview();
    const int selection = ship_template_list->getSelectionIndex();
    if (selection < 0 || selection >= static_cast<int>(visible_ship_template_indices.size()))
    {
        ship_template_preview_status->setText(tr("content_editor", "3D preview unavailable."));
        return;
    }
    const auto catalog_index = visible_ship_template_indices[selection];
    if (!gameGlobalInfo || catalog_index >= ship_template_catalog.size())
    {
        ship_template_preview_status->setText(tr("content_editor", "3D preview unavailable."));
        return;
    }
    const auto preview = gameGlobalInfo->getShipTemplatePreview(
        ship_template_catalog[catalog_index].canonical_id);
    if (!isUsableShipTemplatePreview(preview))
    {
        ship_template_preview_status->setText(tr("content_editor", "3D preview unavailable."));
        return;
    }

    MeshRenderComponent render;
    render.mesh.name = preview.mesh;
    render.texture.name = preview.texture;
    render.specular_texture.name = preview.specular_texture;
    render.illumination_texture.name = preview.illumination_texture;
    render.normal_texture.name = preview.normal_texture;
    render.mesh_offset = {
        preview.mesh_offset_x, preview.mesh_offset_y, preview.mesh_offset_z};
    render.scale = preview.scale;
    ship_template_model_view->setModel(render)->show();
    ship_template_preview_status->setText(tr("content_editor", "Drag to rotate; wheel to zoom."));
}

void GuiContentEditor::clearShipTemplatePreview()
{
    if (ship_template_model_view) ship_template_model_view->clearModel()->hide();
    if (ship_template_preview_status) ship_template_preview_status->setText("");
}

void GuiContentEditor::closeShipTemplatePicker()
{
    clearShipTemplatePreview();
    if (ship_template_picker_overlay) ship_template_picker_overlay->hide();
}

void GuiContentEditor::useSelectedShipTemplate()
{
    const int selection = ship_template_list->getSelectionIndex();
    if (selection < 0 || selection >= static_cast<int>(visible_ship_template_indices.size()))
    {
        ship_template_picker_status->setText(tr("content_editor", "Select a ship template first."));
        return;
    }
    const auto catalog_index = visible_ship_template_indices[selection];
    primary_entry->setText(ship_template_catalog[catalog_index].canonical_id);
    closeShipTemplatePicker();
    setStatus(tr("content_editor", "Ship template selected."));
}

void GuiContentEditor::updateShipOverrideEditor()
{
    if (current_type != ContentResourceType::Ship) return;
    const auto mode = ship_override_selector->getSelectionValue();
    const bool resources = mode == "resources";
    const bool cargo = mode == "cargo";
    const bool crew = mode == "crew";
    const bool items = resources || cargo;
    const bool systems = !items && !crew;
    ship_system_selector->setVisible(systems);
    ship_crew_selector->setVisible(crew);
    ship_health_label->setVisible(systems);
    ship_health_entry->setVisible(systems);
    ship_resource_id_entry->setVisible(items);
    ship_resource_amount_label->setVisible(items || crew);
    ship_resource_amount_entry->setVisible(items);
    ship_resource_amount_label->setText(crew
        ? tr("content_editor", "Not assigned")
        : cargo ? tr("content_editor", "Quantity")
                : tr("content_editor", "Amount"));
    ship_set_system_button->setText(crew
        ? tr("content_editor", "Add position")
        : cargo ? tr("content_editor", "Set cargo")
                : resources ? tr("content_editor", "Set resource")
                            : tr("content_editor", "Set system"));

    if (crew)
    {
        const std::string id = ship_crew_selector->getSelectionValue();
        for (const auto& assigned : ship_edit_session.document().crew_position_ids)
        {
            if (assigned == id)
            {
                ship_resource_amount_label->setText(tr("content_editor", "Assigned"));
                break;
            }
        }
        return;
    }

    if (cargo)
    {
        const std::string id = ship_resource_id_entry->getText();
        for (const auto& item : ship_edit_session.document().cargo)
        {
            if (item.id == id)
            {
                ship_resource_amount_entry->setText(string(static_cast<unsigned int>(item.quantity)));
                return;
            }
        }
        ship_resource_amount_entry->setText("");
        return;
    }

    if (resources)
    {
        const std::string id = ship_resource_id_entry->getText();
        for (const auto& item : ship_edit_session.document().resources)
        {
            if (item.id == id)
            {
                ship_resource_amount_entry->setText(formatShipHealth(item.amount));
                return;
            }
        }
        ship_resource_amount_entry->setText("");
        return;
    }

    ShipSystemId selected;
    if (!parseShipSystemId(ship_system_selector->getSelectionValue(), selected))
    {
        ship_health_entry->setText("");
        return;
    }
    for (const auto& item : ship_edit_session.document().systems)
    {
        if (item.system == selected)
        {
            ship_health_entry->setText(formatShipHealth(item.health));
            return;
        }
    }
    ship_health_entry->setText("");
}

void GuiContentEditor::setShipOverride()
{
    if (current_type != ContentResourceType::Ship) return;
    if (ship_override_selector->getSelectionValue() == "crew")
    {
        const std::string id = ship_crew_selector->getSelectionValue();
        if (ship_edit_session.setCrewPosition(id, true) != ShipEditError::None)
            return setStatus(tr("content_editor", "The selected crew position is invalid."));
        pending_save = "";
        pending_file_export = "";
        discard_guard.reset();
        updateShipOverrideEditor();
        return setStatus(tr("content_editor", "Ship crew position staged."));
    }
    if (ship_override_selector->getSelectionValue() == "cargo")
    {
        std::uint32_t quantity = 0;
        const std::string id = ship_resource_id_entry->getText();
        if (!parseShipCargoQuantity(ship_resource_amount_entry->getText(), quantity)
            || ship_edit_session.setCargoQuantity(id, quantity) != ShipEditError::None)
            return setStatus(tr("content_editor", "Cargo ID or quantity is invalid."));
        pending_save = "";
        pending_file_export = "";
        discard_guard.reset();
        updateShipOverrideEditor();
        return setStatus(tr("content_editor", "Ship cargo override staged."));
    }
    if (ship_override_selector->getSelectionValue() == "resources")
    {
        float amount = 0.0f;
        const std::string id = ship_resource_id_entry->getText();
        if (!parseShipHealth(ship_resource_amount_entry->getText(), amount)
            || ship_edit_session.setResourceAmount(id, amount) != ShipEditError::None)
            return setStatus(tr("content_editor", "Resource ID or amount is invalid."));
        pending_save = "";
        pending_file_export = "";
        discard_guard.reset();
        updateShipOverrideEditor();
        return setStatus(tr("content_editor", "Ship resource override staged."));
    }

    ShipSystemId system;
    float health = 0.0f;
    if (!parseShipSystemId(ship_system_selector->getSelectionValue(), system)
        || !parseShipHealth(ship_health_entry->getText(), health))
        return setStatus(tr("content_editor", "Health must be a finite number between -1 and 1."));
    if (ship_edit_session.setSystemHealth(system, health) != ShipEditError::None)
        return setStatus(tr("content_editor", "Health must be a finite number between -1 and 1."));
    pending_save = "";
    pending_file_export = "";
    discard_guard.reset();
    updateShipOverrideEditor();
    setStatus(tr("content_editor", "Ship system override staged."));
}

void GuiContentEditor::removeShipOverride()
{
    if (current_type != ContentResourceType::Ship) return;
    if (ship_override_selector->getSelectionValue() == "crew")
    {
        const std::string id = ship_crew_selector->getSelectionValue();
        if (ship_edit_session.setCrewPosition(id, false) == ShipEditError::NotFound)
            return setStatus(tr("content_editor", "The selected crew position is not assigned."));
        pending_save = "";
        pending_file_export = "";
        discard_guard.reset();
        updateShipOverrideEditor();
        return setStatus(tr("content_editor", "Ship crew position removed from staging."));
    }
    if (ship_override_selector->getSelectionValue() == "cargo")
    {
        const std::string id = ship_resource_id_entry->getText();
        if (ship_edit_session.removeCargo(id) == ShipEditError::NotFound)
            return setStatus(tr("content_editor", "The selected cargo has no override."));
        pending_save = "";
        pending_file_export = "";
        discard_guard.reset();
        updateShipOverrideEditor();
        return setStatus(tr("content_editor", "Ship cargo override removed from staging."));
    }
    if (ship_override_selector->getSelectionValue() == "resources")
    {
        const std::string id = ship_resource_id_entry->getText();
        if (ship_edit_session.removeResource(id) == ShipEditError::NotFound)
            return setStatus(tr("content_editor", "The selected resource has no override."));
        pending_save = "";
        pending_file_export = "";
        discard_guard.reset();
        updateShipOverrideEditor();
        return setStatus(tr("content_editor", "Ship resource override removed from staging."));
    }

    ShipSystemId system;
    if (!parseShipSystemId(ship_system_selector->getSelectionValue(), system)) return;
    if (ship_edit_session.removeSystemOverride(system) == ShipEditError::NotFound)
        return setStatus(tr("content_editor", "The selected system has no override."));
    pending_save = "";
    pending_file_export = "";
    discard_guard.reset();
    updateShipOverrideEditor();
    setStatus(tr("content_editor", "Ship system override removed from staging."));
}

void GuiContentEditor::undoShipEdit()
{
    if (!ship_edit_session.undo())
        return setStatus(tr("content_editor", "There is no ship edit to undo."));
    pending_save = "";
    pending_file_export = "";
    discard_guard.reset();
    updateShipOverrideEditor();
    setStatus(tr("content_editor", "Ship edit undone."));
}

void GuiContentEditor::redoShipEdit()
{
    if (!ship_edit_session.redo())
        return setStatus(tr("content_editor", "There is no ship edit to redo."));
    pending_save = "";
    pending_file_export = "";
    discard_guard.reset();
    updateShipOverrideEditor();
    setStatus(tr("content_editor", "Ship edit redone."));
}

string GuiContentEditor::deploymentErrorText(ShipDeploymentError error) const
{
    switch(error)
    {
    case ShipDeploymentError::None: return "";
    case ShipDeploymentError::ServerRequired:
        return tr("content_editor", "Ship deployment requires the local server and a Game Master.");
    case ShipDeploymentError::InvalidResource:
        return tr("content_editor", "The ship document is not valid for deployment.");
    case ShipDeploymentError::TemplateUnavailable:
        return tr("content_editor", "The selected player-ship template is not available.");
    case ShipDeploymentError::FactionUnavailable:
        return tr("content_editor", "The selected faction is not available.");
    case ShipDeploymentError::InvalidPosition:
        return tr("content_editor", "The deployment position is outside the safe world bounds.");
    case ShipDeploymentError::UnsupportedResource:
        return tr("content_editor", "Deployment supports only energy and coolant resources.");
    case ShipDeploymentError::UnsupportedCargo:
        return tr("content_editor", "Deployment supports only medicine and spare-parts cargo.");
    case ShipDeploymentError::ConfirmationRequired:
        return tr("content_editor", "Review and confirm the exact deployment plan first.");
    case ShipDeploymentError::ConfirmationStale:
        return tr("content_editor", "The deployment plan changed; review it again.");
    case ShipDeploymentError::ActiveDeployment:
        return tr("content_editor", "Rollback the active content ship before deploying another.");
    case ShipDeploymentError::FactoryFailure:
        return tr("content_editor", "The ship factory failed and removed the partial entity.");
    case ShipDeploymentError::NothingToRollback:
        return tr("content_editor", "There is no active content ship to roll back.");
    case ShipDeploymentError::RollbackFailure:
        return tr("content_editor", "The active content ship could not be rolled back.");
    }
    return tr("content_editor", "Ship deployment failed.");
}

void GuiContentEditor::deployShip()
{
    if (current_type != ContentResourceType::Ship) return;
    if (ship_deployment_session.hasActiveDeployment())
        return setStatus(deploymentErrorText(ShipDeploymentError::ActiveDeployment));

    const auto factions = [] {
        std::vector<std::string> result;
        for (auto [entity, info] : sp::ecs::Query<FactionInfo>()) result.push_back(info.name);
        return result;
    }();

    if (const auto* pending = ship_deployment_session.pendingPlan())
    {
        ShipDeploymentPlan current_plan;
        const auto build_error = buildShipDeploymentPlan(
            formResource(), gameGlobalInfo ? gameGlobalInfo->getShipTemplateCatalog() : ship_template_catalog,
            factions, pending->x, pending->y, pending->rotation, game_server != nullptr, current_plan);
        if (build_error != ShipDeploymentError::None)
            return setStatus(deploymentErrorText(build_error));
        if (current_plan.fingerprint != pending->fingerprint)
        {
            ship_deployment_session.prepare(current_plan);
            return setStatus(tr("content_editor", "Deployment plan updated. Review it and press Deploy ship again."));
        }
        auto error = ship_deployment_session.confirm(current_plan.fingerprint);
        if (error == ShipDeploymentError::None)
        {
            error = ship_deployment_session.apply([](const ShipDeploymentPlan& plan, std::string& receipt) {
                sp::ecs::Entity entity;
                if (!gameGlobalInfo || !gameGlobalInfo->createContentShip(plan, entity)) return false;
                receipt = entity.toString();
                return true;
            });
        }
        if (error != ShipDeploymentError::None)
            return setStatus(deploymentErrorText(error));
        ship_rollback_button->show();
        return setStatus(tr("content_editor", "Ship deployed. Rollback removes only this created ship."));
    }

    ShipDeploymentPlan validation_plan;
    const auto validation_error = buildShipDeploymentPlan(
        formResource(), gameGlobalInfo ? gameGlobalInfo->getShipTemplateCatalog() : ship_template_catalog,
        factions, 0.0f, 0.0f, {}, game_server != nullptr, validation_plan);
    if (validation_error != ShipDeploymentError::None)
        return setStatus(deploymentErrorText(validation_error));

    const ContentResource snapshot = formResource();
    gameGlobalInfo->on_gm_click = [this, snapshot](glm::vec2 position, std::optional<float> rotation) {
        std::vector<std::string> current_factions;
        for (auto [entity, info] : sp::ecs::Query<FactionInfo>()) current_factions.push_back(info.name);
        ShipDeploymentPlan plan;
        const auto error = buildShipDeploymentPlan(
            snapshot, gameGlobalInfo->getShipTemplateCatalog(), current_factions,
            position.x, position.y, rotation, game_server != nullptr, plan);
        gameGlobalInfo->on_gm_preview_trace = std::nullopt;
        show();
        if (error != ShipDeploymentError::None)
        {
            setStatus(deploymentErrorText(error));
        }
        else
        {
            ship_deployment_session.prepare(plan);
            setStatus(tr("content_editor", "Plan: {template} at ({x}, {y}); {systems} systems, {resources} resources, {cargo} cargo and {positions} crew positions. Press Deploy ship again to confirm.").format({
                {"template", string(plan.template_id)},
                {"x", string(plan.x)},
                {"y", string(plan.y)},
                {"systems", string(static_cast<int>(plan.overrides.systems.size()))},
                {"resources", string(static_cast<int>(plan.overrides.resources.size()))},
                {"cargo", string(static_cast<int>(plan.overrides.cargo.size()))},
                {"positions", string(static_cast<int>(plan.overrides.crew_position_ids.size()))},
            }));
        }
        // Clearing this std::function destroys the currently executing closure.
        // Do it only after the final access to its captures.
        gameGlobalInfo->on_gm_click = nullptr;
    };
    hide();
}

void GuiContentEditor::rollbackShip()
{
    const auto error = ship_deployment_session.rollback([](const std::string& receipt) {
        const auto entity = sp::ecs::Entity::fromString(receipt);
        return !entity || (gameGlobalInfo && gameGlobalInfo->rollbackContentShip(entity));
    });
    if (error != ShipDeploymentError::None)
        return setStatus(deploymentErrorText(error));
    ship_rollback_button->hide();
    setStatus(tr("content_editor", "Content ship rolled back."));
}

void GuiContentEditor::openRelationEditor(RelationEditorMode mode)
{
    relation_editor_mode = mode;
    refreshRelationEditor();
    relation_editor_overlay->show()->moveToFront();
}

void GuiContentEditor::closeRelationEditor()
{
    relation_editor_overlay->hide();
}

void GuiContentEditor::refreshRelationEditor()
{
    const auto resource = formResource();
    relation_candidate_selector->clear();
    relation_destination_selector->clear();
    relation_current_list->clear();
    relation_candidate_selector->show();
    relation_destination_selector->hide();
    relation_apply_button->show();
    relation_apply_button->setText(tr("content_editor", "Add selection"));
    relation_clear_button->hide();
    relation_remove_button->show();
    relation_up_button->hide();
    relation_down_button->hide();

    auto addResources = [&](GuiSelector* selector, ContentResourceType type,
                            const std::vector<std::string>* limited_ids = nullptr) {
        for (const auto& item : resources)
        {
            if (item.type != type) continue;
            if (limited_ids
                && std::find(limited_ids->begin(), limited_ids->end(), item.id) == limited_ids->end())
                continue;
            selector->addEntry(relationResourceLabel(item), item.id);
        }
        selector->setSelectionIndex(selector->entryCount() > 0 ? 0 : -1);
    };
    auto addCurrentIds = [&](const string& value, ContentResourceType expected_type) {
        for (const auto& id : relationItems(value))
        {
            string label = id;
            for (const auto& item : resources)
            {
                if (item.type != expected_type || item.id != id) continue;
                label = relationResourceLabel(item);
                break;
            }
            relation_current_list->addEntry(label, id);
        }
        relation_current_list->setSelectionIndex(relation_current_list->entryCount() > 0 ? 0 : -1);
    };

    switch(relation_editor_mode)
    {
    case RelationEditorMode::CampaignMaps:
        relation_editor_title->setText(tr("content_editor", "Campaign maps"));
        addResources(relation_candidate_selector, ContentResourceType::Map);
        addCurrentIds(resource.primary, ContentResourceType::Map);
        relation_up_button->show();
        relation_down_button->show();
        break;
    case RelationEditorMode::CampaignStartingMap:
    {
        relation_editor_title->setText(tr("content_editor", "Starting map"));
        const auto map_ids = relationItems(resource.primary);
        addResources(relation_candidate_selector, ContentResourceType::Map, &map_ids);
        addCurrentIds(resource.secondary, ContentResourceType::Map);
        relation_apply_button->setText(tr("content_editor", "Use selection"));
        relation_clear_button->show();
        relation_remove_button->hide();
        break;
    }
    case RelationEditorMode::CampaignCharacters:
        relation_editor_title->setText(tr("content_editor", "Campaign characters"));
        addResources(relation_candidate_selector, ContentResourceType::Character);
        addCurrentIds(resource.tertiary, ContentResourceType::Character);
        break;
    case RelationEditorMode::CampaignShips:
        relation_editor_title->setText(tr("content_editor", "Campaign ships"));
        addResources(relation_candidate_selector, ContentResourceType::Ship);
        addCurrentIds(resource.quaternary, ContentResourceType::Ship);
        break;
    case RelationEditorMode::CampaignTransitions:
    {
        relation_editor_title->setText(tr("content_editor", "Map transitions"));
        const auto map_ids = relationItems(resource.primary);
        addResources(relation_candidate_selector, ContentResourceType::Map, &map_ids);
        addResources(relation_destination_selector, ContentResourceType::Map, &map_ids);
        relation_destination_selector->show();
        for (const auto& transition : relationItems(resource.quinary))
            relation_current_list->addEntry(transition, transition);
        relation_current_list->setSelectionIndex(relation_current_list->entryCount() > 0 ? 0 : -1);
        break;
    }
    case RelationEditorMode::CharacterCrewPosition:
        relation_editor_title->setText(tr("content_editor", "Crew position"));
        for (int index = 0; index < static_cast<int>(CrewPosition::MAX); ++index)
        {
            const auto position = static_cast<CrewPosition>(index);
            relation_candidate_selector->addEntry(
                getCrewPositionName(position), crewPositionToString(position));
        }
        relation_candidate_selector->setSelectionIndex(0);
        if (const auto current_position = tryParseCrewPosition(resource.primary))
            relation_current_list->addEntry(
                getCrewPositionName(*current_position), crewPositionToString(*current_position));
        relation_current_list->setSelectionIndex(relation_current_list->entryCount() > 0 ? 0 : -1);
        relation_apply_button->setText(tr("content_editor", "Use selection"));
        relation_clear_button->setVisible(!resource.quinary.empty());
        relation_remove_button->hide();
        break;
    case RelationEditorMode::CharacterShip:
        relation_editor_title->setText(tr("content_editor", "Character ship"));
        addResources(relation_candidate_selector, ContentResourceType::Ship);
        addCurrentIds(resource.quaternary, ContentResourceType::Ship);
        relation_apply_button->setText(tr("content_editor", "Use selection"));
        relation_clear_button->show();
        relation_remove_button->hide();
        break;
    }
}

void GuiContentEditor::applyRelationSelection()
{
    auto resource = formResource();
    const std::string selected = relation_candidate_selector->getSelectionValue();
    bool changed = false;
    switch(relation_editor_mode)
    {
    case RelationEditorMode::CampaignMaps:
        changed = addContentReference(resource, resources, ContentReferenceKind::CampaignMap, selected);
        break;
    case RelationEditorMode::CampaignStartingMap:
        changed = setCampaignStartingMap(resource, selected);
        break;
    case RelationEditorMode::CampaignCharacters:
        changed = addContentReference(resource, resources, ContentReferenceKind::CampaignCharacter, selected);
        break;
    case RelationEditorMode::CampaignShips:
        changed = addContentReference(resource, resources, ContentReferenceKind::CampaignShip, selected);
        break;
    case RelationEditorMode::CampaignTransitions:
        changed = addCampaignTransition(
            resource, selected, relation_destination_selector->getSelectionValue());
        break;
    case RelationEditorMode::CharacterCrewPosition:
        changed = setCharacterCrewPosition(resource, selected);
        break;
    case RelationEditorMode::CharacterShip:
        changed = setCharacterShipReference(resource, resources, selected);
        break;
    }
    if (!changed)
        return setStatus(tr("content_editor", "The selected relationship is invalid or already present."));
    applyRelationResource(resource);
    refreshRelationEditor();
    setStatus(tr("content_editor", "Relationship staged. Save the resource to persist it."));
}

void GuiContentEditor::clearRelationSelection()
{
    auto resource = formResource();
    bool changed = false;
    if (relation_editor_mode == RelationEditorMode::CampaignStartingMap)
        changed = setCampaignStartingMap(resource, "");
    else if (relation_editor_mode == RelationEditorMode::CharacterCrewPosition)
        changed = setCharacterCrewPosition(resource, "");
    else if (relation_editor_mode == RelationEditorMode::CharacterShip)
        changed = setCharacterShipReference(resource, resources, "");
    if (!changed)
        return setStatus(tr("content_editor", "The selection cannot be cleared."));
    applyRelationResource(resource);
    refreshRelationEditor();
    setStatus(tr("content_editor", "Relationship cleared in staging."));
}

void GuiContentEditor::removeRelationSelection()
{
    const std::string selected = relation_current_list->getSelectionValue();
    auto resource = formResource();
    bool changed = false;
    if (relation_editor_mode == RelationEditorMode::CampaignMaps)
        changed = removeContentReference(resource, ContentReferenceKind::CampaignMap, selected);
    else if (relation_editor_mode == RelationEditorMode::CampaignCharacters)
        changed = removeContentReference(resource, ContentReferenceKind::CampaignCharacter, selected);
    else if (relation_editor_mode == RelationEditorMode::CampaignShips)
        changed = removeContentReference(resource, ContentReferenceKind::CampaignShip, selected);
    else if (relation_editor_mode == RelationEditorMode::CampaignTransitions)
    {
        const auto separator = selected.find('>');
        if (separator != std::string::npos)
            changed = removeCampaignTransition(
                resource, selected.substr(0, separator), selected.substr(separator + 1));
    }
    if (!changed)
        return setStatus(tr("content_editor", "Select an existing relationship first."));
    applyRelationResource(resource);
    refreshRelationEditor();
    setStatus(tr("content_editor", "Relationship removed from staging."));
}

void GuiContentEditor::moveRelationSelection(int direction)
{
    auto resource = formResource();
    if (relation_editor_mode != RelationEditorMode::CampaignMaps
        || !moveCampaignMap(resource, relation_current_list->getSelectionValue(), direction))
        return setStatus(tr("content_editor", "The selected map cannot move in that direction."));
    applyRelationResource(resource);
    refreshRelationEditor();
    setStatus(tr("content_editor", "Campaign map order updated in staging."));
}

void GuiContentEditor::applyRelationResource(const ContentResource& resource)
{
    primary_entry->setText(resource.primary);
    secondary_entry->setText(resource.secondary);
    tertiary_entry->setText(resource.tertiary);
    quaternary_entry->setText(resource.quaternary);
    quinary_entry->setText(resource.quinary);
    pending_save = "";
    pending_file_export = "";
    discard_guard.reset();
    rename_guard.reset();
}
