#include "content/mapApplySession.h"

namespace
{
// FNV-1a over the object id: stable across runs, platforms and reorderings.
std::uint64_t hashId(const std::string& id)
{
    std::uint64_t hash = 1469598103934665603ull;
    for (unsigned char byte : id)
    {
        hash ^= byte;
        hash *= 1099511628211ull;
    }
    return hash;
}

// splitmix64 step: cheap, deterministic derivation of independent lanes.
std::uint64_t mix(std::uint64_t value)
{
    value += 0x9e3779b97f4a7c15ull;
    value = (value ^ (value >> 30)) * 0xbf58476d1ce4e5b9ull;
    value = (value ^ (value >> 27)) * 0x94d049bb133111ebull;
    return value ^ (value >> 31);
}

float unitLane(std::uint64_t seed, std::uint64_t lane)
{
    return static_cast<float>(mix(seed + lane) % 100000ull) / 100000.0f;
}
}

MapVisualParams computeMapVisualParams(const MapApplyItem& item)
{
    MapVisualParams params;
    const auto seed = item.visual_seed;
    params.model_number = 1 + static_cast<int>(mix(seed + 1) % 10ull);
    params.spin_rate = 0.1f + unitLane(seed, 3) * 0.7f;
    params.z_offset = unitLane(seed, 4) * 100.0f - 50.0f;
    params.nebula_texture = 1 + static_cast<int>(mix(seed + 5) % 3ull);
    return params;
}

MapApplyError buildMapApplyPlan(const MapDocument& document, bool local_server, MapApplyPlan& output)
{
    output = {};
    if (!local_server)
        return MapApplyError::ServerRequired;
    if (validateMapDocument(document) != MapDocumentError::None)
        return MapApplyError::InvalidDocument;

    for (const auto& object : document.objects)
    {
        if (object.kind == MapObjectKind::Unsupported)
        {
            output.skipped += 1;
            continue;
        }
        MapApplyItem item;
        item.id = object.id;
        item.kind = object.kind;
        item.transform = object.transform;
        item.size = object.size;
        item.visual_seed = hashId(object.id);
        output.items.push_back(std::move(item));
    }
    if (output.items.empty())
        return MapApplyError::NothingToApply;
    return MapApplyError::None;
}

MapApplyError MapApplySession::apply(const MapApplyPlan& plan, const Create& create, const Destroy& destroy)
{
    if (hasActiveBatch())
        return MapApplyError::ActiveBatch;
    if (plan.items.empty())
        return MapApplyError::NothingToApply;

    std::vector<std::string> created;
    created.reserve(plan.items.size());
    for (const auto& item : plan.items)
    {
        std::string handle;
        if (!create(item, handle) || handle.empty())
        {
            for (auto it = created.rbegin(); it != created.rend(); ++it)
                destroy(*it);
            return MapApplyError::FactoryFailure;
        }
        created.push_back(handle);
    }
    batch_handles = std::move(created);
    batch_skipped = plan.skipped;
    return MapApplyError::None;
}

MapApplyError MapApplySession::rollback(bool local_server, const Destroy& destroy,
    std::size_t* destroyed, std::size_t* missing)
{
    if (destroyed) *destroyed = 0;
    if (missing) *missing = 0;
    if (!local_server)
        return MapApplyError::ServerRequired;
    if (!hasActiveBatch())
        return MapApplyError::NothingToRollback;

    for (auto it = batch_handles.rbegin(); it != batch_handles.rend(); ++it)
    {
        if (destroy(*it))
        {
            if (destroyed) ++*destroyed;
        }
        else if (missing)
            ++*missing;
    }
    batch_handles.clear();
    batch_skipped = 0;
    return MapApplyError::None;
}
