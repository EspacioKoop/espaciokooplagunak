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
   nodes{ id number mergeStateStatus baseRefName headRefOid isDraft reviewDecision
     labels(first:20){nodes{name}}
     latestOpinionatedReviews(first:10){nodes{state commit{oid}}}
     commits(last:1){nodes{commit{statusCheckRollup{state}}}}
   }}}}
"""

# Items ya en el tablero: hace falta el estado de la PR para poder mover a
# «Hecho» las que salieron de la consulta anterior (states:OPEN) porque se
# fusionaron o cerraron -- si no, conservan para siempre su última columna.
Q_EXISTENTES = """
query($id:ID!,$cur:String){node(id:$id){... on ProjectV2{
      items(first:100,after:$cur){pageInfo{hasNextPage endCursor}
      nodes{id content{... on PullRequest{id state}}}}}}}
"""

def clasificar(pr):
    """Devuelve la clave de OPCIONES para `pr`, o None si no hay evidencia
    suficiente para asignar ninguna columna (y por tanto no se toca su estado
    actual en el tablero)."""
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
    # «Esperando revisión» significa, según la definición publicada del
    # tablero, "CI verde, sin conflictos: solo falta aprobar". CI PENDING,
    # ausencia de rollup o una PR ya aprobada no cumplen eso -- forzarlas
    # aquí convertiría la columna en un estado falso.
    if ci == "SUCCESS" and not pr["isDraft"] and pr["reviewDecision"] != "APPROVED":
        return "esperando"
    return None

def main():
    prs, cur = [], None
    while True:
        d = gql(Q, org=ORG, repo=REPO, **({"cur": cur} if cur else {}))
        page = d["repository"]["pullRequests"]
        prs += page["nodes"]
        if not page["pageInfo"]["hasNextPage"]:
            break
        cur = page["pageInfo"]["endCursor"]

    # items ya en el tablero, con el estado real de su PR (para detectar las
    # que se fusionaron/cerraron desde la última sincronización)
    existentes, cur = {}, None
    while True:
        d = gql(Q_EXISTENTES, id=PROJECT_ID, **({"cur": cur} if cur else {}))
        it = d["node"]["items"]
        for n in it["nodes"]:
            contenido = n["content"]
            if contenido and contenido.get("id"):
                existentes[contenido["id"]] = (n["id"], contenido.get("state"))
        if not it["pageInfo"]["hasNextPage"]:
            break
        cur = it["pageInfo"]["endCursor"]

    def fijar_estado(item_id, clave):
        gql("""mutation($p:ID!,$i:ID!,$f:ID!,$o:String!){
                 updateProjectV2ItemFieldValue(input:{projectId:$p,itemId:$i,fieldId:$f,
                   value:{singleSelectOptionId:$o}}){projectV2Item{id}}}""",
            p=PROJECT_ID, i=item_id, f=STATUS_FIELD, o=OPCIONES[clave])

    cuenta = {}
    abiertas_ids = {pr["id"] for pr in prs}
    for pr in prs:
        entrada = existentes.get(pr["id"])
        if entrada:
            item = entrada[0]
        else:
            d = gql("""mutation($p:ID!,$c:ID!){addProjectV2ItemById(input:{projectId:$p,contentId:$c}){item{id}}}""",
                    p=PROJECT_ID, c=pr["id"])
            item = d["addProjectV2ItemById"]["item"]["id"]
        estado = clasificar(pr)
        cuenta[estado] = cuenta.get(estado, 0) + 1
        if estado is not None:
            fijar_estado(item, estado)

    # PRs que ya estaban en el tablero pero desaparecieron de la consulta
    # OPEN: se fusionaron o cerraron. Sin esto «Hecho» era inalcanzable.
    hechas = 0
    for pr_id, (item_id, estado_pr) in existentes.items():
        if pr_id not in abiertas_ids and estado_pr in ("MERGED", "CLOSED"):
            fijar_estado(item_id, "hecho")
            hechas += 1
    cuenta["hecho"] = cuenta.get("hecho", 0) + hechas

    print(f"{len(prs)} PRs abiertos, {hechas} movidas a hecho:", dict(sorted((k, v) for k, v in cuenta.items() if k is not None)))

if __name__ == "__main__":
    main()
