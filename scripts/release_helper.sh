#!/usr/bin/env bash
# Propone una versión SemVer y, solo con --create-tag, crea un tag anotado.
set -euo pipefail

usage() {
  cat <<'EOF'
Uso: scripts/release_helper.sh {major|minor|patch} [--dry-run|--create-tag]

El modo predeterminado es --dry-run. Los tags vMAJOR.MINOR.PATCH son la
fuente canónica de versiones de release; no se modifica VERSION ni package.json.
La herramienta solo funciona desde la rama main. Sin tags previos, usa v0.0.0
como base; por ejemplo, el primer incremento patch propone v0.0.1.
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
status=$(git status --porcelain) || die "no se pudo comprobar el estado del árbol de trabajo"
[[ -z $status ]] || die "el árbol de trabajo no está limpio"
branch=$(git symbolic-ref --quiet --short HEAD) || die "HEAD separado: cambia a la rama main"
[[ $branch == "main" ]] || die "la release debe prepararse desde la rama main, no desde '$branch'"

stable_re='^v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$'
prerelease_re='^v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)-((0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*)(\.(0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*))*)(\+[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?$'
stable_versions=()
prerelease_cores=()
tags=$(git tag --list 'v*') || die "no se pudieron enumerar las etiquetas existentes"
while IFS= read -r candidate; do
  [[ -n $candidate ]] || continue
  if [[ $candidate =~ $stable_re ]]; then
    stable_versions+=("${BASH_REMATCH[1]}.${BASH_REMATCH[2]}.${BASH_REMATCH[3]}")
  elif [[ $candidate =~ $prerelease_re ]]; then
    prerelease_cores+=("${BASH_REMATCH[1]}.${BASH_REMATCH[2]}.${BASH_REMATCH[3]}")
  else
    die "la etiqueta '$candidate' no cumple la política SemVer documentada"
  fi
done <<< "$tags"

latest="0.0.0"
has_stable=false
if ((${#stable_versions[@]})); then
  latest=$(printf '%s\n' "${stable_versions[@]}" | sort -V | tail -n 1)
  has_stable=true
fi
if ((${#prerelease_cores[@]})); then
  [[ $has_stable == true ]] || die "hay prereleases pero ninguna release estable; el helper no las promueve"
  highest_core=$(printf '%s\n' "$latest" "${prerelease_cores[@]}" | sort -V | tail -n 1)
  [[ $highest_core == "$latest" ]] || die "hay prereleases posteriores a v$latest; el helper no las promueve"
fi

increment_decimal() {
  local value=$1 result="" carry=1 digit sum i
  for ((i = ${#value} - 1; i >= 0; i--)); do
    digit=${value:i:1}
    sum=$((digit + carry))
    result="$((sum % 10))$result"
    carry=$((sum / 10))
  done
  [[ $carry -eq 0 ]] || result="1$result"
  printf '%s\n' "$result"
}

IFS=. read -r major minor patch <<< "$latest"
case "$bump" in
  major) next="$(increment_decimal "$major").0.0" ;;
  minor) next="$major.$(increment_decimal "$minor").0" ;;
  patch) next="$major.$minor.$(increment_decimal "$patch")" ;;
esac
tag="v$next"
if git show-ref --verify --quiet "refs/tags/$tag"; then
  die "la etiqueta $tag ya existe"
else
  rc=$?
  [[ $rc -eq 1 ]] || die "no se pudo comprobar si la etiqueta $tag ya existe"
fi

echo "Versión actual: v$latest"
echo "Versión propuesta: $tag"
if [[ $mode == "dry-run" ]]; then
  echo "Modo dry-run: no se creó ninguna etiqueta."
  exit 0
fi

git tag -a "$tag" -m "Release $tag"
echo "Etiqueta creada localmente: $tag"
echo "Revisa git show $tag y publica explícitamente con git push origin $tag."
