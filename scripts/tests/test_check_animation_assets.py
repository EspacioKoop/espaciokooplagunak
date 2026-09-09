import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import check_animation_assets as mod


def _make_library(resources_root, name, with_asset=True):
    lib_dir = os.path.join(resources_root, 'animations', name)
    os.makedirs(lib_dir, exist_ok=True)
    if with_asset:
        with open(os.path.join(lib_dir, 'clip.glb'), 'wb') as fh:
            fh.write(b'fake')


class TestCheckAnimationAssets(unittest.TestCase):
    def test_falla_si_falta_una_de_las_dos_bibliotecas(self):
        """El defecto original: isdir(dir1) or isdir(dir2) pasaba con una
        de las dos ausente. Con solo la primera presente, debe fallar."""
        with tempfile.TemporaryDirectory() as tmp:
            _make_library(tmp, 'universal-animation-library')
            ok, _lines = mod.check_libraries(tmp)
            self.assertFalse(ok)

    def test_falla_si_faltan_las_dos(self):
        with tempfile.TemporaryDirectory() as tmp:
            ok, _lines = mod.check_libraries(tmp)
            self.assertFalse(ok)

    def test_falla_si_una_biblioteca_esta_vacia(self):
        with tempfile.TemporaryDirectory() as tmp:
            _make_library(tmp, 'universal-animation-library')
            _make_library(tmp, 'universal-animation-library-2', with_asset=False)
            ok, _lines = mod.check_libraries(tmp)
            self.assertFalse(ok)

    def test_pasa_con_las_dos_bibliotecas_presentes(self):
        with tempfile.TemporaryDirectory() as tmp:
            _make_library(tmp, 'universal-animation-library')
            _make_library(tmp, 'universal-animation-library-2')
            ok, _lines = mod.check_libraries(tmp)
            self.assertTrue(ok)

    def test_ignora_ficheros_irrelevantes(self):
        with tempfile.TemporaryDirectory() as tmp:
            lib_dir = os.path.join(tmp, 'animations', 'universal-animation-library')
            os.makedirs(lib_dir, exist_ok=True)
            with open(os.path.join(lib_dir, 'Readme.txt'), 'w') as fh:
                fh.write('no es una animacion')
            _make_library(tmp, 'universal-animation-library-2')
            ok, _lines = mod.check_libraries(tmp)
            self.assertFalse(ok)


if __name__ == '__main__':
    unittest.main()
