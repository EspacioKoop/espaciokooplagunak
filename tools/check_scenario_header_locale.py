#!/usr/bin/env python3
"""Check scenario header metadata against the locale catalogs.

The existing EN/ES validators compare catalogs with each other. They cannot detect
when both catalogs are stale relative to the current Lua header. This tool
reproduces the metadata extraction performed by update_locale.py and checks that
each generated key exists in every requested language catalog.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Iterable

import polib

LocaleKey = tuple[str | None, str]


def parse_header(script: Path) -> dict[str, str]:
    """Parse the initial Lua comment block like update_locale.py."""
    info: dict[str, str] = {}
    current_key: str | None = None

    with script.open(encoding="utf-8", errors="replace") as handle:
        for line in handle:
            if not line.startswith("--"):
                break
            if line.startswith("---"):
                if current_key is not None:
                    info[current_key] += "\n" + line[3:].strip()
                continue
            if ":" not in line:
                continue

            key, _, value = line[2:].partition(":")
            if "[" in key and key.endswith("]"):
                extra = key[key.find("[") + 1 : -1]
                key = key[: key.find("[")].lower().strip()
                current_key = f"{key}[{extra}]"
            else:
                current_key = key.strip().lower()
            info[current_key] = value.strip()

    return info


def expected_header_keys(info: dict[str, str]) -> set[LocaleKey]:
    """Return the keys update_locale.py generates from scenario metadata."""
    keys: set[LocaleKey] = set()
    if "name" not in info:
        return keys

    keys.add((None, info["name"]))
    if "description" in info:
        keys.add((None, info["description"].replace("\r", "")))

    for key, value in info.items():
        if not (key.startswith("setting[") and key.endswith("]")):
            continue

        setting_name = key[8:-1]
        keys.add(("setting", setting_name))
        keys.add(("setting", value))

        option_prefix = setting_name.lower() + "["
        for option_key, option_description in info.items():
            if not (option_key.startswith(option_prefix) and option_key.endswith("]")):
                continue
            option_name = option_key[len(setting_name) + 1 : -1]
            if "|" in option_name:
                option_name = option_name.split("|", 1)[0]
            keys.add((setting_name, option_name))
            keys.add((setting_name, option_description))

    return keys


def active_catalog_keys(path: Path) -> set[LocaleKey]:
    catalog = polib.pofile(str(path))
    return {(entry.msgctxt, entry.msgid) for entry in catalog if not entry.obsolete}


def audit(root: Path, languages: Iterable[str]) -> dict[str, Any]:
    scripts = sorted((root / "scripts").glob("scenario_*.lua"))
    missing_catalogs: list[str] = []
    missing: dict[str, list[dict[str, str | None]]] = {}
    expected_total = 0
    catalogs_checked = 0

    for script in scripts:
        expected = expected_header_keys(parse_header(script))
        expected_total += len(expected)

        for language in languages:
            relative_catalog = Path("scripts/locale") / f"{script.stem}.{language}.po"
            catalog = root / relative_catalog
            if not catalog.exists():
                missing_catalogs.append(relative_catalog.as_posix())
                continue

            catalogs_checked += 1
            absent = sorted(
                expected - active_catalog_keys(catalog),
                key=lambda item: ((item[0] or ""), item[1]),
            )
            if absent:
                missing[relative_catalog.as_posix()] = [
                    {"context": context, "msgid": msgid} for context, msgid in absent
                ]

    missing_keys = sum(len(entries) for entries in missing.values())
    return {
        "scenarios": len(scripts),
        "catalogs_checked": catalogs_checked,
        "expected_keys": expected_total,
        "missing_catalogs": missing_catalogs,
        "catalogs_with_missing_keys": len(missing),
        "missing_keys": missing_keys,
        "missing": missing,
    }


def print_text(result: dict[str, Any]) -> None:
    print(
        "scenarios={scenarios} catalogs={catalogs_checked} "
        "expected_keys={expected_keys} missing_catalogs={missing_catalog_count} "
        "catalogs_with_missing={catalogs_with_missing_keys} missing_keys={missing_keys}".format(
            **result,
            missing_catalog_count=len(result["missing_catalogs"]),
        )
    )
    for catalog in result["missing_catalogs"]:
        print(f"MISSING_CATALOG {catalog}")
    for catalog, entries in result["missing"].items():
        print(f"STALE {catalog} missing={len(entries)}")
        for entry in entries:
            context = entry["context"] if entry["context"] is not None else "-"
            print(f"  [{context}] {json.dumps(entry['msgid'], ensure_ascii=False)}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("root", nargs="?", default=".", type=Path)
    parser.add_argument("--languages", nargs="+", default=("en", "es"))
    parser.add_argument("--json", action="store_true", dest="as_json")
    parser.add_argument(
        "--report-only",
        action="store_true",
        help="report missing keys but exit successfully",
    )
    args = parser.parse_args()

    result = audit(args.root.resolve(), args.languages)
    if args.as_json:
        print(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True))
    else:
        print_text(result)

    has_errors = bool(result["missing_catalogs"] or result["missing_keys"])
    return 0 if args.report_only or not has_errors else 1


if __name__ == "__main__":
    raise SystemExit(main())
