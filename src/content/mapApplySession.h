#pragma once

#include "content/mapDocument.h"

#include <cstdint>
#include <functional>
#include <string>
#include <vector>

enum class MapApplyError
{
    None,
    ServerRequired,
    InvalidDocument,
    NothingToApply,
    ActiveBatch,
    FactoryFailure,
    NothingToRollback,
};

// One creatable object from the validated staging snapshot. Only allowlisted
// kinds reach a plan; opaque objects are counted as skipped and never parsed.
struct MapApplyItem
{
    std::string id;
    MapObjectKind kind = MapObjectKind::Unsupported;
    MapObjectTransform transform;
    float size = 120.0f;
    std::uint64_t visual_seed = 0;
};

struct MapApplyPlan
{
    std::vector<MapApplyItem> items;
    std::size_t skipped = 0;
};

// Deterministic cosmetic parameters derived exclusively from the object id, so
// applying the same document twice produces identical-looking entities.
struct MapVisualParams
{
    int model_number = 1;      // asteroid mesh/texture variant, 1..10
    float rotation = 0.0f;     // resting rotation, 0..360
    float spin_rate = 0.0f;    // asteroid spin, 0.1..0.8
    float z_offset = 0.0f;     // asteroid mesh offset, -50..50
    int nebula_texture = 1;    // nebula radar/cloud texture variant, 1..3
};

MapVisualParams computeMapVisualParams(const MapApplyItem& item);

// Validates the whole document before planning: an invalid document produces an
// empty plan and zero world calls.
MapApplyError buildMapApplyPlan(const MapDocument& document, bool local_server, MapApplyPlan& output);

// Transactional application of one plan as a single reversible batch.
// The world is only touched through the injected callbacks.
class MapApplySession
{
public:
    // Returns false on factory failure; on success fills the opaque handle.
    using Create = std::function<bool(const MapApplyItem&, std::string& handle)>;
    // Returns false when the handle no longer names a live entity of the batch.
    using Destroy = std::function<bool(const std::string& handle)>;

    // All-or-nothing: a failure at object N destroys, in reverse order,
    // everything created by this call and leaves no active batch.
    MapApplyError apply(const MapApplyPlan& plan, const Create& create, const Destroy& destroy);
    // Destroys only this batch, newest first. Handles already destroyed by the
    // simulation are tolerated and reported through destroyed/missing counts.
    MapApplyError rollback(const Destroy& destroy, std::size_t* destroyed = nullptr,
        std::size_t* missing = nullptr);

    bool hasActiveBatch() const { return !batch_handles.empty(); }
    const std::vector<std::string>& batchHandles() const { return batch_handles; }
    std::size_t batchSkipped() const { return batch_skipped; }

private:
    std::vector<std::string> batch_handles;
    std::size_t batch_skipped = 0;
};
