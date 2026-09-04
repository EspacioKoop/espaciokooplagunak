#!/usr/bin/env python3
"""Sincroniza el tablero «Cola de entrega» con el estado REAL de cada PR.

La clasificación es la del barrido de 2026-09-04 y su regla central es que un
CHANGES_REQUESTED caduca sin avisar: GitHub lo mantiene aunque el commit
revisado ya no sea HEAD. Por eso «cambios pedidos» se decide comparando el
commit_id de la revisión con el HEAD de la rama, y no por reviewDecision.
"""
import json, os, subprocess, sys

ORG, REPO = "EspacioKoop", "espaciokooplagunak"
PROJECT_ID = os.environ.get("PROJECT_ID", "PVT_kwDOE14rr84Bidy2")
STATUS_FIELD = os.environ.get("STATUS_FIELD", "PVTSSF_lADOE14rr84Bidy2zhhVxrk")
OPCIONES = {
    "esperando": "0a9704ff", "vivos": "9082b6e6", "rojo": "285df48a",
    "conflictos": "32994f39", "decision": "dc7cb7c8", "hecho": "df0686ed",
}

def gql(query, **vars):
    cmd = ["gh", "api", "graphql", "-f", "query=" + query]
    for k, v in vars.items():
        cmd += ["-f", f"{k}={v}"]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode:
        raise SystemExit(f"graphql falló: {r.stderr[:400]}")
    d = json.loads(r.stdout)
    if "errors" in d:
        raise SystemExit(f"graphql errors: {d['errors']}")
    return d["data"]

Q = """
query($org:String!,$repo:String!,$cur:String){
 repository(owner:$org,name:$repo){
  pullRequests(states:OPEN,first:50,after:$cur){
   pageInfo{hasNextPage endCursor}
   nodes{ id number mergeStateStatus baseRefName headRefOid
     labels(first:20){nodes{name}}
     latestOpinionatedReviews(first:10){nodes{state commit{oid}}}
     commits(last:1){nodes{commit{statusCheckRollup{state}}}}
   }}}}
"""

def clasificar(pr):
    if pr["mergeStateStatus"] == "DIRTY":
        return "conflictos"
    rollup = (pr["commits"]["nodes"] or [{}])[0].get("commit", {}).get("statusCheckRollup")
    ci = (rollup or {}).get("state")
    revs = [r for r in pr["latestOpinionatedReviews"]["nodes"] if r["state"] == "CHANGES_REQUESTED"]
    # Una revisión fijada al HEAD actual es un bloqueo VIVO; si el HEAD ya
    # avanzó, lo que falta es re-revisión, no código.
    viva = any(r["commit"] and r["commit"]["oid"] == pr["headRefOid"] for r in revs)
    if viva:
        return "vivos"
    if ci == "FAILURE" or ci == "ERROR":
        return "rojo"
    if any(l["name"] == "decision" for l in pr["labels"]["nodes"]):
        return "decision"
    return "esperando"

def main():
    prs, cur = [], None
    while True:
        d = gql(Q, org=ORG, repo=REPO, **({"cur": cur} if cur else {}))
        page = d["repository"]["pullRequests"]
        prs += page["nodes"]
        if not page["pageInfo"]["hasNextPage"]:
            break
        cur = page["pageInfo"]["endCursor"]

    # items ya en el tablero
    existentes, cur = {}, None
    while True:
        d = gql("""query($id:ID!,$cur:String){node(id:$id){... on ProjectV2{
              items(first:100,after:$cur){pageInfo{hasNextPage endCursor}
              nodes{id content{... on PullRequest{id}}}}}}}""",
              id=PROJECT_ID, **({"cur": cur} if cur else {}))
        it = d["node"]["items"]
        for n in it["nodes"]:
            if n["content"] and n["content"].get("id"):
                existentes[n["content"]["id"]] = n["id"]
        if not it["pageInfo"]["hasNextPage"]:
            break
        cur = it["pageInfo"]["endCursor"]

    cuenta = {}
    for pr in prs:
        item = existentes.get(pr["id"])
        if not item:
            d = gql("""mutation($p:ID!,$c:ID!){addProjectV2ItemById(input:{projectId:$p,contentId:$c}){item{id}}}""",
                    p=PROJECT_ID, c=pr["id"])
            item = d["addProjectV2ItemById"]["item"]["id"]
        estado = clasificar(pr)
        cuenta[estado] = cuenta.get(estado, 0) + 1
        gql("""mutation($p:ID!,$i:ID!,$f:ID!,$o:String!){
                 updateProjectV2ItemFieldValue(input:{projectId:$p,itemId:$i,fieldId:$f,
                   value:{singleSelectOptionId:$o}}){projectV2Item{id}}}""",
            p=PROJECT_ID, i=item, f=STATUS_FIELD, o=OPCIONES[estado])
    print(f"{len(prs)} PRs abiertos:", dict(sorted(cuenta.items())))

if __name__ == "__main__":
    main()
