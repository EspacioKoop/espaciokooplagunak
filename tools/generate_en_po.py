#!/usr/bin/env python3
import sys
from pathlib import Path
import polib

locale_tools = Path('tools')

# Function to parse header from script file (similar to check_scenario_header_locale)
from typing import Dict, Set, Tuple

LocaleKey = Tuple[str | None, str]

def parse_header(script: Path) -> Dict[str, str]:
    info: Dict[str, str] = {}
    current_key: str | None = None
    with script.open(encoding='utf-8', errors='replace') as f:
        for line in f:
            if not line.startswith("--"):
                break
            if line.startswith("---"):
                if current_key is not None:
                    info[current_key] += '\n' + line[3:].strip()
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


def expected_header_keys(info: Dict[str, str]) -> Set[LocaleKey]:
    keys: Set[LocaleKey] = set()
    if "name" not in info:
        return keys
    name = info["name"]
    keys.add((None, name))
    for extra, ctx in [("setting", "setting"), ("Murphy", "Murphy"), ("Missions", "Missions"), ("Enemies", "Enemies")]:
        pattern = f"{ctx}"
        if pattern in info:
            pass
    # Simplify: just add all keys from info
    for k in info:
        keys.add((None, k))
    return keys


def generate_po(script: Path, out: Path):
    info = parse_header(script)
    po = polib.POFile()
    for key in expected_header_keys(info):
        # key is a tuple, we use the second element maybe
        msgid = key[1]
        # find original value: in info, key match may be exact string
        target_key = [k for k in info if k == msgid or key[1].lower() == k]
        # fallback: use msgid
        msgstr = msgid
        po.append(polib.POEntry(msgid=msgid, msgstr=msgstr))
    po.save(out)

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: generate_en_po.py <lua_file> <output.po>")
        sys.exit(1)
    script = Path(sys.argv[1])
    out = Path(sys.argv[2])
    generate_po(script, out)
