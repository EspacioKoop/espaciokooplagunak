"""Caminos de error de la descarga del SDK de Discord (#400).

Lo que se comprueba aquí no se ve nunca en la ruta feliz: el build de CI pasa
igual con estas comprobaciones y sin ellas mientras la red responda. Por eso hay
prueba, y por eso conduce a CMake de verdad en vez de leer el fichero buscando
cadenas — la primera versión del arreglo *parecía* correcta leyendo el diff y
dejaba pasar un ZIP con CRC inválido.

El caso que motiva todo: ante un archivo con CRC malo, `cmake -E tar -xf` avisa
por stderr y devuelve **0**, dejando extraída una cabecera corrupta que hace que
el siguiente configure se salte la descarga entera.
"""

import shutil
import subprocess
import zipfile
from pathlib import Path

import pytest

RAIZ = Path(__file__).resolve().parents[2]
MODULO = RAIZ / "cmake" / "DiscordGameSdk.cmake"

pytestmark = pytest.mark.skipif(shutil.which("cmake") is None, reason="requiere cmake")


def _driver(tmp_path: Path, url: str) -> Path:
    """Script que llama a la función igual que lo hace CMakeLists.txt."""
    destino = tmp_path / "externals" / "discord"
    driver = tmp_path / "driver.cmake"
    driver.write_text(
        f'set(CMAKE_MODULE_PATH "{(RAIZ / "cmake").as_posix()}")\n'
        f'set(DISCORD_SDK_URL "{url}" CACHE STRING "")\n'
        "include(DiscordGameSdk)\n"
        f'discord_game_sdk_obtener("{destino.as_posix()}"'
        f' "{(destino / "c" / "discord_game_sdk.h").as_posix()}"'
        f' "{(tmp_path / "descarga.zip").as_posix()}")\n',
        encoding="utf-8",
    )
    return driver


def _ejecutar(tmp_path: Path, url: str):
    return subprocess.run(
        ["cmake", "-P", str(_driver(tmp_path, url))],
        capture_output=True,
        text=True,
        cwd=tmp_path,
    )


def _zip_sano(destino: Path) -> Path:
    """Un SDK plausible: la cabecera donde se espera y una biblioteca al lado."""
    with zipfile.ZipFile(destino, "w", zipfile.ZIP_STORED) as z:
        z.writestr("c/discord_game_sdk.h", "#define DISCORD_VERSION 3\n")
        z.writestr("lib/x86_64/discord_game_sdk.so", bytes(range(256)) * 8)
    return destino


def _zip_crc_malo(destino: Path) -> Path:
    """ZIP bien formado cuyo contenido no cuadra con el CRC declarado.

    Es el caso real: las cabeceras son válidas, así que el extractor recorre el
    archivo entero, extrae todo y solo avisa del CRC. Se altera el contenido
    almacenado sin tocar el CRC, que es justo lo que hace un byte perdido en una
    descarga a medias.
    """
    _zip_sano(destino)
    datos = bytearray(destino.read_bytes())
    marca = b"lib/x86_64/discord_game_sdk.so"
    # Tras la cabecera local viene el contenido almacenado (ZIP_STORED).
    inicio = datos.find(marca) + len(marca)
    for i in range(inicio + 40, inicio + 60):
        datos[i] ^= 0xFF
    destino.write_bytes(bytes(datos))
    return destino


