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
        '{"ship":{"callsign":"Itsaso 1","destination":null,'
        '"distance_to_destination":null,"eta_seconds":null,'
        '"hull":200.0,"hull_max":200.0,'
        '"systems":{"impulse":{"health":1.0,"heat":0.0,"power":1.0}}}}'
    )
    r = client.get("/v1/state", headers=auth)
    assert r.status_code == 200
    assert r.json()["ship"]["callsign"] == "Itsaso 1"
    assert r.json()["ship"]["destination"] is None


def test_state_devuelve_destino_distancia_y_eta(client, juego, auth):
    juego.text = (
        '{"ship":{"callsign":"Itsaso 1",'
        '"destination":{"name":"Argia","position":{"x":28000.0,"y":-16000.0}},'
        '"distance_to_destination":1000.0,"eta_seconds":20.0}}'
    )
    ship = client.get("/v1/state", headers=auth).json()["ship"]
    assert ship["destination"]["name"] == "Argia"
    assert ship["distance_to_destination"] == 1000.0
    assert ship["eta_seconds"] == 20.0


def test_state_sin_nave(client, juego, auth):
    juego.text = '{"ship":null}'
    r = client.get("/v1/state", headers=auth)
    assert r.status_code == 200
    assert r.json() == {"ship": None}


def test_scenario_devuelve_el_tiempo_y_la_pausa(client, juego, auth):
    juego.text = '{"scenario_time":42.5,"paused":false}'
    r = client.get("/v1/scenario", headers=auth)
    assert r.status_code == 200
    assert r.json() == {"scenario_time": 42.5, "paused": False}


def test_scenario_envia_lua_con_pausa_al_juego(client, juego, auth):
    juego.text = '{"scenario_time":0.0,"paused":true}'
    client.get("/v1/scenario", headers=auth)
    assert "isGamePaused()" in juego.ultimo_lua


def test_state_envia_lua_de_estado_al_juego(client, juego, auth):
    juego.text = '{"ship":null}'
    client.get("/v1/state", headers=auth)
    assert "getPlayerShip(-1)" in juego.ultimo_lua
    assert "getSystemHealth" in juego.ultimo_lua
    assert "LAGUNAK_ROUTE_s90_argia" in juego.ultimo_lua
    assert "math.sqrt(vx * vx + vy * vy)" in juego.ultimo_lua
    assert "speed > 0.01" in juego.ultimo_lua


def test_state_pide_coolant_y_dotacion_de_reparacion(client, juego, auth):
    juego.text = '{"ship":null}'
    client.get("/v1/state", headers=auth)
    assert "getSystemCoolant" in juego.ultimo_lua
    assert "getRepairCrewCount" in juego.ultimo_lua
    assert '"coolant"' in juego.ultimo_lua
    assert '"repair_crew"' in juego.ultimo_lua


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


def test_events_devuelve_encuentro_iniciado_normalizado(client, juego, auth):
    juego.text = (
        '{"events":[{"id":"encounter-started-s90-123456-000002",'
        '"type":"encounter_started",'
        '"scenario":"scenario_90_lagunak_primera_guardia",'
        '"archetype":"derelict","encounter_callsign":"Hondar 2",'
        '"scenario_time":42.5}]}'
    )
    r = client.get("/v1/events", headers=auth)
    assert r.status_code == 200
    assert r.json()["events"][0] == {
        "id": "encounter-started-s90-123456-000002",
        "type": "encounter_started",
        "scenario": "scenario_90_lagunak_primera_guardia",
        "archetype": "derelict",
        "encounter_callsign": "Hondar 2",
        "scenario_time": 42.5,
    }


def test_events_requiere_auth(client, juego):
    assert client.get("/v1/events").status_code == 401


def test_events_envia_solo_lua_fijo_al_juego(client, juego, auth):
    juego.text = '{"events":[]}'
    client.get("/v1/events", headers=auth)
    assert "getObjectsInRadius" in juego.ultimo_lua
    assert "LAGUNAK_EVT_arrival_s90_" in juego.ultimo_lua
    assert "LAGUNAK_EVT_encounter_started_s90_" in juego.ultimo_lua


