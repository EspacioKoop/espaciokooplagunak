#!/usr/bin/env python3
"""Inventario conservador de módulos Foundry y sus consumidores."""

from __future__ import annotations

import argparse
import json
import posixpath
import re
import sys
from collections import deque
from dataclasses import dataclass
from pathlib import Path, PurePosixPath

_STRING_TOKEN = r"__JS_STRING_\d+__"
IMPORT_RE = re.compile(
    rf"(?<![\w$.])import\s*(?:\(\s*)?({_STRING_TOKEN})"
    rf"|(?<![\w$.])(?:import|export)\b[^;]*?\bfrom\s*({_STRING_TOKEN})",
    re.DOTALL,
)
EVIDENCE_URL_RE = re.compile(
    r"https://github\.com/VaroTv7/espaciokooplagunak/(?P<kind>issues|pull)/(?P<number>[1-9]\d*)$"
)
DATE_RE = re.compile(r"\d{4}-\d{2}-\d{2}$")


@dataclass(frozen=True)
class ImportEvidence:
    target: str
    importer: str
    line: int


def load_manifest(root: Path) -> list[str]:
    manifest = json.loads((root / "module.json").read_text(encoding="utf-8"))
    entries = manifest["esmodules"]
    if not isinstance(entries, list) or not entries:
        raise ValueError("module.json no declara ningún esmodule")
    result = []
    for entry in entries:
        if not isinstance(entry, str):
            raise TypeError(f"esmodule inválido: {entry!r}")
        try:
            result.append(PurePosixPath(entry).relative_to("scripts").as_posix())
        except ValueError as error:
            raise ValueError(f"esmodule fuera de scripts/: {entry}") from error
    return result


def modules(root: Path) -> set[str]:
    return {
        path.relative_to(root / "scripts").as_posix()
        for path in (root / "scripts").rglob("*.mjs")
    }


def _mask_comments_and_strings(source: str) -> tuple[str, dict[str, tuple[str, int]]]:
    """Oculta comentarios/strings sin ocultar los literales que luego referencia el patrón."""
    masked: list[str] = []
    strings: dict[str, tuple[str, int]] = {}
    index = 0
    line = 1
    string_index = 0

    while index < len(source):
        char = source[index]
        following = source[index + 1] if index + 1 < len(source) else ""

        if char == "/" and following in {"/", "*"}:
            block = following == "*"
            masked.extend("  ")
            index += 2
            while index < len(source):
                if block and source[index:index + 2] == "*/":
                    masked.extend("  ")
                    index += 2
                    break
                if not block and source[index] == "\n":
                    break
                masked.append("\n" if source[index] == "\n" else " ")
                if source[index] == "\n":
                    line += 1
                index += 1
            continue

        if char in {"'", '"', "`"}:
            quote = char
            start_line = line
            value: list[str] = []
            cursor = index + 1
            string_lines = 0
            closed = False
            while cursor < len(source):
                current = source[cursor]
                # Las comillas simples/dobles no cruzan líneas en JavaScript. Si
                # no cierran antes, esta comilla puede pertenecer a una regex.
                if current == "\n" and quote != "`":
                    break
                if current == "\\" and cursor + 1 < len(source):
                    value.append(source[cursor + 1])
                    if source[cursor + 1] == "\n":
                        string_lines += 1
                    cursor += 2
                    continue
                if current == quote:
                    cursor += 1
                    closed = True
                    break
                value.append(current)
                if current == "\n":
                    string_lines += 1
                cursor += 1
            if not closed:
                if quote == "`":
                    raise ValueError(f"literal JavaScript sin cerrar en línea {start_line}")
                masked.append(char)
                index += 1
                continue
            index = cursor
            line += string_lines
            if quote == "`":
                masked.append(" ")
            else:
                token = f"__JS_STRING_{string_index}__"
                string_index += 1
                strings[token] = ("".join(value), start_line)
                masked.append(f" {token} ")
            continue

        masked.append(char)
        if char == "\n":
            line += 1
        index += 1

    return "".join(masked), strings


def imports(root: Path, module: str) -> list[ImportEvidence]:
    source = (root / "scripts" / module).read_text(encoding="utf-8")
    masked, strings = _mask_comments_and_strings(source)
    result = []
    for match in IMPORT_RE.finditer(masked):
        token = match.group(1) or match.group(2)
        specifier, line = strings[token]
        if not specifier.startswith("."):
            continue
        target = posixpath.normpath(posixpath.join(posixpath.dirname(module), specifier))
        # El módulo puede consumir datos/helpers que viven fuera de scripts/;
        # esos ficheros no son candidatos de este inventario y no forman aristas.
        if target == ".." or target.startswith("../"):
            continue
        result.append(ImportEvidence(target=target, importer=module, line=line))
    return sorted(result, key=lambda item: (item.target, item.line))


def reachable(
    root: Path, entries: list[str], all_modules: set[str]
) -> tuple[set[str], dict[str, dict]]:
    missing_entries = set(entries) - all_modules
    if missing_entries:
        raise ValueError(f"esmodule inexistente: {sorted(missing_entries)}")

    seen: set[str] = set()
    evidence = {
        entry: {"type": "manifest", "path": "foundry-module/module.json"}
        for entry in entries
    }
    pending = deque(entries)
    while pending:
        current = pending.popleft()
        if current in seen:
            continue
        seen.add(current)
        for imported in imports(root, current):
            if imported.target not in all_modules:
                raise ValueError(
                    f"import relativo inexistente en {imported.importer}:{imported.line}: "
                    f"{imported.target}"
                )
            evidence.setdefault(
                imported.target,
                {
                    "type": "import",
                    "module": imported.importer,
                    "line": imported.line,
                },
            )
            pending.append(imported.target)
    return seen, evidence


