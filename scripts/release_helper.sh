#!/bin/bash
# Helper para gestión de releases semánticos
# Uso: ./scripts/release_helper.sh [major|minor|patch]

set -e

VERSION_FILE="VERSION" # Opcional, si se usa archivo de versión plano
CURRENT_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "v0.0.0")
CURRENT_VERSION=${CURRENT_TAG#v}

IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"

case "$1" in
  major)
    NEW_MAJOR=$((MAJOR + 1))
    NEW_VERSION="$NEW_MAJOR.0.0"
    ;;
  minor)
    NEW_MINOR=$((MINOR + 1))
    NEW_VERSION="$MAJOR.$NEW_MINOR.0"
    ;;
  patch|*)
    NEW_PATCH=$((PATCH + 1))
    NEW_VERSION="$MAJOR.$MINOR.$NEW_PATCH"
    ;;
esac

echo "Versión actual: $CURRENT_VERSION"
echo "Nueva versión propuesta: $NEW_VERSION"
echo ""
read -p "¿Crear tag v$NEW_VERSION? (y/n): " CONFIRM

if [ "$CONFIRM" == "y" ]; then
  git tag -s "v$NEW_VERSION" -m "Release v$NEW_VERSION"
  echo "✅ Tag creado. Recuerda hacer: git push origin --tags"
else
  echo "❌ Operación cancelada."
fi
