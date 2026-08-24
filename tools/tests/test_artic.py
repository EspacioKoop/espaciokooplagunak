#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""Tests for the artic tool."""

from __future__ import annotations

import json
import os
import sys
import unittest
from pathlib import Path
import subprocess

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from tools import artic  # noqa: E402


# Sample AIC search JSON response (REAL response trimmed to 2 items)
SAMPLE_AIC_RESPONSE = {
    "preference": None,
    "pagination": {
        "total": 62046,
        "limit": 5,
        "offset": 0,
        "total_pages": 12410,
        "current_page": 1
    },
    "data": [
        {
            "_score": 128.43826,
            "id": 16568,
            "title": "Water Lilies",
            "date_display": "1906",
            "artist_title": "Claude Monet",
            "image_id": "3c27b499-af56-f0d5-93b5-a7f2f1ad5813",
            "is_public_domain": True
        },
        {
            "_score": 118.99847,
            "id": 16571,
            "title": "Arrival of the Normandy Train, Gare Saint-Lazare",
            "date_display": "1877",
            "artist_title": "Claude Monet",
            "image_id": "0f1cc0e0-e42e-be16-3f71-2022da38cb93",
            "is_public_domain": True
        },
        {
            "_score": 100.0,
            "id": 99999,
            "title": "Copyrighted Work",
            "date_display": "2020",
            "artist_title": "Modern Artist",
            "image_id": "some-image-id",
            "is_public_domain": False
        },
        {
            "_score": 90.0,
            "id": 88888,
            "title": "Public Domain No Image",
            "date_display": "1800",
            "artist_title": "Old Artist",
            "image_id": None,
            "is_public_domain": True
        }
    ],
    "info": {
        "license_text": "The `description` field in this response is licensed under a Creative Commons Attribution 4.0 Generic License (CC-By) and the Terms and Conditions of artic.edu. All other data in this response is licensed under a Creative Commons Zero (CC0) 1.0 designation and the Terms and Conditions of artic.edu.",
        "license_links": [
            "https://creativecommons.org/publicdomain/zero/1.0/",
            "https://www.artic.edu/terms"
        ],
        "version": "1.14"
    },
    "config": {
        "iiif_url": "https://www.artic.edu/iiif/2",
        "website_url": "http://www.artic.edu"
    }
}


def test_artic_loads_json() -> None:
    """Test that the script can load a JSON file and produce the expected output."""
    candidates = artic.obras_desde_json(SAMPLE_AIC_RESPONSE)
    assert len(candidates) == 2, f"Expected 2, got {len(candidates)}"

    # Check the first candidate (Water Lilies)
    assert candidates[0]["id"] == 16568
    assert candidates[0]["title"] == "Water Lilies"
    assert candidates[0]["artist_title"] == "Claude Monet"
    assert candidates[0]["date_display"] == "1906"
    assert candidates[0]["image_id"] == "3c27b499-af56-f0d5-93b5-a7f2f1ad5813"
    assert candidates[0]["iiif_base"] == "https://www.artic.edu/iiif/2/3c27b499-af56-f0d5-93b5-a7f2f1ad5813"
    assert candidates[0]["source"] == "artic"
    assert candidates[0]["source_url"] == "https://api.artic.edu/api/v1/artworks/16568"

    # Check the second candidate
    assert candidates[1]["id"] == 16571
    assert candidates[1]["title"] == "Arrival of the Normandy Train, Gare Saint-Lazare"
    assert candidates[1]["artist_title"] == "Claude Monet"
    assert candidates[1]["date_display"] == "1877"
    assert candidates[1]["image_id"] == "0f1cc0e0-e42e-be16-3f71-2022da38cb93"

    # Verify copyrighted work and no-image work are filtered out
    titles = [c["title"] for c in candidates]
    assert "Copyrighted Work" not in titles
    assert "Public Domain No Image" not in titles


def test_artic_se_ejecuta_como_script_suelto(tmp_path: Path) -> None:
    """La otra forma de invocarlo, que es la que nadie probaba.

    `artic.py` se ejecuta de DOS maneras y cada una monta un `sys.path`
    distinto: como script suelto la raíz del repositorio no está dentro, y como
    módulo sí. Un import escrito para una de las dos rompe la otra en silencio
    —fue `ModuleNotFoundError: No module named 'apis'` en CI—, y la suite solo
    cubría la forma de módulo, así que el fallo llegó hasta el CI sin que nada
    lo parase antes.

    Esta prueba es la mitad que faltaba. Sin ella, arreglar el import en un
    sentido y romperlo en el otro vuelve a pasar desapercibido.
    """
    sample_file = tmp_path / "artic_sample.json"
    sample_file.write_text(json.dumps(SAMPLE_AIC_RESPONSE), encoding="utf-8")

    raiz = Path(__file__).resolve().parent.parent.parent
    result = subprocess.run(
        [sys.executable, str(raiz / "tools" / "artic.py"),
         "--desde-fichero", str(sample_file)],
        capture_output=True,
        text=True,
        cwd=raiz,
    )
    assert result.returncode == 0, f"Como script suelto falla: {result.stderr}"
    salida = json.loads(result.stdout.strip())
    assert salida[0]["title"] == "Water Lilies"


def test_artic_integration(tmp_path: Path) -> None:
    """Test the script integration with --desde-fichero."""
    sample_file = tmp_path / "artic_sample.json"
    sample_file.write_text(json.dumps(SAMPLE_AIC_RESPONSE), encoding="utf-8")

    # The worktree root is two levels up from this test file (tests -> tools -> root)
    worktree_root = Path(__file__).resolve().parent.parent.parent
    result = subprocess.run(
        [sys.executable, "-m", "tools.artic", "--desde-fichero", str(sample_file)],
        capture_output=True,
        text=True,
        cwd=worktree_root,
    )
    assert result.returncode == 0, f"Script failed with stderr: {result.stderr}"

    # Parse the output JSON
    output = json.loads(result.stdout.strip())
    assert isinstance(output, list)
    assert len(output) == 2
    assert output[0]["title"] == "Water Lilies"
    assert output[0]["source"] == "artic"
    assert output[0]["image_id"] == "3c27b499-af56-f0d5-93b5-a7f2f1ad5813"


if __name__ == "__main__":
    # When run directly, run the tests
    import pytest
    sys.exit(pytest.main([__file__]))

class FixtureRealDeDisco(unittest.TestCase):
    """La captura real, tal cual la devolvió el AIC, sin recortar a mano.

    El JSON incrustado más arriba lleva a propósito una obra con
    is_public_domain False, para demostrar que el filtro la descarta. Esta otra
    fixture es una respuesta literal de la API, y sirve para lo contrario: que
    lo que el módulo promete se cumple sobre datos que nadie ha tocado.
    """

    def setUp(self):
        import json as _json
        ruta = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                            'fixtures_artic.json')
        with open(ruta, encoding='utf-8') as f:
            self.datos = _json.load(f)

    def test_la_captura_trae_obras(self):
        self.assertTrue(self.datos['data'])

    def test_toda_obra_devuelta_declara_dominio_publico_y_tiene_imagen(self):
        for obra in artic.obras_desde_json(self.datos):
            self.assertTrue(obra['dominio_publico'])
            self.assertTrue(obra['image_id'])

    def test_la_procedencia_viaja_con_cada_obra(self):
        for obra in artic.obras_desde_json(self.datos):
            self.assertIn('url_condiciones', obra)
            self.assertIn('source_url', obra)