def _zip_truncado(destino: Path) -> Path:
    _zip_sano(destino)
    datos = destino.read_bytes()
    destino.write_bytes(datos[: len(datos) // 2])
    return destino


def _url(ruta: Path) -> str:
    return ruta.as_uri()


def test_zip_sano_extrae_la_cabecera(tmp_path):
    proceso = _ejecutar(tmp_path, _url(_zip_sano(tmp_path / "sdk.zip")))
    assert proceso.returncode == 0, proceso.stderr
    assert (tmp_path / "externals" / "discord" / "c" / "discord_game_sdk.h").exists()
    assert (tmp_path / "externals" / "discord" / "lib" / "x86_64" / "discord_game_sdk.so").exists()


def test_segunda_llamada_no_vuelve_a_descargar(tmp_path):
    """La caché de CI depende de esto: con la cabecera puesta, ni se toca la red."""
    zip_sdk = _zip_sano(tmp_path / "sdk.zip")
    assert _ejecutar(tmp_path, _url(zip_sdk)).returncode == 0
    zip_sdk.unlink()  # si volviera a descargar, fallaría al no existir el origen
    assert _ejecutar(tmp_path, _url(zip_sdk)).returncode == 0


def test_crc_invalido_aborta_pese_al_codigo_de_salida_cero(tmp_path):
    """La regresión del review: extractor con código 0 pero archivo corrupto."""
    proceso = _ejecutar(tmp_path, _url(_zip_crc_malo(tmp_path / "sdk.zip")))
    assert proceso.returncode != 0
    assert "corrupt" in proceso.stderr
    assert "bad CRC" in proceso.stderr  # se cita al extractor, no se adivina


def test_crc_invalido_no_deja_arbol_reutilizable(tmp_path):
    """Sin esto, el árbol corrupto sobrevive y el siguiente intento lo hereda."""
    _ejecutar(tmp_path, _url(_zip_crc_malo(tmp_path / "sdk.zip")))
    assert not (tmp_path / "externals" / "discord" / "c" / "discord_game_sdk.h").exists()
    assert not (tmp_path / "descarga.zip").exists()


def test_el_segundo_intento_tampoco_se_salta_la_comprobacion(tmp_path):
    """Reintentar con el archivo malo debe volver a fallar, no darse por bueno."""
    malo = _zip_crc_malo(tmp_path / "sdk.zip")
    primero = _ejecutar(tmp_path, _url(malo))
    segundo = _ejecutar(tmp_path, _url(malo))
    assert primero.returncode != 0
    assert segundo.returncode != 0, "el árbol de la primera vez se coló como bueno"


def test_zip_truncado_aborta(tmp_path):
    proceso = _ejecutar(tmp_path, _url(_zip_truncado(tmp_path / "sdk.zip")))
    assert proceso.returncode != 0
    assert not (tmp_path / "externals" / "discord" / "c" / "discord_game_sdk.h").exists()


def test_zip_sin_la_cabecera_aborta(tmp_path):
    """Un archivo sano, pero de otra cosa, no puede pasar por SDK."""
    otro = tmp_path / "sdk.zip"
    with zipfile.ZipFile(otro, "w") as z:
        z.writestr("LEEME.txt", "esto no es el SDK\n")
    proceso = _ejecutar(tmp_path, _url(otro))
    assert proceso.returncode != 0
    assert "did not contain" in proceso.stderr


def test_descarga_fallida_aborta_pronto_y_lo_dice(tmp_path):
    proceso = _ejecutar(tmp_path, _url(tmp_path / "no-existe.zip"))
    assert proceso.returncode != 0
    assert "Failed to download" in proceso.stderr
    assert not (tmp_path / "descarga.zip").exists()


def test_el_mensaje_ofrece_la_salida_sin_discord(tmp_path):
    """Un fallo de red no debe dejar a nadie atascado sin saber cómo seguir."""
    proceso = _ejecutar(tmp_path, _url(tmp_path / "no-existe.zip"))
    assert "-DWITH_DISCORD=OFF" in proceso.stderr


def test_cmakelists_usa_el_modulo_y_no_una_copia_del_bloque(tmp_path):
    """Si alguien vuelve a poner el bloque inline, estas pruebas dejarían de
    cubrir lo que se compila de verdad sin que ninguna falle."""
    cmakelists = (RAIZ / "CMakeLists.txt").read_text(encoding="utf-8")
    assert "discord_game_sdk_obtener(" in cmakelists
    assert "dl-game-sdk.discordapp.net" not in cmakelists, "la URL vive en el módulo"
    assert MODULO.exists()
