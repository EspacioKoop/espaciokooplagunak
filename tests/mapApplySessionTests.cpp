#include "content/mapApplySession.h"

#include <cstdlib>
#include <iostream>
#include <string>
#include <vector>

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

MapObject asteroid(const std::string& id)
{
    MapObject object;
    object.id = id;
    object.kind = MapObjectKind::Asteroid;
    object.transform = {1000.0f, 2000.0f, 0.0f};
    object.size = 150.0f;
    return object;
}

MapObject nebula(const std::string& id)
{
    MapObject object;
    object.id = id;
    object.kind = MapObjectKind::Nebula;
    object.transform = {-5000.0f, 3000.0f, 0.0f};
    return object;
}

MapObject unsupported(const std::string& id)
{
    MapObject object;
    object.id = id;
    object.kind = MapObjectKind::Unsupported;
    object.opaque_json = R"({"id":")" + id + R"(","kind":"comet","payload":{"tail":10}})";
    return object;
}

// World stub that records every call; the session must never bypass it.
struct FakeWorld
{
    std::vector<std::string> created;
    std::vector<std::string> destroyed;
    std::vector<std::string> live;
    int fail_at = -1; // 0-based creation index that fails, -1 for never.

    MapApplySession::Create creator()
    {
        return [this](const MapApplyItem& item, std::string& handle)
        {
            if (fail_at >= 0 && static_cast<int>(created.size()) == fail_at)
                return false;
            created.push_back(item.id);
            live.push_back(item.id);
            handle = item.id;
            return true;
        };
    }

    MapApplySession::Destroy destroyer()
    {
        return [this](const std::string& handle)
        {
            destroyed.push_back(handle);
            for (auto it = live.begin(); it != live.end(); ++it)
            {
                if (*it == handle)
                {
                    live.erase(it);
                    return true;
                }
            }
            return false;
        };
    }
};
}

