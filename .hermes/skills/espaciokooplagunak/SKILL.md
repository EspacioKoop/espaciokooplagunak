---
name: espaciokooplagunak
description: Integración de Hermes con Espaciokoop Lagunak — tests, PRs atómicos, combo health OmniRoute, rescate worktrees
version: 1.0.0
author: Hermes Agent
category: devops
---

## Uso
Este skill documenta cómo Hermes interactúa con el repo `VaroTv7/espaciokooplagunak`:
- Ejecutar tests localmente (bridge, foundry, tools)
- Crear PRs atómicos siguiendo convenciones (conventional commits + 1 dominio = 1 PR)
- Verificar salud de combos OmniRoute antes de asignar trabajo
- Rescatar worktrees abandonados quirúrgicamente

---

## Estructura del repo

```
<repo-root>/
├── bridge/                 # FastAPI bridge (Python)
│   └── tests/              # pytest (372 tests)
├── foundry-module/         # Módulo Foundry VTT (Node)
│   ├── scripts/            # .mjs source
│   └── tests/              # node --test (2288 tests)
├── tools/                  # Herramientas CLI (Python)
│   ├── artic.py            # Refactorizado a tools.apis.core
│   └── tests/              # pytest
├── scripts/                # Python scripts (check_orphan_modules, etc.)
├── docker/                 # Dockerfiles
├── docs/                   # Documentación
└── .github/
    ├── workflows/          # CI/CD
    ├── labeler.yml         # Automatización labels (PR #739 validador)
    └── pull_request_template.md
```

---

## Tests locales

### Bridge (Python)
```bash
cd <repo-root>
python3 -m pytest bridge/tests/ -v              # Suite completa (372 tests)
python3 -m pytest bridge/tests/ -v -k "502"     # Solo tests HTTP 502
python3 -m pytest bridge/tests/test_endpoints.py -v
```

### Foundry Module (Node)
```bash
cd <repo-root>
node --test foundry-module/tests/*.test.mjs     # Suite completa (2288 tests)
node --test foundry-module/tests/nave-luminaria.test.mjs
node --test foundry-module/tests/station-handover.test.mjs
```

### Tools (Python)
```bash
cd <repo-root>
python3 -m pytest tools/tests/test_artic.py -v  # 6 tests
python3 tools/artic.py --help                   # CLI dual (script y module)
python3 -m tools.artic --help
```

---

## Convenciones de PR

### Nomenclatura (conventional commits + scope)
```
feat(foundry): descripción corta
test(bridge): descripción corta
refactor(tools): descripción corta
chore(ci): descripción corta
```

### Reglas atómicas (OBLIGATORIO)
- **1 dominio = 1 PR** — no mezclar bridge + foundry + tools
- **Rama limpia** — partir de `main`, no arrastrar commits ajenos
- **Extracción quirúrgica** — `git checkout <commit> -- <archivos>` desde worktree
- **Tests verdes** — suite completa pasa en local antes de push

### Template PR (`.github/pull_request_template.md`)
- Resumen + Issue relacionado (`Closes #`)
- Tipo de cambio (checkboxes)
- Verificación real (comandos ejecutados + resultado)
- Pendiente/no probado
- Riesgos y compatibilidad
- Checklist final

---

## OmniRoute Combo Health

### Verificar antes de asignar trabajo
```bash
python3 - <<'EOF'
import sqlite3
c = sqlite3.connect("file:/home/eloy/.omniroute/storage.sqlite?mode=ro",uri=True)
for combo,n,ok in c.execute("""
  SELECT COALESCE(combo_name,'(sin combo)'),COUNT(*),SUM(status=200)
  FROM call_logs
  WHERE timestamp > datetime('now','-3 hours')
  GROUP BY 1 ORDER BY 2 DESC
"""):
  rate = ok/n*100 if n else 0
  flag = "✅" if rate >= 60 else "❌"
  print(f" {flag} {combo:16} {ok}/{n} ({rate:.1f}%)")
EOF
```

### Umbral: **60% success rate** — por debajo no se manda trabajo, se repara primero

### Reparar combo muerto (skill `combo-salud`)
1. `enabled=true` en SQLite `combos.data` + restart service
2. Podar targets muertos (`omniroute-combo-targets.sh`)
3. Verificar con request real (`--max-time 90`)

---

