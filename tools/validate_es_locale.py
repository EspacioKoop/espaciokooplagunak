#!/usr/bin/env python3
"""Independent QA for Spanish (Spain) PO coverage and format invariants.

Con `--base REF` cada error se marca como NUEVO (lo introduce esta rama) o
HEREDADO (ya estaba en la base). El código de salida no cambia —un catálogo
roto sigue siendo un fallo, lo haya roto quien lo haya roto—, pero la
distinción es lo que faltaba: el 26-ago-2026 los PRs #789 y #793 se fusionaron
con esta puerta en ROJO, y a partir de ahí el mismo rojo salía en #794, #796 y
#797, que no habían tocado nada de eso. Un rojo heredado y uno propio eran
indistinguibles, así que el rojo dejó de significar nada y se fusionó por
encima. Marcarlos aparte devuelve al revisor la pregunta que importa: ¿lo ha
roto ESTE cambio?
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
import tempfile
from collections import Counter
from pathlib import Path

import polib

PLACEHOLDER_RE = re.compile(
    r"(\{[^{}\n]+\}|%(?:\d+\$)?[-+#0]*\d*(?:\.\d+)?[diuoxXfFeEgGaAcspq%]|<[^<>\n]+>|__[^_\n]+__)"
)

# Palabras funcionales inglesas que no son palabras españolas: si aparecen en
# minúscula dentro de un msgstr es que la traducción es por sustitución de
# palabras (#813), no una traducción real. Van en minúscula y con límite de
# palabra a propósito: una traducción de verdad no las usa así, y un nombre
# propio capitalizado (Red Jacket, MP52 Hornet, Nautilus) nunca las toca.
RESIDUAL_ENGLISH_RE = re.compile(
    r"\b(the|and|of|with|will|spawned|whether)\b"
)

def residual_english(text: str) -> list[str]:
    # Los placeholders (`<...>` incluido) se dejan verbatim en inglés a
    # propósito en todo el catálogo (p. ej. "<Transmit 'The Itsy-Bitsy
    # Spider' on all wavelengths>"): no son texto traducible.
    sin_placeholders = PLACEHOLDER_RE.sub(" ", text)
    return sorted(set(RESIDUAL_ENGLISH_RE.findall(sin_placeholders)))


def placeholders(text: str) -> Counter[str]:
    return Counter(PLACEHOLDER_RE.findall(text))


def ending_newlines(text: str) -> int:
    return len(text) - len(text.rstrip("\n"))


def spanish_path(source: Path) -> Path:
    return source.with_name(source.name[:-6] + ".es.po")


def audit(root: Path) -> tuple[list[str], int, int, int]:
    sources = sorted(root.rglob("*.en.po"))
    errors: list[str] = []
    translated_entries = identical = 0
    for source in sources:
        target = spanish_path(source)
        rel = target.relative_to(root)
        if not target.exists():
            errors.append(f"missing: {rel}")
            continue
        src = polib.pofile(str(source), encoding="utf-8")
        dst = polib.pofile(str(target), encoding="utf-8")
        if dst.metadata.get("Language") != "es_ES":
            errors.append(f"bad language metadata: {rel}")
        src_map = {(e.msgctxt, e.msgid, e.msgid_plural): e for e in src if not e.obsolete}
        dst_map = {(e.msgctxt, e.msgid, e.msgid_plural): e for e in dst if not e.obsolete}
        if src_map.keys() != dst_map.keys():
            errors.append(f"key mismatch: {rel}: {len(src_map)} != {len(dst_map)}")
        for key, entry in dst_map.items():
            if key not in src_map:
                continue
            originals = [entry.msgid]
            format_originals = originals
            translations = [entry.msgstr]
            if entry.msgid_plural:
                originals = [entry.msgid, entry.msgid_plural]
                format_originals = [entry.msgid_plural, entry.msgid_plural]
                translations = [entry.msgstr_plural.get(0, ""), entry.msgstr_plural.get(1, "")]
            for original, format_original, translation in zip(originals, format_originals, translations):
                translated_entries += 1
                if translation == "" and original != "":
                    errors.append(f"empty: {rel}: {key!r}")
                    continue
                if original.isspace() and translation != original:
                    errors.append(f"whitespace-only changed: {rel}: {key!r}")
                if placeholders(format_original) != placeholders(translation):
                    errors.append(f"placeholder mismatch: {rel}: {format_original!r}")
                if ending_newlines(original) != ending_newlines(translation):
                    errors.append(f"trailing newline mismatch: {rel}: {original!r}")
                # Un msgstr idéntico al original no está traducido; ya lo
                # cuenta `identical` y es un problema aparte y mucho más
                # amplio (#821) que la sustitución de palabras que esto
                # persigue (#813) — no lo dupliques aquí.
                residuos = (
                    residual_english(translation)
                    if translation != original
                    else []
                )
                if residuos:
                    errors.append(f"residual english {residuos}: {rel}: {key!r}")
                if original == translation:
                    identical += 1
    return errors, len(sources), translated_entries, identical


def errores_en_la_base(base: str) -> set[str] | None:
    """Los errores que ya tenía la base, o `None` si no se pudo mirar.

    Se extrae el árbol de la base a un directorio temporal en vez de comparar
    ficheros sueltos porque la auditoría es del conjunto: un `.es.po` que
    desaparece solo se ve teniendo delante los dos árboles enteros.
    """
    if subprocess.run(["git", "rev-parse", "--verify", base],
                      capture_output=True).returncode != 0:
        return None
    with tempfile.TemporaryDirectory(prefix="validate-es-base-") as tmp:
        archivo = subprocess.run(["git", "archive", base], capture_output=True)
        if archivo.returncode != 0:
            return None
        desempaqueta = subprocess.run(["tar", "-x", "-C", tmp], input=archivo.stdout,
                                      capture_output=True)
        if desempaqueta.returncode != 0:
            return None
        return set(audit(Path(tmp))[0])


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("root", nargs="?", default=".")
    parser.add_argument("--base", help="marcar cada error como NUEVO o HEREDADO respecto a esta referencia")
    args = parser.parse_args()

    errors, sources, translated_entries, identical = audit(Path(args.root).resolve())

    heredados: set[str] = set()
    comparado = False
    if args.base:
        previos = errores_en_la_base(args.base)
        if previos is None:
            print(f"validate-es: no se pudo leer la base `{args.base}`; "
                  "los errores van sin clasificar", file=sys.stderr)
        else:
            heredados = previos
            comparado = True

    nuevos = [e for e in errors if e not in heredados]
    resumen = (f"sources={sources} translated_entries={translated_entries} "
               f"identical={identical} errors={len(errors)}")
    if comparado:
        resumen += f" nuevos={len(nuevos)} heredados={len(errors) - len(nuevos)}"
    print(resumen)

    if errors:
        for error in errors[:200]:
            etiqueta = ""
            if comparado:
                etiqueta = "NUEVO    " if error in nuevos else "HEREDADO "
            print(f"{etiqueta}{error}", file=sys.stderr)
        if len(errors) > 200:
            print(f"... {len(errors) - 200} more", file=sys.stderr)
        if comparado and not nuevos:
            print(
                f"\nvalidate-es: los {len(errors)} errores vienen ya de `{args.base}`; "
                "este cambio no ha roto ninguno. Sigue en rojo a propósito —un "
                "catálogo roto es un fallo aunque lo rompiera otro— pero arreglarlo "
                "no es trabajo de este PR.",
                file=sys.stderr,
            )
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
