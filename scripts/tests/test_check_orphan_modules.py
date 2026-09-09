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
        # El motivo lleva el nombre del módulo porque ahora los motivos deben
        # ser distintivos: uno que vale para dos módulos no explica ninguno.
        "reason": f"Declaración de prueba con procedencia suficiente para {module}.",
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



class ProvenanceIsDistinctiveTest(unittest.TestCase):
    """La procedencia no puede autocertificarse rellenando los campos.

    La verificación de evidencia mira si el enlace RESUELVE, no si viene a
    cuento, y por esa rendija se coló una entrega real el 27-ago-2026: 34
    declaraciones de claves de idioma con un solo motivo —«Clave de idioma no
    utilizada…», que es la definición de huérfana— y una sola evidencia para las
    34, el issue #571, que es el de los ficheros de audio. Las 34 pasaban la
    verificación de enlaces, porque el #571 existe.
    """

    def _validar(self, entradas):
        inventory_checker._validate_provenance_is_distinctive(
            {e["module"]: e for e in entradas}
        )

    def test_dos_modulos_no_pueden_compartir_motivo(self):
        entradas = [declaration("a.mjs"), declaration("b.mjs", reason="Igual.")]
        entradas[0]["reason"] = "Igual."
        with self.assertRaises(ValueError) as ctx:
            self._validar(entradas)
        self.assertIn("motivo de declaración repetido", str(ctx.exception))
        self.assertIn("a.mjs", str(ctx.exception))

    def test_el_motivo_se_compara_sin_mayusculas_ni_espacios_de_sobra(self):
        """Cambiar el envoltorio no convierte un motivo copiado en uno propio."""
        entradas = [declaration("a.mjs"), declaration("b.mjs")]
        entradas[0]["reason"] = "Cimiento sin consumidor."
        entradas[1]["reason"] = "  CIMIENTO   sin\n consumidor.  "
        with self.assertRaises(ValueError):
            self._validar(entradas)

    def test_motivos_distintos_pasan(self):
        self._validar([declaration("a.mjs"), declaration("b.mjs")])

    def test_una_evidencia_compartida_por_pocos_modulos_es_legitima(self):
        """`npc-generador` y `npc-tablas` citan ambos el #676, y está bien:
        son dos módulos de una misma función."""
        entradas = [declaration(f"m{i}.mjs") for i in range(
            inventory_checker.MAX_DECLARACIONES_POR_EVIDENCIA)]
        self._validar(entradas)

    def test_la_misma_evidencia_repetida_de_mas_se_rechaza(self):
        entradas = [declaration(f"m{i}.mjs") for i in range(
            inventory_checker.MAX_DECLARACIONES_POR_EVIDENCIA + 1)]
        with self.assertRaises(ValueError) as ctx:
            self._validar(entradas)
        self.assertIn("enlace copiado", str(ctx.exception))

    def test_el_caso_real_de_las_34_claves_se_rechaza(self):
        entradas = [
            declaration(f"m{i}.mjs",
                        reason="Clave de idioma no utilizada en el código de scripts ni plantillas.")
            for i in range(34)
        ]
        with self.assertRaises(ValueError):
            self._validar(entradas)

    def test_el_inventario_real_del_repositorio_pasa(self):
        """La guarda no puede nacer rompiendo `main`."""
        raiz = Path(__file__).parents[2]
        datos = json.loads(
            (raiz / "docs" / "orphan-declarations.json").read_text(encoding="utf-8"))
        self._validar(datos["declarations"])


