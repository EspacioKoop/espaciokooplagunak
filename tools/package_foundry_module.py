#!/usr/bin/env python3
"""Construye un ZIP reproducible del módulo Foundry de Espaciokoop Lagunak."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import stat
import zipfile
from pathlib import Path, PurePosixPath

MODULE_FILES = ("module.json", "README.md")
MODULE_DIRS = ("lang", "scripts", "styles", "templates")
FIXED_TIMESTAMP = (1980, 1, 1, 0, 0, 0)


def _manifest_paths(manifest: dict) -> set[str]:
    paths = set(manifest.get("esmodules", [])) | set(manifest.get("styles", []))
    paths.update(item["path"] for item in manifest.get("languages", []))
    return paths


def validate_module(source: Path) -> tuple[dict, list[Path]]:
    manifest_path = source / "module.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if manifest.get("id") != "espaciokoop-lagunak":
        raise ValueError("module.json tiene un id inesperado")
    version = manifest.get("version", "")
    if not re.fullmatch(r"\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?", version):
        raise ValueError("module.json no contiene una versión semántica válida")

    for relative in sorted(_manifest_paths(manifest)):
        path = source / relative
        if not path.is_file():
            raise FileNotFoundError(f"ruta declarada ausente: {relative}")

    files: set[Path] = set()
    for relative in MODULE_FILES:
        path = source / relative
        if path.is_file():
            files.add(path)
    for dirname in MODULE_DIRS:
        root = source / dirname
        if root.is_dir():
            files.update(
                path for path in root.rglob("*")
                if path.is_file() and "__pycache__" not in path.parts and path.suffix != ".pyc"
            )

    license_path = source.parent / "LICENSE"
    if not license_path.is_file():
        raise FileNotFoundError("falta LICENSE en la raíz del repositorio")
    files.add(license_path)
    return manifest, sorted(files, key=lambda path: _archive_name(path, source))


def _archive_name(path: Path, source: Path) -> str:
    if path == source.parent / "LICENSE":
        return "LICENSE"
    return PurePosixPath(path.relative_to(source)).as_posix()


def build_package(source: Path, output: Path) -> tuple[Path, str]:
    source = source.resolve()
    output = output.resolve()
    manifest, files = validate_module(source)
    output.parent.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for path in files:
            name = _archive_name(path, source)
            info = zipfile.ZipInfo(name, FIXED_TIMESTAMP)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = (stat.S_IFREG | 0o644) << 16
            archive.writestr(info, path.read_bytes(), compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)

    digest = hashlib.sha256(output.read_bytes()).hexdigest()
    checksum = output.with_suffix(output.suffix + ".sha256")
    checksum.write_text(f"{digest}  {output.name}\n", encoding="ascii", newline="\n")
    print(f"Paquete: {output}")
    print(f"SHA-256: {digest}")
    print(f"Versión: {manifest['version']}")
    return checksum, digest


def main() -> None:
    repo = Path(__file__).resolve().parents[1]
    source = repo / "foundry-module"
    manifest = json.loads((source / "module.json").read_text(encoding="utf-8"))
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output",
        type=Path,
        default=repo / "dist" / f"espaciokoop-lagunak-{manifest['version']}.zip",
    )
    args = parser.parse_args()
    build_package(source, args.output)


if __name__ == "__main__":
    main()
