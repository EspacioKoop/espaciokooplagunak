#!/usr/bin/env python3
"""Fetch Gutendex book seeds for procedural generation.

Returns JSON objects with id/title/author/topic/summary suitable for
NPC backstories, encounter flavor, or prompt seeds.

Usage:
    python tools/gutendex_seeds.py --topic 'fairy tales' --limit 10
    python tools/gutendex_seeds.py --topic adventure --limit 10
    python tools/gutendex_seeds.py --list-topics
"""
from __future__ import annotations

import argparse
import json
import sys
from urllib.parse import urlencode

try:
    import requests
except Exception:
    requests = None

BASE = "https://gutendex.com/books"


def fetch_books(topic: str, limit: int = 32) -> list[dict]:
    """Return at most limit candidates from one page, not a rights clearance."""
    if type(limit) is not int or not 1 <= limit <= 32:
        raise ValueError("limit must be an integer from 1 to 32")
    if requests is None:
        raise RuntimeError("requests not available")
    params = {"topic": topic, "languages": "en", "copyright": "false"}
    url = f"{BASE}?{urlencode(params)}"
    r = requests.get(url, timeout=30)
    r.raise_for_status()
    data = r.json()
    seeds = []
    for b in data.get("results", []):
        if b.get("copyright") is not False:
            continue
        author = ""
        if b.get("authors"):
            author = b["authors"][0].get("name", "")
        seeds.append({
            "id": b.get("id"),
            "title": b.get("title", ""),
            "author": author,
            "topic": topic,
            "copyright": b.get("copyright"),
            "download_count": b.get("download_count", 0),
            "gutenberg_url": f"https://www.gutenberg.org/ebooks/{b.get('id')}" if b.get("id") else "",
            "summary": (b.get("summaries") or [""])[0],
        })
        if len(seeds) >= limit:
            break
    return seeds


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--topic", help="Gutendex topic, e.g. 'fairy tales', 'adventure'")
    ap.add_argument("--limit", type=int, default=10)
    ap.add_argument("--list-topics", action="store_true")
    args = ap.parse_args()

    if args.list_topics:
        print(json.dumps([
            "adventure", "fairy tales", "folklore", "horror",
            "science fiction", "mythology", "children", "romance",
            "medieval", "detective", "war", "pirates", "travel"
        ], ensure_ascii=False, indent=2))
        return 0

    if not args.topic:
        ap.error("--topic is required unless --list-topics is used")

    if not 1 <= args.limit <= 32:
        ap.error("--limit must be from 1 to 32")
    try:
        seeds = fetch_books(args.topic, args.limit)
    except Exception as exc:
        print(f"Gutendex request failed: {exc}", file=sys.stderr)
        return 1
    print(json.dumps(seeds, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
