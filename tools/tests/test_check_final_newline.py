"""Que la guarda detecte de verdad, y que respete lo de upstream."""
import importlib.util
import pathlib

RAIZ = pathlib.Path(__file__).resolve().parent.parent.parent
_spec = importlib.util.spec_from_file_location(
    "check_final_newline", RAIZ / "tools" / "check_final_newline.py")
mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(mod)


def test_detecta_fichero_sin_salto(tmp_path):
    f = tmp_path / "malo.md"
    f.write_bytes(b"sin salto")
    assert mod.sin_salto(str(f))


def test_acepta_fichero_con_salto(tmp_path):
    f = tmp_path / "bueno.md"
    f.write_bytes(b"con salto\n")
    assert not mod.sin_salto(str(f))


def test_un_fichero_vacio_no_es_un_fallo(tmp_path):
    f = tmp_path / "vacio.md"
    f.write_bytes(b"")
    assert not mod.sin_salto(str(f))


def test_no_mira_fuera_del_fork():
    """scripts/, resources/ y netboot/ son de upstream: tocarlos es divergencia."""
    rutas = set(mod.nuestros())
    assert not any(r.startswith(("scripts/", "resources/", "netboot/",
                                 "script_docs/")) for r in rutas)


def test_el_arbol_actual_esta_limpio():
    assert mod.main() == 0


def test_no_depende_del_directorio_de_trabajo(tmp_path, monkeypatch):
    """La guarda tiene que mirar el arbol del repositorio, no el cwd de turno.

    Sin `cwd=RAIZ` esto devolvia una lista vacia desde cualquier otro
    directorio: cero ficheros que revisar, salida 0, puerta en verde sin haber
    mirado nada.
    """
    monkeypatch.chdir(tmp_path)
    assert len(list(mod.nuestros())) > 0
    assert mod.main() == 0
