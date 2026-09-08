"""clasificar() de sync_tablero_cola.py: PENDING no es "esperando", y una PR
ya aprobada tampoco -- solo CI SUCCESS + sin aprobación es la promesa real
de la columna "Esperando revisión" (#997)."""
import importlib.util
import pathlib

RAIZ = pathlib.Path(__file__).resolve().parent.parent.parent
_spec = importlib.util.spec_from_file_location(
    "sync_tablero_cola", RAIZ / "tools" / "sync_tablero_cola.py")
mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(mod)


def _pr(*, mergeStateStatus="CLEAN", headRefOid="abc", isDraft=False,
        reviewDecision=None, labels=(), revisiones=(), ci=None):
    commits = {"nodes": [{"commit": {"statusCheckRollup": {"state": ci} if ci else None}}]}
    return {
        "mergeStateStatus": mergeStateStatus,
        "headRefOid": headRefOid,
        "isDraft": isDraft,
        "reviewDecision": reviewDecision,
        "labels": {"nodes": [{"name": n} for n in labels]},
        "latestOpinionatedReviews": {"nodes": list(revisiones)},
        "commits": commits,
    }


def test_ci_pending_no_es_esperando():
    pr = _pr(ci="PENDING")
    assert mod.clasificar(pr) is None


def test_sin_rollup_no_es_esperando():
    pr = _pr(ci=None)
    assert mod.clasificar(pr) is None


def test_pr_ya_aprobada_no_es_esperando():
    pr = _pr(ci="SUCCESS", reviewDecision="APPROVED")
    assert mod.clasificar(pr) is None


def test_pr_en_borrador_no_es_esperando():
    pr = _pr(ci="SUCCESS", isDraft=True)
    assert mod.clasificar(pr) is None


def test_ci_verde_sin_aprobacion_es_esperando():
    pr = _pr(ci="SUCCESS")
    assert mod.clasificar(pr) == "esperando"


def test_conflicto_manda_sobre_todo_lo_demas():
    pr = _pr(mergeStateStatus="DIRTY", ci="SUCCESS")
    assert mod.clasificar(pr) == "conflictos"


def test_ci_rojo():
    pr = _pr(ci="FAILURE")
    assert mod.clasificar(pr) == "rojo"


def test_cambios_pedidos_vivos_si_la_revision_fija_el_head_actual():
    pr = _pr(headRefOid="head1", revisiones=[{"state": "CHANGES_REQUESTED", "commit": {"oid": "head1"}}])
    assert mod.clasificar(pr) == "vivos"


def test_cambios_pedidos_caducados_no_son_vivos():
    pr = _pr(ci="SUCCESS", headRefOid="head2",
             revisiones=[{"state": "CHANGES_REQUESTED", "commit": {"oid": "head1-viejo"}}])
    assert mod.clasificar(pr) == "esperando"


def test_etiqueta_decision():
    pr = _pr(ci="PENDING", labels=["decision"])
    assert mod.clasificar(pr) == "decision"
