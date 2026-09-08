#!/usr/bin/env python3
"""Ejecuta una suite y publica un resultado estructurado y auditable.

La salida normal del proceso hijo se conserva en stderr para que stdout contenga
exclusivamente el JSON del resultado. No envía telemetría ni conserva archivos.

Uso:
    python3 tools/monitor_test_suite.py --timeout 60 -- python3 -m pytest tools/tests
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import signal
import subprocess
import sys
import tempfile
import time
from typing import IO, Sequence, TypedDict

ESTADOS = frozenset({"passed", "failed", "timeout", "signaled"})


class ResultadoSuite(TypedDict):
    schema_version: int
    status: str
    command: list[str]
    started_at: str
    finished_at: str
    duration_ms: float
    exit_code: int | None
    signal: int | None
    timed_out: bool


def _iso_utc(instante: dt.datetime) -> str:
    return instante.astimezone(dt.timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def _terminar(proceso: subprocess.Popen[bytes], gracia: float) -> None:
    """Termina el grupo en POSIX y el proceso en el resto, escalando a kill."""
    if proceso.poll() is not None:
        return
    try:
        if os.name == "posix":
            os.killpg(proceso.pid, signal.SIGTERM)
        else:
            proceso.terminate()
        proceso.wait(timeout=gracia)
        return
    except (ProcessLookupError, subprocess.TimeoutExpired):
        pass

    try:
        if os.name == "posix":
            os.killpg(proceso.pid, signal.SIGKILL)
        else:
            proceso.kill()
    except ProcessLookupError:
        return
    proceso.wait()


def _copiar(origen: IO[bytes], destino: IO[bytes]) -> None:
    origen.seek(0)
    while bloque := origen.read(64 * 1024):
        destino.write(bloque)
    destino.flush()


def ejecutar_suite(
    comando: Sequence[str],
    *,
    timeout: float | None = None,
    gracia: float = 1.0,
    salida_hija: IO[bytes] | None = None,
) -> ResultadoSuite:
    """Ejecuta ``comando`` y devuelve duración, estado y terminación.

    El reloj monotónico mide la duración. Los timestamps UTC son informativos.
    ``salida_hija`` recibe stdout y stderr después de terminar; por defecto se
    usan los stderr binarios del proceso monitor.
    """
    if not comando:
        raise ValueError("falta el comando de la suite")
    if timeout is not None and timeout <= 0:
        raise ValueError("timeout debe ser mayor que cero")
    if gracia < 0:
        raise ValueError("gracia no puede ser negativa")

    inicio_pared = dt.datetime.now(dt.timezone.utc)
    inicio_mono = time.monotonic_ns()
    agotado = False

    with tempfile.SpooledTemporaryFile(max_size=1024 * 1024) as stdout_tmp, tempfile.SpooledTemporaryFile(
        max_size=1024 * 1024
    ) as stderr_tmp:
        proceso = subprocess.Popen(
            list(comando),
            stdin=subprocess.DEVNULL,
            stdout=stdout_tmp,
            stderr=stderr_tmp,
            start_new_session=(os.name == "posix"),
        )
        try:
            proceso.wait(timeout=timeout)
        except subprocess.TimeoutExpired:
            agotado = True
            _terminar(proceso, gracia)

        fin_mono = time.monotonic_ns()
        fin_pared = dt.datetime.now(dt.timezone.utc)
        destino = salida_hija if salida_hija is not None else sys.stderr.buffer
        _copiar(stdout_tmp, destino)
        _copiar(stderr_tmp, destino)

    codigo = proceso.returncode
    senal = -codigo if os.name == "posix" and codigo is not None and codigo < 0 else None
    if agotado:
        estado = "timeout"
    elif senal is not None:
        estado = "signaled"
    elif codigo == 0:
        estado = "passed"
    else:
        estado = "failed"

    resultado: ResultadoSuite = {
        "schema_version": 1,
        "status": estado,
        "command": list(comando),
        "started_at": _iso_utc(inicio_pared),
        "finished_at": _iso_utc(fin_pared),
        "duration_ms": round((fin_mono - inicio_mono) / 1_000_000, 3),
        "exit_code": codigo if senal is None else None,
        "signal": senal,
        "timed_out": agotado,
    }
    assert resultado["status"] in ESTADOS
    return resultado


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--timeout", type=float, default=None, help="segundos antes de terminar la suite")
    parser.add_argument("--grace", type=float, default=1.0, help="segundos entre terminate y kill")
    parser.add_argument("command", nargs=argparse.REMAINDER, help="comando, precedido por --")
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    comando = list(args.command)
    if comando and comando[0] == "--":
        comando.pop(0)
    if not comando:
        _parser().error("falta el comando tras --")

    try:
        resultado = ejecutar_suite(comando, timeout=args.timeout, gracia=args.grace)
    except (OSError, ValueError) as exc:
        print(json.dumps({"schema_version": 1, "status": "launch_error", "error": str(exc)}, ensure_ascii=False))
        return 127

    print(json.dumps(resultado, ensure_ascii=False, sort_keys=True))
    if resultado["status"] == "timeout":
        return 124
    if resultado["status"] == "signaled":
        assert resultado["signal"] is not None
        return 128 + resultado["signal"]
    assert resultado["exit_code"] is not None
    return resultado["exit_code"]


if __name__ == "__main__":
    raise SystemExit(main())
