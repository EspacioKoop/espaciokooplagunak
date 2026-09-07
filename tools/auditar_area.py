#!/usr/bin/env python3
"""Audita issues cerrados de un area comprobando el PR que los cerro.

Nace de un fallo medido el 2026-08-20 (issue #617): tres auditorias del
enjambre salieron inservibles porque contestaban «¿aparece esta cadena en
algun sitio?» en vez de «¿se implemento esto?». La de bridge dio 32 de 32
«Implementado» porque buscaba el titulo del issue con grep y lo encontraba en
su propio fichero de entrada.

Aqui la evidencia no es textual sino estructural:

  issue cerrado -> PR mergeado que lo referencia -> ficheros que toco
                -> ¿siguen esos ficheros en main?

Un issue sin PR mergeado es SIN_PR: no es «no implementado», es que no se
puede demostrar por esta via y necesita ojo humano. Distinguir esos dos casos
es justo lo que las auditorias anteriores no hacian.

Uso: auditar_area.py <etiqueta> [--repo OWNER/REPO] [--limite N]
"""
import argparse
import json
import subprocess
import sys

CONSULTA = """
query($owner:String!,$repo:String!,$num:Int!){
  repository(owner:$owner,name:$repo){
    issue(number:$num){
      timelineItems(last:50, itemTypes:[CLOSED_EVENT,CROSS_REFERENCED_EVENT]){
        nodes{
          __typename
          ... on ClosedEvent{ closer{ __typename
            ... on PullRequest{ number mergedAt files(first:100){nodes{path}} } } }
          ... on CrossReferencedEvent{ source{
            ... on PullRequest{ number mergedAt files(first:100){nodes{path}} } } }
        }
      }
    }
  }
}
"""


def gh(*args):
    r = subprocess.run(["gh", *args], capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(r.stderr.strip()[:300])
    return r.stdout


def issues_del_area(repo, etiqueta, limite):
    salida = gh("issue", "list", "--repo", repo, "--label", etiqueta,
                "--state", "closed", "--limit", str(limite),
                "--json", "number,title")
    return json.loads(salida)


def prs_que_cierran(repo, numero):
    """PRs MERGEADOS que referencian el issue, con los ficheros que tocaron."""
    owner, nombre = repo.split("/", 1)
    salida = gh("api", "graphql", "-f", f"query={CONSULTA}",
                "-f", f"owner={owner}", "-f", f"repo={nombre}",
                "-F", f"num={numero}")
    nodos = (json.loads(salida)["data"]["repository"]["issue"]
             ["timelineItems"]["nodes"])
    encontrados = {}
    for n in nodos:
        pr = n.get("closer") if n["__typename"] == "ClosedEvent" else n.get("source")
        if not pr or not pr.get("number") or not pr.get("mergedAt"):
            continue
        encontrados[pr["number"]] = [f["path"] for f in
                                     (pr.get("files") or {}).get("nodes", [])]
    return encontrados


def vivos_en_main(rutas):
    """Cuales de esas rutas siguen existiendo en origin/main."""
    if not rutas:
        return [], []
    presentes = set(subprocess.run(
        ["git", "ls-tree", "-r", "--name-only", "origin/main"],
        capture_output=True, text=True).stdout.splitlines())
    return ([r for r in rutas if r in presentes],
            [r for r in rutas if r not in presentes])


def main():
    p = argparse.ArgumentParser()
    p.add_argument("etiqueta")
    p.add_argument("--repo", default="EspacioKoop/espaciokooplagunak")
    p.add_argument("--limite", type=int, default=200)
    a = p.parse_args()

    issues = issues_del_area(a.repo, a.etiqueta, a.limite)
    print(f"# Auditoria de `{a.etiqueta}` por PR que cerro el issue\n")
    print(f"Issues cerrados con la etiqueta: **{len(issues)}**\n")
    print("La evidencia es el PR mergeado que referencia el issue y los "
          "ficheros que toco, no la aparicion del titulo en el texto.\n")

    conteo = {"VIVO": 0, "RETIRADO": 0, "SIN_PR": 0}
    cuerpo = []
    for it in issues:
        num, titulo = it["number"], it["title"]
        try:
            prs = prs_que_cierran(a.repo, num)
        except RuntimeError as e:
            cuerpo.append(f"## Issue {num}: {titulo}\n\n**ERROR** consultando: {e}\n")
            continue
        if not prs:
            conteo["SIN_PR"] += 1
            cuerpo.append(
                f"## Issue {num}: {titulo}\n\n"
                f"**SIN_PR** — cerrado sin PR mergeado que lo referencie. "
                f"No demostrable por esta via; requiere revision humana.\n")
            continue
        todas = sorted({r for rutas in prs.values() for r in rutas})
        viven, faltan = vivos_en_main(todas)
        estado = "VIVO" if viven else "RETIRADO"
        conteo[estado] += 1
        refs = ", ".join(f"#{n}" for n in sorted(prs))
        cuerpo.append(
            f"## Issue {num}: {titulo}\n\n"
            f"**{estado}** — PR {refs}, {len(todas)} fichero(s) tocados, "
            f"{len(viven)} siguen en `main`.\n\n"
            + ("Presentes: " + ", ".join(f"`{r}`" for r in viven[:8])
               + ("…" if len(viven) > 8 else "") + "\n" if viven else "")
            + ("Ya no estan: " + ", ".join(f"`{r}`" for r in faltan[:8])
               + ("…" if len(faltan) > 8 else "") + "\n" if faltan else ""))

    print("| Estado | Issues |\n|---|---|")
    for k, v in conteo.items():
        print(f"| {k} | {v} |")
    total = sum(conteo.values())
    if total and conteo["VIVO"] == total:
        print("\n> **Aviso:** el 100% sale VIVO. Un resultado sin ningun caso "
              "negativo suele significar metodo roto, no proyecto sano. "
              "Revisar antes de dar por buena esta tabla.\n")
    print()
    print("\n---\n".join(cuerpo))
    return 0


if __name__ == "__main__":
    sys.exit(main())
