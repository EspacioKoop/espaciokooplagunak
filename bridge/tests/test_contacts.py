"""Tests del endpoint /v1/contacts: objetos cercanos para el mapa vivo."""

from __future__ import annotations


def test_contacts_requiere_auth(client, juego):
    assert client.get("/v1/contacts").status_code == 401


def test_contacts_sin_nave_devuelve_lista_vacia(client, juego, auth):
    juego.text = '{"contacts":[],"truncated":false,"total":0}'
    r = client.get("/v1/contacts", headers=auth)
    assert r.status_code == 200
    assert r.json() == {"contacts": [], "truncated": False, "total": 0}


def test_contacts_devuelve_objetos_normalizados(client, juego, auth):
    juego.text = (
        '{"contacts":['
        '{"callsign":"Itsaso 1","position":{"x":0.0,"y":0.0},'
        '"faction":"Human Navy","is_player":true},'
        '{"callsign":"Kraylor-7","position":{"x":1200.0,"y":-800.0},'
        '"faction":"Kraylor","is_player":false},'
        '{"callsign":"?","position":{"x":5000.0,"y":5000.0},'
        '"faction":null,"is_player":false}'
        '],"truncated":false,"total":3}'
    )
    payload = client.get("/v1/contacts", headers=auth).json()
    contactos = payload["contacts"]
    assert len(contactos) == 3
    assert contactos[0]["is_player"] is True
    assert contactos[0]["faction"] == "Human Navy"
    assert contactos[1]["callsign"] == "Kraylor-7"
    # Un objeto sin facción (asteroide/nebulosa) no rompe la lista.
    assert contactos[2]["faction"] is None
    assert contactos[2]["is_player"] is False
    # El truncamiento es visible en el contrato.
    assert payload["truncated"] is False
    assert payload["total"] == 3


def test_contacts_envia_solo_lua_fijo_al_juego(client, juego, auth):
    juego.text = '{"contacts":[],"truncated":false,"total":0}'
    client.get("/v1/contacts", headers=auth)
    lua = juego.ultimo_lua
    # Reutiliza el patrón seguro: Lua definido en el servidor, radio y número
    # acotados, accesores opcionales protegidos con pcall. Los contactos se
    # ordenan por distancia (el índice espacial no garantiza orden) y el
    # jugador encabeza la lista por identidad de objeto.
    assert "getPlayerShip(-1)" in lua
    assert "getObjectsInRadius(x, y, 30000)" in lua
    assert "table.sort(otros, function(a, b) return a.d2 < b.d2 end)" in lua
    assert "math.min(#otros, limite - 1)" in lua
    assert '"truncated":%s' in lua
    assert "pcall(function() return object:getFaction() end)" in lua


def test_contacts_rechaza_error_del_juego(client, juego, auth):
    juego.text = '{"ERROR":"algo falló en el script"}'
    r = client.get("/v1/contacts", headers=auth)
    assert r.status_code == 502


def test_contacts_juego_inalcanzable_devuelve_502(client, juego, auth):
    import httpx
    juego.error = httpx.ConnectError("caído")
    r = client.get("/v1/contacts", headers=auth)
    assert r.status_code == 502
