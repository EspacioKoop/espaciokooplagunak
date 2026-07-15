#include "content/contentLibraryStore.h"

#include <algorithm>
#include <cerrno>
#include <cctype>
#include <cstdint>
#include <map>
#include <set>
#include <system_error>
#include <utility>
#include <nlohmann/json.hpp>

#if defined(_WIN32)
#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <windows.h>
#include <fcntl.h>
#include <io.h>
#include <sys/stat.h>
#else
#include <fcntl.h>
#include <sys/file.h>
#include <sys/stat.h>
#include <unistd.h>
#endif

namespace fs = std::filesystem;

class ContentStoreLockGuard
{
public:
    explicit ContentStoreLockGuard(ContentLibraryStore& store)
    : store(store), thread_lock(store.operation_mutex), result(store.acquireLock()),
      acquired(result == ContentStoreError::None)
    {
    }

    ~ContentStoreLockGuard()
    {
        if (acquired) store.releaseLock();
    }

    ContentStoreError error() const { return result; }

private:
    ContentLibraryStore& store;
    std::unique_lock<std::recursive_mutex> thread_lock;
    ContentStoreError result;
    bool acquired;
};

namespace
{
fs::path configured_root;
bool configured_root_invalid = false;

ContentStoreError errorFromCode(const std::error_code& error)
{
    if (!error) return ContentStoreError::None;
    if (error == std::errc::permission_denied) return ContentStoreError::PermissionDenied;
    if (error == std::errc::no_space_on_device) return ContentStoreError::NoSpace;
    return ContentStoreError::IoError;
}

ContentStoreError errorFromErrno(int value)
{
    if (value == EACCES || value == EPERM) return ContentStoreError::PermissionDenied;
    if (value == ENOSPC) return ContentStoreError::NoSpace;
#if defined(EDQUOT)
    if (value == EDQUOT) return ContentStoreError::NoSpace;
#endif
    return ContentStoreError::IoError;
}

#if defined(_WIN32)
ContentStoreError errorFromWindows(DWORD value)
{
    if (value == ERROR_FILE_NOT_FOUND || value == ERROR_PATH_NOT_FOUND)
        return ContentStoreError::NotFound;
    if (value == ERROR_ACCESS_DENIED || value == ERROR_SHARING_VIOLATION)
        return ContentStoreError::PermissionDenied;
    if (value == ERROR_DISK_FULL || value == ERROR_HANDLE_DISK_FULL)
        return ContentStoreError::NoSpace;
    return ContentStoreError::IoError;
}
#endif

void renamePath(const fs::path& source, const fs::path& destination, std::error_code& error)
{
#if defined(_WIN32)
    if (MoveFileExW(source.wstring().c_str(), destination.wstring().c_str(), MOVEFILE_WRITE_THROUGH))
        error.clear();
    else
        error = std::error_code(static_cast<int>(GetLastError()), std::system_category());
#else
    fs::rename(source, destination, error);
#endif
}

bool hasDuplicateJsonKeys(const std::string& input)
{
    std::map<int, std::set<std::string>> keys_by_depth;
    int depth = 0;
    bool duplicate = false;
    auto callback = [&](int, nlohmann::json::parse_event_t event, nlohmann::json& parsed) {
        if (event == nlohmann::json::parse_event_t::object_start)
        {
            ++depth;
            keys_by_depth[depth].clear();
        }
        else if (event == nlohmann::json::parse_event_t::object_end)
        {
            keys_by_depth.erase(depth);
            --depth;
        }
        else if (event == nlohmann::json::parse_event_t::key)
        {
            const auto key = parsed.get<std::string>();
            if (!keys_by_depth[depth].insert(key).second) duplicate = true;
        }
        return true;
    };
    [[maybe_unused]] const auto checked = nlohmann::json::parse(input, callback, false, false);
    return duplicate;
}

bool portableFilename(const std::string& value)
{
    if (value.empty() || value.size() > 128 || value.front() == '.') return false;
    if (value.size() < 6 || value.compare(value.size() - 5, 5, ".json") != 0) return false;
    if (!std::all_of(value.begin(), value.end(), [](char c) {
        return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z')
            || (c >= '0' && c <= '9') || c == '_' || c == '-' || c == '.';
    })) return false;
    auto device_name = value.substr(0, value.find('.'));
    std::transform(device_name.begin(), device_name.end(), device_name.begin(), [](unsigned char c) {
        return static_cast<char>(std::toupper(c));
    });
    static const std::set<std::string> reserved = {
        "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5",
        "COM6", "COM7", "COM8", "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5",
        "LPT6", "LPT7", "LPT8", "LPT9",
    };
    return reserved.count(device_name) == 0;
}

fs::path normalizedRoot(const fs::path& input, bool& invalid)
{
    invalid = input.empty();
    for (const auto& component : input)
        if (component == "." || component == "..") invalid = true;
    std::error_code error;
    const auto absolute = fs::absolute(input, error);
    if (error)
    {
        invalid = true;
        return {};
    }
    return absolute.lexically_normal();
}

ContentStoreError validatePathComponents(const fs::path& path)
{
    std::error_code error;
    const auto absolute = fs::absolute(path, error).lexically_normal();
    if (error || absolute.empty()) return ContentStoreError::InvalidRoot;
    fs::path current = absolute.root_path();
    for (const auto& component : absolute.relative_path())
    {
        current /= component;
        error.clear();
        const auto status = fs::symlink_status(current, error);
        if (error == std::errc::no_such_file_or_directory || !fs::exists(status))
            return current == absolute ? ContentStoreError::None : ContentStoreError::InvalidRoot;
        if (error) return errorFromCode(error);
        if (fs::is_symlink(status)) return ContentStoreError::SymlinkRejected;
#if defined(_WIN32)
        const auto attributes = GetFileAttributesW(current.wstring().c_str());
        if (attributes == INVALID_FILE_ATTRIBUTES) return errorFromWindows(GetLastError());
        if ((attributes & FILE_ATTRIBUTE_REPARSE_POINT) != 0)
            return ContentStoreError::SymlinkRejected;
#endif
    }
    return ContentStoreError::None;
}

std::string resourceKey(const ContentResource& resource)
{
    return contentResourceTypeId(resource.type) + ":" + resource.id;
}
}

