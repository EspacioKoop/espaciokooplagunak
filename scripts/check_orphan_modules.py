#!/usr/bin/env python3
"""Inventario conservador de módulos Foundry y sus consumidores."""

from __future__ import annotations

import argparse
import json
import os
import posixpath
import re
import sys
from collections import deque
from dataclasses import dataclass
from datetime import date
from functools import lru_cache
from pathlib import Path, PurePosixPath
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

EVIDENCE_URL_RE = re.compile(
    r"https://github\.com/EspacioKoop/espaciokooplagunak/(?P<kind>issues|pull)/(?P<number>[1-9]\d*)$"
)
DATE_RE = re.compile(r"\d{4}-\d{2}-\d{2}$")
GITHUB_API_TIMEOUT = 5.0


class EvidenceLinkNotFound(ValueError):
    """GitHub confirmó que el issue o PR enlazado no existe."""


class EvidenceVerificationError(ValueError):
    """No se pudo decidir si la evidencia remota existe."""


@dataclass(frozen=True)
class ImportEvidence:
    target: str
    importer: str
    line: int


@dataclass(frozen=True)
class JsToken:
    kind: str
    value: str
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


def _javascript_tokens(source: str) -> list[JsToken]:
    """Tokeniza solo lo necesario para demostrar imports literales completos.

    No pretende validar JavaScript. Ante regex, templates o escapes que exigirían
    un parser completo, omite el token en vez de inventar una arista del grafo.
    La sintaxis de los ``.mjs`` se valida por separado con ``node --check``.
    """
    tokens: list[JsToken] = []
    index = 0
    line = 1

    while index < len(source):
        char = source[index]
        following = source[index + 1] if index + 1 < len(source) else ""

        if char.isspace():
            if char == "\n":
                line += 1
            index += 1
            continue

        if char == "/" and following in {"/", "*"}:
            block = following == "*"
            index += 2
            while index < len(source):
                if block and source[index:index + 2] == "*/":
                    index += 2
                    break
                if not block and source[index] == "\n":
                    break
                if source[index] == "\n":
                    line += 1
                index += 1
            continue

        # Una barra puede ser división o regex sin contexto sintáctico completo.
        # Continuar desde un supuesto cierre de regex sería peligroso: una barra
        # dentro de una cadena situada tras una división podría hacer que texto
        # de esa misma cadena pareciera código. Desde aquí no se acredita ninguna
        # arista posterior; perderla degrada a unknown y nunca fabrica connected.
        if char == "/":
            break

        if char in {"'", '"'}:
            quote = char
            start_line = line
            value: list[str] = []
            index += 1
            closed = False
            ambiguous = False
            while index < len(source):
                current = source[index]
                if current == "\n":
                    break
                if current == "\\":
                    # El valor cocinado de escapes JavaScript requiere semántica
                    # propia. Un import así queda deliberadamente sin demostrar.
                    ambiguous = True
                    index += 2
                    continue
                if current == quote:
                    index += 1
                    closed = True
                    break
                value.append(current)
                index += 1
            if closed:
                tokens.append(
                    JsToken(
                        kind="ambiguous-string" if ambiguous else "string",
                        value="".join(value),
                        line=start_line,
                    )
                )
            continue

        if char == "`":
            # Sin parser completo no se puede distinguir con seguridad texto de
            # `${expresiones}` ni templates anidados. Desde aquí el fichero queda
            # ambiguo: conservar los tokens anteriores solo puede degradar ramas
            # posteriores a unknown, nunca acreditar texto del template.
            break

        if char.isalpha() or char in {"_", "$"}:
            start = index
            index += 1
            while index < len(source) and (
                source[index].isalnum() or source[index] in {"_", "$"}
            ):
                index += 1
            tokens.append(JsToken(kind="word", value=source[start:index], line=line))
            continue

        tokens.append(JsToken(kind="punctuation", value=char, line=line))
        index += 1

    return tokens


