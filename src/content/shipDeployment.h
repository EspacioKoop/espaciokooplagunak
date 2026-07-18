#pragma once

#include "content/contentResource.h"
#include "content/shipTemplateCatalog.h"

#include <cstdint>
#include <functional>
#include <optional>
#include <string>
#include <vector>

struct ShipDeploymentPlan
{
    std::string resource_id;
    std::string template_id;
    std::string faction;
    std::string callsign;
    ShipDocument overrides;
    float x = 0.0f;
    float y = 0.0f;
    std::optional<float> rotation;
    std::uint64_t fingerprint = 0;
};

enum class ShipDeploymentError
{
    None,
    ServerRequired,
    InvalidResource,
    TemplateUnavailable,
    FactionUnavailable,
    InvalidPosition,
    UnsupportedResource,
    UnsupportedCargo,
    ConfirmationRequired,
    ConfirmationStale,
    ActiveDeployment,
    FactoryFailure,
    NothingToRollback,
    RollbackFailure,
};

ShipDeploymentError buildShipDeploymentPlan(
    const ContentResource& resource,
    const std::vector<ShipTemplateCatalogEntry>& catalog,
    const std::vector<std::string>& factions,
    float x,
    float y,
    std::optional<float> rotation,
    bool local_server,
    ShipDeploymentPlan& output);

class ShipDeploymentSession
{
public:
    using Create = std::function<bool(const ShipDeploymentPlan&, std::string&)>;
    using Destroy = std::function<bool(const std::string&)>;

    ShipDeploymentError prepare(const ShipDeploymentPlan& plan);
    ShipDeploymentError confirm(std::uint64_t fingerprint);
    ShipDeploymentError apply(const Create& create);
    ShipDeploymentError rollback(const Destroy& destroy);

    const ShipDeploymentPlan* pendingPlan() const;
    const std::string& activeReceipt() const { return active_receipt; }
    bool hasActiveDeployment() const { return !active_receipt.empty(); }
    void invalidatePending();

private:
    std::optional<ShipDeploymentPlan> pending_plan;
    std::optional<std::uint64_t> confirmed_fingerprint;
    std::string active_receipt;
};
