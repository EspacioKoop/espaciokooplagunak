"""Middleware ASGI del puente: límite de tamaño de cuerpo y CORS.

Extraído de app.py (ver bridge/lua_templates.py para el precedente de esta
misma extracción mecánica): ninguna lógica cambia, solo su ubicación.
"""

from __future__ import annotations

from typing import Any
from urllib.parse import urlsplit

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import JSONResponse


class _RequestBodyLimitMiddleware:
    """Rechaza cuerpos grandes antes de que el parser JSON los materialice.

    ``Content-Length`` permite fallar inmediatamente. Para peticiones sin esa
    cabecera o con transferencia fragmentada se leen como máximo ``max_bytes``
    y solo se entrega al parser un cuerpo ya acotado.
    """

    def __init__(self, application: Any, max_bytes: int) -> None:
        self.application = application
        self.max_bytes = max_bytes

    async def __call__(self, scope: dict[str, Any], receive: Any, send: Any) -> None:
        if scope.get("type") != "http" or scope.get("method") not in {
            "POST",
            "PUT",
            "PATCH",
        }:
            await self.application(scope, receive, send)
            return

        headers = dict(scope.get("headers", []))
        raw_length = headers.get(b"content-length")
        if raw_length is not None:
            try:
                if int(raw_length) > self.max_bytes:
                    await self._reject(scope, receive, send)
                    return
            except ValueError:
                # El servidor HTTP decide cómo tratar una cabecera malformada;
                # el contador de abajo sigue impidiendo saltarse el límite.
                pass

        body = bytearray()
        while True:
            message = await receive()
            if message.get("type") != "http.request":
                await self.application(scope, _replay_receive(message), send)
                return
            chunk = message.get("body", b"")
            if len(body) + len(chunk) > self.max_bytes:
                await self._reject(scope, receive, send)
                return
            body.extend(chunk)
            if not message.get("more_body", False):
                break

        delivered = False

        async def replay_body() -> dict[str, Any]:
            nonlocal delivered
            if not delivered:
                delivered = True
                return {"type": "http.request", "body": bytes(body), "more_body": False}
            return await receive()

        await self.application(scope, replay_body, send)

    @staticmethod
    async def _reject(scope: dict[str, Any], receive: Any, send: Any) -> None:
        response = JSONResponse(
            status_code=413,
            content={"detail": "Cuerpo de petición demasiado grande"},
        )
        await response(scope, receive, send)


def _replay_receive(message: dict[str, Any]):
    """Devuelve una función ASGI que reproduce una desconexión ya consumida."""

    async def replay() -> dict[str, Any]:
        return message

    return replay


def _parse_allowed_origins(raw: str) -> list[str]:
    """Valida una allowlist CORS de orígenes HTTP(S) exactos."""
    origins: list[str] = []
    for value in raw.split(","):
        origin = value.strip()
        if not origin:
            continue
        if origin == "*":
            raise RuntimeError("BRIDGE_ALLOWED_ORIGINS no admite el comodín '*'")

        parsed = urlsplit(origin)
        try:
            parsed.port
        except ValueError as exc:
            raise RuntimeError(
                f"Origen CORS inválido en BRIDGE_ALLOWED_ORIGINS: {origin!r}"
            ) from exc
        if (
            parsed.scheme not in {"http", "https"}
            or not parsed.hostname
            or parsed.username is not None
            or parsed.password is not None
            or parsed.netloc.endswith(":")
            or parsed.path
            or parsed.query
            or parsed.fragment
        ):
            raise RuntimeError(
                f"Origen CORS inválido en BRIDGE_ALLOWED_ORIGINS: {origin!r}"
            )
        if origin not in origins:
            origins.append(origin)
    return origins


def _configure_cors(application: FastAPI, raw_origins: str) -> None:
    origins = _parse_allowed_origins(raw_origins)
    if not origins:
        return
    application.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_methods=["GET", "POST"],
        allow_headers=["Authorization", "Content-Type"],
        allow_credentials=False,
        max_age=600,
    )
