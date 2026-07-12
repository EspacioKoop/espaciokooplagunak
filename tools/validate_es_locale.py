#!/usr/bin/env python3
"""Independent QA for Spanish (Spain) PO coverage and format invariants."""

from __future__ import annotations

import re
import sys
from collections import Counter
from pathlib import Path

import polib

PLACEHOLDER_RE = re.compile(
    r"(\{[^{}\n]+\}|%(?:\d+\$)?[-+#0]*\d*(?:\.\d+)?[diuoxXfFeEgGaAcspq%]|<[^<>\n]+>|__[^_\n]+__)"
)


def placeholders(text: str) -> Counter[str]:
    return Counter(PLACEHOLDER_RE.findall(text))


def ending_newlines(text: str) -> int:
    return len(text) - len(text.rstrip("\n"))


def spanish_path(source: Path) -> Path:
    return source.with_name(source.name[:-6] + ".es.po")


def main() -> int:
    root = Path(sys.argv[1] if len(sys.argv) > 1 else ".").resolve()
    sources = sorted(root.rglob("*.en.po"))
    errors: list[str] = []
    translated_entries = identical = 0
    for source in sources:
        target = spanish_path(source)
        rel = target.relative_to(root)
        if not target.exists():
            errors.append(f"missing: {rel}")
            continue
        src = polib.pofile(str(source), encoding="utf-8")
        dst = polib.pofile(str(target), encoding="utf-8")
        if dst.metadata.get("Language") != "es_ES":
            errors.append(f"bad language metadata: {rel}")
        src_map = {(e.msgctxt, e.msgid, e.msgid_plural): e for e in src if not e.obsolete}
        dst_map = {(e.msgctxt, e.msgid, e.msgid_plural): e for e in dst if not e.obsolete}
        if src_map.keys() != dst_map.keys():
            errors.append(f"key mismatch: {rel}: {len(src_map)} != {len(dst_map)}")
        for key, entry in dst_map.items():
            if key not in src_map:
                continue
            originals = [entry.msgid]
            format_originals = originals
            translations = [entry.msgstr]
            if entry.msgid_plural:
                originals = [entry.msgid, entry.msgid_plural]
                format_originals = [entry.msgid_plural, entry.msgid_plural]
                translations = [entry.msgstr_plural.get(0, ""), entry.msgstr_plural.get(1, "")]
            for original, format_original, translation in zip(originals, format_originals, translations):
                translated_entries += 1
                if translation == "" and original != "":
                    errors.append(f"empty: {rel}: {key!r}")
                    continue
                if original.isspace() and translation != original:
                    errors.append(f"whitespace-only changed: {rel}: {key!r}")
                if placeholders(format_original) != placeholders(translation):
                    errors.append(f"placeholder mismatch: {rel}: {format_original!r}")
                if ending_newlines(original) != ending_newlines(translation):
                    errors.append(f"trailing newline mismatch: {rel}: {original!r}")
                if original == translation:
                    identical += 1
    print(
        f"sources={len(sources)} translated_entries={translated_entries} "
        f"identical={identical} errors={len(errors)}"
    )
    if errors:
        print("\n".join(errors[:200]), file=sys.stderr)
        if len(errors) > 200:
            print(f"... {len(errors) - 200} more", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
