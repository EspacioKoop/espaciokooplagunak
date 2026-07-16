#include "content/shipDeployment.h"

#include <cmath>
#include <iostream>
#include <limits>

namespace
{
int failures = 0;

void expect(bool condition, const char* message)
{
    if (condition) return;
    ++failures;
    std::cerr << "FAIL: " << message << '\n';
}

ContentResource validShip()
{
    ContentResource resource;
    resource.type = ContentResourceType::Ship;
    resource.id = "rescue-one";
    resource.name = "Rescue One";
    resource.primary = "Phobos M3P";
    resource.secondary = "Human Navy";
    resource.ship_document.systems = {{ShipSystemId::Reactor, 0.5f}};
    resource.ship_document.resources = {{"energy", 800.0f}, {"coolant", 10.0f}};
    resource.ship_document.cargo = {{"medicine", 4}, {"spare-parts", 2}};
    resource.ship_document.crew_position_ids = {"helms", "engineering"};
    return resource;
}

std::vector<ShipTemplateCatalogEntry> catalog()
{
    return {{"Phobos M3P", "Phobos", "playership", "Phobos", true, true}};
}

void testPlanValidation()
{
    const auto resource = validShip();
    const std::vector<std::string> factions{"Human Navy", "Independent"};
    ShipDeploymentPlan plan;
    expect(buildShipDeploymentPlan(resource, catalog(), factions, 12.0f, -4.0f, 90.0f, true, plan)
            == ShipDeploymentError::None,
        "valid deployment builds a plan");
    expect(plan.template_id == "Phobos M3P" && plan.faction == "Human Navy"
            && plan.callsign == "Rescue One" && plan.fingerprint != 0,
        "plan contains the closed scalar inputs and a confirmation fingerprint");

    auto changed = resource;
    changed.name = "Rescue Two";
    ShipDeploymentPlan changed_plan;
    expect(buildShipDeploymentPlan(changed, catalog(), factions, 12.0f, -4.0f, 90.0f, true, changed_plan)
            == ShipDeploymentError::None
            && changed_plan.fingerprint != plan.fingerprint,
        "document changes invalidate the plan fingerprint");
    expect(buildShipDeploymentPlan(resource, catalog(), factions, 13.0f, -4.0f, 90.0f, true, changed_plan)
            == ShipDeploymentError::None
            && changed_plan.fingerprint != plan.fingerprint,
        "position changes invalidate the plan fingerprint");

    expect(buildShipDeploymentPlan(resource, catalog(), factions, 0, 0, {}, false, changed_plan)
            == ShipDeploymentError::ServerRequired,
        "remote-only clients fail closed");
    expect(buildShipDeploymentPlan(resource, {}, factions, 0, 0, {}, true, changed_plan)
            == ShipDeploymentError::TemplateUnavailable,
        "missing template catalog fails before mutation");
    expect(buildShipDeploymentPlan(resource, catalog(), {"Independent"}, 0, 0, {}, true, changed_plan)
            == ShipDeploymentError::FactionUnavailable,
        "unknown faction fails before mutation");
    expect(buildShipDeploymentPlan(resource, catalog(), factions,
               std::numeric_limits<float>::quiet_NaN(), 0, {}, true, changed_plan)
            == ShipDeploymentError::InvalidPosition,
        "non-finite positions are rejected");
    expect(buildShipDeploymentPlan(resource, catalog(), factions,
               10000001.0f, 0, {}, true, changed_plan)
            == ShipDeploymentError::InvalidPosition,
        "positions outside the bounded world are rejected");
    expect(buildShipDeploymentPlan(resource, catalog(), factions, 0, 0,
               std::numeric_limits<float>::infinity(), true, changed_plan)
            == ShipDeploymentError::InvalidPosition,
        "non-finite rotations are rejected");

    changed = resource;
    changed.ship_document.resources.push_back({"antimatter", 1});
    expect(buildShipDeploymentPlan(changed, catalog(), factions, 0, 0, {}, true, changed_plan)
            == ShipDeploymentError::UnsupportedResource,
        "runtime resource allowlist is closed");
    changed = resource;
    changed.ship_document.cargo.push_back({"unknown", 1});
    expect(buildShipDeploymentPlan(changed, catalog(), factions, 0, 0, {}, true, changed_plan)
            == ShipDeploymentError::UnsupportedCargo,
        "runtime cargo allowlist is closed");
}

void testConfirmationApplyAndRollback()
{
    ShipDeploymentPlan plan;
    expect(buildShipDeploymentPlan(validShip(), catalog(), {"Human Navy"}, 1, 2, {}, true, plan)
            == ShipDeploymentError::None,
        "session fixture plan builds");

    ShipDeploymentSession session;
    int create_calls = 0;
    int destroy_calls = 0;
    expect(session.prepare(plan) == ShipDeploymentError::None,
        "plan can be prepared");
    expect(session.apply({}) == ShipDeploymentError::ConfirmationRequired,
        "apply requires explicit second confirmation");
    expect(session.confirm(plan.fingerprint + 1) == ShipDeploymentError::ConfirmationStale,
        "stale confirmation is rejected");
    expect(session.confirm(plan.fingerprint) == ShipDeploymentError::None,
        "exact plan can be confirmed");
    expect(session.apply([&](const ShipDeploymentPlan& applied, std::string& receipt) {
            ++create_calls;
            expect(applied.fingerprint == plan.fingerprint, "factory receives the confirmed plan");
            receipt = "entity-42";
            return true;
        }) == ShipDeploymentError::None,
        "confirmed plan creates exactly one deployment");
    expect(create_calls == 1 && session.hasActiveDeployment(),
        "successful create stores one active receipt");
    expect(session.prepare(plan) == ShipDeploymentError::ActiveDeployment,
        "second apply is blocked while a deployment is active");
    expect(session.rollback([&](const std::string& receipt) {
            ++destroy_calls;
            return receipt != "entity-42";
        }) == ShipDeploymentError::RollbackFailure,
        "failed rollback is surfaced without targeting another receipt");
    expect(session.hasActiveDeployment(),
        "failed rollback preserves the receipt for a safe retry");
    expect(session.rollback([&](const std::string& receipt) {
            ++destroy_calls;
            return receipt == "entity-42";
        }) == ShipDeploymentError::None,
        "rollback destroys only the recorded entity");
    expect(destroy_calls == 2 && !session.hasActiveDeployment(),
        "rollback clears the active receipt");
    expect(session.rollback({}) == ShipDeploymentError::NothingToRollback,
        "repeated rollback is harmless and closed");
}

void testFactoryFailureLeavesNoActiveReceipt()
{
    ShipDeploymentPlan plan;
    buildShipDeploymentPlan(validShip(), catalog(), {"Human Navy"}, 0, 0, {}, true, plan);
    ShipDeploymentSession session;
    session.prepare(plan);
    session.confirm(plan.fingerprint);
    expect(session.apply([](const ShipDeploymentPlan&, std::string&) { return false; })
            == ShipDeploymentError::FactoryFailure,
        "factory failure is surfaced");
    expect(!session.hasActiveDeployment(),
        "factory failure leaves no residual receipt");
}
}

int main()
{
    testPlanValidation();
    testConfirmationApplyAndRollback();
    testFactoryFailureLeavesNoActiveReceipt();
    if (failures)
    {
        std::cerr << failures << " ship deployment checks failed\n";
        return 1;
    }
    std::cout << "ship deployment checks passed\n";
    return 0;
}
