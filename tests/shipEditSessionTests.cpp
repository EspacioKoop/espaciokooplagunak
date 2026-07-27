#include "content/shipEditSession.h"

#include <cstdlib>
#include <iostream>
#include <limits>

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

ShipDocument baseDocument()
{
    ShipDocument document;
    document.systems = {{ShipSystemId::Reactor, 0.5f}};
    document.resources = {{"coolant", 10.0f}};
    document.cargo = {{"medicine", 4}};
    document.crew_position_ids = {"helms"};
    return document;
}
}

int main()
{
    ShipEditSession session(baseDocument());
    expect(!session.isDirty() && !session.canUndo() && !session.canRedo(),
        "new ship session starts clean with empty history");

    expect(session.setHullMax(250.0f) == ShipEditError::None
            && session.document().hull_max == 250.0f && session.isDirty(),
        "a valid maximum hull can be staged");
    expect(session.setHullMax(0.0f) == ShipEditError::InvalidDocument
            && session.document().hull_max == 250.0f,
        "an invalid hull edit fails without partial mutation");
    expect(session.removeHullOverride() == ShipEditError::None
            && !session.document().hull_max && !session.isDirty(),
        "removing the staged hull override returns to the clean document");
    expect(session.undo() && session.document().hull_max == 250.0f,
        "hull override removal can be undone");
    expect(session.redo() && !session.document().hull_max,
        "hull override removal can be redone");

    expect(session.setShieldMax(true, 120.0f) == ShipEditError::None
            && session.document().front_shield_max == 120.0f,
        "front shield maximum can be staged independently");
    expect(session.setShieldMax(false, 90.0f) == ShipEditError::None
            && session.document().rear_shield_max == 90.0f,
        "rear shield maximum can be staged independently");
    expect(session.setShieldMax(false, 0.0f) == ShipEditError::InvalidDocument
            && session.document().rear_shield_max == 90.0f,
        "invalid shield edit fails without partial mutation");
    expect(session.removeShieldOverride(true) == ShipEditError::None
            && !session.document().front_shield_max,
        "shield override removal is explicit");
    expect(session.undo() && session.document().front_shield_max == 120.0f,
        "shield override removal can be undone");
    expect(session.redo() && !session.document().front_shield_max,
        "shield override removal can be redone");
    session.rollback();
    expect(!session.isDirty() && !session.canUndo() && !session.canRedo(),
        "shield sub-session rolls back before independent edit cases");

    expect(session.setSystemHealth(ShipSystemId::FrontShield, -0.25f) == ShipEditError::None
            && session.isDirty() && session.document().systems.size() == 2,
        "adding a valid system override dirties staging");
    expect(session.setSystemHealth(ShipSystemId::FrontShield, -0.25f) == ShipEditError::None,
        "setting an identical override is a no-op");
    expect(session.undo() && !session.isDirty() && session.document().systems.size() == 1,
        "no-op creates no history and undo returns to clean snapshot");
    expect(session.redo() && session.isDirty() && session.document().systems.size() == 2,
        "redo restores system override");

    const auto before_invalid = session.document();
    expect(session.setSystemHealth(ShipSystemId::Count, 0.0f) == ShipEditError::InvalidDocument,
        "out-of-range system is rejected");
    expect(session.setSystemHealth(ShipSystemId::Reactor,
            std::numeric_limits<float>::infinity()) == ShipEditError::InvalidDocument,
        "non-finite health is rejected");
    expect(session.document() == before_invalid,
        "invalid system edits leave the document unchanged");

    expect(session.setResourceAmount("energy", 800.0f) == ShipEditError::None
            && session.document().resources.size() == 2,
        "resource amount can be staged");
    expect(session.setResourceAmount("../energy", 1.0f) == ShipEditError::InvalidDocument,
        "unsafe resource ID is rejected");
    expect(session.removeResource("missing") == ShipEditError::NotFound,
        "removing missing resource does not mutate staging");

    expect(session.setCargoQuantity("spare-parts", 2) == ShipEditError::None
            && session.document().cargo.size() == 2,
        "cargo quantity can be staged");
    expect(session.setCargoQuantity("spare-parts", 0) == ShipEditError::InvalidDocument,
        "zero cargo quantity is rejected rather than treated as implicit deletion");
    expect(session.removeCargo("medicine") == ShipEditError::None
            && session.document().cargo.size() == 1,
        "cargo deletion is explicit");

    expect(session.setCrewPosition("engineering", true) == ShipEditError::None
            && session.document().crew_position_ids.size() == 2,
        "canonical crew position can be enabled");
    expect(session.setCrewPosition("engineering", true) == ShipEditError::None
            && session.document().crew_position_ids.size() == 2,
        "enabling an existing crew position is a no-op");
    expect(session.setCrewPosition("helmsofficer", true) == ShipEditError::InvalidDocument,
        "legacy crew alias is rejected");
    expect(session.setCrewPosition("missing", false) == ShipEditError::NotFound,
        "disabling a missing crew position is explicit NotFound");

    session.markSaved();
    const auto saved = session.document();
    expect(!session.isDirty() && session.cleanDocument() == saved,
        "markSaved redefines the clean ship snapshot");
    expect(session.removeSystemOverride(ShipSystemId::FrontShield) == ShipEditError::None
            && session.isDirty(),
        "system override removal dirties saved staging");
    expect(session.undo() && !session.isDirty(),
        "undo after removal restores saved snapshot");
    expect(session.redo() && session.isDirty(), "redo reapplies system removal");
    session.rollback();
    expect(!session.isDirty() && !session.canUndo() && !session.canRedo()
            && session.document() == saved,
        "rollback restores saved ship and clears both histories");

    expect(session.setResourceAmount("energy", 900.0f) == ShipEditError::None,
        "new edit after rollback succeeds");
    expect(session.undo() && session.canRedo(), "undo exposes redo history");
    expect(session.setResourceAmount("energy", 700.0f) == ShipEditError::None
            && !session.canRedo(),
        "new ship edit after undo clears redo");

    ShipDocument history_base;
    history_base.systems = {{ShipSystemId::Reactor, -1.0f}};
    ShipEditSession bounded(history_base);
    for (int index = 1; index <= 101; ++index)
    {
        const float value = -1.0f + static_cast<float>(index) * 0.01f;
        expect(bounded.setSystemHealth(ShipSystemId::Reactor, value) == ShipEditError::None,
            "bounded history edit succeeds");
    }
    int undo_count = 0;
    while (bounded.undo()) ++undo_count;
    expect(undo_count == 100 && bounded.document().systems[0].health == -0.99f,
        "ship history retains the newest 100 snapshots");

    std::cout << "SHIP_EDIT_SESSION_TESTS_OK checks=" << checks << "\n";
    return 0;
}
