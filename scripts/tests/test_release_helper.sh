#!/usr/bin/env bash
set -euo pipefail

sandbox=$(mktemp -d)
root="$sandbox/repo"
fakebin="$sandbox/fake-bin"
mkdir -p "$root" "$fakebin"
trap 'rm -rf "$sandbox"' EXIT
git -C "$root" init -q -b main
git -C "$root" config user.email test@example.invalid
git -C "$root" config user.name test
touch "$root/file"
git -C "$root" add file
git -C "$root" commit -qm initial

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
helper=$(cd -- "$script_dir/.." && pwd)/release_helper.sh
real_git=$(command -v git)
cat > "$fakebin/git" <<'EOF'
#!/usr/bin/env bash
if [[ ${GIT_FAIL_SUBCOMMAND:-} == "${1:-}" ]]; then
  exit 86
fi
exec "$REAL_GIT" "$@"
EOF
chmod +x "$fakebin/git"
must_fail() {
  if (cd "$root" && bash "$helper" "$@") >/dev/null 2>&1; then exit 1; fi
}
must_fail_with_git() {
  local subcommand=$1
  shift
  if (cd "$root" && env PATH="$fakebin:$PATH" REAL_GIT="$real_git" \
      GIT_FAIL_SUBCOMMAND="$subcommand" bash "$helper" "$@") >/dev/null 2>&1; then
    exit 1
  fi
}

output=$(cd "$root" && bash "$helper" patch)
grep -q 'Versión propuesta: v0.0.1' <<<"$output"
[[ -z $(git -C "$root" tag --list 'v0.0.1') ]]

must_fail
must_fail invalid --dry-run
must_fail patch --unknown
must_fail patch --dry-run extra

git -C "$root" switch -q -c feature/release-incorrecta
must_fail patch --create-tag
git -C "$root" switch -q main
git -C "$root" switch -q --detach
must_fail patch --create-tag
git -C "$root" switch -q main

must_fail_with_git status patch --create-tag
[[ -z $(git -C "$root" tag --list v0.0.1) ]]
must_fail_with_git tag patch --create-tag
[[ -z $(git -C "$root" tag --list v0.0.1) ]]

git -C "$root" tag v1.2.3-rc.1
must_fail patch --create-tag
[[ -z $(git -C "$root" tag --list v) ]]
[[ -z $(git -C "$root" tag --list v0.0.1) ]]

git -C "$root" tag v1.2.3
output=$(cd "$root" && bash "$helper" major --dry-run)
grep -q 'Versión propuesta: v2.0.0' <<<"$output"
output=$(cd "$root" && bash "$helper" minor)
grep -q 'Versión propuesta: v1.3.0' <<<"$output"
[[ -z $(git -C "$root" tag --list v1.3.0) ]]
output=$(cd "$root" && bash "$helper" patch --dry-run)
grep -q 'Versión propuesta: v1.2.4' <<<"$output"

git -C "$root" tag v1.3.0-rc.1
must_fail patch --create-tag
[[ -z $(git -C "$root" tag --list v1.2.4) ]]
git -C "$root" tag -d v1.3.0-rc.1 >/dev/null

(cd "$root" && bash "$helper" patch --create-tag) >/dev/null
git -C "$root" rev-parse --verify refs/tags/v1.2.4 >/dev/null

git -C "$root" tag v1.2.08
must_fail patch --dry-run
git -C "$root" tag -d v1.2.08 >/dev/null

git -C "$root" tag vbanana
must_fail patch --dry-run
git -C "$root" tag -d vbanana >/dev/null

echo dirty >> "$root/file"
must_fail patch --dry-run
echo "release helper tests passed"
