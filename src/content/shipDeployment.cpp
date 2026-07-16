#include "content/shipDeployment.h"

#include <algorithm>
#include <cmath>
#include <cstring>

namespace
{
constexpr float max_world_coordinate = 10000000.0f;

bool contains(const std::vector<std::string>& values, const std::string& value)
{
    return std::find(values.begin(), values.end(), value) != values.end();
}

void hashBytes(std::uint64_t& hash, const void* data, std::size_t size)
{
    const auto* bytes = static_cast<const unsigned char*>(data);
    for (std::size_t index = 0; index < size; ++index)
    {
        hash ^= bytes[index];
        hash *= 1099511628211ULL;
    }
}

void hashString(std::uint64_t& hash, const std::string& value)
{
    hashBytes(hash, value.data(), value.size());
    const unsigned char separator = 0xff;
    hashBytes(hash, &separator, 1);
}

std::uint64_t fingerprint(const ShipDeploymentPlan& plan)
{
    std::uint64_t result = 1469598103934665603ULL;
    hashString(result, plan.resource_id);
    hashString(result, plan.template_id);
    hashString(result, plan.faction);
    hashString(result, plan.callsign);
    hashString(result, shipDocumentOverridesJson(plan.overrides).dump());
    hashBytes(result, &plan.x, sizeof(plan.x));
    hashBytes(result, &plan.y, sizeof(plan.y));
    const bool has_rotation = plan.rotation.has_value();
    hashBytes(result, &has_rotation, sizeof(has_rotation));
    if (plan.rotation) hashBytes(result, &*plan.rotation, sizeof(*plan.rotation));
    return result;
}
}

ShipDeploymentError buildShipDeploymentPlan(
    const ContentResource& resource,
    const std::vector<ShipTemplateCatalogEntry>& catalog,
    const std::vector<std::string>& factions,
    float x,
    float y,
    std::optional<float> rotation,
    bool local_server,
    ShipDeploymentPlan& output)
{
    if (!local_server) return ShipDeploymentError::ServerRequired;
    if (resource.type != ContentResourceType::Ship
        || resource.id.empty()
        || resource.name.empty()
        || resource.name.size() > 128
        || validateShipDocument(resource.ship_document) != ShipDocumentError::None)
        return ShipDeploymentError::InvalidResource;
    if (validateShipTemplateSelection(catalog, resource.primary) != ShipTemplateValidation::Available)
        return ShipDeploymentError::TemplateUnavailable;
    if (!contains(factions, resource.secondary))
        return ShipDeploymentError::FactionUnavailable;
    if (!std::isfinite(x) || !std::isfinite(y)
        || std::abs(x) > max_world_coordinate || std::abs(y) > max_world_coordinate
        || (rotation && (!std::isfinite(*rotation) || std::abs(*rotation) > 360000.0f)))
        return ShipDeploymentError::InvalidPosition;

    for (const auto& resource_override : resource.ship_document.resources)
        if (resource_override.id != "energy" && resource_override.id != "coolant")
            return ShipDeploymentError::UnsupportedResource;
    for (const auto& cargo_override : resource.ship_document.cargo)
        if (cargo_override.id != "medicine" && cargo_override.id != "spare-parts")
            return ShipDeploymentError::UnsupportedCargo;

    ShipDeploymentPlan candidate;
    candidate.resource_id = resource.id;
    candidate.template_id = resource.primary;
    candidate.faction = resource.secondary;
    candidate.callsign = resource.name;
    candidate.overrides = resource.ship_document;
    candidate.x = x;
    candidate.y = y;
    candidate.rotation = rotation;
    candidate.fingerprint = fingerprint(candidate);
    output = std::move(candidate);
    return ShipDeploymentError::None;
}

ShipDeploymentError ShipDeploymentSession::prepare(const ShipDeploymentPlan& plan)
{
    if (hasActiveDeployment()) return ShipDeploymentError::ActiveDeployment;
    if (!plan.fingerprint) return ShipDeploymentError::InvalidResource;
    pending_plan = plan;
    confirmed_fingerprint.reset();
    return ShipDeploymentError::None;
}

ShipDeploymentError ShipDeploymentSession::confirm(std::uint64_t fingerprint)
{
    if (!pending_plan) return ShipDeploymentError::ConfirmationRequired;
    if (pending_plan->fingerprint != fingerprint)
    {
        confirmed_fingerprint.reset();
        return ShipDeploymentError::ConfirmationStale;
    }
    confirmed_fingerprint = fingerprint;
    return ShipDeploymentError::None;
}

ShipDeploymentError ShipDeploymentSession::apply(const Create& create)
{
    if (hasActiveDeployment()) return ShipDeploymentError::ActiveDeployment;
    if (!pending_plan || !confirmed_fingerprint)
        return ShipDeploymentError::ConfirmationRequired;
    if (*confirmed_fingerprint != pending_plan->fingerprint)
        return ShipDeploymentError::ConfirmationStale;

    std::string receipt;
    if (!create || !create(*pending_plan, receipt) || receipt.empty())
    {
        confirmed_fingerprint.reset();
        return ShipDeploymentError::FactoryFailure;
    }
    active_receipt = std::move(receipt);
    pending_plan.reset();
    confirmed_fingerprint.reset();
    return ShipDeploymentError::None;
}

ShipDeploymentError ShipDeploymentSession::rollback(const Destroy& destroy)
{
    if (!hasActiveDeployment()) return ShipDeploymentError::NothingToRollback;
    if (!destroy || !destroy(active_receipt)) return ShipDeploymentError::RollbackFailure;
    active_receipt.clear();
    return ShipDeploymentError::None;
}

const ShipDeploymentPlan* ShipDeploymentSession::pendingPlan() const
{
    return pending_plan ? &*pending_plan : nullptr;
}

void ShipDeploymentSession::invalidatePending()
{
    pending_plan.reset();
    confirmed_fingerprint.reset();
}