def test_encounters_publica_el_catalogo_cerrado(client, juego, auth):
    r = client.get("/v1/encounters", headers=auth)
    assert r.status_code == 200
    cuerpo = r.json()
    assert cuerpo["archetypes"] == [
        "derelict",
        "patrol",
        "freighter",
        "sentry",
        "ambush",
    ]
    assert cuerpo["bearings"] == ["ahead", "astern", "port", "starboard"]
    # Catálogo estático: nunca ejecuta Lua contra el juego.
    assert juego.llamadas == []


def test_encounters_requiere_auth(client, juego):
    assert client.get("/v1/encounters").status_code == 401


# --- /v1/anchors: catálogo de anclas de reposition_ship (#176) ----------------


def test_anchors_publica_el_catalogo_cerrado(client, juego, auth):
    import app as bridge

    r = client.get("/v1/anchors", headers=auth)
    assert r.status_code == 200
    cuerpo = r.json()
    # Misma fuente de verdad que valida /v1/command: el enum ShipAnchor.
    assert cuerpo["anchors"] == [anchor.value for anchor in bridge.ShipAnchor]
    # No consulta al juego: es un catálogo estático servido por el puente.
    assert not juego.llamadas


def test_anchors_requiere_auth(client, juego):
    assert client.get("/v1/anchors").status_code == 401


def test_v1_database_exige_token(client, juego):
    r = client.get("/v1/database")
    assert r.status_code == 401
    assert not juego.llamadas


def test_v1_database_devuelve_lo_que_publica_el_juego(client, juego, auth):
    juego.text = '{"entries":[{"id":"Naves","name":"Naves"}],"truncated":false,"total":1}'
    r = client.get("/v1/database", headers=auth)
    assert r.status_code == 200
    assert r.json()["entries"][0]["id"] == "Naves"
    # Es consulta pura: no emite ninguna orden ni toca el estado de la nave.
    assert "command" not in juego.ultimo_lua


def test_v1_database_rechaza_error_del_juego(client, juego, auth):
    juego.text = '{"ERROR":"algo falló en el script"}'
    r = client.get("/v1/database", headers=auth)
    assert r.status_code == 502


def test_v1_database_juego_inalcanzable_devuelve_502(client, juego, auth):
    import httpx
    juego.error = httpx.ConnectError("caído")
    r = client.get("/v1/database", headers=auth)
    assert r.status_code == 502


def test_v1_events_rechaza_error_del_juego(client, juego, auth):
    juego.text = '{"ERROR":"algo falló en el script"}'
    r = client.get("/v1/events", headers=auth)
    assert r.status_code == 502


def test_v1_events_juego_inalcanzable_devuelve_502(client, juego, auth):
    import httpx
    juego.error = httpx.ConnectError("caído")
    r = client.get("/v1/events", headers=auth)
    assert r.status_code == 502


def test_v1_scenario_rechaza_error_del_juego(client, juego, auth):
    juego.text = '{"ERROR":"algo falló en el script"}'
    r = client.get("/v1/scenario", headers=auth)
    assert r.status_code == 502


def test_v1_scenario_juego_inalcanzable_devuelve_502(client, juego, auth):
    import httpx
    juego.error = httpx.ConnectError("caído")
    r = client.get("/v1/scenario", headers=auth)
    assert r.status_code == 502
    # Un 502 con el detalle equivocado filtraría al cliente el mensaje interno
    # de httpx; el puente tiene que dar SIEMPRE el suyo (#713).
    assert r.json() == {"detail": "El servidor de juego no responde"}
    # Y llamar una sola vez: un reintento silencioso ante un juego caído
    # convertiría un fallo en dos, y aquí no hay política de reintento.
    assert len(juego.llamadas) == 1
