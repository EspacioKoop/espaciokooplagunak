#!/usr/bin/env python3
"""Generate and validate Spanish (Spain) PO catalogs from English templates.

This is a maintainer tool for creating a machine-assisted first pass. Its output
must receive linguistic review before being called final. Translation models are
local and are never committed to the repository.
"""

from __future__ import annotations

import argparse
import re
import sys
from collections import Counter
from pathlib import Path

import ctranslate2
import polib
import sentencepiece as spm


PLACEHOLDER_RE = re.compile(
    r"(\{[^{}\n]+\}|%(?:\d+\$)?[-+#0]*\d*(?:\.\d+)?[diuoxXfFeEgGaAcspq%]|<[^<>\n]+>|__[^_\n]+__)"
)
SENTENCE_SPLIT_RE = re.compile(r"(\n+|(?<=[.!?])\s+)")

# Stable terminology for controls and ship systems. Context-specific exceptions
# can be added by (msgctxt, msgid) in CONTEXT_OVERRIDES.
EXACT_OVERRIDES: dict[str, str] = {
    "Front": "Frontal",
    "Rear": "Popa",
    "Left": "Izquierda",
    "Right": "Derecha",
    "Back": "Volver",
    "Close": "Cerrar",
    "Quit": "Salir",
    "Ok": "Aceptar",
    "OK": "Aceptar",
    "Save": "Guardar",
    "Enabled": "Activado",
    "Disabled": "Desactivado",
    "Yes": "Sí",
    "No": "No",
    "Neutral": "Neutral",
    "Enemy": "Enemigo",
    "Friendly": "Aliado",
    "Factions": "Facciones",
    "Ships": "Naves",
    "Stations": "Estaciones",
    "Class": "Clase",
    "Sub-class": "Subclase",
    "Size": "Tamaño",
    "Shield": "Escudo",
    "Shields": "Escudos",
    "Hull": "Casco",
    "Move speed": "Velocidad de avance",
    "Reverse move speed": "Velocidad de retroceso",
    "Turn speed": "Velocidad de giro",
    "Warp speed": "Velocidad de curvatura",
    "Jump range": "Alcance de salto",
    "Helms": "Timón",
    "Weapons": "Armas",
    "Engineering": "Ingeniería",
    "Science": "Ciencia",
    "Relay": "Comunicaciones",
    "Operations": "Operaciones",
    "Tactical": "Táctica",
    "Single Pilot": "Piloto único",
    "Main screen": "Pantalla principal",
    "Game master": "Director de juego",
    "Control options": "Opciones de control",
    "Interface options": "Opciones de interfaz",
    "Graphics options": "Opciones gráficas",
    "Audio options": "Opciones de audio",
    "Interface language": "Idioma de la interfaz",
    "Interface theme": "Tema de la interfaz",
    "Click Back to apply change": "Pulsa Volver para aplicar el cambio",
    "Configure keyboard/joystick": "Configurar teclado/mando",
    "Radar": "Radar",
    "Database": "Base de datos",
    "Scanning": "Escaneo",
    "Scan": "Escanear",
    "Docking": "Atraque",
    "Dock": "Atracar",
    "Undock": "Desatracar",
    "Impulse": "Impulso",
    "Warp": "Curvatura",
    "Jump": "Salto",
    "Energy": "Energía",
    "Coolant": "Refrigerante",
    "Repair": "Reparar",
    "System": "Sistema",
    "Systems": "Sistemas",
    "Missile": "Misil",
    "Missiles": "Misiles",
    "Mine": "Mina",
    "Mines": "Minas",
    "Player": "Jugador",
    "Players": "Jugadores",
    "Server": "Servidor",
    "Scenario": "Escenario",
    "Tutorial": "Tutorial",
    "Basic Battle": "Batalla básica",
    "Beacon of Light series": "Serie «Faro de luz»",
    "Birth of the Atlantis": "Nacimiento de la Atlantis",
    "Liberation Day": "Día de la liberación",
    "Surf's Up!": "¡A surfear!",
    "Push The Payload": "Empuja la carga",
    "Planet Devourer": "Devorador de planetas",
    "Cadet Patrol": "Patrulla de cadetes",
    "Locust Swarm": "Enjambre de langostas",
    "Scurvy Scavenger": "Carroñero escorbútico",
    "Unwanted Visitors": "Visitantes no deseados",
    "Close the Gaps": "Cierra las brechas",
    "Escape": "Fuga",
    "Delta quadrant patrol duty": "Patrulla del cuadrante Delta",
    "Defender Hunter": "Defensa y caza",
    "Carrier and Fighters": "Portanaves y cazas",
    "Shoreline": "Línea de defensa",
    "Borderline Fever": "Fiebre fronteriza",
    "Capture the Flag": "Captura la bandera",
    "The Omicron Plague": "La plaga Ómicron",
    "Clash in Shangri-La (PVP)": "Choque en Shangri-La (JcJ)",
    "Chaos of War": "Caos de guerra",
    "Battlefield": "Campo de batalla",
    "Warp Drive": "Motor de curvatura",
    "Beam Weapons": "Armas de haz",
    "Beams": "Haces",
    "Beam info": "Información de haces",
    "Beam/shield frequencies": "Frecuencias de haces y escudos",
    "Hailed by {name}": "Llamada entrante de {name}",
    "Channel not open, enter name to hail as to hail target.": "El canal está cerrado; introduce el nombre con el que quieres contactar al objetivo.",
}
CONTEXT_OVERRIDES: dict[tuple[str | None, str], str] = {
    ("scenario-category", "Replayable Mission"): "Misión rejugable",
    ("scenario-category", "Mission"): "Misión",
    ("scenario-category", "Basic"): "Básico",
    ("scenario-category", "PvP"): "JcJ",
    ("scenario-category", "Development"): "Desarrollo",
    ("scenario-category", "Race"): "Carrera",
    ("setting", "Time"): "Tiempo",
    ("setting", "PlayerShip"): "Nave del jugador",
    ("Enemies", "Empty"): "Sin enemigos",
    ("Enemies", "Hard"): "Difícil",
    ("Time", "Unlimited"): "Sin límite",
    ("systems", "HACKED"): "HACKEADO",
    # Issue #28: reviewed UI actions and technical terminology.
    ("hotkey_Cinematic", "Strafe left"): "Desplazarse lateralmente a la izquierda",
    ("hotkey_Cinematic", "Strafe right"): "Desplazarse lateralmente a la derecha",
    ("hotkey_Helms", "Combat boost left"): "Impulso de combate a la izquierda",
    ("hotkey_Helms", "Combat boost right"): "Impulso de combate a la derecha",
    ("hotkey_Weapons", "Select homing"): "Seleccionar misil guiado",
    ("hotkey_Weapons", "Select mine"): "Seleccionar mina",
    ("hotkey_Weapons", "Load tube {number}"): "Cargar tubo {number}",
    ("hotkey_Weapons", "Unload tube {number}"): "Descargar tubo {number}",
    ("hotkey_Weapons", "Fire tube {number}"): "Disparar tubo {number}",
    ("hotkey_Weapons", "Toggle shields"): "Alternar escudos",
    ("missile", "Homing"): "Guiado",
    (None, "Unpause"): "Reanudar",
    ("mainscreen", "Back"): "Trasera",
    (None, "Open comms"): "Abrir comunicaciones",
    (None, "Open Comms"): "Abrir comunicaciones",
    (None, "Waiting for authorization input: {codes} left"): "Esperando códigos de autorización: quedan {codes}",
    ("button", "Cycle through ships"): "Recorrer las naves",
    ("slider", "Power"): "Potencia",
    ("slider", "Power: {current_level}% / {requested}%"): "Potencia: {current_level}% / {requested}%",
    ("science", "Bearing"): "Demora",
    ("button", "Power"): "Potencia",
    ("button", "Hail ship"): "Contactar con la nave",
    ("hotkey_General", "Return to ship options menu"): "Volver al menú de opciones de la nave",
    ("hotkey_General", "Broadcast voice chat to ship"): "Transmitir el chat de voz a la nave",
    (None, "Waiting for ship on "): "Esperando a la nave en ",
    ("chatGM", "{callsign} - Hailing as {target}"): "{callsign} - Contactando como {target}",
    ("tweak-text", "Auto repair rate:"): "Tasa de autorreparación:",
    ("tweak-text", "Charge available:"): "Carga disponible:",
    ("tweak-text", "Homing capacity:"): "Capacidad de misiles guiados:",
    ("tweak-text", "Allow homing:"): "Permitir misiles guiados:",
    ("tweak-text", "Allow mine:"): "Permitir minas:",
    ("shiplog", "Hailing: {name}"): "Contactando con {name}",
    ("shiplog", "Hail suddenly went dead."): "La llamada se interrumpió de repente.",
    ("shiplog", "Accepted hail from {callsign}"): "Llamada de {callsign} aceptada",
    ("shiplog", "Refused hail from {callsign}"): "Llamada de {callsign} rechazada",
    ("shiplog", "Refused hail from {name}"): "Llamada de {name} rechazada",
    ("shiplog", "Hailing from {callsign} stopped"): "La llamada de {callsign} se ha interrumpido",
    ("database direction", "Rear"): "Trasera",
    ("database direction", "Front"): "Frontal",
    ("station", "Helms"): "Timón",
    ("station", "Weapons"): "Armas",
    ("station", "Engineering"): "Ingeniería",
    ("station", "Science"): "Ciencia",
    ("time-incCall", "%s, you have one minute remaining."): "%s, te queda %d minuto.",
    ("time-incCall", "%s, you have %d minutes remaining."): "%s, te quedan %d minutos.",
    ("upgrade-comms", "Provide %s for 25 percent energy capacity upgrade"): "Entrega %s para mejorar un 25 por ciento la capacidad de energía",
}


