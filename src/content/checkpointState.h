#pragma once

// #766.1: contrato + codec puro de checkpoint de campaña standalone-first.
// Deliberadamente independiente de ContentResource/CONTENT_RESOURCE_SCHEMA_VERSION
// (ver comentario del issue, 2026-09-02): un checkpoint es estado runtime de una
// partida en curso, no contenido de autoría con su propio ciclo de vida.
//
// Alcance de esta fase: estado de nave (salud/energía/operatividad por sistema),
// contactos detectados, semillas deterministas y las variables de campaña que YA
// viven en el escenario Lua (crisis, flags, waypoints) como un mapa de cadenas
// opaco. Bitácora y nivel de alerta hoy viven en foundry-module/ (JS) y quedan
// fuera: issue dependiente antes de que este código las capture.
//
// No incluye todavía: CheckpointStore (I/O en disco), CLI load_checkpoint=,
// ni el puente Lua real que produce/consume campaign_flags.

#include <cstddef>
#include <cstdint>
#include <map>
#include <string>
#include <vector>

struct CheckpointShipSystem
{
    std::string id;
    float health = 1.0f;
    float energy = 1.0f;
    bool operational = true;
};

inline bool operator==(const CheckpointShipSystem& lhs, const CheckpointShipSystem& rhs)
{
    return lhs.id == rhs.id && lhs.health == rhs.health && lhs.energy == rhs.energy
        && lhs.operational == rhs.operational;
}

struct CheckpointContact
{
    std::string id;
    std::string faction;
    float x = 0.0f;
    float y = 0.0f;
    bool identified = false;
};

inline bool operator==(const CheckpointContact& lhs, const CheckpointContact& rhs)
{
    return lhs.id == rhs.id && lhs.faction == rhs.faction && lhs.x == rhs.x && lhs.y == rhs.y
        && lhs.identified == rhs.identified;
}

struct CheckpointState
{
    std::vector<CheckpointShipSystem> ship_systems;
    std::vector<CheckpointContact> contacts;
    // Semillas deterministas del arte procedural y los minijuegos de asistencia
    // (#555 y hermanos): clave = dominio ("nave-mural", "blackjack-mesa-1", ...).
    std::map<std::string, std::uint64_t> seeds;
    // Variables de campaña que ya viven en el escenario Lua activo (crisis, flags,
    // waypoints). Opaco a propósito: el puente Lua real es fase posterior (#766.3);
    // aquí solo se garantiza que lo que entra sale idéntico.
    std::map<std::string, std::string> campaign_flags;
};

inline bool operator==(const CheckpointState& lhs, const CheckpointState& rhs)
{
    return lhs.ship_systems == rhs.ship_systems && lhs.contacts == rhs.contacts
        && lhs.seeds == rhs.seeds && lhs.campaign_flags == rhs.campaign_flags;
}

inline bool operator!=(const CheckpointState& lhs, const CheckpointState& rhs)
{
    return !(lhs == rhs);
}

enum class CheckpointError
{
    None,
    InvalidStructure,
    UnknownFields,
    UnsupportedFormatOrVersion,
    DuplicateJsonKeys,
    TooManySystems,
    TooManyContacts,
    TooManySeeds,
    TooManyFlags,
    InvalidId,
    DuplicateId,
    InvalidNumber,
    TooLarge,
};

constexpr int CHECKPOINT_SCHEMA_VERSION = 1;
constexpr const char* CHECKPOINT_FORMAT_ID = "espaciokoop-campaign-checkpoint";
constexpr std::size_t CHECKPOINT_MAX_SHIP_SYSTEMS = 64;
constexpr std::size_t CHECKPOINT_MAX_CONTACTS = 512;
constexpr std::size_t CHECKPOINT_MAX_SEEDS = 64;
constexpr std::size_t CHECKPOINT_MAX_FLAGS = 1024;
constexpr std::size_t CHECKPOINT_MAX_SERIALIZED_BYTES = 512 * 1024;

CheckpointError validateCheckpointState(const CheckpointState& state);
std::string serializeCheckpointState(const CheckpointState& state, int indent = -1);
CheckpointError parseCheckpointState(const std::string& input, CheckpointState& output);
