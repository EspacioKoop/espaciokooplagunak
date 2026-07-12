#!/usr/bin/env python3
"""Regenerate resources/locale/main.en.po from current C++ sources.

Requires GNU xgettext in PATH. Other languages are intentionally not merged;
maintainers can review those updates separately to avoid unrelated churn.
"""

from __future__ import annotations

import argparse
import subprocess
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path.cwd())
    args = parser.parse_args()
    root = args.root.resolve()
    sources = sorted(
        p for p in (root / "src").rglob("*") if p.suffix in {".cpp", ".h"}
    )
    if not sources:
        parser.error("no C++ sources found")
    output = root / "resources/locale/main.en.po"
    subprocess.run(
        [
            "xgettext",
            "--from-code=UTF-8",
            "--language=C++",
            "--keyword=tr:1c,2",
            "--keyword=tr:1",
            "--keyword=trn:2c,3,4",
            "--keyword=trn:2,3",
            "--keyword=trMark:1c,2",
            "--keyword=trMark:1",
            "--add-comments=TRANSLATORS",
            "--omit-header",
            "--no-wrap",
            "--sort-by-file",
            "--output",
            str(output),
            *map(str, sources),
        ],
        cwd=root,
        check=True,
    )
    print(f"updated {output.relative_to(root)} from {len(sources)} C++ files")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
