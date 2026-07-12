"""Tests de `_run_lua`: traducción de cada fallo del juego a 502, sin filtrar
detalle. Se ejercita a través de `/v1/state` (endpoint autenticado que solo
reenvía el resultado de `_run_lua`)."""

from __future__ import annotations

import httpx

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