ContentLibraryStore::ContentLibraryStore()
: root(configured_root), invalid_root_path(configured_root_invalid)
{
}

ContentLibraryStore::ContentLibraryStore(fs::path root)
{
    this->root = normalizedRoot(root, invalid_root_path);
}

ContentLibraryStore::~ContentLibraryStore()
{
    while (lock_depth > 0) releaseLock();
}

void ContentLibraryStore::configureDefaultRoot(const fs::path& configuration_root)
{
    configured_root = normalizedRoot(configuration_root / "content-editor", configured_root_invalid);
}

fs::path ContentLibraryStore::libraryDirectory() const { return root / "library"; }
fs::path ContentLibraryStore::libraryPath() const { return libraryDirectory() / "library.json"; }
fs::path ContentLibraryStore::tempPath() const { return libraryDirectory() / "library.json.tmp"; }
fs::path ContentLibraryStore::backupPath() const { return root / "backups" / "library.json.bak"; }
fs::path ContentLibraryStore::exportsDirectory() const { return root / "exports"; }
fs::path ContentLibraryStore::inboxDirectory() const { return root / "inbox"; }
fs::path ContentLibraryStore::quarantineDirectory() const { return root / "quarantine"; }

ContentStoreError ContentLibraryStore::ensureManagedDirectory(const fs::path& path)
{
    const auto path_result = validatePathComponents(path);
    if (path_result != ContentStoreError::None) return path_result;
    std::error_code error;
    bool created = false;
    auto status = fs::symlink_status(path, error);
    if (error && error != std::errc::no_such_file_or_directory) return errorFromCode(error);
    if (fs::is_symlink(status)) return ContentStoreError::SymlinkRejected;
    if (fs::exists(status) && !fs::is_directory(status)) return ContentStoreError::InvalidRoot;
    if (!fs::exists(status))
    {
        fs::create_directory(path, error);
        if (error) return errorFromCode(error);
        created = true;
        status = fs::symlink_status(path, error);
        if (error) return errorFromCode(error);
        if (fs::is_symlink(status) || !fs::is_directory(status)) return ContentStoreError::InvalidRoot;
    }
#if !defined(_WIN32)
    if (created)
    {
        fs::permissions(path, fs::perms::owner_all, fs::perm_options::replace, error);
        if (error) return errorFromCode(error);
    }
    const auto permissions = fs::status(path, error).permissions();
    if (error) return errorFromCode(error);
    constexpr auto public_permissions = fs::perms::group_all | fs::perms::others_all;
    if ((permissions & public_permissions) != fs::perms::none)
        return ContentStoreError::PermissionDenied;
#endif
    if (created)
    {
        auto result = syncDirectory(path);
        if (result != ContentStoreError::None) return result;
        result = syncDirectory(path.parent_path());
        if (result != ContentStoreError::None) return result;
    }
    return ContentStoreError::None;
}

ContentStoreError ContentLibraryStore::acquireLock()
{
    if (lock_depth > 0)
    {
        ++lock_depth;
        return ContentStoreError::None;
    }
    const auto path = root / ".store.lock";
#if defined(_WIN32)
    const HANDLE handle = CreateFileW(path.wstring().c_str(), GENERIC_READ | GENERIC_WRITE,
        FILE_SHARE_READ | FILE_SHARE_WRITE, nullptr, OPEN_ALWAYS, FILE_FLAG_OPEN_REPARSE_POINT, nullptr);
    if (handle == INVALID_HANDLE_VALUE) return errorFromWindows(GetLastError());
    BY_HANDLE_FILE_INFORMATION information{};
    if (!GetFileInformationByHandle(handle, &information))
    {
        const auto error = errorFromWindows(GetLastError());
        CloseHandle(handle);
        return error;
    }
    if ((information.dwFileAttributes & FILE_ATTRIBUTE_REPARSE_POINT) != 0)
    {
        CloseHandle(handle);
        return ContentStoreError::SymlinkRejected;
    }
    OVERLAPPED overlapped{};
    if (!LockFileEx(handle, LOCKFILE_EXCLUSIVE_LOCK, 0, MAXDWORD, MAXDWORD, &overlapped))
    {
        const auto error = errorFromWindows(GetLastError());
        CloseHandle(handle);
        return error;
    }
    lock_handle = handle;
#else
    const int descriptor = open(path.c_str(), O_RDWR | O_CREAT | O_CLOEXEC | O_NOFOLLOW, 0600);
    if (descriptor < 0)
    {
        if (errno == ELOOP) return ContentStoreError::SymlinkRejected;
        return errorFromErrno(errno);
    }
    while (flock(descriptor, LOCK_EX) != 0)
    {
        if (errno == EINTR) continue;
        const int saved_errno = errno;
        close(descriptor);
        return errorFromErrno(saved_errno);
    }
    lock_descriptor = descriptor;
#endif
    lock_depth = 1;
    return ContentStoreError::None;
}

