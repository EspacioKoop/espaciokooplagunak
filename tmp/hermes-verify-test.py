#!/usr/bin/env python3
import subprocess, tempfile, pathlib, sys
from pathlib import Path

def run():
    # Generate temp outputs for each lua
    lua_files = [Path('scripts/scenario_49_allies.lua'), Path('scripts/scenario_58_race.lua'), Path('scripts/scenario_59_border.lua')]
    for lua in lua_files:
        temp = Path(tempfile.mktemp(prefix='hermes-verify-', suffix='.po'))
        cmd = ['python3', 'tools/generate_en_po.py', str(lua), str(temp)]
        subprocess.check_call(cmd, cwd=Path.cwd())
        # diff with existing
        existing = Path('scripts/locale') / f"{lua.stem}.en.po"
        diff_out = subprocess.run(['diff','-q', str(existing), str(temp)], capture_output=True, text=True)
        if diff_out.returncode==0:
            print(f"{existing} matches generated output")
        else:
            print(f"{existing} differs from generated output")
            print(diff_out.stdout)
        temp.unlink(missing_ok=True)

if __name__=='__main__': run()
