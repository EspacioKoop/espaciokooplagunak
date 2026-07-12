from __future__ import annotations

import hashlib
import json
import shutil
import tempfile
import unittest
import zipfile
from pathlib import Path

from tools.package_foundry_module import build_package, validate_module


REPO = Path(__file__).resolve().parents[2]


class FoundryPackageTests(unittest.TestCase):
    def test_build_is_reproducible_and_installable(self) -> None:
        with tempfile.TemporaryDirectory(prefix="hermes-verify-foundry-package-") as tmp:
            root = Path(tmp)
            first = root / "first.zip"
            second = root / "second.zip"
            _, digest_first = build_package(REPO / "foundry-module", first)
            _, digest_second = build_package(REPO / "foundry-module", second)

            self.assertEqual(first.read_bytes(), second.read_bytes())
            self.assertEqual(digest_first, digest_second)
            self.assertEqual(digest_first, hashlib.sha256(first.read_bytes()).hexdigest())

            with zipfile.ZipFile(first) as archive:
                names = archive.namelist()
                self.assertIn("module.json", names)
                self.assertIn("LICENSE", names)
                self.assertIn("scripts/main.mjs", names)
                self.assertTrue(all(not name.startswith("tests/") for name in names))
                self.assertTrue(all("__pycache__" not in name for name in names))
                self.assertEqual(names, sorted(names))
                packaged = json.loads(archive.read("module.json"))
                self.assertEqual(packaged["id"], "espaciokoop-lagunak")

    def test_missing_manifest_path_fails_closed(self) -> None:
        with tempfile.TemporaryDirectory(prefix="hermes-verify-foundry-invalid-") as tmp:
            root = Path(tmp)
            source = root / "foundry-module"
            shutil.copytree(REPO / "foundry-module", source)
            shutil.copy2(REPO / "LICENSE", root / "LICENSE")
            manifest_path = source / "module.json"
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            manifest["esmodules"].append("scripts/ausente.mjs")
            manifest_path.write_text(json.dumps(manifest), encoding="utf-8")

            with self.assertRaisesRegex(FileNotFoundError, "scripts/ausente.mjs"):
                validate_module(source)


if __name__ == "__main__":
    unittest.main()
