#!/usr/bin/env python3
"""Encuentra rutas de fichero citadas en la documentacion que ya no existen.

Medido el 2026-08-19 en Lagunak: de 155 rutas citadas entre comillas invertidas
en los .md, **65 no existian**. Prosa que describe un repo que ya no es ese.

Comprueba dos formas de citar:
  - rutas entre comillas invertidas: `docs/FOO.md`, `bridge/app.py`
  - enlaces markdown relativos: [texto](docs/FOO.md)

Uso: refs-rotas.py [RAIZ] [--json] [--lista]
Sale con 1 si hay alguna rota, para servir de criterio de aceptacion.
"""
import json, os, re, sys

BACKTICK = re.compile(r"`((?:docs|scripts|bridge|src|foundry-module|tools|cmake|packs|www)/[A-Za-z0-9_./-]+)`")
ENLACE = re.compile(r"\]\((?!https?:|#|mailto:)([^)\s]+\.(?:md|py|mjs|js|lua|json|yaml|yml|cpp|h|sh|txt))\)")


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    raiz = args[0] if args else "."
    raiz = os.path.abspath(raiz)
    rotas = {}
    total = 0
    for base, dirs, ficheros in os.walk(raiz):
        dirs[:] = [d for d in dirs if d not in (".git", "node_modules", ".worktrees", "__pycache__")]
        for f in ficheros:
            if not f.endswith(".md"):
                continue
            p = os.path.join(base, f)
            try:
                txt = open(p, encoding="utf-8", errors="replace").read()
            except OSError:
                continue
            citadas = set(BACKTICK.findall(txt))
            for m in ENLACE.findall(txt):
                citadas.add(os.path.normpath(os.path.join(
                    os.path.relpath(base, raiz), m)))
            for ruta in citadas:
                total += 1
                # Una cita puede ser relativa a la raiz, al directorio del propio
                # documento, o a foundry-module/ (CLAUDE.md cita `scripts/x.mjs`
                # queriendo decir foundry-module/scripts/x.mjs). Solo es rota si
                # no resuelve por ninguna de las tres vias: dar por rota una ruta
                # que si existe manda al agente a perseguir fantasmas.
                candidatos = (
                    os.path.join(raiz, ruta),
                    os.path.join(base, ruta),
                    os.path.join(raiz, "foundry-module", ruta),
                )
                if not any(os.path.exists(c) for c in candidatos):
                    rotas.setdefault(os.path.relpath(p, raiz), []).append(ruta)

    n = sum(len(v) for v in rotas.values())
    if "--json" in sys.argv:
        print(json.dumps(rotas, ensure_ascii=False, indent=1))
    else:
        print(f"rutas citadas: {total}  |  rotas: {n}  |  documentos afectados: {len(rotas)}")
        if n and ("--lista" in sys.argv or n <= 40):
            for doc in sorted(rotas):
                print(f"\n{doc}")
                for r in sorted(set(rotas[doc])):
                    print(f"    ✗ {r}")
    return 1 if n else 0


if __name__ == "__main__":
    sys.exit(main())
