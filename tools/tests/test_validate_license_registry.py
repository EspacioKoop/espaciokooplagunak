import json
from pathlib import Path

from tools.validate_license_registry import validate


def test_license_registry_is_valid():
    root = Path(__file__).parents[2]
    assert validate(root / "licensing" / "registry.json") == []


def _mutated_registry(tmp_path, mutate):
    root = Path(__file__).parents[2]
    data = json.loads((root / "licensing" / "registry.json").read_text(encoding="utf-8"))
    mutate(data)
    path = tmp_path / "registry.json"
    path.write_text(json.dumps(data), encoding="utf-8")
    return path


def test_rejects_unknown_verification_status(tmp_path):
    path = _mutated_registry(tmp_path, lambda data: data["systems"][0].update(
        verificationStatus="probably"))
    assert any("verificationStatus" in error for error in validate(path))


def test_rejects_verified_entry_with_pending_placeholders(tmp_path):
    path = _mutated_registry(tmp_path, lambda data: data["systems"][0].update(
        verificationStatus="verified"))
    assert any("verify placeholder" in error for error in validate(path))


def test_pending_entry_is_not_presented_as_verified(tmp_path):
    path = _mutated_registry(tmp_path, lambda data: data["systems"][0].pop(
        "verificationStatus"))
    assert any("missing" in error and "verificationStatus" in error for error in validate(path))
