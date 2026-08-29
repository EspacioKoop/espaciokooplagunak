from pathlib import Path

from tools.validate_license_registry import validate


def test_license_registry_is_valid():
    root = Path(__file__).parents[2]
    assert validate(root / "licensing" / "registry.json") == []
