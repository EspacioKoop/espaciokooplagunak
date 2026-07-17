from __future__ import annotations

import contextlib
import io
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

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
        # En macOS solo se anuncia brew si Homebrew está realmente instalado.
        self.assertEqual(
            instalar.gestor_de_paquetes(
                "Darwin", {}, which=lambda cmd: "/opt/homebrew/bin/brew" if cmd == "brew" else None
            ),
            "brew",
        )
        self.assertIsNone(instalar.gestor_de_paquetes("Darwin", {}, which=lambda _: None))

    def test_comando_cmake_incluye_glm_solo_en_pacman(self) -> None:
        # Arch/CachyOS: la glm 1.0.x del sistema rompe SeriousProton; el
        # comando sugerido debe llevar el flag documentado en BUILDING.md.
        self.assertIn("-DCMAKE_DISABLE_FIND_PACKAGE_glm=TRUE", instalar.comando_cmake("pacman"))
        self.assertNotIn("glm", instalar.comando_cmake("apt"))
        self.assertNotIn("glm", instalar.comando_cmake(None))

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

    @unittest.skipUnless(os.name == "posix", "los permisos 0600 son de POSIX")
    def test_asegurar_env_escribe_con_permisos_privados(self) -> None:
        # El .env lleva secretos: nunca debe quedar legible por otros usuarios,
        # ni al crearlo ni al actualizar uno que estuviera con permisos amplios.
        with tempfile.TemporaryDirectory() as tmp:
            ejemplo = Path(tmp) / ".env.example"
            ejemplo.write_text("BRIDGE_TOKEN=\n", encoding="utf-8")
            destino = Path(tmp) / ".env"

            instalar.asegurar_env(ejemplo=ejemplo, destino=destino)
            self.assertEqual(destino.stat().st_mode & 0o777, 0o600)

            os.chmod(destino, 0o644)  # simula un .env ya expuesto
            instalar.asegurar_env({"EE_SERVER_PORT": "36000"},
                                  ejemplo=ejemplo, destino=destino)
            self.assertEqual(destino.stat().st_mode & 0o777, 0o600)


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

    def test_ocultar_token_no_revela_huella(self) -> None:
        token = "a" * 64
        oculto = instalar._ocultar_token(token)
        self.assertNotIn(token, oculto)
        self.assertNotIn("aaaa", oculto)
        self.assertEqual(oculto, "**** (64 car.)")


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

    def test_enlazar_modulo_rechaza_directorio_real_sin_sobrescribir(self) -> None:
        # Un directorio real en la ruta puede ser del usuario: sin permiso
        # explícito no se toca, y su contenido sobrevive intacto.
        with tempfile.TemporaryDirectory() as tmp:
            origen = Path(tmp) / "modulo"
            origen.mkdir()
            modules = Path(tmp) / "modules"
            previo = modules / instalar.ID_MODULO
            previo.mkdir(parents=True)
            (previo / "datos_usuario.txt").write_text("no borrar", encoding="utf-8")

            with self.assertRaises(FileExistsError):
                instalar.enlazar_modulo(modules, origen=origen, copiar=True)
            # El fichero del usuario sigue ahí (OLD_USER_DATA_SURVIVES True).
            self.assertEqual(
                (previo / "datos_usuario.txt").read_text(encoding="utf-8"), "no borrar"
            )

    def test_enlazar_modulo_sobrescribir_conserva_datos_en_bak(self) -> None:
        # Con sobrescribir se reinstala, pero el directorio anterior no se borra:
        # se renombra a un .bak- y su contenido sigue existiendo.
        with tempfile.TemporaryDirectory() as tmp:
            origen = Path(tmp) / "modulo"
            origen.mkdir()
            (origen / "module.json").write_text("{}", encoding="utf-8")
            modules = Path(tmp) / "modules"
            previo = modules / instalar.ID_MODULO
            previo.mkdir(parents=True)
            (previo / "datos_usuario.txt").write_text("no borrar", encoding="utf-8")

            destino = instalar.enlazar_modulo(
                modules, origen=origen, copiar=True, sobrescribir=True
            )
            self.assertTrue((destino / "module.json").exists())
            baks = list(modules.glob(f"{instalar.ID_MODULO}.bak-*"))
            self.assertEqual(len(baks), 1)
            self.assertEqual(
                (baks[0] / "datos_usuario.txt").read_text(encoding="utf-8"), "no borrar"
            )