def protect(text: str) -> tuple[str, dict[str, str]]:
    mapping: dict[str, str] = {}

    def repl(match: re.Match[str]) -> str:
        token = f"ZXQPH{len(mapping)}QXZ"
        mapping[token] = match.group(0)
        return token

    return PLACEHOLDER_RE.sub(repl, text), mapping


def restore(text: str, mapping: dict[str, str]) -> str:
    for token, original in mapping.items():
        text = text.replace(token, original)
    missing = [token for token in mapping if token in text]
    if missing:
        raise ValueError(f"unrestored placeholders: {missing}")
    return text


def chunks(text: str, max_chars: int = 420) -> list[str]:
    if len(text) <= max_chars:
        return [text]
    parts = SENTENCE_SPLIT_RE.split(text)
    out: list[str] = []
    current = ""
    for part in parts:
        if current and len(current) + len(part) > max_chars:
            out.append(current)
            current = part
        else:
            current += part
    if current:
        out.append(current)
    return out


def translatable_pieces(text: str) -> list[str]:
    """Split text while keeping formatting placeholders out of the model."""
    result: list[str] = []
    for segment in PLACEHOLDER_RE.split(text):
        if not segment:
            continue
        if PLACEHOLDER_RE.fullmatch(segment):
            result.append(segment)
        else:
            result.extend(chunks(segment))
    return result


