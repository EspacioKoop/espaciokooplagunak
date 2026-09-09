"""El manifiesto del archivo de artefactos no puede mentir.

El archivo de #1039 vale por una sola cosa: que cada HTML guardado sea la copia
BYTE A BYTE del artefacto original, acreditada por su sha256. Nada lo vigilaba,
y el commit f0bfa3fb lo demostró — una guarda de estilo añadió un salto de línea
final a tres ficheros y dejó tres checksums desajustados sin que fallara nada.
Un checksum que nadie comprueba no acredita, tranquiliza.
"""
import hashlib
import json
import pathlib

RAIZ = pathlib.Path(__file__).resolve().parent.parent.parent
ARCHIVO = RAIZ / "docs" / "referencias" / "claude-artifacts"


def _manifiesto():
    return json.loads((ARCHIVO / "manifest.json").read_text(encoding="utf-8"))


def test_cada_html_coincide_con_su_sha256_y_su_tamano():
    for ficha in _manifiesto()["artifacts"]:
        ruta = ARCHIVO / ficha["local_html"]
        assert ruta.is_file(), f"falta la copia de {ficha['title']}: {ruta}"
        crudo = ruta.read_bytes()
        assert hashlib.sha256(crudo).hexdigest() == ficha["sha256"], (
            f"{ficha['title']}: la copia ya no es la que dice el manifiesto")
        assert len(crudo) == ficha["bytes"], f"{ficha['title']}: tamaño distinto"


def test_no_sobra_ni_falta_ninguna_copia():
    declaradas = {f["local_html"] for f in _manifiesto()["artifacts"]}
    en_disco = {f"html/{p.name}" for p in (ARCHIVO / "html").iterdir()}
    assert declaradas == en_disco