class AccionDockerTests(unittest.TestCase):
    """La ruta Docker no puede mutar el equipo sin confirmar ni ocultar fallos."""

    def _info(self, compose: bool = True) -> dict:
        return {"docker_compose": compose}

    def _requisitos_ok(self):
        return mock.patch.object(instalar, "comprobar_requisitos", return_value=[])

    def test_sin_compose_se_corta_antes_de_mutar(self) -> None:
        # Compose es prerrequisito real: sin él ni se crea .env ni se pregunta.
        with self._requisitos_ok(), \
             mock.patch.object(instalar, "asegurar_env") as env, \
             mock.patch.object(instalar, "_confirmar") as confirmar, \
             contextlib.redirect_stdout(io.StringIO()) as salida:
            instalar._accion_docker(self._info(compose=False))
        env.assert_not_called()
        confirmar.assert_not_called()
        self.assertIn("Compose", salida.getvalue())

    def test_no_crea_env_si_no_se_confirma(self) -> None:
        # La confirmación PRECEDE a crear docker/.env.
        with tempfile.TemporaryDirectory() as tmp:
            destino = Path(tmp) / "docker" / ".env"
            with self._requisitos_ok(), \
                 mock.patch.object(instalar, "ENV_DESTINO", destino), \
                 mock.patch.object(instalar, "RAIZ", Path(tmp)), \
                 mock.patch.object(instalar, "asegurar_env") as env, \
                 mock.patch.object(instalar, "_confirmar", return_value=False), \
                 contextlib.redirect_stdout(io.StringIO()):
                instalar._accion_docker(self._info())
            env.assert_not_called()
            self.assertFalse(destino.exists())

    def test_env_existente_no_se_reescribe(self) -> None:
        # Con .env presente, esta ruta no lo toca en absoluto.
        with tempfile.TemporaryDirectory() as tmp:
            destino = Path(tmp) / ".env"
            destino.write_text("BRIDGE_TOKEN=fijado\n", encoding="utf-8")
            antes = destino.stat().st_mtime_ns
            with self._requisitos_ok(), \
                 mock.patch.object(instalar, "ENV_DESTINO", destino), \
                 mock.patch.object(instalar, "RAIZ", Path(tmp)), \
                 mock.patch.object(instalar, "asegurar_env") as env, \
                 mock.patch.object(instalar, "_confirmar", return_value=False), \
                 contextlib.redirect_stdout(io.StringIO()):
                instalar._accion_docker(self._info())
            env.assert_not_called()
            self.assertEqual(destino.stat().st_mtime_ns, antes)

    def test_fallo_de_compose_se_comunica(self) -> None:
        # Un exit code != 0 de `docker compose up` no queda silencioso.
        with tempfile.TemporaryDirectory() as tmp:
            destino = Path(tmp) / ".env"
            destino.write_text("BRIDGE_TOKEN=fijado\n", encoding="utf-8")
            with self._requisitos_ok(), \
                 mock.patch.object(instalar, "ENV_DESTINO", destino), \
                 mock.patch.object(instalar, "RAIZ", Path(tmp)), \
                 mock.patch.object(instalar, "_confirmar", return_value=True), \
                 mock.patch.object(instalar.subprocess, "run",
                                   return_value=subprocess.CompletedProcess([], 17)), \
                 contextlib.redirect_stdout(io.StringIO()) as salida:
                instalar._accion_docker(self._info())
            self.assertIn("código 17", salida.getvalue())


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

    def test_set_rechaza_clave_desconocida(self) -> None:
        # --set no puede añadir claves fuera de la lista blanca.
        salida = self._ejecutar("--set", "CLAVE_ARBITRARIA=x")
        self.assertNotEqual(salida.returncode, 0)
        self.assertIn("desconocida", salida.stderr)

    def test_set_rechaza_salto_de_linea(self) -> None:
        # Un valor con \n inyectaría líneas nuevas en el .env.
        salida = self._ejecutar("--set", "EE_SERVER_NAME=uno\nINYECTADA=1")
        self.assertNotEqual(salida.returncode, 0)
        self.assertIn("saltos de línea", salida.stderr)

    def test_set_rechaza_secretos_en_argv(self) -> None:
        with self.assertRaisesRegex(SystemExit, "no admite secretos por argv"):
            instalar.main(["--set", "BRIDGE_TOKEN=valor-de-prueba"])


