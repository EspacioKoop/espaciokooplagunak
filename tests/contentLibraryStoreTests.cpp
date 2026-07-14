#include "content/contentLibraryStore.h"

#include <algorithm>
#include <atomic>
#include <chrono>
#include <cstdlib>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <string>
#include <thread>
#include <vector>
#include <nlohmann/json.hpp>

#if !defined(_WIN32)
#include <sys/wait.h>
#include <unistd.h>
#endif

namespace fs = std::filesystem;

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

struct TemporaryDirectory
{
    fs::path path;

    explicit TemporaryDirectory(const std::string& suffix)
    {
        const auto stamp = std::chrono::steady_clock::now().time_since_epoch().count();
        path = fs::temp_directory_path() / ("espaciokoop-content-store-" + suffix + "-" + std::to_string(stamp));
        fs::create_directories(path);
    }

    ~TemporaryDirectory()
    {
        std::error_code ignored;
        fs::permissions(path, fs::perms::owner_all, fs::perm_options::add, ignored);
        fs::remove_all(path, ignored);
    }
};

ContentResource campaign(const std::string& id, const std::string& name)
{
    ContentResource result;
    result.type = ContentResourceType::Campaign;
    result.id = id;
    result.name = name;
    result.description = "Campaign description";
    result.primary = "";
    result.secondary = "";
    return result;
}

ContentResource visualMap()
{
    ContentResource result;
    result.type = ContentResourceType::Map;
    result.id = "visual-map";
    result.name = "Visual Map";
    result.primary = "scenario_00_basic.lua";
    result.secondary = "4";
    MapObject asteroid;
    asteroid.id = "asteroid-1";
    asteroid.kind = MapObjectKind::Asteroid;
    asteroid.transform = {1200.0f, -300.0f, 45.0f};
    asteroid.size = 150.0f;
    result.map_document.objects.push_back(asteroid);
    MapObject unsupported;
    unsupported.id = "future-1";
    unsupported.kind = MapObjectKind::Unsupported;
    unsupported.opaque_json = R"({"id":"future-1","kind":"comet","properties":{"tail":10}})";
    result.map_document.objects.push_back(unsupported);
    return result;
}

std::string readAll(const fs::path& path)
{
    std::ifstream input(path, std::ios::binary);
    return {std::istreambuf_iterator<char>(input), std::istreambuf_iterator<char>()};
}

void writeAll(const fs::path& path, const std::string& data)
{
    fs::create_directories(path.parent_path());
    std::ofstream output(path, std::ios::binary | std::ios::trunc);
    output << data;
    output.close();
    expect(bool(output), "test fixture write succeeds");
}