class ModulosNuevosTest(unittest.TestCase):
    """La guarda del DELTA: un módulo que estrena un PR no puede entrar mudo.

    `unknown` no rompe CI para lo que ya está en el árbol (#701) — ante
    sintaxis que el lexer no puede demostrar, el inventario prefiere no saber
    antes que acusar en falso. Pero eso es una regla sobre lo HEREDADO: un
    módulo recién escrito y sin consumidor es la reposición de #537 otra vez,
    y quien lo escribe es el único que sabe si es cimiento o cable olvidado.
    """

    def test_traduce_rutas_del_repositorio_a_claves_de_modulo(self):
        claves = inventory_checker.modulos_nuevos(
            [
                "foundry-module/scripts/nueva.mjs",
                "foundry-module/scripts/minijuegos/otra.mjs",
            ],
            Path("foundry-module"),
        )
        self.assertEqual(claves, ["minijuegos/otra.mjs", "nueva.mjs"])

    def test_descarta_lo_que_no_es_un_modulo_del_arbol(self):
        """Un diff trae de todo: docs, tests, ficheros de otra carpeta y
        líneas en blanco. Nada de eso es un módulo que estrenar."""
        claves = inventory_checker.modulos_nuevos(
            [
                "",
                "   ",
                "docs/algo.md",
                "src/content/cosa.cpp",
                "foundry-module/tests/nueva.test.mjs",
                "foundry-module/scripts/buena.mjs",
            ],
            Path("foundry-module"),
        )
        self.assertEqual(claves, ["buena.mjs"])

    def test_ruta_con_espacios_alrededor_se_acepta(self):
        claves = inventory_checker.modulos_nuevos(
            ["  foundry-module/scripts/buena.mjs  "], Path("foundry-module"))
        self.assertEqual(claves, ["buena.mjs"])

    def _revisar(self, results, nuevos, fuentes, art_modules=frozenset()):
        return inventory_checker.revisar_modulos_nuevos(
            results, nuevos, fuentes, set(art_modules))

    def test_un_modulo_nuevo_unknown_es_error(self):
        errores = self._revisar(
            [{"module": "nueva.mjs", "status": "unknown"}],
            ["nueva.mjs"],
            {"nueva.mjs": "export const x = 1;\n"},
        )
        self.assertEqual(len(errores), 1)
        self.assertIn("sin consumidor y sin declarar", errores[0])

    def test_un_modulo_nuevo_conectado_pasa(self):
        self.assertEqual(
            self._revisar(
                [{"module": "nueva.mjs", "status": "connected"}],
                ["nueva.mjs"],
                {"nueva.mjs": "export const x = 1;\n"},
            ),
            [],
        )

    def test_un_modulo_nuevo_declarado_huerfano_pasa(self):
        """Declararlo es la salida legítima: cimiento con motivo y evidencia."""
        self.assertEqual(
            self._revisar(
                [{"module": "nueva.mjs", "status": "declared-orphan"}],
                ["nueva.mjs"],
                {"nueva.mjs": "export const x = 1;\n"},
            ),
            [],
        )

    def test_un_unknown_heredado_no_bloquea_a_nadie(self):
        """La regla es sobre el delta: el `unknown` que ya estaba sigue sin
        romper CI, que es la decisión de #701 y no se toca aquí."""
        self.assertEqual(
            self._revisar(
                [
                    {"module": "vieja.mjs", "status": "unknown"},
                    {"module": "nueva.mjs", "status": "connected"},
                ],
                ["nueva.mjs"],
                {"nueva.mjs": "export const x = 1;\n"},
            ),
            [],
        )

    def test_un_modulo_nuevo_con_color_propio_es_error(self):
        errores = self._revisar(
            [{"module": "nueva.mjs", "status": "connected"}],
            ["nueva.mjs"],
            {"nueva.mjs": 'export const FONDO = "#ff8c1e";\n'},
        )
        self.assertEqual(len(errores), 1)
        self.assertIn("#ff8c1e", errores[0])
        self.assertIn("paleta.mjs", errores[0])

    def test_rgba_tambien_cuenta_como_color_propio(self):
        errores = self._revisar(
            [{"module": "nueva.mjs", "status": "connected"}],
            ["nueva.mjs"],
            {"nueva.mjs": "ctx.fillStyle = rgba(12, 4, 9, 0.5);\n"},
        )
        self.assertEqual(len(errores), 1)

    def test_un_color_en_comentario_no_acusa(self):
        """Misma limpieza que hace paleta.test.mjs: un color citado en prosa
        explicando de dónde sale un tono no es un color declarado."""
        fuente = (
            "// el ámbar de señal es #ff8c1e y vive en paleta.mjs\n"
            "/* histórico: antes era #ffb703 */\n"
            "import { AMBAR_SENAL } from './paleta.mjs';\n"
        )
        self.assertEqual(
            self._revisar(
                [{"module": "nueva.mjs", "status": "connected"}],
                ["nueva.mjs"],
                {"nueva.mjs": fuente},
            ),
            [],
        )

    def test_un_modulo_de_arte_puede_declarar_color(self):
        """artModules es la frontera ya razonada de #351: dentro de ella el
        color propio es el contenido, y quien lo vigila es paleta.test.mjs."""
        self.assertEqual(
            self._revisar(
                [{"module": "nueva.mjs", "status": "connected"}],
                ["nueva.mjs"],
                {"nueva.mjs": 'export const P = "#ff8c1e";\n'},
                art_modules={"nueva.mjs"},
            ),
            [],
        )

    def test_la_paleta_no_se_acusa_a_si_misma(self):
        """`paleta.mjs` es DONDE viven los colores y no está en artModules
        —esa lista dice quién los consume—. Sin la excepción, la guarda
        acusaría a la regla de incumplirse a sí misma."""
        self.assertEqual(
            self._revisar(
                [{"module": inventory_checker.MODULO_PALETA, "status": "connected"}],
                [inventory_checker.MODULO_PALETA],
                {inventory_checker.MODULO_PALETA: 'export const T = "#ff8c1e";\n'},
            ),
            [],
        )

    def test_un_modulo_nuevo_sin_fuente_legible_no_revienta(self):
        """Si el fichero no se pudo leer, el estado sigue comprobándose y la
        parte de color se calla: no saber no es acusar."""
        self.assertEqual(
            self._revisar(
                [{"module": "nueva.mjs", "status": "connected"}],
                ["nueva.mjs"],
                {},
            ),
            [],
        )

    def test_un_modulo_que_el_inventario_no_conoce_se_ignora(self):
        self.assertEqual(self._revisar([], ["fantasma.mjs"], {}), [])

    def test_los_dos_defectos_se_informan_juntos(self):
        """Un módulo puede estar huérfano Y traer color propio: arreglar uno
        y volver a descubrir el otro en la siguiente vuelta de CI es el
        desperdicio que esta guarda existe para evitar."""
        errores = self._revisar(
            [{"module": "nueva.mjs", "status": "unknown"}],
            ["nueva.mjs"],
            {"nueva.mjs": 'export const F = "#ff8c1e";\n'},
        )
        self.assertEqual(len(errores), 2)


