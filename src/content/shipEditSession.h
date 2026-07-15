#pragma once

#include "content/shipDocument.h"

#include <cstddef>
#include <string>
#include <vector>

enum class ShipEditError
{
    None,
    InvalidDocument,
    NotFound,
};

class ShipEditSession
{
public:
    explicit ShipEditSession(ShipDocument clean_document = {});

    const ShipDocument& document() const { return current_document; }
    const ShipDocument& cleanDocument() const { return clean_document; }

    ShipEditError setSystemHealth(ShipSystemId system, float health);
    ShipEditError removeSystemOverride(ShipSystemId system);
    ShipEditError setResourceAmount(const std::string& id, float amount);
    ShipEditError removeResource(const std::string& id);
    ShipEditError setCargoQuantity(const std::string& id, std::uint32_t quantity);
    ShipEditError removeCargo(const std::string& id);
    ShipEditError setCrewPosition(const std::string& id, bool enabled);

    bool canUndo() const { return !undo_history.empty(); }
    bool canRedo() const { return !redo_history.empty(); }
    bool undo();
    bool redo();
    bool isDirty() const { return current_document != clean_document; }
    void markSaved();
    void rollback();

private:
    static constexpr std::size_t history_limit = 100;

    ShipEditError commit(ShipDocument next);

    ShipDocument clean_document;
    ShipDocument current_document;
    std::vector<ShipDocument> undo_history;
    std::vector<ShipDocument> redo_history;
};