class LocalTranslator:
    def __init__(self, model_dir: Path):
        self.sp = spm.SentencePieceProcessor(model_file=str(model_dir / "sentencepiece.model"))  # type: ignore[call-arg]
        self.engine = ctranslate2.Translator(str(model_dir / "model"), device="cpu", compute_type="int8")
        self.cache: dict[str, str] = {}

    @staticmethod
    def piece_parts(text: str) -> tuple[str, str, str]:
        whitespace = re.fullmatch(r"(\s*)(.*?)(\s*)", text, flags=re.DOTALL)
        assert whitespace is not None
        return whitespace.group(1), whitespace.group(2), whitespace.group(3)

    def preload(self, texts: list[str], batch_size: int = 64) -> None:
        pending: list[str] = []
        seen: set[str] = set()
        for text in texts:
            if text in EXACT_OVERRIDES:
                continue
            for piece in translatable_pieces(text):
                if PLACEHOLDER_RE.fullmatch(piece):
                    continue
                if not piece.strip() or piece in self.cache or piece in seen:
                    continue
                _, core, _ = self.piece_parts(piece)
                if not core or core in EXACT_OVERRIDES:
                    continue
                seen.add(piece)
                pending.append(piece)
        print(f"preloading {len(pending)} unique translation chunks", flush=True)
        for start in range(0, len(pending), batch_size):
            batch = pending[start:start + batch_size]
            encoded: list[list[str]] = []
            prepared: list[tuple[str, str, dict[str, str]]] = []
            for piece in batch:
                prefix, core, suffix = self.piece_parts(piece)
                encoded.append(self.sp.encode(core, out_type=str))  # type: ignore[attr-defined]
                prepared.append((prefix, suffix, {}))
            results = self.engine.translate_batch(encoded, beam_size=2)
            for piece, result, (prefix, suffix, mapping) in zip(batch, results, prepared):
                decoded = self.sp.decode(result.hypotheses[0])  # type: ignore[attr-defined]
                self.cache[piece] = prefix + restore(decoded, mapping) + suffix
            print(f"translated chunks {min(start + batch_size, len(pending))}/{len(pending)}", flush=True)

    def translate_piece(self, text: str) -> str:
        if not text.strip():
            return text
        whitespace = re.fullmatch(r"(\s*)(.*?)(\s*)", text, flags=re.DOTALL)
        assert whitespace is not None
        prefix, core, suffix = whitespace.groups()
        if not core:
            return text
        if core in EXACT_OVERRIDES:
            return prefix + EXACT_OVERRIDES[core] + suffix
        if text in self.cache:
            return self.cache[text]
        tokens = self.sp.encode(core, out_type=str)  # type: ignore[attr-defined]
        result = self.engine.translate_batch([tokens], beam_size=3)[0].hypotheses[0]
        translated = prefix + self.sp.decode(result) + suffix  # type: ignore[attr-defined]
        self.cache[text] = translated
        return translated

    def translate(self, text: str, context: str | None = None) -> str:
        override = CONTEXT_OVERRIDES.get((context, text))
        if override is not None:
            return override
        if text in EXACT_OVERRIDES:
            return EXACT_OVERRIDES[text]
        return "".join(
            piece if PLACEHOLDER_RE.fullmatch(piece) else self.translate_piece(piece)
            for piece in translatable_pieces(text)
        )


