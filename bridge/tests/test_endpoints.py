"""Tests de los endpoints de lectura: healthz, state, scenario y events."""

from __future__ import annotations


def test_healthz_sin_auth_con_juego_ok(client, juego):
    juego.text = '{"ok":true}'
    r = client.get("/healthz")  # sin cabecera de auth: /healthz es público
    assert r.status_code == 200
    cuerpo = r.json()
    assert cuerpo["bridge"] == "ok"
    assert cuerpo["game"] == "ok"
    assert "version" in cuerpo


def test_healthz_reporta_juego_inalcanzable(client, juego):
    import httpx

    juego.error = httpx.ConnectError("caído")
    r = client.get("/healthz")
    assert r.status_code == 200  # el puente sí responde
    assert r.json()["game"] == "unreachable"


def test_state_devuelve_la_nave(client, juego, auth):
    juego.text = (
        '{"ship":{"callsign":"Itsaso 1","hull":200.0,"hull_max":200.0,'
        '"systems":{"impulse":{"health":1.0,"heat":0.0,"power":1.0}}}}'
    )
    r = client.get("/v1/state", headers=auth)
    assert r.status_code == 200
    assert r.json()["ship"]["callsign"] == "Itsaso 1"


def test_state_sin_nave(client, juego, auth):
    juego.text = '{"ship":null}'
    r = client.get("/v1/state", headers=auth)
    assert r.status_code == 200
    assert r.json() == {"ship": None}


def test_scenario_devuelve_el_tiempo(client, juego, auth):
    juego.text = '{"scenario_time":42.5}'
    r = client.get("/v1/scenario", headers=auth)
    assert r.status_code == 200
    assert r.json() == {"scenario_time": 42.5}


def test_state_envia_lua_de_estado_al_juego(client, juego, auth):
    juego.text = '{"ship":null}'
    client.get("/v1/state", headers=auth)
    assert "getPlayerShip(-1)" in juego.ultimo_lua
    assert "getSystemHealth" in juego.ultimo_lua


def test_scenario_requiere_auth(client, juego):
    r = client.get("/v1/scenario")
    assert r.status_code == 401


def test_events_devuelve_lista_vacia(client, juego, auth):
    juego.text = '{"events":[]}'
    r = client.get("/v1/events", headers=auth)
    assert r.status_code == 200
    assert r.json() == {"events": []}


def test_events_devuelve_llegada_normalizada(client, juego, auth):
    juego.text = (
        '{"events":[{"id":"arrival-s90-123456","type":"arrival",'
        '"scenario":"scenario_90_lagunak_primera_guardia",'
        '"destination":"Argia","scenario_time":42.5}]}'
    )
    r = client.get("/v1/events", headers=auth)
    assert r.status_code == 200
    assert r.json()["events"][0] == {
        "id": "arrival-s90-123456",
        "type": "arrival",
        "scenario": "scenario_90_lagunak_primera_guardia",
        "destination": "Argia",
        "scenario_time": 42.5,
    }


def test_events_requiere_auth(client, juego):
    assert client.get("/v1/events").status_code == 401


def test_events_envia_solo_lua_fijo_al_juego(client, juego, auth):
    juego.text = '{"events":[]}'
    client.get("/v1/events", headers=auth)
    assert "getObjectsInRadius" in juego.ultimo_lua
    assert "LAGUNAK_EVT_arrival_s90_" in juego.ultimo_lua
