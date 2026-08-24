import json
import subprocess
import sys
from pathlib import Path


SCRIPT = Path(__file__).parents[1] / "check_orphan_modules.py"


def write_fixture(tmp_path, consumer=True, declaration=True):
    root = tmp_path / "module"
    scripts = root / "scripts"
    scripts.mkdir(parents=True)
    (root / "module.json").write_text('{"esmodules":["scripts/main.mjs"]}', encoding="utf-8")
    (scripts / "main.mjs").write_text(
        'import "./used.mjs";\n' if consumer else "", encoding="utf-8"
    )
    (scripts / "used.mjs").write_text("export const used = true;\n", encoding="utf-8")
    (scripts / "dynamic.mjs").write_text("export const dynamic = true;\n", encoding="utf-8")
    declarations = {"schemaVersion": 1, "declarations": []}
    if declaration:
        declarations["declarations"].append(
            {
                "module": "dynamic.mjs",
                "status": "declared-orphan",
                "reason": "fixture dinámico",
                "declaredBy": "test",
                "declaredAt": "2026-08-24",
                "evidence": {"type": "test", "url": "https://example.invalid/test"},
            }
        )
    declarations_path = tmp_path / "declarations.json"
    declarations_path.write_text(json.dumps(declarations), encoding="utf-8")
    return root, declarations_path


def run(root, declarations, *extra):
    return subprocess.run(
        [sys.executable, str(SCRIPT), "--root", str(root), "--declarations", str(declarations), *extra],
        capture_output=True,
        text=True,
        check=False,
    )


def test_inventory_distinguishes_connected_and_declared_orphan(tmp_path):
    root, declarations = write_fixture(tmp_path)
    result = run(root, declarations, "--format", "json", "--check")
    assert result.returncode == 0
    statuses = {item["module"]: item["status"] for item in json.loads(result.stdout)}
    assert statuses == {"main.mjs": "connected", "used.mjs": "connected", "dynamic.mjs": "declared-orphan"}


def test_missing_declaration_is_unknown_but_not_a_false_orphan(tmp_path):
    root, declarations = write_fixture(tmp_path, declaration=False)
    result = run(root, declarations, "--format", "json", "--check")
    assert result.returncode == 0
    dynamic = next(item for item in json.loads(result.stdout) if item["module"] == "dynamic.mjs")
    assert dynamic["status"] == "unknown"


def test_declared_connected_module_without_consumer_fails(tmp_path):
    root, declarations = write_fixture(tmp_path, consumer=False)
    data = json.loads(declarations.read_text(encoding="utf-8"))
    data["declarations"].append(
        {
            "module": "used.mjs",
            "status": "connected",
            "reason": "fixture conectado",
            "declaredBy": "test",
            "declaredAt": "2026-08-24",
            "evidence": {"type": "test", "url": "https://example.invalid/test"},
        }
    )
    declarations.write_text(json.dumps(data), encoding="utf-8")
    result = run(root, declarations, "--check")
    assert result.returncode == 2
    assert "connected sin consumidor estático" in result.stderr
