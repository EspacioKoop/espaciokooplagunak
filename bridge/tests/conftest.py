"""Fixtures para los tests del puente.

El servidor de juego (su endpoint ``/exec.lua``) se simula sustituyendo
``httpx.AsyncClient`` dentro del módulo del puente por un doble configurable.
Así los tests ejercitan la app FastAPI real —auth, límites, validación,
generación de Lua— sin necesitar un EmptyEpsilon en marcha.
"""

from __future__ import annotations

import sys
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from pathlib import Path

import httpx
import pytest
from starlette.testclient import TestClient

# El paquete del puente es `app.py`, en el directorio padre de este archivo.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import app as bridge  # noqa: E402

TOKEN = "token-de-prueba-0123456789"


@dataclass
class JuegoFalso:
    """Controla lo que el `/exec.lua` simulado devuelve, y registra las
    llamadas para poder afirmar qué Lua generó el puente."""

    status_code: int = 200
    text: str = '{"ok":true}'
    error: Exception | None = None
    llamadas: list[str] = field(default_factory=list)

    @property
    def ultimo_lua(self) -> str:
        assert self.llamadas, "el puente no llamó al juego"
        return self.llamadas[-1]


@pytest.fixture
def juego(monkeypatch: pytest.MonkeyPatch) -> JuegoFalso:
    """Sustituye httpx.AsyncClient dentro del puente por un doble."""
    estado = JuegoFalso()

    class _ClienteFalso:
        def __init__(self, *args, **kwargs) -> None:
            pass

        async def __aenter__(self) -> "_ClienteFalso":
            return self

        async def __aexit__(self, *args) -> bool:
            return False

        @asynccontextmanager
        async def stream(self, method: str, url: str, content: str | None = None):
            assert method == "POST"
            estado.llamadas.append(content or "")
            if estado.error is not None:
                raise estado.error
            response = httpx.Response(estado.status_code, text=estado.text)
            try:
                yield response
            finally:
                await response.aclose()

    monkeypatch.setattr(bridge.httpx, "AsyncClient", _ClienteFalso)
    return estado


@pytest.fixture(autouse=True)
def _reset_rate_limiter(monkeypatch: pytest.MonkeyPatch) -> None:
    """Cada test empieza con un limitador holgado, para que el consumo de
    tokens de un test no contamine a otro. El test de límite instala el suyo."""
    monkeypatch.setattr(
        bridge, "_rate_limiter", bridge._TokenBucket(rate=1000, burst=1000)
    )


@pytest.fixture(autouse=True)
def _token_configurado(monkeypatch: pytest.MonkeyPatch) -> None:
    """Por defecto el puente tiene BRIDGE_TOKEN; los tests que prueban su
    ausencia lo sobrescriben."""
    monkeypatch.setattr(bridge, "BRIDGE_TOKEN", TOKEN)


@pytest.fixture
def client() -> TestClient:
    return TestClient(bridge.app)


@pytest.fixture
def auth() -> dict[str, str]:
    return {"Authorization": f"Bearer {TOKEN}"}
