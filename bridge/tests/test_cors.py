"""Regresiones CORS para el cliente web de Foundry."""

from __future__ import annotations

import pytest
from fastapi import FastAPI
from starlette.testclient import TestClient

import app as bridge


def _client_with_origins(raw_origins: str) -> TestClient:
    application = FastAPI()

    @application.get("/healthz")
    async def healthz():
        return {"bridge": "ok"}

    @application.get("/v1/state")
    async def state():
        return {"ship": None}

    bridge._configure_cors(application, raw_origins)
    return TestClient(application)


def test_allowed_origin_receives_cors_header():
    client = _client_with_origins("http://localhost:30000")

    response = client.get(
        "/healthz", headers={"Origin": "http://localhost:30000"}
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == (
        "http://localhost:30000"
    )
    assert "access-control-allow-credentials" not in response.headers


def test_bearer_preflight_is_allowed_only_for_configured_origin():
    client = _client_with_origins(
        "http://localhost:30000, https://foundry.example.test"
    )
    headers = {
        "Origin": "https://foundry.example.test",
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "Authorization",
    }

    response = client.options("/v1/state", headers=headers)

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == (
        "https://foundry.example.test"
    )
    allowed_headers = response.headers["access-control-allow-headers"].lower()
    assert "authorization" in allowed_headers


def test_unlisted_origin_does_not_receive_cors_access():
    client = _client_with_origins("http://localhost:30000")

    response = client.get(
        "/healthz", headers={"Origin": "https://untrusted.example.test"}
    )

    assert response.status_code == 200
    assert "access-control-allow-origin" not in response.headers


def test_empty_allowlist_keeps_cors_disabled():
    client = _client_with_origins("  ")

    response = client.get(
        "/healthz", headers={"Origin": "http://localhost:30000"}
    )

    assert response.status_code == 200
    assert "access-control-allow-origin" not in response.headers


@pytest.mark.parametrize(
    "raw",
    [
        "*",
        "null",
        "ftp://localhost:30000",
        "http://localhost:30000/path",
        "http://user:password@localhost:30000",
        "http://localhost:not-a-port",
        "http://localhost:",
    ],
)
def test_invalid_or_unsafe_origins_fail_closed(raw):
    with pytest.raises(RuntimeError, match="BRIDGE_ALLOWED_ORIGINS"):
        bridge._parse_allowed_origins(raw)


def test_allowlist_trims_deduplicates_and_preserves_exact_origins():
    assert bridge._parse_allowed_origins(
        " http://localhost:30000,https://foundry.example.test,http://localhost:30000 "
    ) == ["http://localhost:30000", "https://foundry.example.test"]
