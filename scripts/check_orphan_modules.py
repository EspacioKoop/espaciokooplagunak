#!/usr/bin/env python3
"""Inventario conservador de módulos Foundry y sus consumidores."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path, PurePosixPath

IMPORT_RE = re.compile(r"(?:\bfrom\s*|\bimport\s*(?:\(\s*)?)['\"](\.[^'\"]+)['\"]")


def load_manifest(root: Path) -> list[str]:
    manifest = json.loads((root / "module.json").read_text(encoding="utf-8"))
    return [PurePosixPath(path).relative_to("scripts").as_posix() for path in manifest["esmodules"]]


def modules(root: Path) -> set[str]:
    return {
        path.relative_to(root / "scripts").as_posix()
        for path in (root / "scripts").rglob("*.mjs")
    }


def imports(root: Path, module: str) -> list[str]:
    source = (root / "scripts" / module).read_text(encoding="utf-8")
    result = []
    for specifier in IMPORT_RE.findall(source):
        resolved = PurePosixPath("scripts", module).parent.joinpath(specifier)
        normalized = PurePosixPath(resolved).as_posix()
        if normalized.startswith("scripts/"):
            result.append(normalized.removeprefix("scripts/"))
    return result


def reachable(root: Path, entries: list[str]) -> tuple[set[str], dict[str, str]]:
    seen: set[str] = set()
    evidence: dict[str, str] = {}
    pending = list(entries)
    while pending:
        current = pending.pop()
        if current in seen:
            continue
        seen.add(current)
        for target in imports(root, current):
            if target not in evidence:
                evidence[target] = current
            pending.append(target)
    return seen, evidence


def load_declarations(path: Path) -> dict[str, dict]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if data.get("schemaVersion") != 1:
        raise ValueError("schemaVersion debe ser 1")
    declarations = {}
    for entry in data.get("declarations", []):
        module = entry.get("module")
        if not module or entry.get("status") not in {"declared-orphan", "connected"}:
            raise ValueError(f"declaración inválida: {entry!r}")
        evidence = entry.get("evidence", {})
        if not entry.get("reason") or not entry.get("declaredBy") or not entry.get("declaredAt"):
            raise ValueError(f"falta procedencia en {module}")
        if evidence.get("type") not in {"issue", "pr", "test"} or not evidence.get("url"):
            raise ValueError(f"falta evidencia enlazada en {module}")
        if module in declarations:
            raise ValueError(f"declaración duplicada: {module}")
        declarations[module] = entry
    return declarations


def inventory(root: Path, declaration_path: Path) -> list[dict]:
    all_modules = modules(root)
    reachable_modules, evidence = reachable(root, load_manifest(root))
    declarations = load_declarations(declaration_path)
    unknown_declarations = set(declarations) - all_modules
    if unknown_declarations:
        raise ValueError(f"declaración de módulo inexistente: {sorted(unknown_declarations)}")
    invalid_connected = {
        module for module, entry in declarations.items()
        if entry["status"] == "connected" and module not in reachable_modules
    }
    if invalid_connected:
        raise ValueError(f"declaración connected sin consumidor estático: {sorted(invalid_connected)}")
    results = []
    for module in sorted(all_modules):
        if module in reachable_modules:
            result = {"module": module, "status": "connected"}
            if module in evidence:
                result["evidence"] = {"type": "import", "module": evidence[module]}
        elif module in declarations:
            result = {"module": module, "status": declarations[module]["status"], "evidence": declarations[module]["evidence"]}
        else:
            result = {"module": module, "status": "unknown", "reason": "sin consumidor estático demostrable"}
        results.append(result)
    return results


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path("foundry-module"))
    parser.add_argument("--declarations", type=Path, default=Path("docs/orphan-declarations.json"))
    parser.add_argument("--format", choices=("text", "json"), default="text")
    parser.add_argument("--check", action="store_true", help="falla ante declaraciones inválidas o módulos no declarados")
    args = parser.parse_args()
    try:
        results = inventory(args.root, args.declarations)
    except (OSError, KeyError, ValueError, json.JSONDecodeError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 2
    if args.format == "json":
        print(json.dumps(results, ensure_ascii=False, indent=2))
    else:
        for result in results:
            print(f"{result['status']:16} {result['module']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