void ContentLibraryStore::releaseLock()
{
    if (lock_depth == 0 || --lock_depth > 0) return;
#if defined(_WIN32)
    const HANDLE handle = static_cast<HANDLE>(lock_handle);
    OVERLAPPED overlapped{};
    UnlockFileEx(handle, 0, MAXDWORD, MAXDWORD, &overlapped);
    CloseHandle(handle);
    lock_handle = nullptr;
#else
    flock(lock_descriptor, LOCK_UN);
    close(lock_descriptor);
    lock_descriptor = -1;
#endif
}

ContentStoreError ContentLibraryStore::initialize()
{
    std::lock_guard<std::recursive_mutex> thread_lock(operation_mutex);
    if (invalid_root_path) return ContentStoreError::InvalidRoot;
    if (root.empty()) return ContentStoreError::NotConfigured;
    auto result = ensureManagedDirectory(root);
    if (result != ContentStoreError::None) return result;
    ContentStoreLockGuard lock(*this);
    if (lock.error() != ContentStoreError::None) return lock.error();
    for (const auto& path : {
        libraryDirectory(), exportsDirectory(), inboxDirectory(), root / "backups", quarantineDirectory()
    })
    {
        result = ensureManagedDirectory(path);
        if (result != ContentStoreError::None) return result;
    }
    return recoverManagedExports();
}

ContentStoreError ContentLibraryStore::recoverManagedExports()
{
    auto collectEntries = [](const fs::path& directory, std::vector<fs::path>& entries) {
        std::error_code error;
        for (fs::directory_iterator iterator(directory, error), end;
             iterator != end && !error; iterator.increment(error))
            entries.push_back(iterator->path());
        if (error) return errorFromCode(error);
        std::sort(entries.begin(), entries.end());
        return ContentStoreError::None;
    };

    std::vector<fs::path> export_entries;
    auto result = collectEntries(exportsDirectory(), export_entries);
    if (result != ContentStoreError::None) return result;
    for (const auto& temporary : export_entries)
    {
        const auto temporary_name = temporary.filename().string();
        if (temporary_name.size() <= 4 || temporary_name.substr(temporary_name.size() - 4) != ".tmp") continue;
        const auto filename = temporary_name.substr(0, temporary_name.size() - 4);
        if (!portableFilename(filename)) continue;

        std::error_code error;
        const auto temporary_status = fs::symlink_status(temporary, error);
        if (error) return errorFromCode(error);
        if (fs::is_symlink(temporary_status)) return ContentStoreError::SymlinkRejected;
        if (!fs::is_regular_file(temporary_status)) return ContentStoreError::NotRegularFile;

        const auto destination = exportsDirectory() / filename;
        const auto backup = root / "backups" / ("export-" + filename + ".bak");
        const auto destination_status = fs::symlink_status(destination, error);
        if (error && error != std::errc::no_such_file_or_directory) return errorFromCode(error);
        if (fs::is_symlink(destination_status)) return ContentStoreError::SymlinkRejected;
        if (fs::exists(destination_status))
        {
            if (!fs::is_regular_file(destination_status)) return ContentStoreError::NotRegularFile;
            error.clear();
            fs::remove(temporary, error);
            if (error) return errorFromCode(error);
            result = syncDirectory(exportsDirectory());
            if (result != ContentStoreError::None) return result;
            continue;
        }

        std::string data;
        ContentResource resource;
        result = readRegularFile(temporary, CONTENT_RESOURCE_MAX_IMPORT_BYTES, data);
        if (result == ContentStoreError::None
            && parseContentResource(data, resource) == ContentResourceError::None)
        {
            error.clear();
            renamePath(temporary, destination, error);
            if (error) return errorFromCode(error);
            result = syncDirectory(exportsDirectory());
            if (result != ContentStoreError::None) return result;
            continue;
        }

        error.clear();
        fs::remove(temporary, error);
        if (error) return errorFromCode(error);
        const auto backup_status = fs::symlink_status(backup, error);
        if (error && error != std::errc::no_such_file_or_directory) return errorFromCode(error);
        if (fs::is_symlink(backup_status)) return ContentStoreError::SymlinkRejected;
        if (fs::exists(backup_status))
        {
            if (!fs::is_regular_file(backup_status)) return ContentStoreError::NotRegularFile;
            error.clear();
            renamePath(backup, destination, error);
            if (error) return errorFromCode(error);
            result = syncDirectory(exportsDirectory());
            if (result != ContentStoreError::None) return result;
            result = syncDirectory(root / "backups");
            if (result != ContentStoreError::None) return result;
        }
    }

    std::vector<fs::path> backup_entries;
    result = collectEntries(root / "backups", backup_entries);
    if (result != ContentStoreError::None) return result;
    for (const auto& backup : backup_entries)
    {
        const auto backup_name = backup.filename().string();
        if (backup_name.rfind("export-", 0) != 0 || backup_name.size() <= 11
            || backup_name.substr(backup_name.size() - 4) != ".bak") continue;
        const auto filename = backup_name.substr(7, backup_name.size() - 11);
        if (!portableFilename(filename)) continue;

        std::error_code error;
        const auto backup_status = fs::symlink_status(backup, error);
        if (error) return errorFromCode(error);
        if (fs::is_symlink(backup_status)) return ContentStoreError::SymlinkRejected;
        if (!fs::is_regular_file(backup_status)) return ContentStoreError::NotRegularFile;
        const auto destination = exportsDirectory() / filename;
        const auto destination_status = fs::symlink_status(destination, error);
        if (error && error != std::errc::no_such_file_or_directory) return errorFromCode(error);
        if (fs::is_symlink(destination_status)) return ContentStoreError::SymlinkRejected;
        if (fs::exists(destination_status)) continue;

        error.clear();
        renamePath(backup, destination, error);
        if (error) return errorFromCode(error);
        result = syncDirectory(exportsDirectory());
        if (result != ContentStoreError::None) return result;
        result = syncDirectory(root / "backups");
        if (result != ContentStoreError::None) return result;
    }
    return ContentStoreError::None;
}