void testRoundTripAndAtomicFailures()
{
    TemporaryDirectory temporary("atomic");
    ContentLibraryStore store(temporary.path / "managed");
    std::vector<ContentResource> loaded;
    auto load_result = store.load(loaded);
    expect(load_result.error == ContentStoreError::None && loaded.empty(), "new store loads empty");
    for (const char* directory : {"library", "exports", "inbox", "backups", "quarantine"})
        expect(fs::is_directory(store.rootPath() / directory), "managed directory exists");

    const std::vector<ContentResource> old_resources{campaign("old", "Old")};
    const std::vector<ContentResource> new_resources{campaign("new", "New")};
    expect(store.save(old_resources) == ContentStoreError::None, "initial commit succeeds");

    store.setTestFault(ContentStoreFault::PermissionBeforeWrite);
    expect(store.save(new_resources) == ContentStoreError::PermissionDenied, "permission failure is reported");
    store.setTestFault(ContentStoreFault::None);
    loaded.clear();
    expect(store.load(loaded).error == ContentStoreError::None && loaded == old_resources,
        "permission failure preserves canonical library");

    store.setTestFault(ContentStoreFault::NoSpaceDuringWrite);
    expect(store.save(new_resources) == ContentStoreError::NoSpace, "disk-full failure is reported");
    store.setTestFault(ContentStoreFault::None);
    loaded.clear();
    expect(store.load(loaded).error == ContentStoreError::None && loaded == old_resources,
        "partial write preserves canonical library");

    TemporaryDirectory initial_no_space("initial-no-space");
    ContentLibraryStore no_space_store(initial_no_space.path / "managed");
    no_space_store.setTestFault(ContentStoreFault::NoSpaceDuringWrite);
    expect(no_space_store.save(new_resources) == ContentStoreError::NoSpace,
        "disk-full during first commit is reported");
    ContentLibraryStore inspect_partial(no_space_store.rootPath());
    loaded.clear();
    expect(inspect_partial.load(loaded).error == ContentStoreError::InvalidData,
        "truncated first commit is quarantined instead of becoming an empty library");

    store.setTestFault(ContentStoreFault::InterruptAfterTempSync);
    expect(store.save(new_resources) == ContentStoreError::Interrupted, "interrupt after temp sync is reported");
    ContentLibraryStore recovered_after_temp(store.rootPath());
    loaded.clear();
    load_result = recovered_after_temp.load(loaded);
    expect(load_result.error == ContentStoreError::None && !load_result.recovered && loaded == old_resources,
        "valid canonical wins over uncommitted temp");

    TemporaryDirectory initial_temporary("initial-temp");
    ContentLibraryStore initial_store(initial_temporary.path / "managed");
    initial_store.setTestFault(ContentStoreFault::InterruptAfterTempSync);
    expect(initial_store.save(new_resources) == ContentStoreError::Interrupted,
        "first commit can be interrupted after syncing temp");
    ContentLibraryStore recovered_initial(initial_store.rootPath());
    loaded.clear();
    load_result = recovered_initial.load(loaded);
    expect(load_result.error == ContentStoreError::None && load_result.recovered && loaded == new_resources,
        "startup promotes synced temp when no canonical exists");

    expect(recovered_after_temp.save(old_resources) == ContentStoreError::None, "reset old canonical succeeds");
    recovered_after_temp.setTestFault(ContentStoreFault::InterruptAfterBackupDestinationSync);
    expect(recovered_after_temp.save(new_resources) == ContentStoreError::Interrupted,
        "interrupt after durable backup destination is reported");
    ContentLibraryStore recovered_between_directory_syncs(store.rootPath());
    loaded.clear();
    load_result = recovered_between_directory_syncs.load(loaded);
    expect(load_result.error == ContentStoreError::None && load_result.recovered && loaded == new_resources,
        "durable backup prevents loss between destination and origin directory sync");
    expect(recovered_between_directory_syncs.save(old_resources) == ContentStoreError::None,
        "reset old canonical after directory-sync recovery succeeds");
    recovered_between_directory_syncs.setTestFault(ContentStoreFault::InterruptAfterBackup);
    expect(recovered_between_directory_syncs.save(new_resources) == ContentStoreError::Interrupted,
        "interrupt after backup rotation is reported");
    ContentLibraryStore recovered_after_backup(store.rootPath());
    loaded.clear();
    load_result = recovered_after_backup.load(loaded);
    expect(load_result.error == ContentStoreError::None && load_result.recovered && loaded == new_resources,
        "startup promotes temp when canonical was rotated");
}

void testMapDocumentRoundTrip()
{
    TemporaryDirectory temporary("map-document");
    ContentLibraryStore store(temporary.path / "managed");
    const auto source = visualMap();
    expect(store.save({source}) == ContentStoreError::None,
        "v3 map document saves through the atomic store");
    std::vector<ContentResource> loaded;
    const auto result = store.load(loaded);
    expect(result.error == ContentStoreError::None && loaded == std::vector<ContentResource>{source},
        "supported and opaque map objects survive atomic save/load");
    const auto canonical = nlohmann::json::parse(
        readAll(store.rootPath() / "library/library.json"));
    expect(canonical["resources"][0]["version"] == 3
            && canonical["resources"][0]["fields"]["objects"].size() == 2,
        "library stores canonical v3 resources without changing its envelope version");
}