int main()
{
    // 1. Invalid document: zero world calls.
    {
        MapDocument invalid;
        invalid.objects.push_back(asteroid("dup"));
        invalid.objects.push_back(asteroid("dup"));
        MapApplyPlan plan;
        expect(buildMapApplyPlan(invalid, true, plan) == MapApplyError::InvalidDocument
                && plan.items.empty() && plan.skipped == 0,
            "invalid document produces no plan");
    }

    // Client-side guard: no plan without a local server.
    {
        MapDocument document;
        document.objects.push_back(asteroid("a-1"));
        MapApplyPlan plan;
        expect(buildMapApplyPlan(document, false, plan) == MapApplyError::ServerRequired
                && plan.items.empty(),
            "plan requires a local server");
    }

    // 2. Asteroid + nebula + future kind: exactly two created, one skipped.
    MapDocument document;
    document.objects.push_back(asteroid("a-1"));
    document.objects.push_back(nebula("n-1"));
    document.objects.push_back(unsupported("future-1"));

    MapApplyPlan plan;
    expect(buildMapApplyPlan(document, true, plan) == MapApplyError::None
            && plan.items.size() == 2 && plan.skipped == 1,
        "mixed document plans two allowlisted objects and reports one skipped");
    expect(plan.items[0].id == "a-1" && plan.items[0].kind == MapObjectKind::Asteroid
            && plan.items[1].id == "n-1" && plan.items[1].kind == MapObjectKind::Nebula,
        "plan preserves document order and kinds");

    {
        FakeWorld world;
        MapApplySession session;
        expect(session.apply(plan, world.creator(), world.destroyer()) == MapApplyError::None
                && world.created.size() == 2 && world.destroyed.empty()
                && session.hasActiveBatch() && session.batchSkipped() == 1,
            "apply creates exactly the allowlisted objects");

        // 3. Partial failure: zero new entities, no residual handles.
        // 4. Second apply with an active batch fails closed without mutation.
        FakeWorld untouched;
        expect(session.apply(plan, untouched.creator(), untouched.destroyer()) == MapApplyError::ActiveBatch
                && untouched.created.empty() && untouched.destroyed.empty(),
            "second apply with active batch fails closed");

        // 7. Rollback without local authority fails closed: zero destroy calls
        // and the batch stays active for a later authorized rollback.
        {
            FakeWorld offline;
            expect(session.rollback(false, offline.destroyer()) == MapApplyError::ServerRequired
                    && offline.destroyed.empty() && session.hasActiveBatch(),
                "rollback without local server fails closed with zero destroy calls");
        }

        // 5. Rollback tolerates an already destroyed handle and only touches its own batch.
        world.live.push_back("sentinel");
        expect(world.destroyer()("n-1"), "simulation destroys one batch entity externally");
        std::size_t destroyed = 0, missing = 0;
        world.destroyed.clear();
        expect(session.rollback(true, world.destroyer(), &destroyed, &missing) == MapApplyError::None
                && destroyed == 1 && missing == 1 && !session.hasActiveBatch(),
            "rollback tolerates a dead handle and reports it");
        expect(world.destroyed == std::vector<std::string>({"n-1", "a-1"}),
            "rollback destroys newest first and only its own batch");
        expect(world.live == std::vector<std::string>({"sentinel"}),
            "sentinel entity outside the batch survives rollback");
        expect(session.rollback(true, world.destroyer()) == MapApplyError::NothingToRollback,
            "rollback without batch fails closed");
    }

    // 3. Partial failure destroys everything created by that operation, in reverse.
    {
        FakeWorld world;
        world.fail_at = 1;
        MapApplySession session;
        expect(session.apply(plan, world.creator(), world.destroyer()) == MapApplyError::FactoryFailure
                && !session.hasActiveBatch(),
            "partial failure leaves no active batch");
        expect(world.live.empty() && world.destroyed == std::vector<std::string>({"a-1"}),
            "partial failure destroys prior creations in reverse order");

        // The session recovers: a clean apply works after the failed one.
        world.fail_at = -1;
        expect(session.apply(plan, world.creator(), world.destroyer()) == MapApplyError::None
                && world.live.size() == 2,
            "apply succeeds after a failed attempt");
    }

    // Empty plans never reach the world.
    {
        MapDocument only_opaque;
        only_opaque.objects.push_back(unsupported("future-1"));
        MapApplyPlan empty_plan;
        expect(buildMapApplyPlan(only_opaque, true, empty_plan) == MapApplyError::NothingToApply
                && empty_plan.skipped == 1,
            "document without allowlisted objects yields nothing to apply");
        FakeWorld world;
        MapApplySession session;
        expect(session.apply(empty_plan, world.creator(), world.destroyer()) == MapApplyError::NothingToApply
                && world.created.empty(),
            "empty plan is rejected before touching the world");
    }

    // Editing staging after Apply must not change what was applied: the plan
    // is an immutable snapshot taken at apply time.
    {
        MapApplyPlan snapshot = plan;
        document.objects[0].transform.x = 99999.0f;
        MapApplyPlan replan;
        expect(buildMapApplyPlan(document, true, replan) == MapApplyError::None
                && snapshot.items[0].transform.x == 1000.0f
                && replan.items[0].transform.x == 99999.0f,
            "applied snapshot is independent from later staging edits");
    }

    // 6. Deterministic visual parameters: same document, same results.
    {
        MapApplyPlan again;
        MapDocument fresh;
        fresh.objects.push_back(asteroid("a-1"));
        fresh.objects.push_back(nebula("n-1"));
        expect(buildMapApplyPlan(fresh, true, again) == MapApplyError::None
                && again.items[0].visual_seed == plan.items[0].visual_seed
                && again.items[1].visual_seed == plan.items[1].visual_seed,
            "visual seeds derive only from object ids");
        expect(plan.items[0].visual_seed != plan.items[1].visual_seed,
            "different ids produce different seeds");

        const auto first = computeMapVisualParams(plan.items[0]);
        const auto second = computeMapVisualParams(again.items[0]);
        expect(first.model_number == second.model_number
                && first.spin_rate == second.spin_rate && first.z_offset == second.z_offset
                && first.nebula_texture == second.nebula_texture,
            "visual parameters are deterministic for the same id");
        expect(first.model_number >= 1 && first.model_number <= 10
                && first.spin_rate >= 0.1f && first.spin_rate <= 0.8f
                && first.z_offset >= -50.0f && first.z_offset <= 50.0f
                && first.nebula_texture >= 1 && first.nebula_texture <= 3,
            "visual parameters stay inside the Lua reference ranges");
    }

    std::cout << "MAP_APPLY_SESSION_TESTS_OK checks=" << checks << "\n";
    return 0;
}