ContentStoreError ContentLibraryStore::writeSynced(const fs::path& path, const std::string& data)
{
    if (fault == ContentStoreFault::PermissionBeforeWrite) return ContentStoreError::PermissionDenied;

#if defined(_WIN32)
    const HANDLE handle = CreateFileW(path.wstring().c_str(), GENERIC_READ | GENERIC_WRITE,
        FILE_SHARE_READ, nullptr, OPEN_ALWAYS,
        FILE_ATTRIBUTE_NORMAL | FILE_FLAG_OPEN_REPARSE_POINT | FILE_FLAG_WRITE_THROUGH, nullptr);
    if (handle == INVALID_HANDLE_VALUE) return errorFromWindows(GetLastError());
    BY_HANDLE_FILE_INFORMATION information{};
    if (!GetFileInformationByHandle(handle, &information))
    {
        const auto error = errorFromWindows(GetLastError());
        CloseHandle(handle);
        return error;
    }
    if ((information.dwFileAttributes & FILE_ATTRIBUTE_REPARSE_POINT) != 0)
    {
        CloseHandle(handle);
        return ContentStoreError::SymlinkRejected;
    }
    if ((information.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) != 0)
    {
        CloseHandle(handle);
        return ContentStoreError::NotRegularFile;
    }
    LARGE_INTEGER beginning{};
    if (!SetFilePointerEx(handle, beginning, nullptr, FILE_BEGIN) || !SetEndOfFile(handle))
    {
        const auto error = errorFromWindows(GetLastError());
        CloseHandle(handle);
        return error;
    }
    const std::size_t limit = fault == ContentStoreFault::NoSpaceDuringWrite ? data.size() / 2 : data.size();
    std::size_t offset = 0;
    while (offset < limit)
    {
        const DWORD chunk = static_cast<DWORD>(std::min<std::size_t>(limit - offset, 1U << 20));
        DWORD count = 0;
        if (!WriteFile(handle, data.data() + offset, chunk, &count, nullptr) || count == 0)
        {
            const auto error = errorFromWindows(GetLastError());
            CloseHandle(handle);
            return error;
        }
        offset += count;
    }
    if (!FlushFileBuffers(handle))
    {
        const auto error = errorFromWindows(GetLastError());
        CloseHandle(handle);
        return error;
    }
    if (!CloseHandle(handle)) return ContentStoreError::IoError;
    if (fault == ContentStoreFault::NoSpaceDuringWrite) return ContentStoreError::NoSpace;
#else
    std::error_code status_error;
    const auto status = fs::symlink_status(path, status_error);
    if (status_error && status_error != std::errc::no_such_file_or_directory)
        return errorFromCode(status_error);
    if (fs::is_symlink(status)) return ContentStoreError::SymlinkRejected;
    if (fs::exists(status) && !fs::is_regular_file(status)) return ContentStoreError::NotRegularFile;

    const int descriptor = open(path.c_str(), O_WRONLY | O_CREAT | O_TRUNC | O_CLOEXEC | O_NOFOLLOW, 0600);
    if (descriptor < 0)
    {
        if (errno == ELOOP) return ContentStoreError::SymlinkRejected;
        return errorFromErrno(errno);
    }
    const std::size_t limit = fault == ContentStoreFault::NoSpaceDuringWrite ? data.size() / 2 : data.size();
    std::size_t offset = 0;
    while (offset < limit)
    {
        const auto count = write(descriptor, data.data() + offset, limit - offset);
        if (count < 0 && errno == EINTR) continue;
        if (count <= 0)
        {
            const int saved_errno = errno;
            close(descriptor);
            return errorFromErrno(saved_errno);
        }
        offset += static_cast<std::size_t>(count);
    }
    if (fsync(descriptor) != 0)
    {
        const int saved_errno = errno;
        close(descriptor);
        return errorFromErrno(saved_errno);
    }
    if (close(descriptor) != 0) return ContentStoreError::IoError;
    if (fault == ContentStoreFault::NoSpaceDuringWrite) return ContentStoreError::NoSpace;
#endif
    return ContentStoreError::None;
}