void testCorruptionMigrationAndFutureVersion()
{
    TemporaryDirectory temporary("formats");
    ContentLibraryStore store(temporary.path / "managed");
    const auto old_resource = campaign("old", "Old");
    const auto new_resource = campaign("new", "New");
    expect(store.save({old_resource}) == ContentStoreError::None, "old generation saves");
    expect(store.save({new_resource}) == ContentStoreError::None, "new generation saves with backup");
    writeAll(store.rootPath() / "library/library.json", "{broken");

    std::vector<ContentResource> loaded;
    auto result = store.load(loaded);
    expect(result.error == ContentStoreError::None && result.recovered && loaded == std::vector<ContentResource>{old_resource},
        "corrupt canonical recovers last valid backup");
    expect(fs::is_regular_file(store.rootPath() / "quarantine/library.invalid.json"),
        "corrupt canonical is quarantined");
    const auto first_quarantine = readAll(store.rootPath() / "quarantine/library.invalid.json");
    expect(store.save({new_resource}) == ContentStoreError::None,
        "new generation recreates a recovery backup");
    writeAll(store.rootPath() / "library/library.json", "{broken-again");
    loaded.clear();
    result = store.load(loaded);
    expect(result.error == ContentStoreError::None && result.recovered,
        "second corrupt canonical also recovers");
    expect(readAll(store.rootPath() / "quarantine/library.invalid.json") == first_quarantine
            && fs::is_regular_file(store.rootPath() / "quarantine/library.invalid.json.1"),
        "quarantine preserves previous evidence with a unique name");

    nlohmann::json legacy = {
        {"format", "espaciokoop-content-library"},
        {"version", 0},
        {"items", nlohmann::json::array({nlohmann::json::parse(serializeContentResource(new_resource))})},
    };
    writeAll(store.rootPath() / "library/library.json", legacy.dump(2));
    loaded.clear();
    result = store.load(loaded);
    expect(result.error == ContentStoreError::None && result.migrated && loaded == std::vector<ContentResource>{new_resource},
        "version zero migrates sequentially to current");
    const auto migrated = nlohmann::json::parse(readAll(store.rootPath() / "library/library.json"));
    expect(migrated["version"] == 1 && migrated.contains("resources"), "migration rewrites current schema");

    auto future = migrated;
    future["version"] = 2;
    const auto future_data = future.dump(2);
    writeAll(store.rootPath() / "library/library.json", future_data);
    loaded = {old_resource};
    result = store.load(loaded);
    expect(result.error == ContentStoreError::FutureVersion, "future version refuses downgrade");
    expect(readAll(store.rootPath() / "library/library.json") == future_data,
        "future document remains byte-for-byte untouched");
    expect(loaded == std::vector<ContentResource>{old_resource}, "failed future load leaves caller output unchanged");
}

