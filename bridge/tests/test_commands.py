"""Tests de la lista blanca de órdenes: generación de Lua correcta, rechazo de
lo que no está en la lista, y —lo central— que NINGÚN Lua arbitrario del cliente
llega al juego. Todo el Lua lo define el servidor; el cliente solo aporta valores
tipados y acotados.
"""

from __future__ import annotations

import pytest

CMD = "/v1/command"


# --- Órdenes válidas: cada una genera el Lua esperado --------------------------


def test_set_impulse_genera_lua(client, juego, auth):
    r = client.post(CMD, headers=auth, json={"op": "set_impulse", "value": 0.5})
    assert r.status_code == 200
    assert r.json()["op"] == "set_impulse"
    assert "commandImpulse(0.500)" in juego.ultimo_lua
    assert "getPlayerShip(-1)" in juego.ultimo_lua


def test_set_warp_genera_lua(client, juego, auth):
    r = client.post(CMD, headers=auth, json={"op": "set_warp", "level": 2})
    assert r.status_code == 200
    assert "commandWarp(2)" in juego.ultimo_lua


def test_set_target_heading_aplica_el_desfase_de_90(client, juego, auth):
    r = client.post(CMD, headers=auth, json={"op": "set_target_heading", "heading": 90.0})
    assert r.status_code == 200
    # 90 de juego == 0 de rotación interna.
    assert "commandTargetRotation(0.000)" in juego.ultimo_lua


def test_set_shields_serializa_booleano_en_minusculas(client, juego, auth):
    r = client.post(CMD, headers=auth, json={"op": "set_shields", "active": True})
    assert r.status_code == 200
    assert "commandSetShields(true)" in juego.ultimo_lua
    assert "True" not in juego.ultimo_lua  # no el booleano de Python


def test_set_system_power_genera_lua(client, juego, auth):
    r = client.post(
        CMD, headers=auth, json={"op": "set_system_power", "system": "impulse", "level": 1.5}
    )
    assert r.status_code == 200
    assert 'commandSetSystemPowerRequest("impulse", 1.500)' in juego.ultimo_lua


# --- Rechazos: fuera de la lista o fuera de rango -> 422 -----------------------


def test_op_desconocida_rechazada(client, juego, auth):
    r = client.post(CMD, headers=auth, json={"op": "self_destruct"})
    assert r.status_code == 422
    assert not juego.llamadas  # el juego nunca fue tocado


def test_falta_op_rechazada(client, juego, auth):
    r = client.post(CMD, headers=auth, json={"value": 0.5})
    assert r.status_code == 422


@pytest.mark.parametrize("valor", [-1.5, 1.5, 2.0, -100])
def test_impulse_fuera_de_rango_rechazado(client, juego, auth, valor):
    r = client.post(CMD, headers=auth, json={"op": "set_impulse", "value": valor})
    assert r.status_code == 422
    assert not juego.llamadas


@pytest.mark.parametrize("nivel", [-1, 5, 10])
def test_warp_fuera_de_rango_rechazado(client, juego, auth, nivel):
    r = client.post(CMD, headers=auth, json={"op": "set_warp", "level": nivel})
    assert r.status_code == 422


def test_heading_fuera_de_rango_rechazado(client, juego, auth):
    r = client.post(CMD, headers=auth, json={"op": "set_target_heading", "heading": 400.0})
    assert r.status_code == 422


def test_sistema_no_permitido_rechazado(client, juego, auth):
    r = client.post(
        CMD, headers=auth, json={"op": "set_system_power", "system": "warpcore", "level": 1.0}
    )
    assert r.status_code == 422
    assert not juego.llamadas


# --- Anti-inyección: los campos tipados no dejan colar Lua ---------------------


@pytest.mark.parametrize(
    "value_malicioso",
    [
        '0.5); os.execute("rm -rf /"); --',
        "1.0 or victory('Exuari')",
        "getPlayerShip(-1):destroy()",
        "']]..os.getenv('BRIDGE_TOKEN')..[[",
    ],
)
def test_inyeccion_por_value_numerico_rechazada(client, juego, auth, value_malicioso):
    r = client.post(CMD, headers=auth, json={"op": "set_impulse", "value": value_malicioso})
    assert r.status_code == 422
    assert not juego.llamadas  # nada llegó al juego


def test_inyeccion_por_system_rechazada(client, juego, auth):
    r = client.post(
        CMD,
        headers=auth,
        json={"op": "set_system_power", "system": '"); victory("Exuari"); ("', "level": 1.0},
    )
    assert r.status_code == 422
    assert not juego.llamadas


def test_inyeccion_por_heading_rechazada(client, juego, auth):
    r = client.post(
        CMD,
        headers=auth,
        json={"op": "set_target_heading", "heading": "90); ship:destroy(); --"},
    )
    assert r.status_code == 422
    assert not juego.llamadas


def test_lua_generado_es_solo_del_servidor(client, juego, auth):
    # Un valor legítimo en el borde: el Lua resultante contiene solo la llamada
    # canónica formateada por el servidor, sin rastro de entrada cruda.
    client.post(CMD, headers=auth, json={"op": "set_impulse", "value": 1.0})
    lua = juego.ultimo_lua
    assert lua.count("commandImpulse") == 1
    assert "os." not in lua and "io." not in lua and "victory" not in lua


def test_command_requiere_auth(client, juego):
    r = client.post(CMD, json={"op": "set_impulse", "value": 0.5})
    assert r.status_code == 401
    assert not juego.llamadas
