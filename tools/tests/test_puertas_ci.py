"""Guardia de las puertas de CI (#361).

La puerta de un workflow es lo que se exige en la protección de `main`. Si se
rompe en silencio —alguien devuelve un `paths:` al disparador, o añade un job y
se olvida de meterlo en `needs`— la protección sigue diciendo verde mientras deja
de comprobar lo que creía comprobar. Eso es peor que no tener protección, porque
nadie mira una puerta que lleva meses en verde.

Estas comprobaciones son la parte EXIGIBLE de #361: sin ellas, la tabla de verdad
y la mudanza de los filtros son prosa en un comentario.
"""

from pathlib import Path

import pytest
import yaml

WORKFLOWS = Path(__file__).resolve().parents[2] / ".github" / "workflows"

# Workflows con puerta: los que aportan un check exigible. `codeql`, `semgrep`,
# `label` y `docker-publish` quedan fuera a propósito y por motivos distintos:
# los dos primeros ya publican un check propio que se dispara siempre, `label`
# es cosmético y `docker-publish` solo corre al publicar.
CON_PUERTA = {
    "cicd.yml": "Puerta de build C++/Lua",
    "foundry-module.yml": "Puerta del módulo Foundry",
    "tools.yml": "Puerta de tools",
    "docker.yml": "Puerta de docker y puente",
    "trivy.yml": "Puerta de imágenes",
}


def cargar(nombre):
    # PyYAML convierte la clave `on:` en el booleano True (YAML 1.1, «Norway
    # problem» al revés). Se lee tal cual y se busca la clave por las dos vías:
    # cambiar el workflow para esquivar un detalle del parser sería la cola
    # meneando al perro.
    datos = yaml.safe_load((WORKFLOWS / nombre).read_text(encoding="utf-8"))
    disparadores = datos.get("on", datos.get(True, {})) or {}
    return datos, disparadores


@pytest.mark.parametrize("nombre", sorted(CON_PUERTA))
def test_ningun_paths_en_pull_request(nombre):
    """El fallo original de #361, y el único que no se ve venir.

    Un `paths:` en el disparador no salta el workflow: hace que no exista, y un
    check requerido que no existe deja el PR en «Expected» para siempre.
    """
    _, disparadores = cargar(nombre)
    pr = disparadores.get("pull_request") or {}
    assert "paths" not in pr, (
        f"{nombre} filtra por rutas en el disparador: su check dejará de existir "
        "en los PRs de otras áreas y no se podrá exigir. El filtro va en un job."
    )


@pytest.mark.parametrize("nombre", sorted(CON_PUERTA))
def test_la_puerta_existe_y_corre_siempre(nombre):
    datos, _ = cargar(nombre)
    puerta = datos["jobs"].get("puerta")
    assert puerta is not None, f"{nombre} no tiene puerta"
    assert puerta["name"] == CON_PUERTA[nombre], (
        "El nombre de la puerta es el contexto que se exige en la protección de "
        "main: renombrarlo la desactiva sin que nada se ponga rojo."
    )
    # Sin `always()` la puerta se salta cuando se salta lo que vigila, y un check
    # requerido saltado por dependencia no reporta lo mismo que uno que ha
    # decidido pasar.
    assert str(puerta.get("if")).strip() == "always()"


@pytest.mark.parametrize("nombre", sorted(CON_PUERTA))
def test_la_puerta_vigila_todos_los_jobs(nombre):
    """Añadir un job y no meterlo en `needs` es el fallo silencioso.

    El job nuevo puede fallar sin que la puerta se entere, y la protección de
    `main` deja pasar el PR. Por eso se comprueba la cobertura completa y no que
    la lista «tenga cosas».
    """
    datos, _ = cargar(nombre)
    trabajos = set(datos["jobs"]) - {"puerta"}
    vigilados = set(datos["jobs"]["puerta"]["needs"])
    assert vigilados == trabajos, (
        f"{nombre}: la puerta no vigila {sorted(trabajos - vigilados)} "
        f"y vigila de más {sorted(vigilados - trabajos)}"
    )


@pytest.mark.parametrize("nombre", sorted(set(CON_PUERTA) - {"cicd.yml"}))
def test_los_jobs_filtrados_se_saltan_pero_reportan(nombre):
    """Todo job de área cuelga del filtro; si no, corre siempre y gasta runner."""
    datos, _ = cargar(nombre)
    for jid, trabajo in datos["jobs"].items():
        if jid in {"puerta", "changes"}:
            continue
        assert "needs.changes.outputs.run" in str(trabajo.get("if", "")), (
            f"{nombre}:{jid} no consulta el filtro de rutas"
        )