void testManagedImportExportAndSymlinks()
{
    TemporaryDirectory temporary("managed-files");
    ContentLibraryStore store(temporary.path / "managed");
    expect(store.initialize() == ContentStoreError::None, "managed file store initializes");
    const auto resource = campaign("portable", "Portable");

    std::string filename;
    expect(store.exportResource(resource, {resource}, false, filename) == ContentStoreError::None,
        "first managed export succeeds");
    expect(filename == "campaign-portable.json", "export filename is generated from validated identity");
    const auto first_export = readAll(store.rootPath() / "exports" / filename);
    expect(first_export.find("\"dependencies\"") != std::string::npos,
        "managed individual export includes its dependency manifest");
    expect(store.exportResource(resource, {resource}, false, filename) == ContentStoreError::AlreadyExists,
        "export overwrite requires explicit confirmation");
    expect(store.exportResource(resource, {resource}, true, filename) == ContentStoreError::None,
        "confirmed export overwrite succeeds atomically");

    fs::copy_file(store.rootPath() / "exports" / filename, store.rootPath() / "inbox" / "roundtrip.json");
    ContentResource imported;
    expect(store.importFromInbox("roundtrip.json", imported) == ContentStoreError::None && imported == resource,
        "managed inbox imports exported resource");
    std::string second_filename;
    expect(store.exportResource(imported, {imported}, true, second_filename) == ContentStoreError::None,
        "imported resource re-exports");
    expect(readAll(store.rootPath() / "exports" / second_filename) == first_export,
        "export-import-export remains equivalent");

    auto updated_resource = resource;
    updated_resource.name = "Portable Updated";
    store.setTestFault(ContentStoreFault::InterruptAfterTempSync);
    expect(store.exportResource(updated_resource, {updated_resource}, true, filename) == ContentStoreError::Interrupted,
        "managed export can stop after syncing temp");
    ContentLibraryStore recovered_export_before_rotation(store.rootPath());
    expect(recovered_export_before_rotation.initialize() == ContentStoreError::None,
        "export recovery initializes before rotation");
    ContentResource recovered_export;
    expect(parseContentResource(readAll(store.rootPath() / "exports" / filename), recovered_export)
            == ContentResourceError::None && recovered_export == resource,
        "valid exported canonical wins over uncommitted temp");

    recovered_export_before_rotation.setTestFault(ContentStoreFault::InterruptAfterBackup);
    expect(recovered_export_before_rotation.exportResource(
               updated_resource, {updated_resource}, true, filename)
            == ContentStoreError::Interrupted,
        "managed export can stop after backup rotation");
    ContentLibraryStore recovered_export_after_rotation(store.rootPath());
    expect(recovered_export_after_rotation.initialize() == ContentStoreError::None,
        "export recovery initializes after rotation");
    expect(parseContentResource(readAll(store.rootPath() / "exports" / filename), recovered_export)
            == ContentResourceError::None && recovered_export == updated_resource,
        "complete exported temp is promoted after backup rotation");
    expect(fs::is_regular_file(store.rootPath() / "backups" / ("export-" + filename + ".bak")),
        "export recovery retains previous generation backup");

    expect(store.importFromInbox("../exports/campaign-portable.json", imported) == ContentStoreError::InvalidFilename,
        "parent traversal is rejected");
    expect(store.importFromInbox("/tmp/roundtrip.json", imported) == ContentStoreError::InvalidFilename,
        "absolute import path is rejected");
    expect(store.importFromInbox("hidden", imported) == ContentStoreError::InvalidFilename,
        "non-json filename is rejected");
    expect(store.importFromInbox("CON.json", imported) == ContentStoreError::InvalidFilename,
        "reserved Windows device filename is rejected portably");
    expect(store.importFromInbox("CON.foo.json", imported) == ContentStoreError::InvalidFilename,
        "reserved Windows device filename with extra extension is rejected");
    expect(store.importFromInbox("lpt9.backup.json", imported) == ContentStoreError::InvalidFilename,
        "reserved Windows device filename is rejected case-insensitively");

    writeAll(store.rootPath() / "inbox" / "oversized.json",
        std::string(CONTENT_RESOURCE_MAX_IMPORT_BYTES + 1, 'x'));
    expect(store.importFromInbox("oversized.json", imported) == ContentStoreError::FileTooLarge,
        "oversized inbox file is rejected");

#if !defined(_WIN32)
    const auto outside = temporary.path / "outside.json";
    writeAll(outside, serializeContentResource(resource));
    fs::create_symlink(outside, store.rootPath() / "inbox" / "evil.json");
    expect(store.importFromInbox("evil.json", imported) == ContentStoreError::SymlinkRejected,
        "inbox symlink is rejected");
    std::vector<std::string> inbox;
    expect(store.listInbox(inbox) == ContentStoreError::None
        && std::find(inbox.begin(), inbox.end(), "evil.json") == inbox.end(),
        "inbox listing excludes symlinks");

    const auto external_directory = temporary.path / "external-root";
    fs::create_directories(external_directory);
    const auto linked_root = temporary.path / "linked-root";
    fs::create_directory_symlink(external_directory, linked_root);
    ContentLibraryStore symlinked_store(linked_root);
    expect(symlinked_store.initialize() == ContentStoreError::SymlinkRejected,
        "managed root symlink is rejected");

    const auto real_parent = temporary.path / "real-parent";
    fs::create_directory(real_parent);
    const auto linked_parent = temporary.path / "linked-parent";
    fs::create_directory_symlink(real_parent, linked_parent);
    ContentLibraryStore intermediate_symlink_store(linked_parent / "managed");
    expect(intermediate_symlink_store.initialize() == ContentStoreError::SymlinkRejected,
        "intermediate managed path symlink is rejected");
    ContentLibraryStore lexical_bypass_store(linked_parent / ".." / "managed-bypass");
    expect(lexical_bypass_store.initialize() == ContentStoreError::InvalidRoot,
        "dot-dot component is rejected before lexical normalization");

    ContentLibraryStore temp_symlink_store(temporary.path / "temp-symlink-store");
    expect(temp_symlink_store.initialize() == ContentStoreError::None,
        "temp symlink fixture initializes");
    const auto outside_target = temporary.path / "outside-target.json";
    writeAll(outside_target, "sentinel");
    fs::remove(temp_symlink_store.rootPath() / ".store.lock");
    fs::create_symlink(outside_target, temp_symlink_store.rootPath() / ".store.lock");
    expect(temp_symlink_store.save({resource}) == ContentStoreError::SymlinkRejected,
        "store lock symlink is rejected before locking");
    expect(readAll(outside_target) == "sentinel", "rejected lock symlink does not modify external target");
    fs::remove(temp_symlink_store.rootPath() / ".store.lock");
    fs::create_symlink(outside_target,
        temp_symlink_store.rootPath() / "library/library.json.tmp");
    expect(temp_symlink_store.save({resource}) == ContentStoreError::SymlinkRejected,
        "atomic temp symlink is rejected before open");
    expect(readAll(outside_target) == "sentinel", "rejected temp symlink does not truncate external target");

    const auto public_root = temporary.path / "public-root";
    fs::create_directories(public_root);
    fs::permissions(public_root, fs::perms::owner_all | fs::perms::group_read,
        fs::perm_options::replace);
    ContentLibraryStore public_store(public_root);
    expect(public_store.initialize() == ContentStoreError::PermissionDenied,
        "pre-existing group-readable managed root is rejected without chmod");
#endif
}

