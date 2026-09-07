import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from urllib.error import HTTPError, URLError
from unittest.mock import patch

SCRIPT = Path(__file__).parents[1] / "check_orphan_modules.py"
sys.path.insert(0, str(SCRIPT.parent))

import check_orphan_modules as inventory_checker  # noqa: E402
from check_orphan_modules import (  # noqa: E402
    EvidenceLinkNotFound,
    EvidenceVerificationError,
    _request_github_evidence,
)

ISSUE_URL = "https://github.com/EspacioKoop/espaciokooplagunak/issues/701"
LOCAL_EVIDENCE = {"type": "test", "path": "module/tests/evidence.test.mjs"}


def declaration(module, status="declared-orphan", **overrides):
    entry = {
        "module": module,
        "status": status,
        "reason": "Declaración de prueba con procedencia suficiente.",
        "declaredBy": "test",
        "declaredAt": "2026-08-24",
        "evidence": LOCAL_EVIDENCE,
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
    evidence_path = root / "tests" / "evidence.test.mjs"
    evidence_path.parent.mkdir(exist_ok=True)
    evidence_path.write_text("// evidencia de fixture\n", encoding="utf-8")
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


def assert_valid_javascript(test_case, path):
    result = subprocess.run(
        ["node", "--check", str(path)], capture_output=True, text=True, check=False
    )
    test_case.assertEqual(result.returncode, 0, result.stderr)


class FakeResponse:
    def __init__(self, status=200, body=b"{}"):
        self.status = status
        self.body = body

    def __enter__(self):
        return self

    def __exit__(self, *unused):
        return False

    def read(self, size=-1):
        return self.body if size < 0 else self.body[:size]


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
            self.assertEqual(inventory["dynamic.mjs"]["evidence"], LOCAL_EVIDENCE)

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

    def test_complete_literal_dynamic_import_is_connected(self):
        with tempfile.TemporaryDirectory() as temporary:
            base = Path(temporary)
            root, declarations_path = write_fixture(
                base, main_source='import("./dynamic.mjs");\n'
            )
            assert_valid_javascript(self, root / "scripts" / "main.mjs")
            result = run(root, declarations_path, "--format", "json", "--check")
            self.assertEqual(result.returncode, 0, result.stderr)
            inventory = {item["module"]: item for item in json.loads(result.stdout)}
            self.assertEqual(inventory["dynamic.mjs"]["status"], "connected")

    def test_concatenated_dynamic_import_target_is_unknown(self):
        with tempfile.TemporaryDirectory() as temporary:
            base = Path(temporary)
            root, declarations_path = write_fixture(
                base,
                main_source='const suffix = ".backup"; import("./dynamic.mjs" + suffix);\n',
            )
            assert_valid_javascript(self, root / "scripts" / "main.mjs")
            result = run(root, declarations_path, "--format", "json", "--check")
            self.assertEqual(result.returncode, 0, result.stderr)
            inventory = {item["module"]: item for item in json.loads(result.stdout)}
            self.assertEqual(inventory["dynamic.mjs"]["status"], "unknown")

    def test_concatenated_dynamic_import_prefix_is_unknown_not_error(self):
        with tempfile.TemporaryDirectory() as temporary:
            base = Path(temporary)
            root, declarations_path = write_fixture(
                base,
                main_source='const name = "dynamic.mjs"; import("./" + name);\n',
            )
            assert_valid_javascript(self, root / "scripts" / "main.mjs")
            result = run(root, declarations_path, "--format", "json", "--check")
            self.assertEqual(result.returncode, 0, result.stderr)
            inventory = {item["module"]: item for item in json.loads(result.stdout)}
            self.assertEqual(inventory["dynamic.mjs"]["status"], "unknown")

    def test_template_dynamic_import_is_unknown(self):
        with tempfile.TemporaryDirectory() as temporary:
            base = Path(temporary)
            root, declarations_path = write_fixture(
                base,
                main_source='const name = "dynamic"; import(`./${name}.mjs`);\n',
            )
            assert_valid_javascript(self, root / "scripts" / "main.mjs")
            result = run(root, declarations_path, "--format", "json", "--check")
            self.assertEqual(result.returncode, 0, result.stderr)
            inventory = {item["module"]: item for item in json.loads(result.stdout)}
            self.assertEqual(inventory["dynamic.mjs"]["status"], "unknown")

    def test_nested_template_text_cannot_create_import_edge(self):
        with tempfile.TemporaryDirectory() as temporary:
            base = Path(temporary)
            root, declarations_path = write_fixture(
                base,
                main_source='const message = `outer ${`import("./dynamic.mjs")`} tail`;\n',
            )
            assert_valid_javascript(self, root / "scripts" / "main.mjs")
            result = run(root, declarations_path, "--format", "json", "--check")
            self.assertEqual(result.returncode, 0, result.stderr)
            inventory = {item["module"]: item for item in json.loads(result.stdout)}
            self.assertEqual(inventory["dynamic.mjs"]["status"], "unknown")

    def test_import_named_object_method_is_not_an_import_edge(self):
        with tempfile.TemporaryDirectory() as temporary:
            base = Path(temporary)
            root, declarations_path = write_fixture(
                base,
                main_source='globalThis.loader.import("./dynamic.mjs");\n',
            )
            assert_valid_javascript(self, root / "scripts" / "main.mjs")
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

    def test_comment_string_and_regex_do_not_count_as_consumers(self):
        with tempfile.TemporaryDirectory() as temporary:
            base = Path(temporary)
            root, declarations_path = write_fixture(
                base,
                main_source=(
                    'import "./used.mjs";\n'
                    '// import "./dynamic.mjs";\n'
                    'const example = \'import "./dynamic.mjs"\';\n'
                    'const pattern = /import(".\\/dynamic.mjs")/;\n'
                ),
            )
            assert_valid_javascript(self, root / "scripts" / "main.mjs")
            result = run(root, declarations_path, "--format", "json", "--check")
            self.assertEqual(result.returncode, 0, result.stderr)
            inventory = {item["module"]: item for item in json.loads(result.stdout)}
            self.assertEqual(inventory["dynamic.mjs"]["status"], "unknown")

    def test_regex_with_backtick_is_ignored_without_lexer_error(self):
        with tempfile.TemporaryDirectory() as temporary:
            base = Path(temporary)
            root, declarations_path = write_fixture(
                base,
                main_source='const pattern = /[`]import(".\\/dynamic.mjs")/;\n',
            )
            assert_valid_javascript(self, root / "scripts" / "main.mjs")
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

    def test_static_import_and_reexport_are_connected(self):
        with tempfile.TemporaryDirectory() as temporary:
            base = Path(temporary)
            root, declarations_path = write_fixture(
                base,
                main_source=(
                    'import { used } from "./used.mjs";\n'
                    'export { dynamic } from "./dynamic.mjs";\n'
                ),
            )
            assert_valid_javascript(self, root / "scripts" / "main.mjs")
            result = run(root, declarations_path, "--format", "json", "--check")
            self.assertEqual(result.returncode, 0, result.stderr)
            inventory = {item["module"]: item for item in json.loads(result.stdout)}
            self.assertEqual(inventory["used.mjs"]["status"], "connected")
            self.assertEqual(inventory["dynamic.mjs"]["status"], "connected")

    def test_export_clause_cannot_borrow_from_after_statement_boundary(self):
        with tempfile.TemporaryDirectory() as temporary:
            base = Path(temporary)
            root, declarations_path = write_fixture(
                base, main_source='export {}\nfrom\n"./dynamic.mjs";\n'
            )
            assert_valid_javascript(self, root / "scripts" / "main.mjs")
            result = run(root, declarations_path, "--format", "json", "--check")
            self.assertEqual(result.returncode, 0, result.stderr)
            inventory = {item["module"]: item for item in json.loads(result.stdout)}
            self.assertEqual(inventory["dynamic.mjs"]["status"], "unknown")

    def test_division_before_import_text_in_string_is_unknown(self):
        with tempfile.TemporaryDirectory() as temporary:
            base = Path(temporary)
            root, declarations_path = write_fixture(
                base,
                main_source=(
                    "const ratio = 1 / 'prefix/ import(\"./dynamic.mjs\")';\n"
                ),
            )
            assert_valid_javascript(self, root / "scripts" / "main.mjs")
            result = run(root, declarations_path, "--format", "json", "--check")
            self.assertEqual(result.returncode, 0, result.stderr)
            inventory = {item["module"]: item for item in json.loads(result.stdout)}
            self.assertEqual(inventory["dynamic.mjs"]["status"], "unknown")

    def test_output_is_stable(self):
        with tempfile.TemporaryDirectory() as temporary:
            base = Path(temporary)
            root, declarations_path = write_fixture(base)
            first = run(root, declarations_path, "--format", "json", "--check")
            second = run(root, declarations_path, "--format", "json", "--check")
            self.assertEqual(first.returncode, 0, first.stderr)
            self.assertEqual(second.returncode, 0, second.stderr)
            self.assertEqual(first.stdout, second.stdout)

    def test_github_evidence_uses_api_timeout_and_token(self):
        captured = {}

        def opener(request, timeout):
            captured["request"] = request
            captured["timeout"] = timeout
            return FakeResponse()

        _request_github_evidence(
            ISSUE_URL, token="token-de-prueba", timeout=3.5, opener=opener
        )

        request = captured["request"]
        self.assertEqual(
            request.full_url,
            "https://api.github.com/repos/EspacioKoop/espaciokooplagunak/issues/701",
        )
        self.assertEqual(request.get_header("Authorization"), "Bearer token-de-prueba")
        self.assertEqual(request.get_header("Accept"), "application/vnd.github+json")
        self.assertEqual(captured["timeout"], 3.5)

    def test_pr_evidence_uses_pulls_endpoint_without_empty_token_header(self):
        captured = {}

        def opener(request, timeout):
            captured["request"] = request
            return FakeResponse()

        _request_github_evidence(
            "https://github.com/EspacioKoop/espaciokooplagunak/pull/742",
            token="  ",
            opener=opener,
        )

        request = captured["request"]
        self.assertEqual(
            request.full_url,
            "https://api.github.com/repos/EspacioKoop/espaciokooplagunak/pulls/742",
        )
        self.assertIsNone(request.get_header("Authorization"))

    def test_issue_declaration_only_checks_remote_in_explicit_ci_mode(self):
        with tempfile.TemporaryDirectory() as temporary:
            base = Path(temporary)
            root, declarations_path = write_fixture(
                base,
                declarations=[
                    declaration(
                        "dynamic.mjs",
                        evidence={"type": "issue", "url": ISSUE_URL},
                    )
                ],
            )
            with (
                patch.dict(os.environ, {"GITHUB_TOKEN": "token-ci"}),
                patch.object(inventory_checker, "_verify_github_evidence") as verify,
            ):
                inventory_checker.load_declarations(declarations_path, root.parent)
                verify.assert_not_called()
                inventory_checker.load_declarations(
                    declarations_path,
                    root.parent,
                    verify_github=True,
                )
            verify.assert_called_once_with(ISSUE_URL, "token-ci")

    def test_github_evidence_confirmed_404_is_a_broken_link(self):
        def opener(request, timeout):
            raise HTTPError(request.full_url, 404, "Not Found", {}, None)

        with self.assertRaisesRegex(EvidenceLinkNotFound, "GitHub confirmó 404"):
            _request_github_evidence(ISSUE_URL, opener=opener)

    def test_github_evidence_network_failure_is_not_reported_as_404(self):
        def opener(request, timeout):
            raise URLError(TimeoutError("timed out"))

        with self.assertRaisesRegex(
            EvidenceVerificationError, "no se pudo verificar.*red"
        ) as raised:
            _request_github_evidence(ISSUE_URL, opener=opener)
        self.assertNotIsInstance(raised.exception, EvidenceLinkNotFound)

    def test_issue_evidence_rejects_pull_request_returned_by_issues_endpoint(self):
        def opener(request, timeout):
            return FakeResponse(body=b'{"number":742,"pull_request":{}}')

        with self.assertRaisesRegex(ValueError, "declarada como issue.*PR"):
            _request_github_evidence(
                "https://github.com/EspacioKoop/espaciokooplagunak/issues/742",
                opener=opener,
            )

    def test_issue_evidence_accepts_real_issue_payload(self):
        def opener(request, timeout):
            return FakeResponse(body=b'{"number":701}')

        _request_github_evidence(ISSUE_URL, opener=opener)

    def test_calendar_date_must_exist(self):
        with tempfile.TemporaryDirectory() as temporary:
            base = Path(temporary)
            root, declarations_path = write_fixture(
                base,
                declarations=[declaration("dynamic.mjs", declaredAt="2026-02-30")],
            )
            result = run(root, declarations_path, "--check")
            self.assertEqual(result.returncode, 2)
            self.assertIn("fecha de declaración inválida", result.stderr)

    def test_local_test_evidence_must_exist(self):
        with tempfile.TemporaryDirectory() as temporary:
            base = Path(temporary)
            root, declarations_path = write_fixture(
                base,
                declarations=[
                    declaration(
                        "dynamic.mjs",
                        evidence={"type": "test", "path": "module/tests/missing.test.mjs"},
                    )
                ],
            )
            result = run(root, declarations_path, "--check")
            self.assertEqual(result.returncode, 2)
            self.assertIn("evidencia test inexistente", result.stderr)

    def test_existing_local_test_evidence_is_accepted(self):
        with tempfile.TemporaryDirectory() as temporary:
            base = Path(temporary)
            evidence_path = base / "module" / "tests" / "dynamic.test.mjs"
            evidence_path.parent.mkdir(parents=True)
            evidence_path.write_text("// evidencia local\n", encoding="utf-8")
            root, declarations_path = write_fixture(
                base,
                declarations=[
                    declaration(
                        "dynamic.mjs",
                        evidence={"type": "test", "path": "module/tests/dynamic.test.mjs"},
                    )
                ],
            )
            result = run(root, declarations_path, "--check")
            self.assertEqual(result.returncode, 0, result.stderr)


if __name__ == "__main__":
    unittest.main()
