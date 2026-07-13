#pragma once

#include "content/contentResource.h"

#include <filesystem>
#include <string>
#include <vector>

enum class ContentStoreError
{
    None,
    NotConfigured,
    InvalidRoot,
    SymlinkRejected,
    NotRegularFile,
    NotFound,
    InvalidFilename,
    FileTooLarge,
    InvalidData,
    DuplicateResource,
    FutureVersion,
    PermissionDenied,
    NoSpace,
    IoError,
    AlreadyExists,
    Interrupted,
};

enum class ContentStoreFault
{
    None,
    PermissionBeforeWrite,
    NoSpaceDuringWrite,
    InterruptAfterTempSync,
    InterruptAfterBackupDestinationSync,
    InterruptAfterBackup,
};

struct ContentStoreLoadResult
{
    ContentStoreError error = ContentStoreError::None;
    bool recovered = false;
    bool migrated = false;
};

class ContentLibraryStore
{
public:
    static constexpr std::size_t MAX_LIBRARY_BYTES = 8 * 1024 * 1024;
    static constexpr std::size_t MAX_RESOURCES = 4096;
    static constexpr std::size_t MAX_INBOX_ENTRIES = 16;

    ContentLibraryStore();
    explicit ContentLibraryStore(std::filesystem::path root);
    ~ContentLibraryStore();

    ContentLibraryStore(const ContentLibraryStore&) = delete;
    ContentLibraryStore& operator=(const ContentLibraryStore&) = delete;

    static void configureDefaultRoot(const std::filesystem::path& configuration_root);

    ContentStoreError initialize();
    ContentStoreLoadResult load(std::vector<ContentResource>& resources);
    ContentStoreError save(const std::vector<ContentResource>& resources);

    ContentStoreError listInbox(std::vector<std::string>& filenames);
    ContentStoreError importFromInbox(const std::string& filename, ContentResource& resource);
    ContentStoreError exportResource(const ContentResource& resource, bool overwrite, std::string& filename);

    const std::filesystem::path& rootPath() const { return root; }
    void setTestFault(ContentStoreFault value) { fault = value; }

private:
    friend class ContentStoreLockGuard;
    std::filesystem::path root;
    ContentStoreFault fault = ContentStoreFault::None;
    unsigned int lock_depth = 0;
#if defined(_WIN32)
    void* lock_handle = nullptr;
#else
    int lock_descriptor = -1;
#endif

    std::filesystem::path libraryDirectory() const;
    std::filesystem::path libraryPath() const;
    std::filesystem::path tempPath() const;
    std::filesystem::path backupPath() const;
    std::filesystem::path exportsDirectory() const;
    std::filesystem::path inboxDirectory() const;
    std::filesystem::path quarantineDirectory() const;

    ContentStoreError ensureManagedDirectory(const std::filesystem::path& path);
    ContentStoreError acquireLock();
    void releaseLock();
    ContentStoreError writeSynced(const std::filesystem::path& path, const std::string& data);
    ContentStoreError commitDocument(const std::string& data);
    ContentStoreError readRegularFile(const std::filesystem::path& path, std::size_t limit, std::string& data) const;
    ContentStoreError parseLibrary(const std::string& data, std::vector<ContentResource>& resources, bool& migrated) const;
    ContentStoreError loadCandidate(const std::filesystem::path& path, std::vector<ContentResource>& resources, bool& migrated) const;
    ContentStoreError recoverManagedExports();
    ContentStoreError syncDirectory(const std::filesystem::path& path) const;
};

const char* contentStoreErrorId(ContentStoreError error);
