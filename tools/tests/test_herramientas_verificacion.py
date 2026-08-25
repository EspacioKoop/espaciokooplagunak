"""Que las herramientas de verificación verifiquen de verdad.

Son las que sostienen el criterio de que una atribución de museo se comprueba
contra el museo. Si ellas mismas no están probadas, el criterio vuelve a ser
una promesa: exactamente el fallo del 2026-08-19 que las hizo nacer.

Ninguna prueba toca la red. `arte-verificar` habla con el Met y con
Wikidata, así que aquí se le sustituyen esas dos funciones: lo que se prueba
es el juicio —¿acepta la atribución correcta y rechaza la falsa?—, no que las
APIs sigan en pie.
"""
import importlib.util
import pathlib

RAIZ = pathlib.Path(__file__).resolve().parent.parent.parent


def _cargar(nombre, fichero):
    spec = importlib.util.spec_from_file_location(nombre, RAIZ / "tools" / fichero)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


arte = _cargar("arte_verificar", "arte-verificar.py")
auditoria = _cargar("auditoria_completa", "auditoria-completa.py")
refs = _cargar("refs_rotas", "refs-rotas.py")
coherencia = _cargar("doc_coherencia", "doc-coherencia.py")


def _correr(mod, *argv):
    """Ejecuta el main del script con argv puesto, y devuelve su codigo."""
    import sys
    viejo = sys.argv
    sys.argv = [mod.__name__, *argv]
    try:
        return mod.main()
    finally:
        sys.argv = viejo


# ── arte-verificar ──────────────────────────────────────────────────────────

RONDA = "SK-C-5"          # La Ronda de Noche, de Rembrandt
GRAN_OLA = "JP1847"       # La Gran Ola de Kanagawa, de Hokusai


def test_arte_acepta_la_atribucion_correcta(tmp_path, monkeypatch):
    monkeypatch.setattr(arte, "rijks", lambda n: {
        "titulo": "De Nachtwacht", "autor": "Rembrandt van Rijn"})
    doc = tmp_path / "ok.md"
    doc.write_text(f"## Una obra\n\n**Artista:** Rembrandt van Rijn\n\n`{RONDA}`\n",
                   encoding="utf-8")
    assert _correr(arte, str(doc)) == 0


def test_arte_caza_la_atribucion_falsa(tmp_path, monkeypatch):
    # El fallo real del 2026-08-19: SK-C-5 atribuido a Pieter de Hooch.
    monkeypatch.setattr(arte, "rijks", lambda n: {
        "titulo": "De Nachtwacht", "autor": "Rembrandt van Rijn"})
    doc = tmp_path / "mal.md"
    doc.write_text(f"## Una obra\n\n**Artista:** Pieter de Hooch\n\n`{RONDA}`\n",
                   encoding="utf-8")
    assert _correr(arte, str(doc)) == 1


def test_arte_caza_el_numero_que_no_existe(tmp_path, monkeypatch):
    monkeypatch.setattr(arte, "met", lambda n: None)
    doc = tmp_path / "fantasma.md"
    doc.write_text(f"## Una obra\n\n**Artista:** Katsushika Hokusai\n\n`{GRAN_OLA}`\n",
                   encoding="utf-8")
    assert _correr(arte, str(doc)) == 1


def test_arte_sin_argumentos_devuelve_2():
    assert _correr(arte) == 2


# ── auditoria-completa ──────────────────────────────────────────────────────

def test_auditoria_acepta_la_seccion_con_comando(tmp_path):
    doc = tmp_path / "buena.md"
    doc.write_text("## Issue #1 algo\n\nComprobado:\n\n```\n$ pytest -q\n```\n",
                   encoding="utf-8")
    assert _correr(auditoria, str(doc)) == 0


def test_auditoria_caza_la_seccion_sin_comando(tmp_path):
    doc = tmp_path / "sin.md"
    doc.write_text("## Issue #1 algo\n\nEstá hecho, de verdad.\n", encoding="utf-8")
    assert _correr(auditoria, str(doc)) == 1


def test_auditoria_caza_las_casillas_sin_marcar(tmp_path):
    # El fallo que la hizo nacer: 32 casillas sin marcar y cero comandos.
    doc = tmp_path / "casillas.md"
    doc.write_text("## Issue #1 algo\n\n- [ ] por hacer\n\n```\n$ pytest -q\n```\n",
                   encoding="utf-8")
    assert _correr(auditoria, str(doc)) == 1


def test_auditoria_sin_argumentos_devuelve_2():
    assert _correr(auditoria) == 2


# ── refs-rotas ──────────────────────────────────────────────────────────────

def test_refs_caza_la_ruta_que_no_existe(tmp_path):
    (tmp_path / "docs").mkdir()
    (tmp_path / "docs" / "guia.md").write_text(
        "Ver `docs/QUE-NO-EXISTE.md` para mas detalle.\n", encoding="utf-8")
    assert _correr(refs, str(tmp_path)) == 1


def test_refs_acepta_la_ruta_que_existe(tmp_path):
    (tmp_path / "docs").mkdir()
    (tmp_path / "docs" / "otra.md").write_text("contenido\n", encoding="utf-8")
    (tmp_path / "docs" / "guia.md").write_text(
        "Ver `docs/otra.md` para mas detalle.\n", encoding="utf-8")
    assert _correr(refs, str(tmp_path)) == 0


# ── doc-coherencia ──────────────────────────────────────────────────────────
#
# Ya estaba en el arbol y no la trae este cambio, pero su comprobacion de sumas
# escritas a mano estuvo a punto de perderse al rescatar las otras tres: la
# version rescatada era ANTERIOR y no la tenia. Esta prueba la ancla.

def test_coherencia_caza_la_suma_escrita_a_mano_que_no_cuadra(tmp_path):
    doc = tmp_path / "inventario.md"
    doc.write_text("# Inventario\n\nVerificacion: 100 + 79 = 171\n", encoding="utf-8")
    assert _correr(coherencia, str(doc)) == 1


def test_coherencia_acepta_la_suma_que_si_cuadra(tmp_path):
    doc = tmp_path / "inventario.md"
    doc.write_text("# Inventario\n\nVerificacion: 100 + 71 = 171\n", encoding="utf-8")
    assert _correr(coherencia, str(doc)) == 0
