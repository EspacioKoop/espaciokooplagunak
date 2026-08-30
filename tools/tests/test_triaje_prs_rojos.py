"""Pruebas del triaje de PRs en rojo.

Los fragmentos de log son REALES, copiados de las ejecuciones que motivaron la
herramienta (runs 32994196808 y 33095418758 del 2026-08-26/27). Un fixture
inventado probaría el parser contra un formato que GitHub no emite.
"""
import importlib.util
import io
import json
import os
import unittest
from contextlib import redirect_stderr, redirect_stdout
from unittest import mock

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_spec = importlib.util.spec_from_file_location(
    "triaje_prs_rojos", os.path.join(RAIZ, "triaje-prs-rojos.py"))
triaje = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(triaje)


LOG_MAPA_AREAS = (
    "tools/tests (Linux)\tUNKNOWN STEP\t2026-08-26T17:29:08.4572024Z         self.assertGreater(len(modulos), 50)\n"
    "tools/tests (Linux)\tUNKNOWN STEP\t2026-08-26T17:29:08.4582804Z E       AssertionError: Lists differ\n"
    "tools/tests (Linux)\tUNKNOWN STEP\t2026-08-26T17:29:08.4589689Z FAILED tools/tests/test_mapa_areas.py::MapaDeAreas::test_ningun_modulo_del_foundry_queda_sin_area - AssertionError: Lists differ\n"
    "tools/tests (Linux)\tUNKNOWN STEP\t2026-08-26T17:29:08.4919164Z ##[error]Process completed with exit code 1.\n"
)

LOG_NEWLINE = (
    "tools/tests (Linux)\tUNKNOWN STEP\t2026-08-27T17:01:34.3608042Z tools/tests/test_check_final_newline.py:38: AssertionError\n"
    "tools/tests (Linux)\tUNKNOWN STEP\t2026-08-27T17:01:34.3623824Z FAILED tools/tests/test_check_final_newline.py::test_el_arbol_actual_esta_limpio - assert 1 == 0\n"
)

# Ruido de `actions/checkout`: es la mayor parte de un log y no dice nada.
LOG_SOLO_RUIDO = (
    "Puerta de tools\tUNKNOWN STEP\t2026-08-26T17:29:35.1257300Z Removing HTTP extra header\n"
    "Puerta de tools\tUNKNOWN STEP\t2026-08-26T17:29:35.2306805Z Cleaning up orphan processes\n"
)