def _literal_imports(source: str) -> list[tuple[str, int]]:
    """Devuelve solo especificadores que son el literal completo del import."""
    tokens = _javascript_tokens(source)
    result: list[tuple[str, int]] = []

    def literal_after(position: int) -> tuple[str, int] | None:
        if position < len(tokens) and tokens[position].kind == "string":
            return tokens[position].value, tokens[position].line
        return None

    def static_import_from(start: int) -> tuple[str, int] | None:
        """Acepta solo las formas restringidas del ImportClause de ESM."""
        cursor = start
        brace_depth = 0
        while cursor < len(tokens) and tokens[cursor].value != ";":
            current = tokens[cursor]
            if current.value == "{":
                brace_depth += 1
            elif current.value == "}":
                brace_depth -= 1
                if brace_depth < 0:
                    return None
            elif current.kind == "word" and current.value == "from" and brace_depth == 0:
                # Debe haber una cláusula entre `import` y `from`; cualquier
                # puntuación no propia de imports vuelve ambigua la construcción.
                clause = tokens[start:cursor]
                if not clause or any(
                    item.kind == "ambiguous-string"
                    or (
                        item.kind == "punctuation"
                        and item.value not in {"{", "}", "*", ","}
                    )
                    for item in clause
                ):
                    return None
                return literal_after(cursor + 1)
            cursor += 1
        return None

    def reexport_from(start: int) -> tuple[str, int] | None:
        """Reconoce reexports sin buscar `from` a través de otra sentencia."""
        first = tokens[start]
        if first.value == "*":
            cursor = start + 1
            if (
                cursor + 1 < len(tokens)
                and tokens[cursor].kind == "word"
                and tokens[cursor].value == "as"
                and tokens[cursor + 1].kind == "word"
            ):
                cursor += 2
            if (
                cursor < len(tokens)
                and tokens[cursor].kind == "word"
                and tokens[cursor].value == "from"
            ):
                return literal_after(cursor + 1)
            return None

        if first.value != "{":
            return None
        cursor = start + 1
        while cursor < len(tokens) and tokens[cursor].value != "}":
            current = tokens[cursor]
            if current.kind != "word" and current.value != ",":
                return None
            cursor += 1
        if cursor >= len(tokens):
            return None
        closing = tokens[cursor]
        following = tokens[cursor + 1] if cursor + 1 < len(tokens) else None
        if (
            following is None
            or following.kind != "word"
            or following.value != "from"
            # `export {}\nfrom\n"./x"` es sintaxis válida pero no evidencia
            # inequívoca para este lexer reducido. Exigir la misma línea evita
            # unir dos construcciones que ASI/contexto podrían separar.
            or following.line != closing.line
        ):
            return None
        return literal_after(cursor + 2)

    for index, token in enumerate(tokens):
        if token.kind != "word" or token.value not in {"import", "export"}:
            continue

        previous = tokens[index - 1] if index > 0 else None
        if previous and previous.value == ".":
            # `loader.import("./x.mjs")` es una llamada ordinaria, no sintaxis
            # import de JavaScript y por tanto no demuestra conexión.
            continue
        following = tokens[index + 1] if index + 1 < len(tokens) else None
        if token.value == "import" and following and following.value == ".":
            continue
        if token.value == "import" and following and following.value == "(":
            literal = literal_after(index + 2)
            closing = tokens[index + 3] if index + 3 < len(tokens) else None
            if literal and closing and closing.value == ")":
                result.append(literal)
            continue
        if token.value == "import" and following and following.kind == "string":
            result.append((following.value, following.line))
            continue
        literal = (
            static_import_from(index + 1)
            if token.value == "import"
            else reexport_from(index + 1)
            if following is not None
            else None
        )
        if literal:
            result.append(literal)
    return result


def imports(root: Path, module: str) -> list[ImportEvidence]:
    source = (root / "scripts" / module).read_text(encoding="utf-8")
    result = []
    for specifier, line in _literal_imports(source):
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


def _request_github_evidence(
    url: str,
    *,
    token: str | None = None,
    timeout: float = GITHUB_API_TIMEOUT,
    opener=urlopen,
) -> None:
    """Comprueba una URL de evidencia mediante REST, sin confundir red y 404."""
    match = EVIDENCE_URL_RE.fullmatch(url)
    if match is None:
        raise ValueError(f"URL de evidencia GitHub inválida: {url}")
    resource = "issues" if match.group("kind") == "issues" else "pulls"
    api_url = (
        "https://api.github.com/repos/EspacioKoop/espaciokooplagunak/"
        f"{resource}/{match.group('number')}"
    )
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "espaciokoop-module-inventory",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    if token and token.strip():
        headers["Authorization"] = f"Bearer {token.strip()}"
    request = Request(api_url, headers=headers, method="GET")

    try:
        response = opener(request, timeout=timeout)
        with response:
            status = response.status
            # El cuerpo distingue un issue real de una PR devuelta por el
            # endpoint combinado `/issues/{number}` de GitHub.
            body = response.read()
    except HTTPError as error:
        if error.code == 404:
            raise EvidenceLinkNotFound(
                f"evidencia GitHub inexistente (GitHub confirmó 404): {url}"
            ) from error
        raise EvidenceVerificationError(
            f"no se pudo verificar evidencia GitHub: HTTP {error.code} para {url}"
        ) from error
    except (URLError, TimeoutError, OSError) as error:
        raise EvidenceVerificationError(
            f"no se pudo verificar evidencia GitHub por red: {url} ({error})"
        ) from error

    if status == 404:
        raise EvidenceLinkNotFound(
            f"evidencia GitHub inexistente (GitHub confirmó 404): {url}"
        )
    if not 200 <= status < 300:
        raise EvidenceVerificationError(
            f"no se pudo verificar evidencia GitHub: HTTP {status} para {url}"
        )
    try:
        payload = json.loads(body)
    except (TypeError, UnicodeDecodeError, json.JSONDecodeError) as error:
        raise EvidenceVerificationError(
            f"respuesta GitHub inválida al verificar evidencia: {url}"
        ) from error
    if not isinstance(payload, dict):
        raise EvidenceVerificationError(
            f"respuesta GitHub inválida al verificar evidencia: {url}"
        )
    if resource == "issues" and "pull_request" in payload:
        raise ValueError(
            f"evidencia declarada como issue pero GitHub confirma que es una PR: {url}"
        )