class GoogleBatchTranslator:
    """Higher-quality online pass for public game strings, batched per request."""

    separator = "\n<<<9876543210123456789>>>\n"

    def __init__(self):
        from deep_translator import GoogleTranslator

        self.engine = GoogleTranslator(source="en", target="es")
        self.cache: dict[str, str] = {}

    @staticmethod
    def piece_parts(text: str) -> tuple[str, str, str]:
        whitespace = re.fullmatch(r"(\s*)(.*?)(\s*)", text, flags=re.DOTALL)
        assert whitespace is not None
        return whitespace.group(1), whitespace.group(2), whitespace.group(3)

    def preload(self, texts: list[str], max_chars: int = 3800) -> None:
        pending: list[str] = []
        seen: set[str] = set()
        for text in texts:
            if text in EXACT_OVERRIDES:
                continue
            for piece in translatable_pieces(text):
                if PLACEHOLDER_RE.fullmatch(piece) or not piece.strip() or piece in seen:
                    continue
                _, core, _ = self.piece_parts(piece)
                if core and core not in EXACT_OVERRIDES:
                    seen.add(piece)
                    pending.append(piece)
        groups: list[list[str]] = []
        group: list[str] = []
        size = 0
        for piece in pending:
            _, core, _ = self.piece_parts(piece)
            extra = len(core) + (len(self.separator) if group else 0)
            if group and size + extra > max_chars:
                groups.append(group)
                group, size = [], 0
            group.append(piece)
            size += extra
        if group:
            groups.append(group)
        print(f"preloading {len(pending)} chunks in {len(groups)} Google batches", flush=True)
        for index, batch in enumerate(groups, 1):
            cores = [self.piece_parts(piece)[1] for piece in batch]
            translated = self.engine.translate(self.separator.join(cores))
            outputs = translated.split("<<<9876543210123456789>>>")
            if len(outputs) != len(batch):
                raise RuntimeError(f"Google batch cardinality mismatch: {len(batch)} != {len(outputs)}")
            for piece, output in zip(batch, outputs):
                prefix, _, suffix = self.piece_parts(piece)
                self.cache[piece] = prefix + output.strip() + suffix
            print(f"translated Google batches {index}/{len(groups)}", flush=True)

    def translate_piece(self, text: str) -> str:
        if not text.strip():
            return text
        prefix, core, suffix = self.piece_parts(text)
        if core in EXACT_OVERRIDES:
            return prefix + EXACT_OVERRIDES[core] + suffix
        if text not in self.cache:
            self.cache[text] = prefix + self.engine.translate(core).strip() + suffix
        return self.cache[text]

    def translate(self, text: str, context: str | None = None) -> str:
        override = CONTEXT_OVERRIDES.get((context, text))
        if override is not None:
            return override
        if text in EXACT_OVERRIDES:
            return EXACT_OVERRIDES[text]
        return "".join(
            piece if PLACEHOLDER_RE.fullmatch(piece) else self.translate_piece(piece)
            for piece in translatable_pieces(text)
        )