ContentStoreError ContentLibraryStore::syncDirectory(const fs::path& path) const
{
#if !defined(_WIN32)
    const int descriptor = open(path.c_str(), O_RDONLY | O_DIRECTORY | O_CLOEXEC);
    if (descriptor < 0) return errorFromErrno(errno);
    if (fsync(descriptor) != 0)
    {
        const int saved_errno = errno;
        close(descriptor);
        return errorFromErrno(saved_errno);
    }
    if (close(descriptor) != 0) return ContentStoreError::IoError;
#else
    (void)path;
#endif
    return ContentStoreError::None;
}

ContentStoreError ContentLibraryStore::readRegularFile(const fs::path& path, std::size_t limit, std::string& data) const
{
#if defined(_WIN32)
    const HANDLE handle = CreateFileW(path.wstring().c_str(), GENERIC_READ, FILE_SHARE_READ,
        nullptr, OPEN_EXISTING, FILE_FLAG_OPEN_REPARSE_POINT | FILE_FLAG_SEQUENTIAL_SCAN, nullptr);
    if (handle == INVALID_HANDLE_VALUE) return errorFromWindows(GetLastError());

    BY_HANDLE_FILE_INFORMATION information{};
    if (!GetFileInformationByHandle(handle, &information))
    {
        const auto error = errorFromWindows(GetLastError());
        CloseHandle(handle);
        return error;
    }
    if ((information.dwFileAttributes & FILE_ATTRIBUTE_REPARSE_POINT) != 0)
    {
        CloseHandle(handle);
        return ContentStoreError::SymlinkRejected;
    }
    if ((information.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) != 0)
    {
        CloseHandle(handle);
        return ContentStoreError::NotRegularFile;
    }
    LARGE_INTEGER size{};
    if (!GetFileSizeEx(handle, &size))
    {
        const auto error = errorFromWindows(GetLastError());
        CloseHandle(handle);
        return error;
    }
    if (size.QuadPart < 0 || static_cast<unsigned long long>(size.QuadPart) > limit)
    {
        CloseHandle(handle);
        return ContentStoreError::FileTooLarge;
    }

    data.clear();
    data.reserve(static_cast<std::size_t>(size.QuadPart));
    char buffer[8192];
    while (data.size() <= limit)
    {
        DWORD count = 0;
        const auto remaining = std::min<std::size_t>(sizeof(buffer), limit + 1 - data.size());
        if (!ReadFile(handle, buffer, static_cast<DWORD>(remaining), &count, nullptr))
        {
            const auto error = errorFromWindows(GetLastError());
            CloseHandle(handle);
            return error;
        }
        if (count == 0) break;
        data.append(buffer, count);
    }
    if (!CloseHandle(handle)) return ContentStoreError::IoError;
#else
    const int descriptor = open(path.c_str(), O_RDONLY | O_CLOEXEC | O_NOFOLLOW);
    if (descriptor < 0)
    {
        if (errno == ENOENT) return ContentStoreError::NotFound;
        if (errno == ELOOP) return ContentStoreError::SymlinkRejected;
        return errorFromErrno(errno);
    }
    struct stat information{};
    if (fstat(descriptor, &information) != 0)
    {
        const int saved_errno = errno;
        close(descriptor);
        return errorFromErrno(saved_errno);
    }
    if (!S_ISREG(information.st_mode))
    {
        close(descriptor);
        return ContentStoreError::NotRegularFile;
    }
    if (information.st_size < 0 || static_cast<unsigned long long>(information.st_size) > limit)
    {
        close(descriptor);
        return ContentStoreError::FileTooLarge;
    }

    data.clear();
    data.reserve(static_cast<std::size_t>(information.st_size));
    char buffer[8192];
    while (data.size() <= limit)
    {
        const auto remaining = std::min<std::size_t>(sizeof(buffer), limit + 1 - data.size());
        const auto count = read(descriptor, buffer, remaining);
        if (count < 0)
        {
            const int saved_errno = errno;
            close(descriptor);
            return errorFromErrno(saved_errno);
        }
        if (count == 0) break;
        data.append(buffer, static_cast<std::size_t>(count));
    }
    if (close(descriptor) != 0) return ContentStoreError::IoError;
#endif
    return data.size() > limit ? ContentStoreError::FileTooLarge : ContentStoreError::None;
}