class FirmaDeLog(unittest.TestCase):
    def test_pytest_gana_al_codigo_de_salida(self):
        # El mismo log trae el FAILED y un `exit code 1`. Quedarse con el
        # segundo perdería lo unico que distingue una causa de otra.
        clase, detalle = triaje.firma_de_log(LOG_MAPA_AREAS)
        self.assertEqual(clase, "pytest")
        self.assertIn("test_ningun_modulo_del_foundry_queda_sin_area", detalle)

    def test_dos_fallos_distintos_dan_firmas_distintas(self):
        self.assertNotEqual(
            triaje.firma_de_log(LOG_MAPA_AREAS),
            triaje.firma_de_log(LOG_NEWLINE),
            "dos causas sin relación no pueden colapsar en un grupo")

    def test_log_sin_causa_reconocible_devuelve_none(self):
        # Distinguir «no hay causa en el log» de «no he mirado». Inventar una
        # causa para tapar el hueco es peor que el hueco.
        self.assertIsNone(triaje.firma_de_log(LOG_SOLO_RUIDO))

    def test_codigo_de_salida_como_ultimo_recurso(self):
        log = LOG_SOLO_RUIDO + "x\ty\t2026-08-26T17:29:35.9Z ##[error]Process completed with exit code 2\n"
        clase, detalle = triaje.firma_de_log(log)
        self.assertEqual(clase, "salida")
        self.assertIn("2", detalle)

    def test_error_de_workflow(self):
        log = ("x\ty\t2026-08-26T17:29:34.9Z \x1b[36;1m##[error]metadata-action no generó "
               "un tag SHA.\x1b[0m\n")
        clase, detalle = triaje.firma_de_log(log)
        self.assertEqual(clase, "workflow")
        self.assertIn("no generó un tag SHA", detalle)
        self.assertNotIn("\x1b", detalle, "las secuencias ANSI ensucian la firma")

    def test_la_queja_de_una_puerta_no_es_una_causa(self):
        # `La puerta no pasa: jobs en rojo: tests` solo NOMBRA el job donde está
        # la causa, en otro workflow. Se clasifica aparte para que nadie agrupe
        # por ella creyendo que ha encontrado un origen común.
        log = "x\ty\t2026-08-26T17:29:34.9Z ##[error]La puerta no pasa. Jobs en rojo o cancelados: tests (failure)\n"
        clase, _ = triaje.firma_de_log(log)
        self.assertEqual(clase, "puerta")

    def test_una_causa_real_gana_a_la_queja_de_la_puerta(self):
        # Este es el fallo que la herramienta cometía contra sí misma: la línea
        # de la puerta aparecía ANTES en el log y se quedaba con ella.
        log = (
            "x\ty\t2026-08-26T17:29:34.0Z ##[error]La puerta no pasa. Jobs en rojo: tests (failure)\n"
            + LOG_MAPA_AREAS)
        clase, detalle = triaje.firma_de_log(log)
        self.assertEqual(clase, "pytest")
        self.assertIn("test_ningun_modulo_del_foundry_queda_sin_area", detalle)

    def test_rutas_del_runner_no_entran_en_la_firma(self):
        # El mismo fallo en dos runs distintos tiene que agrupar junto.
        a = "x\ty\t2026-08-26T01:00:00.0Z FAILED /home/runner/work/espaciokooplagunak/espaciokooplagunak/tools/tests/test_a.py::test_b - boom\n"
        b = "x\ty\t2026-08-27T02:00:00.0Z FAILED /home/runner/work/otro/otro/tools/tests/test_a.py::test_b - boom\n"
        self.assertEqual(triaje.firma_de_log(a), triaje.firma_de_log(b))


class Agrupar(unittest.TestCase):
    def _entradas(self):
        return [
            {"numero": 803, "titulo": "convocatoria", "check": "tools/tests (Linux)", "log": LOG_MAPA_AREAS},
            {"numero": 826, "titulo": "skills", "check": "tools/tests (Linux)", "log": LOG_NEWLINE},
            {"numero": 819, "titulo": "guarda de restos", "check": "tools/tests (Linux)", "log": LOG_MAPA_AREAS},
        ]

    def test_mismo_check_no_significa_misma_causa(self):
        # Es el fallo que motivó la herramienta: los tres comparten check.
        grupos = triaje.agrupar(self._entradas())
        self.assertEqual(len(grupos), 2)

    def test_un_pr_con_dos_checks_por_la_misma_causa_cuenta_una_vez(self):
        entradas = self._entradas() + [
            {"numero": 803, "titulo": "convocatoria", "check": "Puerta de tools", "log": LOG_MAPA_AREAS}]
        grupos = triaje.agrupar(entradas)
        mayor = grupos[0]["prs"]
        self.assertEqual([p["numero"] for p in mayor], [803, 819])
        c803 = [p for p in mayor if p["numero"] == 803][0]["checks"]
        self.assertEqual(sorted(c803), ["Puerta de tools", "tools/tests (Linux)"])

    def test_el_grupo_mayor_va_primero(self):
        grupos = triaje.agrupar(self._entradas())
        self.assertEqual([p["numero"] for p in grupos[0]["prs"]], [803, 819])
        self.assertEqual([p["numero"] for p in grupos[1]["prs"]], [826])

    def test_orden_estable_entre_ejecuciones(self):
        a = triaje.agrupar(self._entradas())
        b = triaje.agrupar(list(reversed(self._entradas())))
        self.assertEqual([g["causa"] for g in a], [g["causa"] for g in b])

    def test_los_ilegibles_se_agrupan_aparte_y_no_se_pierden(self):
        entradas = self._entradas() + [
            {"numero": 900, "titulo": "opaco", "check": "Puerta de tools", "log": LOG_SOLO_RUIDO}]
        grupos = triaje.agrupar(entradas)
        total = sum(len(g["prs"]) for g in grupos)
        self.assertEqual(total, 4, "ningún PR puede desaparecer del informe")
        self.assertIn("sin causa reconocible en el log", [g["causa"] for g in grupos])


