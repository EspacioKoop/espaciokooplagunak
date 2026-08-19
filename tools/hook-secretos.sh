#!/usr/bin/env bash
# Bloquea commits y pushes que contengan credenciales.
#
# Instalación (cubre también los clones que hagan agentes automáticos):
#   git config --global core.hooksPath ~/.config/git/hooks
#   cp tools/hook-secretos.sh ~/.config/git/hooks/pre-commit
#   cp tools/hook-secretos.sh ~/.config/git/hooks/pre-push
#   chmod +x ~/.config/git/hooks/pre-commit ~/.config/git/hooks/pre-push
#
# O solo para este repositorio:
#   cp tools/hook-secretos.sh .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit
#
# Escape a conciencia, cuando de verdad sea un falso positivo:
#   SKIP_SECRET_SCAN=1 git commit ...
[ -n "$SKIP_SECRET_SCAN" ] && exit 0

# Se construye por trozos para que el propio fichero no active el hook al
# versionarlo: ninguna línea contiene un patrón completo.
P_LLM='sk-or-v1-[A-Za-z0-9]{16,}|sk-[A-Za-z0-9]{16,}-[A-Za-z0-9]{6}-[A-Za-z0-9]{8}'
P_LLM="$P_LLM"'|gsk_[A-Za-z0-9]{40,}|nvapi-[A-Za-z0-9_-]{40,}|csk-[a-z0-9]{40,}'
P_LLM="$P_LLM"'|cfut_[A-Za-z0-9]{40,}|AIza[0-9A-Za-z_-]{35}|AQ\.[A-Za-z0-9_-]{30,}'
P_VCS='gh[pousr]_[A-Za-z0-9]{36,}|xox[baprs]-[A-Za-z0-9-]{10,}|SCW[A-Z0-9]{17}'
P_GEN='-----BEGIN [A-Z ]*PRIVATE'' KEY-----|aws_secret''_access_key'
PATTERNS="($P_LLM|$P_VCS|$P_GEN)"

# El propio hook se excluye: su tabla de patrones no es una credencial.
ficheros=$(git diff --cached --name-only --diff-filter=ACM | grep -v 'hook-secretos.sh' || true)
[ -z "$ficheros" ] && exit 0

hits=$(git diff --cached --no-color -U0 -- $ficheros | grep -E '^\+' | grep -EI "$PATTERNS" || true)
if [ -n "$hits" ]; then
  echo "════════════════════════════════════════════════════════════"
  echo " COMMIT BLOQUEADO: parece haber una credencial en el diff"
  echo "════════════════════════════════════════════════════════════"
  echo "$hits" | head -10 | sed -E 's/(.{12}).*/\1…[recortado]/'
  echo
  echo "Quita el secreto del commit. Si de verdad es un falso positivo:"
  echo "  SKIP_SECRET_SCAN=1 git commit ..."
  exit 1
fi
exit 0
