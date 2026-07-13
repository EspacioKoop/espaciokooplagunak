from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from tools import instalar


REPO = Path(__file__).resolve().parents[2]


class DeteccionTests(unittest.TestCase):
    def test_gestor_por_distro(self) -> None:
        self.assertEqual(
            instalar.gestor_de_paquetes("Linux", {"ID": "ubuntu"}, which=lambda _: None),
            "apt",
        )
        self.assertEqual(
            instalar.gestor_de_paquetes("Linux", {"ID": "cachyos", "ID_LIKE": "arch"},
                                        which=lambda _: None),
            "pacman",
        )
        self.assertEqual(
            instalar.gestor_de_paquetes("Darwin", {}, which=lambda _: None),
            "brew",
        )

    def test_gestor_por_id_like_cuando_id_desconocido(self) -> None:
        # Una distro derivada desconocida cae en su ID_LIKE.
        gestor = instalar.gestor_de_paquetes(
            "Linux", {"ID": "distro-rara", "ID_LIKE": "debian"}, which=lambda _: None
        )
        self.assertEqual(gestor, "apt")

    def test_gestor_por_sondeo_de_path(self) -> None:
        # Sin os-release útil, se sondea el PATH.
        gestor = instalar.gestor_de_paquetes(
            "Linux", {}, which=lambda cmd: "/usr/bin/dnf" if cmd == "dnf" else None
        )
        self.assertEqual(gestor, "dnf")

    def test_gestor_desconocido_en_windows(self) -> None:
        self.assertIsNone(
            instalar.gestor_de_paquetes("Windows", {}, which=lambda _: None)
        )

    def test_ruta_modulos_por_so(self) -> None:
        entorno = {"HOME": "/home/tester", "LOCALAPPDATA": "C:\\Users\\t\\AppData\\Local"}
        linux = instalar.ruta_modulos_foundry("Linux", entorno=entorno)
        self.assertEqual(linux, Path("/home/tester/.local/share/FoundryVTT/Data/modules"))
        win = instalar.ruta_modulos_foundry("Windows", entorno=entorno)
        self.assertEqual(win.name, "modules")
        self.assertIn("FoundryVTT", win.parts)

    def test_detectar_incluye_claves_esperadas(self) -> None:
        info = instalar.detectar_sistema(which=lambda _: None, entorno={"HOME": "/home/x"})
        for clave in ("sistema", "gestor_paquetes", "python", "docker", "modulos_foundry"):
            self.assertIn(clave, info)


