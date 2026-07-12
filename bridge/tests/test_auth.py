"""Tests de autenticación y límite de frecuencia a nivel de endpoint.

`/v1/state` sirve de endpoint autenticado representativo.
"""

from __future__ import annotations

import app as bridge

STATE_OK = '{"ship":null}'


def test_sin_token_configurado_devuelve_503(client, juego, auth, monkeypatch):
    monkeypatch.setattr(bridge, "BRIDGE_TOKEN", "")
    r = client.get("/v1/state", headers=auth)
    assert r.status_code == 503


def test_sin_cabecera_authorization_devuelve_401(client, juego):
    r = client.get("/v1/state")
    assert r.status_code == 401


def test_token_incorrecto_devuelve_401(client, juego):
    r = client.get("/v1/state", headers={"Authorization": "Bearer incorrecto"})
    assert r.status_code == 401


def test_esquema_no_bearer_devuelve_401(client, juego):
    r = client.get("/v1/state", headers={"Authorization": bridge.BRIDGE_TOKEN})
    assert r.status_code == 401


def test_token_correcto_pasa(client, juego, auth):
    juego.text = STATE_OK
    r = client.get("/v1/state", headers=auth)
    assert r.status_code == 200


def test_un_token_mal_no_filtra_por_longitud(client, juego):
    # Prefijo correcto pero incompleto: sigue siendo 401 (compare_digest).
    corto = bridge.BRIDGE_TOKEN[:-1]
    r = client.get("/v1/state", headers={"Authorization": f"Bearer {corto}"})
    assert r.status_code == 401


def test_supera_el_limite_de_frecuencia_devuelve_429(client, juego, auth, monkeypatch):
    juego.text = STATE_OK
    # Limitador diminuto: 2 de ráfaga, sin recarga apreciable durante el test.
    monkeypatch.setattr(bridge, "_rate_limiter", bridge._TokenBucket(rate=0, burst=2))
    assert client.get("/v1/state", headers=auth).status_code == 200
    assert client.get("/v1/state", headers=auth).status_code == 200
    assert client.get("/v1/state", headers=auth).status_code == 429


def test_el_limite_se_comprueba_tras_la_autenticacion(client, juego, monkeypatch):
    # Un token inválido nunca debe gastar cupo del limitador: aunque el bucket
    # esté vacío, la respuesta es 401 (no 429), porque el token se comprueba antes.
    monkeypatch.setattr(bridge, "_rate_limiter", bridge._TokenBucket(rate=0, burst=0))
    r = client.get("/v1/state", headers={"Authorization": "Bearer incorrecto"})
    assert r.status_code == 401