class _Proceso:
    def __init__(self, returncode=0, stdout="", stderr=""):
        self.returncode = returncode
        self.stdout = stdout
        self.stderr = stderr


class GhQueFalla(unittest.TestCase):
    """Un fallo de `gh` no puede parecerse a «no hay PRs en rojo».

    Ignorar el código de salida hacía que autenticación caducada, corte de red,
    rate limit o falta de permisos devolvieran stdout vacío, que `recoger()`
    convertía en `[]` y `--recoger` publicaba con éxito.
    """

    def test_fallo_en_pr_list_aborta_en_vez_de_devolver_vacio(self):
        with mock.patch.object(triaje.subprocess, "run",
                               return_value=_Proceso(42, "", "gh: not authenticated")):
            with self.assertRaises(triaje.ErrorDeGh) as ctx:
                triaje.recoger()
        self.assertIn("not authenticated", str(ctx.exception))

    def test_fallo_en_run_view_aborta_aunque_pr_list_funcionara(self):
        listado = json.dumps([{
            "number": 803, "title": "un PR",
            "statusCheckRollup": [{
                "name": "tools/tests (Linux)", "conclusion": "FAILURE",
                "detailsUrl": "https://github.com/o/r/actions/runs/12345/job/9"}]}])

        def run(cmd, **kwargs):
            if cmd[1] == "pr":
                return _Proceso(0, listado, "")
            return _Proceso(1, "", "HTTP 403: rate limit exceeded")

        with mock.patch.object(triaje.subprocess, "run", side_effect=run):
            with self.assertRaises(triaje.ErrorDeGh) as ctx:
                triaje.recoger()
        self.assertIn("rate limit", str(ctx.exception))

    def test_recoger_sale_con_codigo_no_cero_y_no_imprime_informe(self):
        salida, err = io.StringIO(), io.StringIO()
        with mock.patch.object(triaje.subprocess, "run",
                               return_value=_Proceso(42, "", "gh: not authenticated")):
            with mock.patch.object(triaje.sys, "argv", ["triaje", "--recoger"]):
                with redirect_stdout(salida), redirect_stderr(err):
                    rc = triaje.main()
        self.assertNotEqual(rc, 0, "un fallo de recogida no puede salir con 0")
        self.assertEqual(salida.getvalue(), "",
                         "sin datos no se emite informe: `[]` se leería como cero PRs en rojo")
        aviso = err.getvalue().lower()
        self.assertIn("no he podido consultar github", aviso)
        self.assertIn("no es", aviso)
        self.assertIn("cero prs en rojo", aviso.replace("«", "").replace("»", ""))

    def test_recoger_sale_con_cero_cuando_la_consulta_se_completa(self):
        salida = io.StringIO()
        with mock.patch.object(triaje.subprocess, "run",
                               return_value=_Proceso(0, "[]", "")):
            with mock.patch.object(triaje.sys, "argv", ["triaje", "--recoger"]):
                with redirect_stdout(salida):
                    rc = triaje.main()
        self.assertEqual(rc, 0, "una recogida completa sin PRs rojos es un informe válido")
        self.assertEqual(json.loads(salida.getvalue()), [])

    def test_el_mensaje_de_error_no_arrastra_un_token(self):
        fuga = "error: HTTP 401 con ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ012345"
        with mock.patch.object(triaje.subprocess, "run",
                               return_value=_Proceso(1, "", fuga)):
            with self.assertRaises(triaje.ErrorDeGh) as ctx:
                triaje.recoger()
        mensaje = str(ctx.exception)
        self.assertNotIn("ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ012345", mensaje)
        self.assertIn("[redactado]", mensaje)


if __name__ == "__main__":
    unittest.main()
