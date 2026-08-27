#!/usr/bin/env python3
"""Valida el índice operativo de áreas, tareas y límites de seguridad."""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "docs" / "INDICE_OPERATIVO.json"
MAP = ROOT / "docs" / "TRABAJO_PARALELO_AGENTES.md"
REQUIRED_SECURITY = {"authority", "secrets", "network"}


def main() -> int:
    index = json.loads(INDEX.read_text(encoding="utf-8"))
    map_text = MAP.read_text(encoding="utf-8")
    areas = index.get("areas")
    if index.get("schemaVersion") != 1 or not isinstance(areas, list) or not areas:
        raise ValueError("el índice debe declarar schemaVersion 1 y una lista de áreas")

    ids = set()
    map_areas = {
        match.group(1)
        for match in re.finditer(r"^\| ([^|]+) \|", map_text, re.MULTILINE)
        if match.group(1) not in {"Área", "---"}
    }
    for area in areas:
        area_id = area.get("id")
        if not isinstance(area_id, str) or not re.fullmatch(r"[a-z0-9-]+", area_id):
            raise ValueError("cada área necesita un id portable")
        if area_id in ids:
            raise ValueError(f"id duplicado: {area_id}")
        ids.add(area_id)
        if area.get("mapArea") not in map_areas:
            raise ValueError(f"área ausente del mapa: {area.get('mapArea')}")
        for key in ("task", "agent", "verification"):
            if not isinstance(area.get(key), str) or not area[key].strip():
                raise ValueError(f"{area_id} carece de {key}")
        security = area.get("security")
        if not isinstance(security, dict) or set(security) != REQUIRED_SECURITY:
            raise ValueError(f"{area_id} debe declarar authority, secrets y network")
        if any(not isinstance(value, str) or not value.strip() for value in security.values()):
            raise ValueError(f"{area_id} contiene un límite de seguridad vacío")

    print(f"ok: {len(areas)} áreas operativas con tarea, prueba y límites de seguridad")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
