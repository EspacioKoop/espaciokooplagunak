"""Pruebas del monitor local de suites (#875)."""

from __future__ import annotations

import importlib.util
import io
import json
import os
import signal
import subprocess
import sys
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
HERRAMIENTA = REPO / "tools" / "monitor_test_suite.py"
_spec = importlib.util.spec_from_file_location("monitor_test_suite", HERRAMIENTA)
assert _spec is not None
monitor = importlib.util.module_from_spec(_spec)
assert _spec.loader is not None
_spec.loader.exec_module(monitor)


def python(*codigo: str) -> list[str]:
    return [sys.executable, "-c", ";".join(codigo)]


class EjecutarSuite(unittest.TestCase):
    def test_salida_correcta(self) -> None:
        logs = io.BytesIO()
        resultado = monitor.ejecutar_suite(python("print('ok')"), salida_hija=logs)
        self.assertEqual(resultado["status"], "passed")
        self.assertEqual(resultado["exit_code"], 0)
        self.assertFalse(resultado["timed_out"])
        self.assertEqual(logs.getvalue(), b"ok\n")

    def test_fallo_conserva_codigo_y_logs(self) -> None:
        logs = io.BytesIO()
        resultado = monitor.ejecutar_suite(
            python("import sys", "print('fallo', file=sys.stderr)", "sys.exit(7)"),
            salida_hija=logs,
        )
        self.assertEqual(resultado["status"], "failed")
        self.assertEqual(resultado["exit_code"], 7)
        self.assertIn(b"fallo", logs.getvalue())

    def test_timeout_se_distingue_de_un_fallo(self) -> None:
        resultado = monitor.ejecutar_suite(
            python("import time", "time.sleep(5)"), timeout=0.05, gracia=0.05, salida_hija=io.BytesIO()
        )
        self.assertEqual(resultado["status"], "timeout")
        self.assertTrue(resultado["timed_out"])
        self.assertGreaterEqual(resultado["duration_ms"], 40)
        self.assertLess(resultado["duration_ms"], 2000)

    @unittest.skipUnless(os.name == "posix", "las señales negativas son contrato POSIX")
    def test_senal_no_se_disfraza_de_fallo_normal(self) -> None:
        resultado = monitor.ejecutar_suite(
            python("import os, signal", "os.kill(os.getpid(), signal.SIGTERM)"),
            salida_hija=io.BytesIO(),
        )
        self.assertEqual(resultado["status"], "signaled")
        self.assertEqual(resultado["signal"], signal.SIGTERM)
        self.assertIsNone(resultado["exit_code"])

    def test_resultado_tiene_esquema_y_timestamps(self) -> None:
        resultado = monitor.ejecutar_suite(python("pass"), salida_hija=io.BytesIO())
        self.assertEqual(
            set(resultado),
            {
                "schema_version",
                "status",
                "command",
                "started_at",
                "finished_at",
                "duration_ms",
                "exit_code",
                "signal",
                "timed_out",
            },
        )
        self.assertEqual(resultado["schema_version"], 1)
        self.assertTrue(str(resultado["started_at"]).endswith("Z"))
        self.assertTrue(str(resultado["finished_at"]).endswith("Z"))
        self.assertGreaterEqual(resultado["duration_ms"], 0)

    def test_rechaza_timeout_no_positivo(self) -> None:
        with self.assertRaises(ValueError):
            monitor.ejecutar_suite(python("pass"), timeout=0, salida_hija=io.BytesIO())


class Cli(unittest.TestCase):
    def ejecutar(self, *args: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [sys.executable, str(HERRAMIENTA), *args],
            cwd=REPO,
            text=True,
            capture_output=True,
            check=False,
            timeout=5,
        )

    def test_stdout_es_json_y_los_logs_van_a_stderr(self) -> None:
        proceso = self.ejecutar("--", *python("print('log-hijo')"))
        self.assertEqual(proceso.returncode, 0)
        resultado = json.loads(proceso.stdout)
        self.assertEqual(resultado["status"], "passed")
        self.assertIn("log-hijo", proceso.stderr)

    def test_cli_propaga_fallo(self) -> None:
        proceso = self.ejecutar("--", *python("import sys", "sys.exit(9)"))
        self.assertEqual(proceso.returncode, 9)
        self.assertEqual(json.loads(proceso.stdout)["status"], "failed")

    def test_cli_timeout_usa_codigo_124(self) -> None:
        proceso = self.ejecutar("--timeout", "0.05", "--grace", "0.05", "--", *python("import time", "time.sleep(5)"))
        self.assertEqual(proceso.returncode, 124)
        self.assertEqual(json.loads(proceso.stdout)["status"], "timeout")


if __name__ == "__main__":
    unittest.main()
