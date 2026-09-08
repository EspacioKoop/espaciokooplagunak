#!/usr/bin/env python3
"""Un catálogo `.po` puede crecer y puede corregirse, pero no puede encoger.

POR QUÉ EXISTE. `check_scenario_header_locale.py` comprueba que estén las
claves de la CABECERA del escenario, que son unas pocas decenas. No mira las
otras cientos —diálogo de estaciones, avisos, respuestas de comunicaciones— y
por tanto **su criterio se puede cumplir borrándolas**: se reescribe el fichero
con solo lo que la cabecera pide, el `STALE` desaparece y el escenario se queda
mudo en ese idioma.

No es hipotético. El 26-ago-2026, tres entregas seguidas del mismo reparto lo
hicieron sin que nada fallara:

  scenario_56_carrierTurret.en.po   363 claves ->  67   (296 perdidas)
  scenario_74_omicron.en.po         660 claves ->  66   (594 perdidas)

La primera además seguía sin cumplir el criterio: destruía 296 claves y dejaba
el mismo `missing=67` de antes. El fallo es fácil de cometer y muy difícil de
ver en revisión, porque el diff de un `.po` reescrito parece reflujo de líneas
largas: `+124 −1939` no dice «he borrado el diálogo del escenario».

QUÉ COMPRUEBA. Para cada `.po` que el commit toca, que el conjunto de claves
`(msgctxt, msgid)` de la rama **contiene** el de la base. Añadir está bien;
quitar falla y nombra las claves perdidas.

QUÉ NO COMPRUEBA, a propósito: el contenido de las traducciones. Que un `msgstr`
esté vacío, sea flojo o esté mal es trabajo de revisión humana (#28); esto solo
impide la pérdida silenciosa.

RETIRAR UNA CLAVE SIGUE SIENDO POSIBLE. Cuando el `.lua` deja de usar un texto,
su clave sobra de verdad. Entonces esta guarda salta y hay que decir por qué en
el PR — que es exactamente lo que se quiere: que borrar sea una decisión escrita
y no un efecto colateral.

Uso:
    check_po_no_pierde_claves.py [--base origin/main] [ruta...]

Sale por 0 si ningún catálogo encoge, por 1 si alguno lo hace, y por 2 si no
puede comprobarlo (sin git, sin base, sin polib) — un guardián que no puede
mirar no dice que todo está bien.
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

try:
    import polib
except ImportError:  # pragma: no cover - lo instala la CI
    print("check-po: falta polib (pip install polib==1.2.0)", file=sys.stderr)
    raise SystemExit(2)


def git(*args: str) -> tuple[int, str]:
    proceso = subprocess.run(["git", *args], capture_output=True, text=True)
    return proceso.returncode, proceso.stdout


def catalogos_tocados(base: str, rutas: list[str]) -> list[str]:
    """Los `.po` que difieren de la base, incluidos los que desaparecen.

    Va con `--name-status --no-renames` a propósito. Con la detección de renames
    activada —el defecto— mover `scenario_33_early.en.po` a otro nombre sale como
    una sola `R` con la ruta nueva, la antigua no aparece por ninguna parte, y el
    catálogo esperado se esfumaba mostrando solo `nuevo …`. Es la vía de escape
    que encontró la revisión: la guarda decía «ok» mientras un escenario se
    quedaba sin su catálogo. Sin detección de renames, lo mismo llega como `D` de
    la ruta vieja más `A` de la nueva, y la `D` falla como debe.
    """
    codigo, salida = git("diff", "--name-status", "--no-renames", f"{base}...HEAD")
    if codigo != 0:
        # Sin merge-base utilizable (checkout superficial), se compara directo.
        codigo, salida = git("diff", "--name-status", "--no-renames", base)
    if codigo != 0:
        print(f"check-po: no se pudo comparar con `{base}`", file=sys.stderr)
        raise SystemExit(2)
    tocados = []
    for linea in salida.splitlines():
        partes = linea.split("\t")
        if len(partes) < 2:
            continue
        ruta = partes[-1]
        if ruta.endswith(".po"):
            tocados.append(ruta)
    if rutas:
        pedidos = {str(Path(r)) for r in rutas}
        tocados = [t for t in tocados if t in pedidos]
    return tocados


def claves(texto: str) -> set[tuple[str | None, str]]:
    catalogo = polib.pofile(texto)
    return {(entrada.msgctxt, entrada.msgid) for entrada in catalogo if not entrada.obsolete}


def claves_en_base(base: str, ruta: str) -> set[tuple[str | None, str]] | None:
    """`None` cuando el fichero no existe en la base: es nuevo y no puede encoger."""
    codigo, contenido = git("show", f"{base}:{ruta}")
    if codigo != 0:
        return None
    return claves(contenido)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", default="origin/main", help="referencia con la que comparar")
    parser.add_argument("rutas", nargs="*", help="limitar a estos .po (por defecto, los tocados)")
    args = parser.parse_args()

    if git("rev-parse", "--verify", args.base)[0] != 0:
        print(f"check-po: la base `{args.base}` no existe en este checkout", file=sys.stderr)
        return 2

    tocados = catalogos_tocados(args.base, args.rutas)
    if not tocados:
        print("check-po: ningún catálogo .po tocado")
        return 0

    fallos = 0
    for ruta in tocados:
        antes = claves_en_base(args.base, ruta)
        if antes is None:
            print(f"  nuevo    {ruta}")
            continue
        if not Path(ruta).exists():
            print(f"✗ BORRADO  {ruta}: el catálogo entero desaparece")
            fallos += 1
            continue
        ahora = claves(Path(ruta).read_text(encoding="utf-8"))
        perdidas = antes - ahora
        if not perdidas:
            print(f"  ok       {ruta}: {len(antes)} → {len(ahora)} (+{len(ahora - antes)})")
            continue
        fallos += 1
        print(f"✗ PIERDE   {ruta}: {len(antes)} → {len(ahora)}, {len(perdidas)} claves perdidas")
        for contexto, texto in sorted(perdidas, key=lambda k: (k[0] or "", k[1]))[:5]:
            etiqueta = f"[{contexto}] " if contexto else ""
            recorte = texto if len(texto) <= 70 else texto[:67] + "…"
            print(f"      {etiqueta}{recorte!r}")
        if len(perdidas) > 5:
            print(f"      … y {len(perdidas) - 5} más")

    if fallos:
        print(
            "\ncheck-po: un catálogo que encoge deja el escenario mudo en ese idioma, y el "
            "diff de un .po reescrito no lo delata. Si la clave sobra de verdad porque el "
            ".lua ya no usa ese texto, dilo en el PR.",
            file=sys.stderr,
        )
    return 1 if fallos else 0


if __name__ == "__main__":
    raise SystemExit(main())
