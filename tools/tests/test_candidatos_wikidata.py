#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""Tests for the candidatos_wikidata tool."""

from __future__ import annotations

import json
import sys
from pathlib import Path
import subprocess

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from tools import candidatos_wikidata as candidato  # noqa: E402


def test_candidatos_wikidata_loads_json(tmp_path: Path) -> None:
    """Test that the script can load a JSON file and produce the expected output."""
    # Sample Wikidata SPARQL JSON response (minimal)
    sample_data = {
        "results": {
            "bindings": [
                {
                    "item": {"value": "http://www.wikidata.org/entity/Q123"},
                    "itemLabel": {"value": "Escultura de ejemplo"},
                    "itemDescription": {"value": "Una escultura de prueba"},
                    "image": {"value": "http://commons.wikimedia.org/wiki/Special:FilePath/Escultura_ejemplo.jpg"},
                    "inception": {"value": "-0500-01-01T00:00:00Z"},
                    "collection": {"value": "http://www.wikidata.org/entity/Q456"},
                    "collectionLabel": {"value": "Colección de ejemplo"}
                },
                {
                    "item": {"value": "http://www.wikidata.org/entity/Q789"},
                    "itemLabel": {"value": "Otra escultura"},
                    "itemDescription": {"value": "Otra escultura de prueba"},
                    # Note: missing optional fields to test optionality
                }
            ]
        }
    }

    # Check that we got two candidates
    candidates = candidato.candidatos_desde_json(sample_data)
    assert len(candidates) == 2

    # Check the first candidate
    assert candidates[0]["obra"] == "Escultura de ejemplo"
    assert candidates[0]["descripción"] == "Una escultura de prueba"
    assert candidates[0]["imagen"] == "http://commons.wikimedia.org/wiki/Special:FilePath/Escultura_ejemplo.jpg"
    assert candidates[0]["fecha"] == "-0500-01-01T00:00:00Z"
    assert candidates[0]["coleccion_uri"] == "http://www.wikidata.org/entity/Q456"
    assert candidates[0]["coleccion"] == "Colección de ejemplo"
    # Check the required fields from PROCEDENCIA_ASSETS.md
    assert candidates[0]["qué es el fichero"] == "DESCONOCIDO"
    assert candidates[0]["autoría"] == ""
    assert candidates[0]["licencia"] == "NO COMPROBADO"
    assert candidates[0]["enlace"] == ""
    assert candidates[0]["sha256"] == ""
    assert candidates[0]["cómo se convirtió"] == ""

    # Check the second candidate (with missing optional fields)
    assert candidates[1]["obra"] == "Otra escultura"
    assert candidates[1]["descripción"] == "Otra escultura de prueba"
    assert candidates[1]["imagen"] == ""  # Default to empty string when missing
    assert candidates[1]["fecha"] == ""
    assert candidates[1]["coleccion_uri"] == ""
    assert candidates[1]["coleccion"] == ""


def test_candidatos_wikidata_integration(tmp_path: Path) -> None:
    """Test the script integration with --desde-fichero."""
    sample_data = {
        "results": {
            "bindings": [
                {
                    "item": {"value": "http://www.wikidata.org/entity/Q123"},
                    "itemLabel": {"value": "Escultura de ejemplo"},
                    "itemDescription": {"value": "Una escultura de prueba"},
                    "image": {"value": "http://commons.wikimedia.org/wiki/Special:FilePath/Escultura_ejemplo.jpg"},
                }
            ]
        }
    }

    sample_file = tmp_path / "wikidata_sample.json"
    sample_file.write_text(json.dumps(sample_data), encoding="utf-8")

    # We'll test by running the script as a module using -m
    # The worktree root is two levels up from this test file (tests -> tools -> root)
    worktree_root = Path(__file__).resolve().parent.parent.parent
    result = subprocess.run(
        [sys.executable, "-m", "tools.candidatos_wikidata", "--desde-fichero", str(sample_file)],
        capture_output=True,
        text=True,
        cwd=worktree_root,
    )
    assert result.returncode == 0, f"Script failed with stderr: {result.stderr}"

    # Parse the output JSON
    output = json.loads(result.stdout.strip())
    assert isinstance(output, list)
    assert len(output) == 1
    assert output[0]["obra"] == "Escultura de ejemplo"
    assert output[0]["licencia"] == "NO COMPROBADO"


if __name__ == "__main__":
    # When run directly, run the tests
    import pytest
    sys.exit(pytest.main([__file__]))