ContentStoreError ContentLibraryStore::parseLibrary(
    const std::string& data, std::vector<ContentResource>& resources, bool& migrated) const
{
    if (hasDuplicateJsonKeys(data)) return ContentStoreError::InvalidData;
    const auto document = nlohmann::json::parse(data, nullptr, false);
    if (document.is_discarded() || !document.is_object()) return ContentStoreError::InvalidData;
    if (!document.contains("format") || !document["format"].is_string()
        || document["format"].get<std::string>() != "espaciokoop-content-library"
        || !document.contains("version"))
        return ContentStoreError::InvalidData;

    std::uint64_t version = 0;
    if (document["version"].is_number_unsigned()) version = document["version"].get<std::uint64_t>();
    else if (document["version"].is_number_integer())
    {
        const auto signed_version = document["version"].get<std::int64_t>();
        if (signed_version < 0) return ContentStoreError::InvalidData;
        version = static_cast<std::uint64_t>(signed_version);
    }
    else return ContentStoreError::InvalidData;
    if (version > 1) return ContentStoreError::FutureVersion;

    const char* array_key = version == 0 ? "items" : "resources";
    const std::set<std::string> expected = version == 0
        ? std::set<std::string>{"format", "version", "items"}
        : std::set<std::string>{"format", "version", "resources"};
    for (auto it = document.begin(); it != document.end(); ++it)
        if (!expected.count(it.key())) return ContentStoreError::InvalidData;
    if (!document.contains(array_key) || !document[array_key].is_array()) return ContentStoreError::InvalidData;
    if (document[array_key].size() > MAX_RESOURCES) return ContentStoreError::FileTooLarge;

    std::vector<ContentResource> candidate;
    std::set<std::string> identities;
    migrated = version == 0;
    candidate.reserve(document[array_key].size());
    for (const auto& item : document[array_key])
    {
        ContentResource resource;
        if (parseContentResource(item.dump(), resource) != ContentResourceError::None)
            return ContentStoreError::InvalidData;
        if (!identities.insert(resourceKey(resource)).second)
            return ContentStoreError::DuplicateResource;
        const auto canonical = nlohmann::json::parse(serializeContentResource(resource), nullptr, false);
        if (canonical.is_discarded()) return ContentStoreError::InvalidData;
        if (item != canonical) migrated = true;
        candidate.push_back(std::move(resource));
    }
    resources = std::move(candidate);
    return ContentStoreError::None;
}

ContentStoreError ContentLibraryStore::loadCandidate(
    const fs::path& path, std::vector<ContentResource>& resources, bool& migrated) const
{
    std::string data;
    auto result = readRegularFile(path, MAX_LIBRARY_BYTES, data);
    if (result != ContentStoreError::None) return result;
    return parseLibrary(data, resources, migrated);
}

ContentStoreError ContentLibraryStore::commitDocument(const std::string& data)
{
    auto result = initialize();
    if (result != ContentStoreError::None) return result;
    ContentStoreLockGuard lock(*this);
    if (lock.error() != ContentStoreError::None) return lock.error();
    result = writeSynced(tempPath(), data);
    if (result != ContentStoreError::None) return result;
    if (fault == ContentStoreFault::InterruptAfterTempSync) return ContentStoreError::Interrupted;

    std::error_code error;
    const auto current_status = fs::symlink_status(libraryPath(), error);
    if (error && error != std::errc::no_such_file_or_directory) return errorFromCode(error);
    if (fs::is_symlink(current_status)) return ContentStoreError::SymlinkRejected;
    if (fs::exists(current_status) && !fs::is_regular_file(current_status)) return ContentStoreError::NotRegularFile;

    const auto backup_status = fs::symlink_status(backupPath(), error);
    if (error && error != std::errc::no_such_file_or_directory) return errorFromCode(error);
    if (fs::is_symlink(backup_status)) return ContentStoreError::SymlinkRejected;
    if (fs::exists(backup_status))
    {
        if (!fs::is_regular_file(backup_status)) return ContentStoreError::NotRegularFile;
        fs::remove(backupPath(), error);
        if (error) return errorFromCode(error);
    }
    if (fs::exists(current_status))
    {
        renamePath(libraryPath(), backupPath(), error);
        if (error) return errorFromCode(error);
        result = syncDirectory(backupPath().parent_path());
        if (result != ContentStoreError::None) return result;
        if (fault == ContentStoreFault::InterruptAfterBackupDestinationSync)
            return ContentStoreError::Interrupted;
        result = syncDirectory(libraryDirectory());
        if (result != ContentStoreError::None) return result;
    }
    if (fault == ContentStoreFault::InterruptAfterBackup) return ContentStoreError::Interrupted;

    renamePath(tempPath(), libraryPath(), error);
    if (error)
    {
        const auto promotion_error = error;
        std::error_code restore_error;
        const bool library_exists = fs::exists(libraryPath(), restore_error);
        if (restore_error) return errorFromCode(restore_error);
        const bool backup_exists = fs::exists(backupPath(), restore_error);
        if (restore_error) return errorFromCode(restore_error);
        if (!library_exists && backup_exists)
        {
            renamePath(backupPath(), libraryPath(), restore_error);
            if (restore_error) return errorFromCode(restore_error);
            result = syncDirectory(libraryDirectory());
            if (result != ContentStoreError::None) return result;
            result = syncDirectory(backupPath().parent_path());
            if (result != ContentStoreError::None) return result;
        }
        return errorFromCode(promotion_error);
    }
    return syncDirectory(libraryDirectory());
}

ContentStoreError ContentLibraryStore::save(const std::vector<ContentResource>& resources)
{
    if (resources.size() > MAX_RESOURCES) return ContentStoreError::FileTooLarge;
    if (validateContentLibrary(resources) != ContentResourceError::None)
        return ContentStoreError::InvalidData;
    std::vector<ContentResource> sorted = resources;
    std::sort(sorted.begin(), sorted.end(), [](const ContentResource& left, const ContentResource& right) {
        return resourceKey(left) < resourceKey(right);
    });
    std::set<std::string> identities;
    nlohmann::json items = nlohmann::json::array();
    for (const auto& resource : sorted)
    {
        if (validateContentResource(resource) != ContentResourceError::None)
            return ContentStoreError::InvalidData;
        if (!identities.insert(resourceKey(resource)).second)
            return ContentStoreError::DuplicateResource;
        items.push_back(nlohmann::json::parse(serializeContentResource(resource)));
    }
    nlohmann::json document = {
        {"format", "espaciokoop-content-library"},
        {"version", 1},
        {"resources", std::move(items)},
    };
    const auto data = document.dump(2) + "\n";
    if (data.size() > MAX_LIBRARY_BYTES) return ContentStoreError::FileTooLarge;
    return commitDocument(data);
}