def spanish_path(source: Path) -> Path:
    if not source.name.endswith(".en.po"):
        raise ValueError(source)
    return source.with_name(source.name[:-6] + ".es.po")


def set_metadata(po: polib.POFile) -> None:
    po.metadata = {
        "Project-Id-Version": "Espaciokoop Lagunak / EmptyEpsilon",
        "Language": "es_ES",
        "Language-Team": "Espaciokoop Lagunak",
        "PO-Revision-Date": "2026-07-12 00:00+0200",
        "Last-Translator": "Espaciokoop Lagunak contributors",
        "Report-Msgid-Bugs-To": "https://github.com/VaroTv7/espaciokooplagunak/issues",
        "MIME-Version": "1.0",
        "Content-Type": "text/plain; charset=UTF-8",
        "Content-Transfer-Encoding": "8bit",
        "Plural-Forms": "nplurals=2; plural=(n != 1);",
        "X-Generator": "tools/i18n_es.py (machine-assisted; human review required)",
    }


def generate(source: Path, translator: LocalTranslator | GoogleBatchTranslator, overwrite: bool) -> tuple[int, int]:
    target = spanish_path(source)
    if target.exists() and not overwrite:
        return 0, 1
    po = polib.pofile(str(source), encoding="utf-8", wrapwidth=0)
    set_metadata(po)
    translated = 0
    for entry in po:
        if entry.obsolete:
            continue
        entry.msgstr = ""
        entry.msgstr_plural = {}
        if entry.msgid_plural:
            entry.msgstr_plural[0] = translator.translate(entry.msgid, entry.msgctxt)
            entry.msgstr_plural[1] = translator.translate(entry.msgid_plural, entry.msgctxt)
            translated += 2
        elif entry.msgid:
            entry.msgstr = translator.translate(entry.msgid, entry.msgctxt)
            translated += 1
    target.parent.mkdir(parents=True, exist_ok=True)
    po.save(str(target))
    return translated, 0


def placeholder_counter(text: str) -> Counter[str]:
    return Counter(PLACEHOLDER_RE.findall(text))


