"""Puerta estricta para la política local de `.github/labeler.yml`.

No intenta reimplementar todo el esquema de actions/labeler. Este repositorio
limita deliberadamente cada etiqueta a reglas `changed-files` con listas de
matchers: una forma simple, determinista y suficiente para su configuración.
"""

from pathlib import Path

import pytest
import yaml

ROOT = Path(__file__).resolve().parents[2]
LABELER_CONFIG = ROOT / ".github" / "labeler.yml"
MATCHERS = {
    "all-globs-to-all-files",
    "all-globs-to-any-file",
    "any-glob-to-all-files",
    "any-glob-to-any-file",
}
MAX_PATTERN_LENGTH = 1024 * 64  # minimatch@10.2.5, fijado por Labeler v7


class UniqueKeyLoader(yaml.SafeLoader):
    """SafeLoader que rechaza claves YAML duplicadas en cualquier nivel."""


def _construct_unique_mapping(loader, node, deep=False):
    mapping = {}
    for key_node, value_node in node.value:
        key = loader.construct_object(key_node, deep=deep)
        if key in mapping:
            raise ValueError(f"clave YAML duplicada: {key}")
        mapping[key] = loader.construct_object(value_node, deep=deep)
    return mapping


UniqueKeyLoader.add_constructor(
    yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG,
    _construct_unique_mapping,
)


def load_labeler(text):
    return yaml.load(text, Loader=UniqueKeyLoader)


def _javascript_string_length(value):
    """Cuenta unidades UTF-16 como `String.length` en el runtime de Labeler."""
    return sum(2 if ord(character) > 0xFFFF else 1 for character in value)


def validate_repository_labeler_policy(config):
    assert isinstance(config, dict) and config, "el labeler debe definir etiquetas"
    for label, rules in config.items():
        assert isinstance(label, str) and label.strip(), (
            "la política local exige nombres de etiqueta textuales no vacíos"
        )
        assert isinstance(rules, list) and rules, (
            f"{label}: la política local exige una lista de reglas changed-files"
        )
        for rule in rules:
            assert isinstance(rule, dict) and set(rule) == {"changed-files"}, (
                f"{label}: la política local solo admite reglas changed-files"
            )
            groups = rule["changed-files"]
            assert isinstance(groups, list) and groups, (
                f"{label}: la política local exige una lista changed-files no vacía"
            )
            for group in groups:
                assert isinstance(group, dict) and group, f"{label}: grupo de globs vacío"
                unknown = set(group) - MATCHERS
                assert not unknown, f"{label}: matcher no admitido: {unknown}"
                for matcher, globs in group.items():
                    values = [globs] if isinstance(globs, str) else globs
                    assert isinstance(values, list) and values, (
                        f"{label}/{matcher}: lista vacía o inválida"
                    )
                    for glob in values:
                        assert isinstance(glob, str) and glob.strip(), (
                            f"{label}/{matcher}: glob vacío o no textual"
                        )
                        assert _javascript_string_length(glob) <= MAX_PATTERN_LENGTH, (
                            f"{label}/{matcher}: glob supera el límite de minimatch"
                        )


def test_labeler_actual_cumple_la_politica_local_y_no_duplica_claves():
    config = load_labeler(LABELER_CONFIG.read_text(encoding="utf-8"))
    validate_repository_labeler_policy(config)


def test_claves_duplicadas_se_rechazan_en_lugar_de_sobrescribirse():
    duplicate = """
documentation:
  - changed-files:
      - any-glob-to-any-file: ['docs/**']
documentation:
  - changed-files:
      - any-glob-to-any-file: ['*.md']
"""
    with pytest.raises(ValueError, match="clave YAML duplicada: documentation"):
        load_labeler(duplicate)


def test_claves_duplicadas_anidadas_tambien_se_rechazan():
    duplicate = """
documentation:
  - changed-files:
      - any-glob-to-any-file: ['docs/**']
        any-glob-to-any-file: ['*.md']
"""
    with pytest.raises(ValueError, match="clave YAML duplicada: any-glob-to-any-file"):
        load_labeler(duplicate)


def test_regla_sin_globs_se_rechaza():
    config = {"documentation": [{"changed-files": [{"any-glob-to-any-file": []}]}]}
    with pytest.raises(AssertionError, match="lista vacía"):
        validate_repository_labeler_policy(config)


@pytest.mark.parametrize(
    ("glob", "accepted"),
    [
        ("a" * MAX_PATTERN_LENGTH, True),
        ("a" * (MAX_PATTERN_LENGTH + 1), False),
        ("á" * MAX_PATTERN_LENGTH, True),
        ("😀" * (MAX_PATTERN_LENGTH // 2), True),
        ("😀" * (MAX_PATTERN_LENGTH // 2 + 1), False),
    ],
)
def test_limite_de_minimatch_usa_unidades_utf16_como_javascript(glob, accepted):
    config = {
        "documentation": [
            {"changed-files": [{"any-glob-to-any-file": glob}]}
        ]
    }
    if accepted:
        validate_repository_labeler_policy(config)
    else:
        with pytest.raises(AssertionError, match="límite de minimatch"):
            validate_repository_labeler_policy(config)


@pytest.mark.parametrize(
    "config",
    [
        {"documentation": [{"base-branch": "main"}]},
        {"documentation": [{"any": [{"head-branch": "^docs/"}]}]},
        {"max-files-changed": 100},
        {
            "documentation": [
                {"changed-files": {"any-glob-to-any-file": "docs/**"}}
            ]
        },
    ],
)
def test_formas_fuera_de_la_politica_local_se_rechazan(config):
    with pytest.raises(AssertionError, match="política local"):
        validate_repository_labeler_policy(config)


@pytest.mark.parametrize("label", [True, 123, None])
def test_nombres_no_textuales_se_rechazan(label):
    config = {label: [{"changed-files": [{"any-glob-to-any-file": "**"}]}]}
    with pytest.raises(AssertionError, match="nombres de etiqueta textuales"):
        validate_repository_labeler_policy(config)
