"""El alcance de la cobertura no puede volver a ensancharse.

La puerta `--cov-fail-under=75` solo significa algo si el denominador es
código de PRODUCCIÓN. Midiendo desde `bridge/` con `--cov=.` y sin recorte,
`bridge/tests/**` entraba en la medida: 1612 de 2054 líneas eran los propios
tests, contados al 100 % porque un test se ejecuta entero por definición. Con
ese alcance se puede sostener el 75 % añadiendo tests mientras la cobertura de
producción BAJA.

Esta comprobación es deliberadamente pequeña: no mide cobertura (eso ya lo
hace la puerta), solo vigila que el recorte siga puesto.
"""
import configparser
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent


def _config():
    parser = configparser.ConfigParser()
    leidos = parser.read(RAIZ / ".coveragerc", encoding="utf-8")
    assert leidos, "falta bridge/.coveragerc: sin él, --cov=. vuelve a medir los tests"
    return parser


def test_los_tests_quedan_fuera_del_denominador():
    omitidos = _config().get("run", "omit", fallback="").split()
    assert "tests/*" in omitidos, (
        "bridge/.coveragerc debe omitir tests/*; sin eso la puerta de cobertura "
        "premia añadir tests aunque la cobertura de producción empeore"
    )


def test_el_recorte_no_se_come_ningun_modulo_de_produccion():
    """Lo contrario también es un fallo: omitir de más ocultaría código sin medir."""
    omitidos = set(_config().get("run", "omit", fallback="").split())
    produccion = {p.name for p in RAIZ.glob("*.py")}
    assert produccion, "no se encontró ningún módulo de producción en bridge/"
    for modulo in produccion:
        assert modulo not in omitidos, f"{modulo} es código de producción y está omitido"