def validate_pair(source: Path, target: Path) -> list[str]:
    errors: list[str] = []
    src = polib.pofile(str(source), encoding="utf-8")
    dst = polib.pofile(str(target), encoding="utf-8")
    src_map = {(e.msgctxt, e.msgid, e.msgid_plural): e for e in src if not e.obsolete}
    dst_map = {(e.msgctxt, e.msgid, e.msgid_plural): e for e in dst if not e.obsolete}
    if src_map.keys() != dst_map.keys():
        errors.append(f"catalog keys differ: source={len(src_map)} target={len(dst_map)}")
    for key, entry in dst_map.items():
        source_entry = src_map.get(key)
        if source_entry is None:
            continue
        translations = list(entry.msgstr_plural.values()) if entry.msgid_plural else [entry.msgstr]
        originals = [entry.msgid, entry.msgid_plural] if entry.msgid_plural else [entry.msgid]
        format_originals = [entry.msgid_plural, entry.msgid_plural] if entry.msgid_plural else originals
        if not translations:
            errors.append(f"empty translation set: {key!r}")
            continue
        for original, format_original, translated in zip(originals, format_originals, translations):
            if not translated and original:
                errors.append(f"empty translation: {key!r}")
                continue
            if original.isspace() and translated != original:
                errors.append(f"whitespace-only translation changed: {key!r}")
            if placeholder_counter(format_original) != placeholder_counter(translated):
                errors.append(f"placeholder mismatch: {format_original!r} -> {translated!r}")
    if dst.metadata.get("Language") != "es_ES":
        errors.append("metadata Language is not es_ES")
    return errors


def source_catalogs(root: Path, only: str | None) -> list[Path]:
    catalogs = sorted(root.rglob("*.en.po"))
    if only:
        catalogs = [p for p in catalogs if only in str(p.relative_to(root))]
    return catalogs


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path.cwd())
    parser.add_argument("--provider", choices=("argos", "google"), default="argos")
    parser.add_argument("--model", type=Path, help="Argos CTranslate2 model directory")
    parser.add_argument("--only", help="substring filter for source catalog path")
    parser.add_argument("--overwrite", action="store_true")
    parser.add_argument("--validate-only", action="store_true")
    args = parser.parse_args()
    root = args.root.resolve()
    catalogs = source_catalogs(root, args.only)
    if not catalogs:
        parser.error("no English catalogs found")

    translator: LocalTranslator | GoogleBatchTranslator | None
    if args.validate_only:
        translator = None
    elif args.provider == "google":
        translator = GoogleBatchTranslator()
    else:
        if args.model is None:
            parser.error("--model is required with --provider argos")
        translator = LocalTranslator(args.model)
    if translator is not None:
        source_texts: list[str] = []
        for source in catalogs:
            po = polib.pofile(str(source), encoding="utf-8")
            for entry in po:
                if entry.obsolete:
                    continue
                if entry.msgid:
                    source_texts.append(entry.msgid)
                if entry.msgid_plural:
                    source_texts.append(entry.msgid_plural)
        translator.preload(source_texts)
    total = skipped = 0
    failures: list[str] = []
    for index, source in enumerate(catalogs, 1):
        target = spanish_path(source)
        if translator is not None:
            count, was_skipped = generate(source, translator, args.overwrite)
            total += count
            skipped += was_skipped
            print(f"[{index}/{len(catalogs)}] {target.relative_to(root)}: {count or 'skipped'}", flush=True)
        if not target.exists():
            failures.append(f"missing target: {target.relative_to(root)}")
            continue
        failures.extend(f"{target.relative_to(root)}: {error}" for error in validate_pair(source, target))

    print(f"catalogs={len(catalogs)} translated_entries={total} skipped={skipped} errors={len(failures)}")
    if failures:
        print("\n".join(failures[:200]), file=sys.stderr)
        if len(failures) > 200:
            print(f"... {len(failures) - 200} more", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
