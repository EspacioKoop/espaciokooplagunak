#!/usr/bin/env bash
set -euo pipefail

root=$(mktemp -d)
trap 'rm -rf "$root"' EXIT
git -C "$root" init -q
git -C "$root" config user.email test@example.invalid
git -C "$root" config user.name test
touch "$root/file"
git -C "$root" add file
git -C "$root" commit -qm initial
git -C "$root" tag v1.2.3
git -C "$root" tag v9.9.9-rc.1
git -C "$root" tag vnot-a-version

output=$(cd "$root" && bash "$OLDPWD/scripts/release_helper.sh" minor --dry-run)
grep -q 'Versión propuesta: v1.3.0' <<<"$output"
[[ -z $(git -C "$root" tag --list 'v1.3.0') ]]

if (cd "$root" && bash "$OLDPWD/scripts/release_helper.sh" invalid --dry-run) >/dev/null 2>&1; then exit 1; fi
if (cd "$root" && bash "$OLDPWD/scripts/release_helper.sh") >/dev/null 2>&1; then exit 1; fi
(cd "$root" && bash "$OLDPWD/scripts/release_helper.sh" patch --dry-run) | grep -q 'Versión actual: v1.2.3'
(cd "$root" && bash "$OLDPWD/scripts/release_helper.sh" patch --create-tag) >/dev/null
git -C "$root" rev-parse --verify refs/tags/v1.2.4 >/dev/null

echo dirty >> "$root/file"
if (cd "$root" && bash "$OLDPWD/scripts/release_helper.sh" patch --dry-run) >/dev/null 2>&1; then exit 1; fi
echo "release helper tests passed"
