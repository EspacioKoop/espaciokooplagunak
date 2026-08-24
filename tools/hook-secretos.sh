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

# QUE SE MIRA, SEGUN EL HOOK QUE SEA.
#
# En pre-commit lo que va a entrar es el indice. En pre-push NO hay indice: lo
# que se publica son commits que ya existen, asi que mirar `--cached` deja el
# hook en nada. Comprobado: con la version que solo miraba el indice, un commit
# con credencial hecho antes de instalar el hook (o con SKIP_SECRET_SCAN) se
# empujaba al remoto sin una sola queja — justo el caso que este fichero existe
# para impedir en un repositorio publico.
NULO=0000000000000000000000000000000000000000
case "$(basename "$0")" in
  pre-push)
    ACCION="PUSH"
    # git entrega por la entrada estandar: <ref local> <sha local> <ref remota> <sha remoto>
    commits=""
    while read -r _ local _ remoto; do
      [ "$local" = "$NULO" ] && continue          # borrado de rama: no publica nada
      if [ "$remoto" = "$NULO" ]; then
        # Rama nueva: lo que ninguna otra rama remota tenga ya.
        nuevos=$(git rev-list "$local" --not --remotes 2>/dev/null)
      else
        nuevos=$(git rev-list "$remoto..$local" 2>/dev/null)
      fi
      commits="$commits $nuevos"
    done
    [ -z "${commits// /}" ] && exit 0
    hits=""
    for commit in $(echo "$commits" | tr ' ' '\n' | sort -u); do
      # Se nombra el fichero, no la linea: en un push la linea puede venir de un
      # commit viejo y recortarla a doce caracteres no dice donde mirar.
      f=$(git show --no-color -U0 --format= --name-only "$commit" \
          -- . ':(exclude)*hook-secretos.sh' | tr '\n' ' ')
      h=$(git show --no-color -U0 --format= "$commit" -- . ':(exclude)*hook-secretos.sh' \
          | grep -E '^\+' | grep -EI "$PATTERNS" || true)
      [ -n "$h" ] && hits="$hits
  ${commit:0:9} en: $f"
    done
    ;;
  *)
    ACCION="COMMIT"
    # El propio hook se excluye: su tabla de patrones no es una credencial.
    hits=$(git diff --cached --no-color -U0 -- . ':(exclude)*hook-secretos.sh' \
           | grep -E '^\+' | grep -EI "$PATTERNS" || true)
    ;;
esac

if [ -n "${hits// /}" ]; then
  echo "════════════════════════════════════════════════════════════"
  echo " $ACCION BLOQUEADO: parece haber una credencial"
  echo "════════════════════════════════════════════════════════════"
  # El pre-commit recorta la linea (el secreto esta en ella); el pre-push ya
  # trae solo commit y fichero, que no hay que recortar.
  if [ "$ACCION" = "PUSH" ]; then
    echo "$hits" | head -10
  else
    echo "$hits" | head -10 | sed -E 's/(.{12}).*/\1…[recortado]/'
  fi
  echo
  echo "Quita el secreto. Si ya esta en el historial no basta con borrarlo del"
  echo "fichero: hay que reescribir el historial Y rotar la credencial."
  echo "Si de verdad es un falso positivo:  SKIP_SECRET_SCAN=1 git ..."
  exit 1
fi
exit 0