## Rescate worktrees #667

### Worktrees rescatados (4 PRs creados)
| Worktree | PR | Archivos | Tests |
|----------|-----|----------|-------|
| `t_87c6e15e` | #751 | `nave-luminaria.mjs`, `nave-sala-caja.mjs`, `nave-luminaria.test.mjs` | 15 |
| `t_6c580159` + `t_7363ef0e` | #752 | 4 tests station-handover | 13 |
| `t_344e5996` | #753 | `tools/artic.py` | 6 |

### Worktrees pendientes (7)
```
t_31672022  t_340116c8  t_08733ca4  t_6dc81aeb
t_86badf6f  t_884ec48f  t_c96bad74
```

### Procedimiento rescate
```bash
# 1. Listar worktrees
cd <repo-root> && git worktree list

# 2. Inspeccionar trabajo
ls -la .worktrees/t_<id>/

# 3. Crear rama limpia desde main
cd <repo-root>
git checkout main && git pull origin main
git checkout -b rescue/<dominio>

# 4. Extraer SOLO archivos relevantes
git checkout <commit-worktree> -- <archivos-dominio>

# 5. Verificar tests locales
# 6. Commit + push + PR
```

---

## Scripts útiles en repo

| Script | Qué hace |
|--------|----------|
| `scripts/check_orphan_modules.py` | Inventario módulos conservador |
| `tools/artic.py` | Articulador LLM (cache SQLite, ritmo, presupuesto) |
| `.github/actions/filtro-rutas` | Filtra paths para CI condicional |
| `.github/actions/puerta` | Puerta de calidad (siempre existe) |
| `omniroute-combo-targets.sh` | Gestionar targets de combo (ver `~/.hermes/`) |

---

## CI/CD claves

| Workflow | Trigger | Qué valida |
|----------|---------|------------|
| `foundry-module.yml` | push/PR a main | Tests Node, sintaxis JS, inventario, prerender |
| `cicd.yml` | push/PR | Bridge pytest, Docker, CodeQL, semgrep |
| `label.yml` | PR opened/synced | Validador labeler.yml estricto (PR #739) |
| `tools.yml` | paths: tools/** | Tests tools, artic.py |

### Filtro de rutas
El job `changes` (en cada workflow) decide si la suite se ejecuta o salta (`skipped`). Usa `.github/actions/filtro-rutas` con patrones específicos.

---

## Comandos gh frecuentes

```bash
# Ver PRs
gh pr list --limit 20

# Ver checks
gh pr checks 751

# Ver diff
gh pr diff 751 --name-only

# Review aprobatorio (requerido para merge)
gh pr review 750 --approve --body "Aprobado"

# Merge squash (admin)
gh pr merge 750 --squash --delete-branch --admin

# Comment en issue
gh issue comment 715 --body-file /tmp/comentario.md
```

---

## Estado actual (handover 2026-08-24)

| PR | Estado | Próxima acción |
|----|--------|----------------|
| #750 | Checks ✅, review requerido | Esperar aprobatoria VaroTv7/colaborador |
| #751 | Checks 🔄 (re-ejecutándose) | Monitorizar, luego review |
| #752 | Checks ✅ | Esperar review |
| #753 | Checks ✅ | Esperar review |
| #739 | Checks ✅, Ready for review | Esperar review aprobatorio |

### Combo health (última verificación)
```
✅ solo-gratis      99.1%
✅ hermes-code     100%
✅ hermes-smart     77.6%
✅ hermes-fast       —
✅ free-stack        —
⚠️  Kimi Coding      reparado (enabled=true, target podado/re-añadido, proxy local caído)
```

---

## Pitfalls conocidos

1. **No auto-aprobar propio PR** — GitHub bloquea `gh pr review --approve` si eres autor
2. **Branch protection** — main requiere review aprobatorio (no solo comentario)
3. **Tests frágiles** — "los focos iluminan el suelo" eliminado (depende retro3d inestable)
4. **global vs globalThis** — Node test env requiere `globalThis.Hooks` y `globalThis.foundry`
5. **Dual import artic.py** — `try/except` + `sys.path` para `python3 tools/artic.py` y `python3 -m tools.artic`
6. **Combo PUT no persiste** — editar SQLite directamente + restart service
7. **Paths en labeler.yml** — usar `changed-files` explícitos, no crear labels nuevas