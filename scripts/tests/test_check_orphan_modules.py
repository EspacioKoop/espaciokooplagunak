import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).parents[1] / "check_orphan_modules.py"
ISSUE_URL = "https://github.com/VaroTv7/espaciokooplagunak/issues/701"


def declaration(module, status="declared-orphan", **overrides):
    entry = {
        "module": module,
        "status": status,
        "reason": "Declaración de prueba con procedencia suficiente.",
        "declaredBy": "test",
        "declaredAt": "2026-08-24",
        "evidence": {"type": "issue", "url": ISSUE_URL},
    }
    if status == "declared-orphan":
        entry["foundation"] = True
    entry.update(overrides)
    return entry


def write_fixture(base, main_source='import "./used.mjs";\n', declarations=None):
    root = base / "module"
    scripts = root / "scripts"
    scripts.mkdir(parents=True)
    (root / "module.json").write_text(
        '{"esmodules":["scripts/main.mjs"]}', encoding="utf-8"
    )
    (scripts / "main.mjs").write_text(main_source, encoding="utf-8")
    (scripts / "used.mjs").write_text(
        "export const used = true;\n", encoding="utf-8"
    )
    (scripts / "dynamic.mjs").write_text(
        "export const dynamic = true;\n", encoding="utf-8"
    )
    data = {
        "schemaVersion": 1,
        "declarations": declarations or [],
        "artModules": ["used.mjs"],
    }
    declarations_path = base / "declarations.json"
    declarations_path.write_text(json.dumps(data), encoding="utf-8")
    return root, declarations_path


def run(root, declarations_path, *extra):
    return subprocess.run(
        [
            sys.executable,
            str(SCRIPT),
            "--root",
            str(root),
            "--declarations",
            str(declarations_path),
            *extra,
        ],
        capture_output=True,
        text=True,
        check=False,
    )


class OrphanModuleInventoryTests(unittest.TestCase):
    def test_inventory_distinguishes_all_three_states_and_preserves_evidence(self):
        with tempfile.TemporaryDirectory() as temporary:
            base = Path(temporary)
            root, declarations_path = write_fixture(
                base, declarations=[declaration("dynamic.mjs")]
            )
            result = run(root, declarations_path, "--format", "json", "--check")
            self.assertEqual(result.returncode, 0, result.stderr)
            inventory = {item["module"]: item for item in json.loads(result.stdout)}
            self.assertEqual(inventory["main.mjs"]["status"], "connected")
            self.assertEqual(inventory["main.mjs"]["evidence"]["type"], "manifest")
            self.assertEqual(inventory["used.mjs"]["status"], "connected")
            self.assertEqual(
                inventory["used.mjs"]["evidence"],
                {"type": "import", "module": "main.mjs", "line": 1},
            )
            self.assertEqual(inventory["used.mjs"]["inventories"], ["art"])
            self.assertEqual(inventory["dynamic.mjs"]["status"], "declared-orphan")
            self.assertEqual(inventory["dynamic.mjs"]["evidence"]["url"], ISSUE_URL)

    def test_dynamic_registration_without_import_is_unknown(self):
        with tempfile.TemporaryDirectory() as temporary:
            base = Path(temporary)
            root, declarations_path = write_fixture(
                base,
                main_source=(
                    'import "./used.mjs";\n'
                    'registerModule("./dynamic.mjs", () => globalThis.dynamicFactory);\n'
                ),
            )
            result = run(root, declarations_path, "--format", "json", "--check")
            self.assertEqual(result.returncode, 0, result.stderr)
            inventory = {item["module"]: item for item in json.loads(result.stdout)}
            self.assertEqual(inventory["dynamic.mjs"]["status"], "unknown")

    def test_declared_connected_regression_fails_after_unique_consumer_is_removed(self):
        with tempfile.TemporaryDirectory() as temporary:
            base = Path(temporary)
            root, declarations_path = write_fixture(
                base, declarations=[declaration("used.mjs", status="connected")]
            )
            connected = run(root, declarations_path, "--check")
            self.assertEqual(connected.returncode, 0, connected.stderr)
            (root / "scripts" / "main.mjs").write_text("", encoding="utf-8")
            regressed = run(root, declarations_path, "--check")
            self.assertEqual(regressed.returncode, 2)
            self.assertIn("connected sin consumidor estático", regressed.stderr)

    def test_invalid_declaration_without_evidence_fails(self):
        with tempfile.TemporaryDirectory() as temporary:
            base = Path(temporary)
            invalid = declaration("dynamic.mjs")
            invalid.pop("evidence")
            root, declarations_path = write_fixture(base, declarations=[invalid])
            result = run(root, declarations_path, "--check")
            self.assertEqual(result.returncode, 2)
            self.assertIn("falta evidencia enlazada", result.stderr)

    def test_declared_orphan_that_becomes_reachable_fails(self):
        with tempfile.TemporaryDirectory() as temporary:
            base = Path(temporary)
            root, declarations_path = write_fixture(
                base,
                main_source='import "./used.mjs";\nimport "./dynamic.mjs";\n',
                declarations=[declaration("dynamic.mjs")],
            )
            result = run(root, declarations_path, "--check")
            self.assertEqual(result.returncode, 2)
            self.assertIn("declared-orphan ya conectada", result.stderr)

    def test_comment_and_string_do_not_count_as_consumers(self):
        with tempfile.TemporaryDirectory() as temporary:
            base = Path(temporary)
            root, declarations_path = write_fixture(
                base,
                main_source=(
                    'import "./used.mjs";\n'
                    '// import "./dynamic.mjs";\n'
                    'const example = \'import "./dynamic.mjs"\';\n'
                ),
            )
            result = run(root, declarations_path, "--format", "json", "--check")
            self.assertEqual(result.returncode, 0, result.stderr)
            inventory = {item["module"]: item for item in json.loads(result.stdout)}
            self.assertEqual(inventory["dynamic.mjs"]["status"], "unknown")

    def test_parent_relative_import_is_normalized(self):
        with tempfile.TemporaryDirectory() as temporary:
            base = Path(temporary)
            root, declarations_path = write_fixture(
                base, main_source='import "./sub/consumer.mjs";\n'
            )
            subdirectory = root / "scripts" / "sub"
            subdirectory.mkdir()
            (subdirectory / "consumer.mjs").write_text(
                'import "../used.mjs";\n', encoding="utf-8"
            )
            result = run(root, declarations_path, "--format", "json", "--check")
            self.assertEqual(result.returncode, 0, result.stderr)
            inventory = {item["module"]: item for item in json.loads(result.stdout)}
            self.assertEqual(inventory["used.mjs"]["status"], "connected")
            self.assertEqual(
                inventory["used.mjs"]["evidence"]["module"], "sub/consumer.mjs"
            )

    def test_output_is_stable(self):
        with tempfile.TemporaryDirectory() as temporary:
            base = Path(temporary)
            root, declarations_path = write_fixture(base)
            first = run(root, declarations_path, "--format", "json", "--check")
            second = run(root, declarations_path, "--format", "json", "--check")
            self.assertEqual(first.returncode, 0, first.stderr)
            self.assertEqual(second.returncode, 0, second.stderr)
            self.assertEqual(first.stdout, second.stdout)


if __name__ == "__main__":
    unittest.main()
