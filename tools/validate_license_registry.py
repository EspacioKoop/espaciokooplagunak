#!/usr/bin/env python3
"""Validate the standalone RPG license registry structure."""
import json
import sys
from pathlib import Path
from urllib.parse import urlparse

REQUIRED = {"id", "name", "license", "source", "version", "contentScope", "allowedUses", "restrictedUses", "vtt", "commercial", "attribution", "adapterAllowed", "risk", "verificationStatus"}
VERIFICATION_STATUSES = {"verified", "pending"}

def validate(path: Path) -> list[str]:
    data = json.loads(path.read_text(encoding="utf-8"))
    errors = []
    if data.get("standalonePolicy", {}).get("coreMayDependOnExternalRpg") is not False:
        errors.append("standalonePolicy.coreMayDependOnExternalRpg must be false")
    if data.get("standalonePolicy", {}).get("adapterDirection") != "adapter -> espaciokoop-core":
        errors.append("adapter direction must point toward the core")
    systems = data.get("systems")
    if not isinstance(systems, list) or len(systems) < 17:
        errors.append("registry must contain at least 17 systems")
        systems = systems or []
    ids = set()
    for index, system in enumerate(systems):
        missing = REQUIRED - system.keys()
        if missing:
            errors.append(f"systems[{index}] missing: {', '.join(sorted(missing))}")
        if system.get("id") in ids:
            errors.append(f"duplicate id: {system.get('id')}")
        ids.add(system.get("id"))
        source = urlparse(str(system.get("source", "")))
        if source.scheme != "https" or not source.netloc:
            errors.append(f"systems[{index}] source must be an https URL")
        for field in ("allowedUses", "restrictedUses"):
            if not isinstance(system.get(field), list) or not system[field]:
                errors.append(f"systems[{index}] {field} must be non-empty")
        if not str(system.get("contentScope", "")).strip():
            errors.append(f"systems[{index}] contentScope is required")
        status = system.get("verificationStatus")
        if status not in VERIFICATION_STATUSES:
            errors.append(f"systems[{index}] verificationStatus must be verified or pending")
        if status == "verified":
            evidence = " ".join(str(system.get(field, "")) for field in (
                "license", "version", "contentScope", "vtt", "commercial",
                "attribution", "adapterAllowed"))
            if "verify" in evidence.lower():
                errors.append(f"systems[{index}] verified entry still contains a verify placeholder")
    return errors

def main() -> int:
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("licensing/registry.json")
    errors = validate(path)
    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 1
    print(f"license registry valid: {len(json.loads(path.read_text(encoding='utf-8'))['systems'])} systems")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