void testInboxLimitAndConcurrentWriters()
{
    TemporaryDirectory temporary("limits-lock");
    ContentLibraryStore store(temporary.path / "managed");
    expect(store.initialize() == ContentStoreError::None, "limited inbox store initializes");
    const auto resource = campaign("portable", "Portable");
    for (int index = 0; index < 24; ++index)
    {
        const auto name = "import-" + std::to_string(index + 100) + ".json";
        writeAll(store.rootPath() / "inbox" / name, serializeContentResource(resource));
    }
    std::vector<std::string> inbox;
    expect(store.listInbox(inbox) == ContentStoreError::None
            && inbox.size() == ContentLibraryStore::MAX_INBOX_ENTRIES,
        "managed inbox is capped to selector-safe entry count");
    expect(std::is_sorted(inbox.begin(), inbox.end()), "limited inbox remains deterministic");

    std::atomic<bool> thread_writes_ok{true};
    const auto thread_writer = [&](const char* id, const char* name) {
        for (int iteration = 0; iteration < 8; ++iteration)
            if (store.save({campaign(id, name)}) != ContentStoreError::None) thread_writes_ok = false;
    };
    std::thread first_thread(thread_writer, "thread-a", "Thread A");
    std::thread second_thread(thread_writer, "thread-b", "Thread B");
    first_thread.join();
    second_thread.join();
    expect(thread_writes_ok, "same store instance serializes concurrent threads");
    std::vector<ContentResource> thread_loaded;
    expect(store.load(thread_loaded).error == ContentStoreError::None && thread_loaded.size() == 1
            && (thread_loaded[0].id == "thread-a" || thread_loaded[0].id == "thread-b"),
        "threaded final generation is complete and parseable");

#if !defined(_WIN32)
    const auto writer = [&](const char* id, const char* name) {
        ContentLibraryStore child(store.rootPath());
        for (int iteration = 0; iteration < 8; ++iteration)
            if (child.save({campaign(id, name)}) != ContentStoreError::None) _exit(2);
        _exit(0);
    };
    const auto first = fork();
    if (first == 0) writer("writer-a", "Writer A");
    expect(first > 0, "first concurrent writer starts");
    const auto second = fork();
    if (second == 0) writer("writer-b", "Writer B");
    expect(second > 0, "second concurrent writer starts");
    int first_status = 0;
    int second_status = 0;
    expect(waitpid(first, &first_status, 0) == first && waitpid(second, &second_status, 0) == second,
        "concurrent writers finish");
    expect(WIFEXITED(first_status) && WEXITSTATUS(first_status) == 0
            && WIFEXITED(second_status) && WEXITSTATUS(second_status) == 0,
        "concurrent writers commit without temp collisions");
    std::vector<ContentResource> loaded;
    const auto result = store.load(loaded);
    expect(result.error == ContentStoreError::None && loaded.size() == 1
            && (loaded[0].id == "writer-a" || loaded[0].id == "writer-b"),
        "concurrent final generation is complete and parseable");
#endif
}

void testSchemaGuards()
{
    TemporaryDirectory temporary("schema");
    ContentLibraryStore store(temporary.path / "managed");
    const auto resource = campaign("same", "Same");
    expect(store.save({resource, resource}) == ContentStoreError::DuplicateResource,
        "duplicate type and ID cannot be persisted");

    expect(store.initialize() == ContentStoreError::None, "schema store initializes");
    const std::string duplicate_root =
        R"({"format":"espaciokoop-content-library","version":1,"version":1,"resources":[]})";
    writeAll(store.rootPath() / "library/library.json", duplicate_root);
    std::vector<ContentResource> loaded;
    expect(store.load(loaded).error == ContentStoreError::InvalidData,
        "duplicate JSON keys in library document are rejected");
}
}

int main()
{
    testRoundTripAndAtomicFailures();
    testMapDocumentRoundTrip();
    testCorruptionMigrationAndFutureVersion();
    testManagedImportExportAndSymlinks();
    testInboxLimitAndConcurrentWriters();
    testSchemaGuards();
    std::cout << "CONTENT_LIBRARY_STORE_TESTS_OK checks=" << checks << "\n";
    return 0;
}
