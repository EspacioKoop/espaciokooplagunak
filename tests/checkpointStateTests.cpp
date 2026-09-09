#include "content/checkpointState.h"

#include <cstdlib>
#include <iostream>
#include <string>
#include <nlohmann/json.hpp>

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

CheckpointState complexState()
{
    CheckpointState state;
    state.ship_systems = {
        {"reactor", 0.42f, 0.90f, true},
        {"escudos", 0.0f, 0.0f, false},
        {"maniobra", 1.0f, 1.0f, true},
    };
    state.contacts = {
        {"contacto-1", "krak", 1200.5f, -300.25f, true},
        {"contacto-2", "desconocido", -8000.0f, 0.0f, false},
    };
    state.seeds = {
        {"nave-mural", 1234567890ULL},
        {"blackjack-mesa-1", 42ULL},
    };
    state.campaign_flags = {
        {"crisis-emboscada-activa", "true"},
        {"parlamento-completado", "false"},
        {"waypoint-actual", "sector-7"},
    };
    return state;
}
}

int main()
{
    CheckpointState empty;
    expect(validateCheckpointState(empty) == CheckpointError::None, "empty state is valid");
    CheckpointState reparsed_empty;
    expect(parseCheckpointState(serializeCheckpointState(empty), reparsed_empty) == CheckpointError::None
            && reparsed_empty == empty, "empty state round-trips");

    const auto complex = complexState();
    expect(validateCheckpointState(complex) == CheckpointError::None, "complex state is valid");
    const auto serialized = serializeCheckpointState(complex);
    CheckpointState restored;
    expect(parseCheckpointState(serialized, restored) == CheckpointError::None,
        "complex state parses back without error");
    expect(restored == complex, "complex state round-trips with 100% fidelity");

    expect(serializeCheckpointState(complex, 2).size() > serialized.size(),
        "indented serialization is readable and longer");

    CheckpointState ignored;
    expect(parseCheckpointState("not json", ignored) == CheckpointError::InvalidStructure,
        "garbage input is rejected");
    expect(parseCheckpointState("{}", ignored) == CheckpointError::UnknownFields,
        "missing required fields is rejected");

    nlohmann::json wrong_version = nlohmann::json::parse(serialized);
    wrong_version["version"] = CHECKPOINT_SCHEMA_VERSION + 1;
    expect(parseCheckpointState(wrong_version.dump(), ignored)
            == CheckpointError::UnsupportedFormatOrVersion,
        "future schema version is rejected, not silently accepted");

    // OTACON Astra: compare the schema before any narrowing conversion.
    // Large signed/unsigned integers must not wrap back to the current version.
    const char* invalid_versions[] = {
        "4294967297", "8589934593", "-4294967295", "-8589934591",
        "9223372036854775807", "18446744073709551615",
        "-9223372036854775808", "0", "-1", "2", "1.0", "1e0",
        "true", "null", "\"1\"", "[]", "{}",
    };
    for (const auto* version : invalid_versions)
    {
        auto document = nlohmann::json::parse(serialized);
        document["version"] = nlohmann::json::parse(version);
        auto unchanged = complex;
        expect(parseCheckpointState(document.dump(), unchanged)
                == CheckpointError::UnsupportedFormatOrVersion,
            "unsupported version is rejected without integer narrowing");
        expect(unchanged == complex, "rejected version preserves output state");
    }
    for (const int indent : {-1, 2})
    {
        CheckpointState compatible;
        expect(parseCheckpointState(serializeCheckpointState(complex, indent), compatible)
                == CheckpointError::None && compatible == complex,
            "current schema retains compact and pretty save compatibility");
    }

    nlohmann::json wrong_format = nlohmann::json::parse(serialized);
    wrong_format["format"] = "some-other-format";
    expect(parseCheckpointState(wrong_format.dump(), ignored)
            == CheckpointError::UnsupportedFormatOrVersion,
        "wrong format id is rejected");

    nlohmann::json duplicate_id = nlohmann::json::parse(serialized);
    duplicate_id["simulation"]["ship_systems"][1]["id"] = "reactor";
    expect(parseCheckpointState(duplicate_id.dump(), ignored) == CheckpointError::DuplicateId,
        "duplicate ship system id is rejected");

    nlohmann::json bad_health = nlohmann::json::parse(serialized);
    bad_health["simulation"]["ship_systems"][0]["health"] = 1.5;
    expect(parseCheckpointState(bad_health.dump(), ignored) == CheckpointError::InvalidNumber,
        "out-of-range health is rejected");

    nlohmann::json unknown_field = nlohmann::json::parse(serialized);
    unknown_field["simulation"]["ship_systems"][0]["shield_frequency"] = 1234;
    expect(parseCheckpointState(unknown_field.dump(), ignored) == CheckpointError::UnknownFields,
        "unknown field on a ship system is rejected, not silently ignored");

    std::string duplicate_keys = serialized;
    const auto marker = duplicate_keys.find("\"format\"");
    duplicate_keys.insert(marker, "\"format\":\"decoy\",");
    expect(parseCheckpointState(duplicate_keys, ignored) == CheckpointError::DuplicateJsonKeys,
        "duplicate top-level JSON keys are rejected");

    std::cout << checks << " checkpoint state checks passed\n";
    return 0;
}
