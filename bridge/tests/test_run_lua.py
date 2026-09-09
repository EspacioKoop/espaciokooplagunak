"""Tests de `_run_lua`: traducción de cada fallo del juego a 502, sin filtrar
detalle. Se ejercita a través de `/v1/state` (endpoint autenticado que solo
reenvía el resultado de `_run_lua`)."""

from __future__ import annotations

import httpx
import pytest
import app as bridge


class TrackedStream(httpx.AsyncByteStream):
    """Synthetic chunks, never a connection to a real simulator."""

    def __init__(self, chunks, fail_after=False):
        self.chunks = chunks
        self.fail_after = fail_after
        self.consumed = 0
        self.closed = False

    async def __aiter__(self):
        for chunk in self.chunks:
            self.consumed += 1
            yield chunk
        if self.fail_after:
            raise httpx.ReadTimeout("synthetic-private-upstream-detail")

    async def aclose(self):
        self.closed = True


def install_stream(monkeypatch, stream, status=200, headers=None):
    real_client = httpx.AsyncClient

    def handler(request):
        assert request.method == "POST"
        assert request.url.path == "/exec.lua"
        return httpx.Response(status, headers=headers, stream=stream)

    monkeypatch.setattr(
        bridge.httpx, "AsyncClient",
        lambda **kwargs: real_client(transport=httpx.MockTransport(handler), **kwargs),
    )


@pytest.mark.parametrize("headers", [{}, {"content-length": "1"}])
def test_overflow_stops_reading_and_closes(client, auth, monkeypatch, headers):
    stream = TrackedStream([b" " * bridge.MAX_GAME_RESPONSE_BYTES, b"!", b"unread"])
    install_stream(monkeypatch, stream, headers=headers)
    response = client.get("/v1/state", headers=auth)
    assert response.status_code == 502
    assert stream.consumed == 2
    assert stream.closed
    assert "unread" not in response.text


@pytest.mark.parametrize("size", [bridge.MAX_GAME_RESPONSE_BYTES - 1,
                                  bridge.MAX_GAME_RESPONSE_BYTES])
def test_boundary_valid_json_closes(client, auth, monkeypatch, size):
    data = b'{"ok":true}' + b" " * (size - len(b'{"ok":true}'))
    stream = TrackedStream([data[:7], data[7:]])
    install_stream(monkeypatch, stream)
    response = client.get("/v1/state", headers=auth)
    assert response.status_code == 200
    assert response.json() == {"ok": True}
    assert stream.closed


def test_non_success_does_not_read_body(client, auth, monkeypatch):
    stream = TrackedStream([b"synthetic-private-upstream-detail"])
    install_stream(monkeypatch, stream, status=500)
    response = client.get("/v1/state", headers=auth)
    assert response.status_code == 502
    assert stream.consumed == 0
    assert stream.closed
    assert "synthetic-private" not in response.text


def test_midstream_timeout_closes_and_redacts(client, auth, monkeypatch):
    stream = TrackedStream([b'{"ok":'], fail_after=True)
    install_stream(monkeypatch, stream)
    response = client.get("/v1/state", headers=auth)
    assert response.status_code == 502
    assert stream.closed
    assert "synthetic-private" not in response.text


@pytest.mark.parametrize("oversize", [False, True])
def test_compressed_response_limits_decoded_bytes(client, auth, monkeypatch, oversize):
    import gzip

    data = b'{"ok":true}'
    if oversize:
        data += b" " * bridge.MAX_GAME_RESPONSE_BYTES
    stream = TrackedStream([gzip.compress(data)])
    install_stream(monkeypatch, stream, headers={"content-encoding": "gzip"})
    response = client.get("/v1/state", headers=auth)
    assert response.status_code == (502 if oversize else 200)
    if not oversize:
        assert response.json() == {"ok": True}
    assert stream.closed


def test_split_multibyte_json_and_charset(client, auth, monkeypatch):
    data = '{"ship":"Itsasó"}'.encode("utf-8")
    split = data.index(b"\xc3") + 1
    stream = TrackedStream([data[:split], data[split:]])
    install_stream(monkeypatch, stream, headers={"content-type": "application/json; charset=utf-8"})
    response = client.get("/v1/state", headers=auth)
    assert response.status_code == 200
    assert response.json() == {"ship": "Itsasó"}
    assert stream.closed


MUCHO = 64 * 1024 + 1


def test_juego_inalcanzable_devuelve_502(client, juego, auth):
    juego.error = httpx.ConnectError("sin ruta al juego")
    r = client.get("/v1/state", headers=auth)
    assert r.status_code == 502


def test_timeout_del_juego_devuelve_502(client, juego, auth):
    juego.error = httpx.ReadTimeout("el juego tardó demasiado")
    r = client.get("/v1/state", headers=auth)
    assert r.status_code == 502


def test_respuesta_no_200_devuelve_502(client, juego, auth):
    juego.status_code = 500
    juego.text = '{"ship":null}'
    r = client.get("/v1/state", headers=auth)
    assert r.status_code == 502


def test_respuesta_demasiado_grande_devuelve_502(client, juego, auth):
    juego.text = '{"x":"' + "A" * MUCHO + '"}'
    r = client.get("/v1/state", headers=auth)
    assert r.status_code == 502


def test_json_invalido_devuelve_502(client, juego, auth):
    juego.text = "esto no es json"
    r = client.get("/v1/state", headers=auth)
    assert r.status_code == 502


def test_payload_con_ERROR_devuelve_502(client, juego, auth):
    # Es como responde /exec.lua ante un error de script Lua.
    juego.text = '{"ERROR": "Script error: [string]:1: ..."}'
    r = client.get("/v1/state", headers=auth)
    assert r.status_code == 502


def test_el_502_no_filtra_el_detalle_del_juego(client, juego, auth):
    secreto = "traza-interna-sensible-12345"
    juego.text = '{"ERROR": "' + secreto + '"}'
    r = client.get("/v1/state", headers=auth)
    assert r.status_code == 502
    assert secreto not in r.text


def test_payload_valido_se_reenvia(client, juego, auth):
    juego.text = '{"ship":{"callsign":"Itsaso 1","hull":200.0}}'
    r = client.get("/v1/state", headers=auth)
    assert r.status_code == 200
    assert r.json() == {"ship": {"callsign": "Itsaso 1", "hull": 200.0}}
