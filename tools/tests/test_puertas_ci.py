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


# Jobs que corren SIN filtro de rutas a propósito, con su motivo. La excepción
# se declara aquí y no se deduce: un job que se sale del filtro por descuido
# gasta runner en todos los PRs, y uno que entra en el filtro por descuido se
# salta justo donde hace falta. `tools.yml:restos` vigila basura que comete un
# PR de cualquier área —el caso de #818 tocaba `foundry-module/`, fuera de este
# filtro—, y es un script de stdlib de milisegundos.
SIN_FILTRO = {("tools.yml", "restos")}


@pytest.mark.parametrize("nombre", sorted(set(CON_PUERTA) - {"cicd.yml"}))
def test_los_jobs_filtrados_se_saltan_pero_reportan(nombre):
    """Todo job de área cuelga del filtro; si no, corre siempre y gasta runner."""
    datos, _ = cargar(nombre)
    for jid, trabajo in datos["jobs"].items():
        if jid in {"puerta", "changes"} or (nombre, jid) in SIN_FILTRO:
            continue
        assert "needs.changes.outputs.run" in str(trabajo.get("if", "")), (
            f"{nombre}:{jid} no consulta el filtro de rutas"
        )


# Cada auditoría de área y la ruta que la puede romper. Un filtro que no
# despierta la puerta en el PR que introduce el fallo es peor que no tener
# auditoría: deja el check en verde por SALTADO, que se lee igual que aprobado.
COBERTURA_DEL_FILTRO = [
    ("tools.yml", "scripts/locale/scenario_50_gaps.es.po",
     "paridad es-ES de los catálogos de escenario"),
    ("tools.yml", "scripts/scenario_90_lagunak_primera_guardia.lua",
     "claves de cabecera que declara el propio escenario"),
    ("tools.yml", "resources/locale/main.en.po",
     "cobertura i18n de las cadenas de C++"),
    ("tools.yml", "tools/validate_es_locale.py", "las propias herramientas"),
    ("tools.yml", "docs/BASELINE.md", "rutas citadas por la documentación"),
]


@pytest.mark.parametrize("nombre,ruta,motivo", COBERTURA_DEL_FILTRO)
def test_el_filtro_despierta_a_quien_puede_romper_la_puerta(nombre, ruta, motivo):
    """El fallo del 26-ago-2026, y por qué esta prueba existe.

    El filtro de `tools.yml` tenía `resources/locale/` (los catálogos del C++)
    pero no `scripts/locale/` (los de escenario). Los lotes de traducción tocan
    exactamente eso y nada más, así que entraron con el job SALTADO y dejaron
    `main` con tres catálogos descuadrados. La rotura no se vio hasta días
    después, en un PR de `tools/` que sí despertaba la puerta — y ahí parecía
    culpa suya.
    """
    import re

    datos, _ = cargar(nombre)
    filtro = None
    for job in datos["jobs"].values():
        for paso in job.get("steps", []):
            if "filtro-rutas" in str(paso.get("uses", "")):
                filtro = paso["with"]["rutas"]
    assert filtro, f"{nombre} no declara un filtro de rutas"
    assert re.match(filtro, ruta), (
        f"{nombre}: un cambio en `{ruta}` no despierta la puerta, y ahí vive "
        f"{motivo}. El check saldría SALTADO, que se lee igual que aprobado."
    )
def test_la_guarda_de_restos_no_depende_del_filtro():
    """La otra mitad de la excepción: que siga sin filtro (#818).

    `SIN_FILTRO` solo autoriza que este job se salte el filtro; sin esto, meterlo
    dentro del filtro después no rompería nada y la guarda volvería a salir
    SALTADA en los PRs de otras áreas, que es donde se comete la basura.
    """
    datos, _ = cargar("tools.yml")
    restos = datos["jobs"]["restos"]
    assert "if" not in restos, "la guarda de restos no puede condicionarse"
    assert "needs" not in restos, "colgarla de `changes` la salta por dependencia"