def _validate_evidence(module: str, evidence: object) -> None:
    if not isinstance(evidence, dict):
        raise TypeError(f"falta evidencia enlazada en {module}")
    evidence_type = evidence.get("type")
    if evidence_type in {"issue", "pr"}:
        url = evidence.get("url")
        match = EVIDENCE_URL_RE.fullmatch(url) if isinstance(url, str) else None
        expected_kind = "issues" if evidence_type == "issue" else "pull"
        if not match or match.group("kind") != expected_kind:
            raise ValueError(f"evidencia {evidence_type} inválida en {module}")
        return
    if evidence_type == "test":
        path = evidence.get("path")
        if (
            not isinstance(path, str)
            or not path.endswith(".test.mjs")
            or PurePosixPath(path).is_absolute()
            or ".." in PurePosixPath(path).parts
        ):
            raise ValueError(f"evidencia test inválida en {module}")
        return
    raise ValueError(f"falta evidencia enlazada en {module}")


def load_declarations(path: Path) -> tuple[dict[str, dict], set[str]]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if data.get("schemaVersion") != 1:
        raise ValueError("schemaVersion debe ser 1")

    declarations = {}
    raw_declarations = data.get("declarations")
    if not isinstance(raw_declarations, list):
        raise TypeError("declarations debe ser una lista")
    for entry in raw_declarations:
        if not isinstance(entry, dict):
            raise TypeError(f"declaración inválida: {entry!r}")
        module = entry.get("module")
        if not isinstance(module, str) or entry.get("status") not in {
            "declared-orphan",
            "connected",
        }:
            raise ValueError(f"declaración inválida: {entry!r}")
        if (
            not isinstance(entry.get("reason"), str)
            or not entry["reason"].strip()
            or not isinstance(entry.get("declaredBy"), str)
            or not entry["declaredBy"].strip()
            or not isinstance(entry.get("declaredAt"), str)
            or not DATE_RE.fullmatch(entry["declaredAt"])
        ):
            raise ValueError(f"falta procedencia en {module}")
        if entry["status"] == "declared-orphan" and not isinstance(
            entry.get("foundation"), bool
        ):
            raise ValueError(f"declaración huérfana sin decisión de cimiento en {module}")
        _validate_evidence(module, entry.get("evidence"))
        if module in declarations:
            raise ValueError(f"declaración duplicada: {module}")
        declarations[module] = entry

    raw_art_modules = data.get("artModules")
    if not isinstance(raw_art_modules, list) or not all(
        isinstance(module, str) for module in raw_art_modules
    ):
        raise ValueError("artModules debe ser una lista de módulos")
    art_modules = set(raw_art_modules)
    if len(art_modules) != len(raw_art_modules):
        raise ValueError("artModules contiene módulos duplicados")
    return declarations, art_modules


def inventory(root: Path, declaration_path: Path) -> list[dict]:
    all_modules = modules(root)
    declarations, art_modules = load_declarations(declaration_path)
    unknown_inventory_modules = (set(declarations) | art_modules) - all_modules
    if unknown_inventory_modules:
        raise ValueError(
            f"inventario de módulo inexistente: {sorted(unknown_inventory_modules)}"
        )

    reachable_modules, evidence = reachable(root, load_manifest(root), all_modules)
    invalid_connected = {
        module
        for module, entry in declarations.items()
        if entry["status"] == "connected" and module not in reachable_modules
    }
    if invalid_connected:
        raise ValueError(
            f"declaración connected sin consumidor estático: {sorted(invalid_connected)}"
        )
    stale_orphans = {
        module
        for module, entry in declarations.items()
        if entry["status"] == "declared-orphan" and module in reachable_modules
    }
    if stale_orphans:
        raise ValueError(
            f"declaración declared-orphan ya conectada: {sorted(stale_orphans)}"
        )

    results = []
    for module in sorted(all_modules):
        if module in reachable_modules:
            result = {
                "module": module,
                "status": "connected",
                "evidence": evidence[module],
            }
        elif module in declarations:
            declaration = declarations[module]
            result = {
                "module": module,
                "status": "declared-orphan",
                "reason": declaration["reason"],
                "declaredBy": declaration["declaredBy"],
                "declaredAt": declaration["declaredAt"],
                "foundation": declaration["foundation"],
                "evidence": declaration["evidence"],
            }
        else:
            result = {
                "module": module,
                "status": "unknown",
                "reason": "sin consumidor estático demostrable",
            }
        if module in art_modules:
            result["inventories"] = ["art"]
        results.append(result)
    return results


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path("foundry-module"))
    parser.add_argument(
        "--declarations", type=Path, default=Path("docs/orphan-declarations.json")
    )
    parser.add_argument("--format", choices=("text", "json"), default="text")
    parser.add_argument(
        "--check",
        action="store_true",
        help="valida el inventario en modo CI (la validación también protege la salida normal)",
    )
    args = parser.parse_args()
    try:
        results = inventory(args.root, args.declarations)
    except (OSError, KeyError, TypeError, ValueError, json.JSONDecodeError) as error:
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