class EnvTests(unittest.TestCase):
    def test_parse_ignora_comentarios_y_vacios(self) -> None:
        texto = "# comentario\n\nEE_SERVER_PORT=35666\nBRIDGE_TOKEN= abc \n"
        valores = instalar.parse_env(texto)
        self.assertEqual(valores["EE_SERVER_PORT"], "35666")
        self.assertEqual(valores["BRIDGE_TOKEN"], "abc")
        self.assertNotIn("#", valores)

    def test_fusionar_actualiza_en_sitio_y_preserva_comentarios(self) -> None:
        original = "# cabecera\nEE_SERVER_PORT=35666\n# otro\nBRIDGE_PORT=8090\n"
        nuevo = instalar.fusionar_env(original, {"EE_SERVER_PORT": "36000"})
        self.assertIn("# cabecera", nuevo)
        self.assertIn("# otro", nuevo)
        self.assertIn("EE_SERVER_PORT=36000", nuevo)
        self.assertNotIn("EE_SERVER_PORT=35666", nuevo)
        # No duplica la clave.
        self.assertEqual(nuevo.count("EE_SERVER_PORT="), 1)

    def test_fusionar_anade_claves_nuevas_al_final(self) -> None:
        nuevo = instalar.fusionar_env("EE_SERVER_PORT=35666\n", {"NUEVA": "valor"})
        self.assertTrue(nuevo.rstrip().endswith("NUEVA=valor"))
        self.assertIn("EE_SERVER_PORT=35666", nuevo)

    def test_asegurar_env_crea_con_token(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            ejemplo = Path(tmp) / ".env.example"
            ejemplo.write_text("BRIDGE_TOKEN=\nEE_SERVER_PORT=35666\n", encoding="utf-8")
            destino = Path(tmp) / ".env"
            resultado = instalar.asegurar_env(ejemplo=ejemplo, destino=destino)
            self.assertTrue(resultado.creado)
            self.assertTrue(destino.exists())
            token = instalar.parse_env(destino.read_text(encoding="utf-8"))["BRIDGE_TOKEN"]
            self.assertEqual(len(token), 64)  # token_hex(32)

    def test_asegurar_env_conserva_token_existente(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            ejemplo = Path(tmp) / ".env.example"
            ejemplo.write_text("BRIDGE_TOKEN=\n", encoding="utf-8")
            destino = Path(tmp) / ".env"
            destino.write_text("BRIDGE_TOKEN=fijado\nEE_SERVER_PORT=35666\n", encoding="utf-8")
            resultado = instalar.asegurar_env({"EE_SERVER_PORT": "36000"},
                                              ejemplo=ejemplo, destino=destino)
            self.assertFalse(resultado.creado)
            valores = instalar.parse_env(destino.read_text(encoding="utf-8"))
            self.assertEqual(valores["BRIDGE_TOKEN"], "fijado")
            self.assertEqual(valores["EE_SERVER_PORT"], "36000")


class ValidacionTests(unittest.TestCase):
    def test_puerto_valido(self) -> None:
        self.assertEqual(instalar.validar_puerto("8090"), 8090)

    def test_puerto_fuera_de_rango(self) -> None:
        with self.assertRaises(ValueError):
            instalar.validar_puerto("70000")

    def test_intervalo_fuera_de_rango(self) -> None:
        with self.assertRaises(ValueError):
            instalar.validar_intervalo("60")

    def test_token_es_hex_de_64(self) -> None:
        token = instalar.token_nuevo()
        self.assertEqual(len(token), 64)
        int(token, 16)  # no lanza si es hexadecimal

    def test_ocultar_token_no_revela_entero(self) -> None:
        token = "a" * 64
        oculto = instalar._ocultar_token(token)
        self.assertNotIn(token, oculto)
        self.assertIn("…", oculto)


class ModuloTests(unittest.TestCase):
    def test_enlazar_modulo_crea_symlink(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            origen = Path(tmp) / "modulo"
            origen.mkdir()
            (origen / "module.json").write_text("{}", encoding="utf-8")
            modules = Path(tmp) / "Data" / "modules"
            destino = instalar.enlazar_modulo(modules, origen=origen)
            self.assertTrue(destino.is_symlink())
            self.assertEqual(destino.name, instalar.ID_MODULO)
            self.assertTrue((destino / "module.json").exists())

    def test_enlazar_modulo_reemplaza_symlink_previo(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            origen = Path(tmp) / "modulo"
            origen.mkdir()
            modules = Path(tmp) / "modules"
            instalar.enlazar_modulo(modules, origen=origen)
            # Segunda vez no debe fallar (reemplaza el enlace).
            destino = instalar.enlazar_modulo(modules, origen=origen)
            self.assertTrue(destino.is_symlink())


class CliTests(unittest.TestCase):
    def _ejecutar(self, *args: str) -> subprocess.CompletedProcess:
        return subprocess.run(
            [sys.executable, "-m", "tools.instalar", *args],
            cwd=str(REPO), capture_output=True, text=True, check=False,
        )

    def test_detectar_devuelve_json(self) -> None:
        salida = self._ejecutar("--detectar")
        self.assertEqual(salida.returncode, 0, salida.stderr)
        datos = json.loads(salida.stdout)
        self.assertIn("sistema", datos)

    def test_generar_token_imprime_hex(self) -> None:
        salida = self._ejecutar("--generar-token")
        self.assertEqual(salida.returncode, 0, salida.stderr)
        token = salida.stdout.strip()
        self.assertEqual(len(token), 64)

    def test_set_rechaza_puerto_invalido(self) -> None:
        salida = self._ejecutar("--set", "EE_SERVER_PORT=70000")
        self.assertNotEqual(salida.returncode, 0)


if __name__ == "__main__":
    unittest.main()