@lru_cache(maxsize=None)
def _verify_github_evidence(url: str, token: str | None) -> None:
    """Evita repetir consultas para enlaces compartidos por varias declaraciones."""
    _request_github_evidence(url, token=token)


def _validate_evidence(
    module: str,
    evidence: object,
    repository_root: Path,
    *,
    verify_github: bool = False,
) -> None:
    if not isinstance(evidence, dict):
        raise TypeError(f"falta evidencia enlazada en {module}")
    evidence_type = evidence.get("type")
    if evidence_type in {"issue", "pr"}:
        url = evidence.get("url")
        match = EVIDENCE_URL_RE.fullmatch(url) if isinstance(url, str) else None
        expected_kind = "issues" if evidence_type == "issue" else "pull"
        if not match or match.group("kind") != expected_kind:
            raise ValueError(f"evidencia {evidence_type} inválida en {module}")
        if verify_github:
            token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
            _verify_github_evidence(url, token)
        return
    if evidence_type == "test":
        path = evidence.get("path")
        pure_path = PurePosixPath(path) if isinstance(path, str) else None
        if (
            pure_path is None
            or not path.endswith(".test.mjs")
            or pure_path.is_absolute()
            or ".." in pure_path.parts
        ):
            raise ValueError(f"evidencia test inválida en {module}")
        evidence_path = (repository_root / path).resolve()
        if not evidence_path.is_relative_to(repository_root.resolve()):
            raise ValueError(f"evidencia test fuera del repositorio en {module}")
        if not evidence_path.is_file():
            raise ValueError(f"evidencia test inexistente en {module}: {path}")
        return
    raise ValueError(f"falta evidencia enlazada en {module}")


def load_declarations(
    path: Path,
    repository_root: Path,
    *,
    verify_github: bool = False,
) -> tuple[dict[str, dict], set[str]]:
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
        declared_at = entry.get("declaredAt")
        if (
            not isinstance(entry.get("reason"), str)
            or not entry["reason"].strip()
            or not isinstance(entry.get("declaredBy"), str)
            or not entry["declaredBy"].strip()
            or not isinstance(declared_at, str)
            or not DATE_RE.fullmatch(declared_at)
        ):
            raise ValueError(f"falta procedencia en {module}")
        try:
            parsed_date = date.fromisoformat(declared_at)
        except ValueError as error:
            raise ValueError(f"fecha de declaración inválida en {module}: {declared_at}") from error
        if parsed_date.isoformat() != declared_at:
            raise ValueError(f"fecha de declaración inválida en {module}: {declared_at}")
        if entry["status"] == "declared-orphan" and not isinstance(
            entry.get("foundation"), bool
        ):
            raise ValueError(f"declaración huérfana sin decisión de cimiento en {module}")
        _validate_evidence(
            module,
            entry.get("evidence"),
            repository_root,
            verify_github=verify_github,
        )
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


def inventory(
    root: Path,
    declaration_path: Path,
    *,
    verify_github: bool = False,
) -> list[dict]:
    all_modules = modules(root)
    repository_root = root.resolve().parent
    declarations, art_modules = load_declarations(
        declaration_path,
        repository_root,
        verify_github=verify_github,
    )
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
    parser.add_argument(
        "--check-github-evidence",
        action="store_true",
        help="verifica una vez por ejecución que los issues y PR enlazados existen",
    )
    args = parser.parse_args()
    try:
        results = inventory(
            args.root,
            args.declarations,
            verify_github=args.check_github_evidence,
        )
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
