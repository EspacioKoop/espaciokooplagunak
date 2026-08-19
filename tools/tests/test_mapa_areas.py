"""El mapa de áreas de `docs/TRABAJO_PARALELO_AGENTES.md` no se puede pudrir.

Ese mapa dice quién puede trabajar en paralelo con quién, y un mapa
desactualizado es peor que no tenerlo: dos agentes creen que están en áreas
distintas y editan el mismo archivo. Aquí se exigen las dos propiedades que lo
mantienen honesto:

1. **Toda ruta declarada existe.** Un patrón que no casa con nada es un área que
   describe código que ya no está.
2. **Ningún módulo de `foundry-module/scripts/` queda fuera de todas las áreas.**
   Un módulo sin área es un módulo que nadie sabe quién puede tocar, y aparece
   solo: se escribe un archivo nuevo y el mapa se queda como estaba.

No se exige lo contrario —que un módulo esté en UNA sola área—: hay piezas que
legítimamente pertenecen a dos (el museo es escena y es catálogo con
procedencia), y forzar una partición limpia obligaría a mentir sobre eso.
"""

from __future__ import annotations

import re
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
MAPA = REPO / "docs" / "TRABAJO_PARALELO_AGENTES.md"

INICIO = "<!-- MAPA_AREAS -->"
FIN = "<!-- /MAPA_AREAS -->"

# Áreas que no declaran rutas de código porque no las tienen.
SIN_RUTAS = {"Documentación"}

# Rutas que el mapa ya declara pero que todavía viven en un PR abierto.
#
# El mapa se actualiza EN EL PR QUE TRAE EL MÓDULO, que es la disciplina que este
# documento predica; pero un mapa escrito mientras hay trabajo en vuelo tiene que
# poder nombrarlo sin mentir. Esta lista es la excepción explícita, con su PR, y
# se limpia sola: si una de estas rutas ya existe, la prueba EXIGE retirarla de
# aquí — una excepción caducada es cómo una guarda se convierte en decoración.
# Vacía porque #606 y #609 ya aterrizaron: sus cuatro rutas están en el árbol y
# la prueba de abajo exigió retirarlas. La categoría vacía es su estado sano.
EN_VUELO: dict[str, str] = {}


def _tabla() -> list[tuple[str, list[str]]]:
    """Devuelve [(área, [patrones])] leyendo la tabla del documento."""
    texto = MAPA.read_text(encoding="utf-8")
    bloque = texto.split(INICIO, 1)[1].split(FIN, 1)[0]
    filas = []
    for linea in bloque.splitlines():
        linea = linea.strip()
        if not linea.startswith("|") or linea.startswith("|---") or linea.startswith("| Área"):
            continue
        celdas = [celda.strip() for celda in linea.strip("|").split("|")]
        if len(celdas) < 2:
            continue
        area = celdas[0]
        patrones = re.findall(r"`([^`]+)`", celdas[1])
        filas.append((area, patrones))
    return filas


class MapaDeAreas(unittest.TestCase):
    def test_el_documento_declara_su_tabla(self) -> None:
        self.assertTrue(MAPA.exists(), "falta docs/TRABAJO_PARALELO_AGENTES.md")
        filas = _tabla()
        self.assertGreaterEqual(len(filas), 8, "el mapa se ha quedado sin áreas")

    def test_toda_ruta_declarada_existe(self) -> None:
        for area, patrones in _tabla():
            if area in SIN_RUTAS:
                continue
            self.assertTrue(patrones, f"el área «{area}» no declara ninguna ruta")
            for patron in patrones:
                casan = list(REPO.glob(patron))
                if patron in EN_VUELO:
                    continue
                self.assertTrue(
                    casan,
                    f"el área «{area}» declara `{patron}`, que no casa con nada en el árbol",
                )

    def test_las_excepciones_en_vuelo_se_retiran_al_aterrizar(self) -> None:
        aterrizadas = sorted(patron for patron in EN_VUELO if list(REPO.glob(patron)))
        self.assertEqual(
            aterrizadas,
            [],
            "Estas rutas ya están en el árbol y siguen declaradas como en vuelo:\n"
            + "\n".join(f"  - {ruta} ({EN_VUELO[ruta]})" for ruta in aterrizadas)
            + "\n\nRetíralas de EN_VUELO en este archivo.",
        )

    def test_ningun_modulo_del_foundry_queda_sin_area(self) -> None:
        scripts = REPO / "foundry-module" / "scripts"
        modulos = {p.resolve() for p in scripts.rglob("*.mjs")}
        self.assertGreater(len(modulos), 50, "no se han encontrado los módulos: ¿ruta mal?")

        cubiertos: set[Path] = set()
        for area, patrones in _tabla():
            if area in SIN_RUTAS:
                continue
            for patron in patrones:
                cubiertos.update(p.resolve() for p in REPO.glob(patron) if p.suffix == ".mjs")
                # Un patrón de directorio (`.../**`) cubre lo que hay dentro.
                if patron.endswith("/**"):
                    base = REPO / patron[: -len("/**")]
                    if base.is_dir():
                        cubiertos.update(p.resolve() for p in base.rglob("*.mjs"))

        huerfanos = sorted(str(p.relative_to(REPO)) for p in modulos - cubiertos)
        self.assertEqual(
            huerfanos,
            [],
            "Estos módulos no pertenecen a ningún área del mapa:\n"
            + "\n".join(f"  - {ruta}" for ruta in huerfanos)
            + "\n\nAñádelos a un área en docs/TRABAJO_PARALELO_AGENTES.md: sin área, dos "
            "agentes no tienen forma de saber si pueden trabajar a la vez sobre ellos.",
        )


if __name__ == "__main__":
    unittest.main()