ContentStoreLoadResult ContentLibraryStore::load(std::vector<ContentResource>& resources)
{
    ContentStoreLoadResult result;
    result.error = initialize();
    if (result.error != ContentStoreError::None) return result;
    ContentStoreLockGuard lock(*this);
    if (lock.error() != ContentStoreError::None)
    {
        result.error = lock.error();
        return result;
    }

    std::vector<ContentResource> candidate;
    bool migrated = false;
    auto current_result = loadCandidate(libraryPath(), candidate, migrated);
    if (current_result == ContentStoreError::None)
    {
        resources = candidate;
        result.migrated = migrated;
        if (migrated)
        {
            result.error = save(resources);
            if (result.error != ContentStoreError::None) return result;
        }
        std::error_code ignored;
        const auto temp_status = fs::symlink_status(tempPath(), ignored);
        if (!ignored && fs::is_regular_file(temp_status)) fs::remove(tempPath(), ignored);
        return result;
    }
    if (current_result == ContentStoreError::FutureVersion
        || current_result == ContentStoreError::SymlinkRejected
        || current_result == ContentStoreError::NotRegularFile)
    {
        result.error = current_result;
        return result;
    }

    auto quarantine = [&](const fs::path& source, const std::string& name) -> ContentStoreError {
        std::error_code error;
        const auto status = fs::symlink_status(source, error);
        if (error == std::errc::no_such_file_or_directory || !fs::exists(status)) return ContentStoreError::None;
        if (error) return errorFromCode(error);
        if (fs::is_symlink(status)) return ContentStoreError::SymlinkRejected;
        if (!fs::is_regular_file(status)) return ContentStoreError::NotRegularFile;

        fs::path destination;
        for (unsigned int suffix = 0; suffix < 10000; ++suffix)
        {
            destination = quarantineDirectory() / (suffix == 0 ? name : name + "." + std::to_string(suffix));
            error.clear();
            const auto destination_status = fs::symlink_status(destination, error);
            if (error && error != std::errc::no_such_file_or_directory) return errorFromCode(error);
            if (!fs::exists(destination_status)) break;
            if (fs::is_symlink(destination_status) || !fs::is_regular_file(destination_status))
                return ContentStoreError::SymlinkRejected;
            destination.clear();
        }
        if (destination.empty()) return ContentStoreError::IoError;

        error.clear();
        renamePath(source, destination, error);
        if (error) return errorFromCode(error);
        auto sync_result = syncDirectory(quarantineDirectory());
        if (sync_result != ContentStoreError::None) return sync_result;
        return syncDirectory(source.parent_path());
    };

    if (current_result != ContentStoreError::NotFound)
    {
        result.error = quarantine(libraryPath(), "library.invalid.json");
        if (result.error != ContentStoreError::None) return result;
    }

    candidate.clear();
    migrated = false;
    const auto temp_result = loadCandidate(tempPath(), candidate, migrated);
    if (temp_result == ContentStoreError::None)
    {
        resources = candidate;
        fault = ContentStoreFault::None;
        result.error = save(resources);
        result.recovered = result.error == ContentStoreError::None;
        result.migrated = migrated;
        return result;
    }
    if (temp_result == ContentStoreError::FutureVersion
        || temp_result == ContentStoreError::SymlinkRejected
        || temp_result == ContentStoreError::NotRegularFile)
    {
        result.error = temp_result;
        return result;
    }
    if (temp_result != ContentStoreError::NotFound)
    {
        result.error = quarantine(tempPath(), "library.partial.json");
        if (result.error != ContentStoreError::None) return result;
    }

    candidate.clear();
    migrated = false;
    const auto backup_result = loadCandidate(backupPath(), candidate, migrated);
    if (backup_result == ContentStoreError::None)
    {
        resources = candidate;
        fault = ContentStoreFault::None;
        result.error = save(resources);
        result.recovered = result.error == ContentStoreError::None;
        result.migrated = migrated;
        return result;
    }
    if (backup_result == ContentStoreError::NotFound
        && current_result == ContentStoreError::NotFound
        && temp_result == ContentStoreError::NotFound)
    {
        resources.clear();
        result.error = ContentStoreError::None;
        return result;
    }
    result.error = backup_result == ContentStoreError::NotFound
        ? (temp_result == ContentStoreError::NotFound ? current_result : temp_result)
        : backup_result;
    return result;
}

ContentStoreError ContentLibraryStore::listInbox(std::vector<std::string>& filenames)
{
    filenames.clear();
    auto result = initialize();
    if (result != ContentStoreError::None) return result;
    ContentStoreLockGuard lock(*this);
    if (lock.error() != ContentStoreError::None) return lock.error();
    std::error_code error;
    for (fs::directory_iterator iterator(inboxDirectory(), error), end;
         iterator != end && !error; iterator.increment(error))
    {
        const auto status = iterator->symlink_status(error);
        if (error) break;
        const auto name = iterator->path().filename().string();
        if (fs::is_regular_file(status) && !fs::is_symlink(status) && portableFilename(name))
            filenames.push_back(name);
    }
    if (error) return errorFromCode(error);
    std::sort(filenames.begin(), filenames.end());
    if (filenames.size() > MAX_INBOX_ENTRIES) filenames.resize(MAX_INBOX_ENTRIES);
    return ContentStoreError::None;
}

