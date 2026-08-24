#!/usr/bin/env bash
# Propone una versión SemVer y, solo con --create-tag, crea un tag anotado.
set -euo pipefail

usage() {
  cat <<'EOF'
Uso: scripts/release_helper.sh {major|minor|patch} [--dry-run|--create-tag]

El modo predeterminado es --dry-run. Los tags vMAJOR.MINOR.PATCH son la
fuente canónica de versiones de release; no se modifica VERSION ni package.json.
EOF
}

die() { echo "error: $*" >&2; exit 2; }

[[ $# -ge 1 && $# -le 2 ]] || { usage >&2; exit 2; }
bump=$1
case "$bump" in major|minor|patch) ;; *) usage >&2; exit 2 ;; esac
mode="dry-run"
if [[ ${2:-} == "--create-tag" ]]; then mode="create"; elif [[ -n ${2:-} && $2 != "--dry-run" ]]; then usage >&2; exit 2; fi

git rev-parse --show-toplevel >/dev/null 2>&1 || die "ejecuta la herramienta dentro de un repositorio Git"
root=$(git rev-parse --show-toplevel)
cd "$root"
[[ -z $(git status --porcelain) ]] || die "el árbol de trabajo no está limpio"

latest=$(git tag --list 'v*' | sed -nE 's/^v([0-9]+\.[0-9]+\.[0-9]+)$/\1/p' | sort -V | tail -n 1)

if [[ -z $latest ]]; then latest="0.0.0"; fi
IFS=. read -r major minor patch <<< "$latest"
case "$bump" in
  major) next="$((major + 1)).0.0" ;;
  minor) next="$major.$((minor + 1)).0" ;;
  patch) next="$major.$minor.$((patch + 1))" ;;
esac
tag="v$next"
git rev-parse --verify --quiet "refs/tags/$tag" >/dev/null && die "la etiqueta $tag ya existe"

echo "Versión actual: v$latest"
echo "Versión propuesta: $tag"
if [[ $mode == "dry-run" ]]; then
  echo "Modo dry-run: no se creó ninguna etiqueta."
  exit 0
fi

git tag -a "$tag" -m "Release $tag"
echo "Etiqueta creada localmente: $tag"
echo "Revisa git show $tag y publica explícitamente con git push origin $tag."