class ModulosNuevosCliTest(unittest.TestCase):
    """La guarda tiene que fallar de verdad en la línea de órdenes: es como
    la ejecuta CI, y un `revisar_modulos_nuevos` correcto con un `main` que
    no lo llama sería el mismo fallo que la guarda persigue."""

    def _correr(self, rutas):
        with tempfile.NamedTemporaryFile(
                "w", suffix=".txt", delete=False, encoding="utf-8") as fh:
            fh.write("\n".join(rutas))
            nombre = fh.name
        try:
            return subprocess.run(
                [sys.executable, str(SCRIPT), "--nuevos", nombre],
                cwd=str(SCRIPT.parents[1]),
                capture_output=True,
                text=True,
            )
        finally:
            os.unlink(nombre)

    def test_sin_modulos_nuevos_no_falla(self):
        self.assertEqual(self._correr([]).returncode, 0)

    def test_un_fichero_de_nuevos_inexistente_da_error_de_uso(self):
        proceso = subprocess.run(
            [sys.executable, str(SCRIPT), "--nuevos", "no-existe-jamas.txt"],
            cwd=str(SCRIPT.parents[1]), capture_output=True, text=True)
        self.assertEqual(proceso.returncode, 2)

    def test_la_guarda_del_delta_es_mas_estricta_que_el_arbol_heredado(self):
        """Declarar nuevo TODO lo que ya está en `main` SÍ enciende la guarda,
        y eso es correcto, no un fallo: el árbol arrastra casos consentidos
        —`unknown` heredados que #701 decidió no romper, y los módulos de arte
        que `paleta.test.mjs` dejó fuera de `artModules` por su propio motivo—.
        La guarda del delta no los indulta porque no los mira: solo mira lo que
        un PR estrena. Este test fija esa asimetría para que nadie la lea como
        una regresión y afloje la guarda para «arreglarla».

        Lo que sí se exige es que no haya FALSOS positivos: todo módulo que la
        guarda nombre debe ser o bien `unknown`, o bien portador real de un
        color propio. Un módulo conectado y sin color no puede salir acusado.
        """
        raiz = SCRIPT.parents[1]
        modulos = sorted(
            str(ruta.relative_to(raiz))
            for ruta in (raiz / "foundry-module" / "scripts").rglob("*.mjs")
        )
        proceso = self._correr(modulos)
        self.assertEqual(proceso.returncode, 1, proceso.stdout)

        estados = {
            fila["module"]: fila["status"]
            for fila in inventory_checker.inventory(
                root=raiz / "foundry-module",
                declaration_path=raiz / "docs" / "orphan-declarations.json",
            )
        }
        acusados = [
            linea.split(":", 1)[0].strip(" -")
            for linea in proceso.stderr.splitlines()
            if linea.startswith("  - ")
        ]
        self.assertTrue(acusados)
        for modulo in acusados:
            self.assertIn(modulo, estados, f"{modulo} no existe en el inventario")
            fuente = (raiz / "foundry-module" / "scripts" / modulo).read_text(
                encoding="utf-8")
            motivo_valido = (
                estados[modulo] == "unknown"
                or inventory_checker.COLOR_LITERAL_RE.search(
                    inventory_checker.sin_comentarios(fuente))
            )
            self.assertTrue(
                motivo_valido,
                f"{modulo} acusado sin ser unknown ni declarar color: falso positivo")


if __name__ == "__main__":
    unittest.main()
