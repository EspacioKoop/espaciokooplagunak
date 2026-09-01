#!/usr/bin/env python3
"""Extract ShareTextures category/tag names for safe inspiration use.

Outputs a JSON list of strings that can be used as encounter-flavor tokens
or atmosphere table entries. Does NOT download or redistribute assets.

Usage:
    python tools/sharetextures_categories.py > data/sharetextures_categories.json
"""
from __future__ import annotations

import json
import re
import sys
from urllib.parse import urljoin

try:
    import requests
except Exception:
    requests = None


def main() -> int:
    base = "https://www.sharetextures.com/textures"
    html = ""
    if requests:
        try:
            r = requests.get(base, timeout=20)
            r.raise_for_status()
            html = r.text
        except Exception as exc:
            print(f"# fetch failed: {exc}", file=sys.stderr)
    if not html:
        # Fallback minimal set so the script still produces output in restricted envs.
        tokens = [
            "marble", "plaster", "wood", "leather", "metal", "iron",
            "lava", "fabric", "concrete", "ground", "wall", "roof",
            "road", "floor", "surface imperfection", "gems", "abstract"
        ]
        print(json.dumps(tokens, ensure_ascii=False, indent=2))
        return 0

    # Extract visible category links/tokens from the texture page.
    tokens: list[str] = []
    for m in re.finditer(r">([A-Za-z][A-Za-z0-9 ]{2,40})<", html):
        cand = m.group(1).strip()
        if cand.lower() in {"all", "search", "home", "assets", "textures", "models", "atlases", "blog", "tags", "plugins", "blender", "unreal engine", "license", "terms of service"}:
            continue
        if cand not in tokens:
            tokens.append(cand)

    print(json.dumps(tokens, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