class CopiarTokenTests(unittest.TestCase):
    def test_menu_edita_token_con_getpass_sin_mostrar_el_actual(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            env = Path(tmp) / ".env"
            actual = "token-actual-no-visible"
            env.write_text(f"BRIDGE_TOKEN={actual}\n", encoding="utf-8")
            with mock.patch.object(instalar, "ENV_DESTINO", env), \
                 mock.patch.object(instalar, "_preguntar", return_value="7") as preguntar, \
                 mock.patch.object(instalar.getpass, "getpass", return_value="token-nuevo") as oculto, \
                 mock.patch.object(instalar, "asegurar_env") as guardar, \
                 contextlib.redirect_stdout(io.StringIO()) as salida:
                instalar._accion_opciones()
        oculto.assert_called_once()
        self.assertNotIn(actual, oculto.call_args.args[0])
        self.assertNotIn(actual, salida.getvalue())
        self.assertTrue(all(actual not in str(call) for call in preguntar.call_args_list))
        guardar.assert_called_once_with({"BRIDGE_TOKEN": "token-nuevo"})

    def test_leer_token_sin_env_devuelve_vacio(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            self.assertEqual(instalar.leer_token(Path(tmp) / ".env"), "")

    def test_leer_token_devuelve_el_valor(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            env = Path(tmp) / ".env"
            env.write_text("BRIDGE_TOKEN=abc123\n", encoding="utf-8")
            self.assertEqual(instalar.leer_token(env), "abc123")

    def test_copiar_usa_stdin_y_no_argv(self) -> None:
        # El token nunca puede viajar como argumento: argv es visible en `ps`.
        llamadas = []

        def run_falso(comando, **kwargs):
            llamadas.append((comando, kwargs))
            return subprocess.CompletedProcess(comando, 0)

        herramienta = instalar.copiar_al_portapapeles(
            "secreto", which=lambda nombre: "/usr/bin/" + nombre, run=run_falso)
        self.assertEqual(herramienta, "wl-copy")
        comando, kwargs = llamadas[0]
        self.assertNotIn("secreto", " ".join(comando))
        self.assertEqual(kwargs["input"], b"secreto")

    def test_copiar_prueba_la_siguiente_herramienta_si_falla(self) -> None:
        def run_falso(comando, **kwargs):
            codigo = 1 if comando[0] == "wl-copy" else 0
            return subprocess.CompletedProcess(comando, codigo)

        herramienta = instalar.copiar_al_portapapeles(
            "secreto", which=lambda nombre: "/usr/bin/" + nombre, run=run_falso)
        self.assertEqual(herramienta, "xclip")

    def test_copiar_sin_herramientas_devuelve_none(self) -> None:
        self.assertIsNone(
            instalar.copiar_al_portapapeles("secreto", which=lambda _: None))

    def test_limpiar_portapapeles_no_envia_el_token(self) -> None:
        llamadas = []

        def run_falso(comando, **kwargs):
            llamadas.append((comando, kwargs))
            return subprocess.CompletedProcess(comando, 0)

        self.assertTrue(instalar.limpiar_portapapeles(
            "wl-copy", which=lambda _: "/usr/bin/wl-copy", run=run_falso))
        comando, kwargs = llamadas[0]
        self.assertEqual(comando, ["wl-copy", "--clear"])
        self.assertEqual(kwargs["input"], b"")

    def test_limpiar_portapapeles_informa_fallo(self) -> None:
        self.assertFalse(instalar.limpiar_portapapeles(
            "xclip", which=lambda _: None))

    def test_cli_copiar_token_sin_env_falla(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            with mock.patch.object(instalar, "ENV_DESTINO", Path(tmp) / ".env"):
                buffer = io.StringIO()
                with contextlib.redirect_stdout(buffer):
                    codigo = instalar.main(["--copiar-token"])
        self.assertEqual(codigo, 1)

    def test_cli_copiar_token_no_imprime_el_token_entero(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            env = Path(tmp) / ".env"
            token = "a" * 64
            env.write_text(f"BRIDGE_TOKEN={token}\n", encoding="utf-8")
            with mock.patch.object(instalar, "ENV_DESTINO", env), \
                 mock.patch.object(instalar, "copiar_al_portapapeles",
                                   return_value="wl-copy"), \
                 mock.patch.object(instalar, "limpiar_portapapeles", return_value=True), \
                 mock.patch.object(instalar, "_preguntar", return_value=""):
                buffer = io.StringIO()
                with contextlib.redirect_stdout(buffer):
                    codigo = instalar.main(["--copiar-token"])
        self.assertEqual(codigo, 0)
        self.assertNotIn(token, buffer.getvalue())
        self.assertNotIn("aaaa", buffer.getvalue())
        self.assertIn("portapapeles", buffer.getvalue())
        self.assertIn("vaciado", buffer.getvalue())

    def test_cli_copiar_token_falla_si_no_puede_limpiar(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            env = Path(tmp) / ".env"
            token = "c" * 64
            env.write_text(f"BRIDGE_TOKEN={token}\n", encoding="utf-8")
            with mock.patch.object(instalar, "ENV_DESTINO", env), \
                 mock.patch.object(instalar, "copiar_al_portapapeles", return_value="xclip"), \
                 mock.patch.object(instalar, "limpiar_portapapeles", return_value=False), \
                 mock.patch.object(instalar, "_preguntar", return_value=""):
                buffer = io.StringIO()
                with contextlib.redirect_stdout(buffer):
                    codigo = instalar.main(["--copiar-token"])
        self.assertEqual(codigo, 1)
        self.assertNotIn(token, buffer.getvalue())
        self.assertIn("No se pudo vaciar", buffer.getvalue())

    def test_cli_copiar_token_sin_portapapeles_no_imprime_el_token(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            env = Path(tmp) / ".env"
            token = "b" * 64
            env.write_text(f"BRIDGE_TOKEN={token}\n", encoding="utf-8")
            with mock.patch.object(instalar, "ENV_DESTINO", env), \
                 mock.patch.object(instalar, "copiar_al_portapapeles",
                                   return_value=None):
                buffer = io.StringIO()
                with contextlib.redirect_stdout(buffer):
                    codigo = instalar.main(["--copiar-token"])
        self.assertEqual(codigo, 1)
        self.assertNotIn(token, buffer.getvalue())


if __name__ == "__main__":
    unittest.main()