ContentStoreError ContentLibraryStore::importFromInbox(const std::string& filename, ContentResource& resource)
{
    if (!portableFilename(filename) || fs::path(filename).filename() != fs::path(filename))
        return ContentStoreError::InvalidFilename;
    auto result = initialize();
    if (result != ContentStoreError::None) return result;
    ContentStoreLockGuard lock(*this);
    if (lock.error() != ContentStoreError::None) return lock.error();
    std::string data;
    result = readRegularFile(inboxDirectory() / filename, CONTENT_RESOURCE_MAX_IMPORT_BYTES, data);
    if (result != ContentStoreError::None) return result;
    ContentResource candidate;
    if (parseContentResource(data, candidate) != ContentResourceError::None)
        return ContentStoreError::InvalidData;
    resource = std::move(candidate);
    return ContentStoreError::None;
}

ContentStoreError ContentLibraryStore::exportResource(
    const ContentResource& resource,
    const std::vector<ContentResource>& library,
    bool overwrite,
    std::string& filename)
{
    if (validateContentResource(resource) != ContentResourceError::None)
        return ContentStoreError::InvalidData;
    auto result = initialize();
    if (result != ContentStoreError::None) return result;
    ContentStoreLockGuard lock(*this);
    if (lock.error() != ContentStoreError::None) return lock.error();
    filename = contentResourceTypeId(resource.type) + "-" + resource.id + ".json";
    const auto destination = exportsDirectory() / filename;
    const auto temporary = exportsDirectory() / (filename + ".tmp");
    const auto backup = root / "backups" / ("export-" + filename + ".bak");

    std::error_code error;
    const auto destination_status = fs::symlink_status(destination, error);
    if (error && error != std::errc::no_such_file_or_directory) return errorFromCode(error);
    if (fs::is_symlink(destination_status)) return ContentStoreError::SymlinkRejected;
    if (fs::exists(destination_status))
    {
        if (!fs::is_regular_file(destination_status)) return ContentStoreError::NotRegularFile;
        if (!overwrite) return ContentStoreError::AlreadyExists;
    }
    result = writeSynced(temporary, serializeContentResourceExport(resource, library, 2) + "\n");
    if (result != ContentStoreError::None) return result;
    if (fault == ContentStoreFault::InterruptAfterTempSync) return ContentStoreError::Interrupted;

    const auto backup_status = fs::symlink_status(backup, error);
    if (!error && fs::exists(backup_status))
    {
        if (fs::is_symlink(backup_status) || !fs::is_regular_file(backup_status))
            return ContentStoreError::SymlinkRejected;
        fs::remove(backup, error);
        if (error) return errorFromCode(error);
    }
    error.clear();
    if (fs::exists(destination_status))
    {
        renamePath(destination, backup, error);
        if (error) return errorFromCode(error);
        result = syncDirectory(root / "backups");
        if (result != ContentStoreError::None) return result;
        if (fault == ContentStoreFault::InterruptAfterBackupDestinationSync)
            return ContentStoreError::Interrupted;
        result = syncDirectory(exportsDirectory());
        if (result != ContentStoreError::None) return result;
    }
    if (fault == ContentStoreFault::InterruptAfterBackup) return ContentStoreError::Interrupted;
    renamePath(temporary, destination, error);
    if (error)
    {
        const auto promotion_error = error;
        std::error_code ignored;
        const bool destination_exists = fs::exists(destination, ignored);
        if (ignored) return errorFromCode(ignored);
        const bool backup_exists = fs::exists(backup, ignored);
        if (ignored) return errorFromCode(ignored);
        if (!destination_exists && backup_exists)
        {
            renamePath(backup, destination, ignored);
            if (ignored) return errorFromCode(ignored);
            result = syncDirectory(exportsDirectory());
            if (result != ContentStoreError::None) return result;
            result = syncDirectory(root / "backups");
            if (result != ContentStoreError::None) return result;
        }
        return errorFromCode(promotion_error);
    }
    return syncDirectory(exportsDirectory());
}

const char* contentStoreErrorId(ContentStoreError error)
{
    switch(error)
    {
    case ContentStoreError::None: return "none";
    case ContentStoreError::NotConfigured: return "not_configured";
    case ContentStoreError::InvalidRoot: return "invalid_root";
    case ContentStoreError::SymlinkRejected: return "symlink_rejected";
    case ContentStoreError::NotRegularFile: return "not_regular_file";
    case ContentStoreError::NotFound: return "not_found";
    case ContentStoreError::InvalidFilename: return "invalid_filename";
    case ContentStoreError::FileTooLarge: return "file_too_large";
    case ContentStoreError::InvalidData: return "invalid_data";
    case ContentStoreError::DuplicateResource: return "duplicate_resource";
    case ContentStoreError::FutureVersion: return "future_version";
    case ContentStoreError::PermissionDenied: return "permission_denied";
    case ContentStoreError::NoSpace: return "no_space";
    case ContentStoreError::IoError: return "io_error";
    case ContentStoreError::AlreadyExists: return "already_exists";
    case ContentStoreError::Interrupted: return "interrupted";
    }
    return "unknown";
}
