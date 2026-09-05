import json
import subprocess
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "tools" / "validar_indice_operativo.py"
INDEX = ROOT / "docs" / "INDICE_OPERATIVO.json"


class IndiceOperativoTests(unittest.TestCase):
    def test_indice_valido(self):
        resultado = subprocess.run(["python3", SCRIPT], cwd=ROOT, capture_output=True, text=True)
        self.assertEqual(resultado.returncode, 0, resultado.stderr)
        self.assertIn("áreas operativas", resultado.stdout)

    def test_todas_las_areas_tienen_limites_de_seguridad(self):
        indice = json.loads(INDEX.read_text(encoding="utf-8"))
        for area in indice["areas"]:
            self.assertEqual(set(area["security"]), {"authority", "secrets", "network"})
            self.assertTrue(all(area["security"].values()))


if __name__ == "__main__":
    unittest.main()
