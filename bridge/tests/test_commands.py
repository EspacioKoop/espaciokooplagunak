"""Tests de la lista blanca de órdenes: generación de Lua correcta, rechazo de
lo que no está en la lista, y —lo central— que NINGÚN Lua arbitrario del cliente
llega al juego. Todo el Lua lo define el servidor; el cliente solo aporta valores
tipados y acotados.
"""

from __future__ import annotations

import pytest

import app as bridge

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


def test_set_system_coolant_genera_lua(client, juego, auth):
    r = client.post(
        CMD, headers=auth, json={"op": "set_system_coolant", "system": "impulse", "level": 7.5}
    )
    assert r.status_code == 200
    assert 'commandSetSystemCoolantRequest(ship, "impulse", 7.500)' in juego.ultimo_lua
    assert "getPlayerShip(-1)" in juego.ultimo_lua


@pytest.mark.parametrize("nivel", [-0.1, -1.0, 10.1, 100])
def test_coolant_fuera_de_rango_rechazado(client, juego, auth, nivel):
    r = client.post(
        CMD, headers=auth, json={"op": "set_system_coolant", "system": "impulse", "level": nivel}
    )
    assert r.status_code == 422
    assert not juego.llamadas


def test_coolant_sistema_fuera_de_lista_rechazado(client, juego, auth):
    r = client.post(
        CMD,
        headers=auth,
        json={"op": "set_system_coolant", "system": '"); victory("Exuari"); ("', "level": 5.0},
    )
    assert r.status_code == 422
    assert not juego.llamadas


def test_set_system_health_genera_lua(client, juego, auth):
    r = client.post(
        CMD, headers=auth, json={"op": "set_system_health", "system": "impulse", "value": -1.0}
    )
    assert r.status_code == 200
    assert 'setSystemHealth("impulse", -1.000)' in juego.ultimo_lua
    assert "getPlayerShip(-1)" in juego.ultimo_lua


def test_set_system_health_repara_a_tope(client, juego, auth):
    r = client.post(
        CMD, headers=auth, json={"op": "set_system_health", "system": "warp", "value": 1.0}
    )
    assert r.status_code == 200
    assert 'setSystemHealth("warp", 1.000)' in juego.ultimo_lua


def test_scan_object_genera_lua_de_busqueda_y_comando(client, juego, auth):
    r = client.post(CMD, headers=auth, json={"op": "scan_object", "callsign": "Lapur 1"})
    assert r.status_code == 200
    assert 'cs == "Lapur 1"' in juego.ultimo_lua
    assert "ship:commandScan(target)" in juego.ultimo_lua
    assert "getObjectsInRadius(sx, sy, 30000)" in juego.ultimo_lua


@pytest.mark.parametrize("callsign", ["", "x" * 65])
def test_scan_object_callsign_fuera_de_longitud_rechazado(client, juego, auth, callsign):
    r = client.post(CMD, headers=auth, json={"op": "scan_object", "callsign": callsign})
    assert r.status_code == 422
    assert not juego.llamadas


def test_set_weapon_target_genera_lua_de_busqueda_y_comando(client, juego, auth):
    r = client.post(CMD, headers=auth, json={"op": "set_weapon_target", "callsign": "Lapur 1"})
    assert r.status_code == 200
    assert 'cs == "Lapur 1"' in juego.ultimo_lua
    assert "ship:commandSetTarget(target)" in juego.ultimo_lua
    assert "getObjectsInRadius(sx, sy, 30000)" in juego.ultimo_lua


@pytest.mark.parametrize("callsign", ["", "x" * 65])
def test_set_weapon_target_callsign_fuera_de_longitud_rechazado(client, juego, auth, callsign):
    r = client.post(CMD, headers=auth, json={"op": "set_weapon_target", "callsign": callsign})
    assert r.status_code == 422
    assert not juego.llamadas


def test_fire_tube_genera_lua_de_busqueda_y_comando(client, juego, auth):
    r = client.post(CMD, headers=auth, json={"op": "fire_tube", "callsign": "Lapur 1", "index": 2})
    assert r.status_code == 200
    assert 'cs == "Lapur 1"' in juego.ultimo_lua
    assert "ship:commandFireTubeAtTarget(2, target)" in juego.ultimo_lua


@pytest.mark.parametrize("index", [-1, 16, 2.5])
def test_fire_tube_indice_fuera_de_rango_rechazado(client, juego, auth, index):
    r = client.post(CMD, headers=auth, json={"op": "fire_tube", "callsign": "Lapur 1", "index": index})
    assert r.status_code == 422
    assert not juego.llamadas


@pytest.mark.parametrize("index", [True, False])
def test_fire_tube_indice_booleano_rechazado(client, juego, auth, index):
    # strict=True: sin coacción de booleanos (true → tubo 1 colaría un disparo).
    r = client.post(CMD, headers=auth, json={"op": "fire_tube", "callsign": "Lapur 1", "index": index})
    assert r.status_code == 422
    assert not juego.llamadas


@pytest.mark.parametrize("callsign", ["", "x" * 65])
def test_fire_tube_callsign_fuera_de_longitud_rechazado(client, juego, auth, callsign):
    r = client.post(CMD, headers=auth, json={"op": "fire_tube", "callsign": callsign, "index": 0})
    assert r.status_code == 422
    assert not juego.llamadas


def test_set_pause_genera_solo_lua_fijo(client, juego, auth):
    r = client.post(CMD, headers=auth, json={"op": "set_pause", "paused": True})
    assert r.status_code == 200
    assert juego.ultimo_lua == "pauseGame()\nreturn '{\"ok\":true}'"


def test_set_pause_false_reanuda(client, juego, auth):
    r = client.post(CMD, headers=auth, json={"op": "set_pause", "paused": False})
    assert r.status_code == 200
    assert juego.ultimo_lua == "unpauseGame()\nreturn '{\"ok\":true}'"


@pytest.mark.parametrize("valor", ["true", "false", 0, 1, None])
def test_set_pause_exige_booleano_estricto(client, juego, auth, valor):
    r = client.post(CMD, headers=auth, json={"op": "set_pause", "paused": valor})
    assert r.status_code == 422
    assert not juego.llamadas


# --- set_auto_repair: reparto automático de tripulación de reparación (#464) --


def test_set_auto_repair_activa_genera_lua(client, juego, auth):
    r = client.post(CMD, headers=auth, json={"op": "set_auto_repair", "enabled": True})
    assert r.status_code == 200
    assert r.json()["op"] == "set_auto_repair"
    assert "commandSetAutoRepair(ship, true)" in juego.ultimo_lua
    assert "getPlayerShip(-1)" in juego.ultimo_lua


def test_set_auto_repair_desactiva_serializa_false(client, juego, auth):
    r = client.post(CMD, headers=auth, json={"op": "set_auto_repair", "enabled": False})
    assert r.status_code == 200
    assert "commandSetAutoRepair(ship, false)" in juego.ultimo_lua
    assert "False" not in juego.ultimo_lua  # no el booleano de Python


@pytest.mark.parametrize("valor", ["true", "false", 0, 1, None])
def test_set_auto_repair_exige_booleano_estricto(client, juego, auth, valor):
    r = client.post(CMD, headers=auth, json={"op": "set_auto_repair", "enabled": valor})
    assert r.status_code == 422
    assert not juego.llamadas


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


@pytest.mark.parametrize("valor", [-1.001, 1.001, 5, -100])
def test_system_health_fuera_de_rango_rechazado(client, juego, auth, valor):
    r = client.post(
        CMD, headers=auth, json={"op": "set_system_health", "system": "impulse", "value": valor}
    )
    assert r.status_code == 422
    assert not juego.llamadas


@pytest.mark.parametrize("valor", [True, False])
def test_system_health_booleano_rechazado(client, juego, auth, valor):
    # Sin strict=True Pydantic coacciona true → 1.0 (reparación total) y
    # false → 0.0: un booleano no debe convertirse en una mutación válida.
    r = client.post(
        CMD, headers=auth, json={"op": "set_system_health", "system": "impulse", "value": valor}
    )
    assert r.status_code == 422
    assert not juego.llamadas


def test_system_health_entero_en_rango_aceptado(client, juego, auth):
    # strict=True no debe romper los enteros JSON del contrato (-1, 0, 1).
    r = client.post(
        CMD, headers=auth, json={"op": "set_system_health", "system": "impulse", "value": -1}
    )
    assert r.status_code == 200
    assert 'setSystemHealth("impulse", -1.000)' in juego.ultimo_lua


def test_system_health_sistema_no_permitido_rechazado(client, juego, auth):
    r = client.post(
        CMD, headers=auth, json={"op": "set_system_health", "system": "hull", "value": -1.0}
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


@pytest.mark.parametrize(
    "callsign_malicioso",
    [
        'Lapur"); os.execute("rm -rf /"); --',
        "Lapur' or victory('Exuari')",
        "Lapur\\ y luego getPlayerShip(-1):destroy()",
        "Lapur\nreturn '{\"ok\":true,\"pwn\":1}'",
    ],
)
def test_scan_object_callsign_fuera_de_whitelist_rechazado(client, juego, auth, callsign_malicioso):
    # El patrón solo admite letras/dígitos/espacio/apóstrofo/guion/punto: nada
    # de comillas, barras invertidas ni saltos de línea puede llegar aquí, así
    # que ni hace falta que el escapador de _lua_string_literal entre en juego.
    r = client.post(CMD, headers=auth, json={"op": "scan_object", "callsign": callsign_malicioso})
    assert r.status_code == 422
    assert not juego.llamadas


@pytest.mark.parametrize(
    "callsign_malicioso",
    [
        'Lapur"); os.execute("rm -rf /"); --',
        "Lapur' or victory('Exuari')",
        "Lapur\\ y luego getPlayerShip(-1):destroy()",
    ],
)
def test_set_weapon_target_callsign_fuera_de_whitelist_rechazado(client, juego, auth, callsign_malicioso):
    r = client.post(CMD, headers=auth, json={"op": "set_weapon_target", "callsign": callsign_malicioso})
    assert r.status_code == 422
    assert not juego.llamadas


@pytest.mark.parametrize(
    "callsign_malicioso",
    [
        'Lapur"); os.execute("rm -rf /"); --',
        "Lapur' or victory('Exuari')",
        "Lapur\\ y luego getPlayerShip(-1):destroy()",
    ],
)
def test_fire_tube_callsign_fuera_de_whitelist_rechazado(client, juego, auth, callsign_malicioso):
    r = client.post(CMD, headers=auth, json={"op": "fire_tube", "callsign": callsign_malicioso, "index": 0})
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


# --- spawn_encounter: encuentros inyectados por el GM (#117) -------------------


def test_spawn_encounter_genera_lua_fijo(client, juego, auth):
    r = client.post(
        CMD, headers=auth, json={"op": "spawn_encounter", "archetype": "derelict"}
    )
    assert r.status_code == 200
    assert r.json()["op"] == "spawn_encounter"
    assert 'spawn("derelict", nil)' in juego.ultimo_lua
    assert "getScriptStorage()" in juego.ultimo_lua
    assert "storage.espaciokoop_lagunak" in juego.ultimo_lua
    assert "getPlayerShip(-1)" in juego.ultimo_lua
    # Degradación honesta cuando el escenario no registra el callback.
    assert "not_supported" in juego.ultimo_lua


def test_spawn_encounter_con_rumbo(client, juego, auth):
    r = client.post(
        CMD,
        headers=auth,
        json={"op": "spawn_encounter", "archetype": "derelict", "bearing": "port"},
    )
    assert r.status_code == 200
    assert 'spawn("derelict", "port")' in juego.ultimo_lua


@pytest.mark.parametrize("archetype", ["derelict", "patrol", "freighter", "sentry"])
def test_spawn_encounter_todos_los_arquetipos_del_catalogo(client, juego, auth, archetype):
    # Cada arquetipo del enum se acepta y viaja como cadena literal al callback;
    # el Lua emitido sigue siendo fijo (no depende del arquetipo).
    r = client.post(
        CMD, headers=auth, json={"op": "spawn_encounter", "archetype": archetype}
    )
    assert r.status_code == 200
    assert f'spawn("{archetype}", nil)' in juego.ultimo_lua


def test_spawn_encounter_arquetipos_expuestos_coinciden_con_el_enum():
    # El catálogo cerrado y la documentación no se separan sin que un test avise.
    valores = {a.value for a in bridge.EncounterArchetype}
    assert valores == {"derelict", "patrol", "freighter", "sentry"}


def test_spawn_encounter_arquetipo_fuera_de_catalogo_rechazado(client, juego, auth):
    r = client.post(
        CMD, headers=auth, json={"op": "spawn_encounter", "archetype": "kraken"}
    )
    assert r.status_code == 422
    assert not juego.llamadas


def test_spawn_encounter_rumbo_invalido_rechazado(client, juego, auth):
    r = client.post(
        CMD,
        headers=auth,
        json={"op": "spawn_encounter", "archetype": "derelict", "bearing": "north"},
    )
    assert r.status_code == 422
    assert not juego.llamadas


def test_spawn_encounter_sin_coordenadas_crudas(client, juego, auth):
    # La frontera de autoridad (ADR-0002): el cliente jamás coloca objetos por
    # posición absoluta; cualquier coordenada extra se rechaza entera.
    r = client.post(
        CMD,
        headers=auth,
        json={"op": "spawn_encounter", "archetype": "derelict", "x": 1000, "y": -2000},
    )
    assert r.status_code == 422
    assert not juego.llamadas


def test_inyeccion_por_arquetipo_rechazada(client, juego, auth):
    r = client.post(
        CMD,
        headers=auth,
        json={"op": "spawn_encounter", "archetype": '"); victory("Exuari"); ("'},
    )
    assert r.status_code == 422
    assert not juego.llamadas


# --- reposition_ship: reposición de la nave a un ancla nombrada (#176) ---------


def test_reposition_ship_genera_lua_fijo(client, juego, auth):
    r = client.post(
        CMD, headers=auth, json={"op": "reposition_ship", "anchor": "argia"}
    )
    assert r.status_code == 200
    assert r.json()["op"] == "reposition_ship"
    assert 'reposition("argia")' in juego.ultimo_lua
    assert "getScriptStorage()" in juego.ultimo_lua
    assert "storage.espaciokoop_lagunak" in juego.ultimo_lua
    assert "getPlayerShip(-1)" in juego.ultimo_lua
    # Degradación honesta cuando el escenario no registra el callback.
    assert "not_supported" in juego.ultimo_lua


def test_reposition_ship_ancla_fuera_de_catalogo_rechazada(client, juego, auth):
    r = client.post(
        CMD, headers=auth, json={"op": "reposition_ship", "anchor": "andromeda"}
    )
    assert r.status_code == 422
    assert not juego.llamadas


def test_reposition_ship_sin_coordenadas_crudas(client, juego, auth):
    # La frontera de autoridad (ADR-0002): el cliente jamás fija la posición por
    # coordenada absoluta; cualquier x/y colada rechaza la orden entera.
    r = client.post(
        CMD,
        headers=auth,
        json={"op": "reposition_ship", "anchor": "argia", "x": 0, "y": 0},
    )
    assert r.status_code == 422
    assert not juego.llamadas


def test_reposition_ship_ancla_faltante_rechazada(client, juego, auth):
    r = client.post(CMD, headers=auth, json={"op": "reposition_ship"})
    assert r.status_code == 422
    assert not juego.llamadas


def test_inyeccion_por_ancla_rechazada(client, juego, auth):
    r = client.post(
        CMD,
        headers=auth,
        json={"op": "reposition_ship", "anchor": '"); victory("Exuari"); ("'},
    )
    assert r.status_code == 422
    assert not juego.llamadas


# --- Comunicaciones: contestar hail, cerrar canal, diálogo, chat libre (#463) --


def test_answer_comm_hail_genera_lua(client, juego, auth):
    r = client.post(CMD, headers=auth, json={"op": "answer_comm_hail", "accept": True})
    assert r.status_code == 200
    assert r.json()["op"] == "answer_comm_hail"
    assert "commandAnswerCommHail(ship, true)" in juego.ultimo_lua
    assert "getPlayerShip(-1)" in juego.ultimo_lua


def test_answer_comm_hail_ignorar_serializa_false(client, juego, auth):
    r = client.post(CMD, headers=auth, json={"op": "answer_comm_hail", "accept": False})
    assert r.status_code == 200
    assert "commandAnswerCommHail(ship, false)" in juego.ultimo_lua
    assert "False" not in juego.ultimo_lua  # no el booleano de Python


@pytest.mark.parametrize("valor", ["true", "false", 0, 1, None])
def test_answer_comm_hail_exige_booleano_estricto(client, juego, auth, valor):
    r = client.post(CMD, headers=auth, json={"op": "answer_comm_hail", "accept": valor})
    assert r.status_code == 422
    assert not juego.llamadas


def test_close_comm_genera_lua_fijo(client, juego, auth):
    r = client.post(CMD, headers=auth, json={"op": "close_comm"})
    assert r.status_code == 200
    assert r.json()["op"] == "close_comm"
    assert "commandCloseTextComm(ship)" in juego.ultimo_lua
    assert "getPlayerShip(-1)" in juego.ultimo_lua


def test_send_comm_reply_genera_lua(client, juego, auth):
    r = client.post(CMD, headers=auth, json={"op": "send_comm_reply", "index": 2})
    assert r.status_code == 200
    assert "commandSendComm(ship, 2)" in juego.ultimo_lua


@pytest.mark.parametrize("indice", [-1, 16, 100])
def test_send_comm_reply_fuera_de_rango_rechazado(client, juego, auth, indice):
    r = client.post(CMD, headers=auth, json={"op": "send_comm_reply", "index": indice})
    assert r.status_code == 422
    assert not juego.llamadas


@pytest.mark.parametrize("valor", [True, False])
def test_send_comm_reply_booleano_rechazado(client, juego, auth, valor):
    # strict=True: sin coacción de booleanos (true -> 1 colaría como índice).
    r = client.post(CMD, headers=auth, json={"op": "send_comm_reply", "index": valor})
    assert r.status_code == 422
    assert not juego.llamadas


def test_send_comm_message_genera_lua(client, juego, auth):
    r = client.post(
        CMD, headers=auth, json={"op": "send_comm_message", "message": "Solicito atraque."}
    )
    assert r.status_code == 200
    assert "commandSendCommPlayer(ship, 'Solicito atraque.')" in juego.ultimo_lua


def test_send_comm_message_vacio_rechazado(client, juego, auth):
    r = client.post(CMD, headers=auth, json={"op": "send_comm_message", "message": ""})
    assert r.status_code == 422
    assert not juego.llamadas


def test_send_comm_message_demasiado_largo_rechazado(client, juego, auth):
    r = client.post(
        CMD, headers=auth, json={"op": "send_comm_message", "message": "x" * 257}
    )
    assert r.status_code == 422
    assert not juego.llamadas


def test_send_comm_message_escapa_comillas_simples(client, juego, auth):
    # Anti-inyección: una comilla simple sin escapar rompería el literal Lua y
    # dejaría código tras ella corriendo como Lua real.
    r = client.post(
        CMD,
        headers=auth,
        json={"op": "send_comm_message", "message": "hola'); os.execute('rm -rf /'); --"},
    )
    assert r.status_code == 200
    assert "commandSendCommPlayer(ship, 'hola\\'); os.execute(\\'rm -rf /\\'); --')" in juego.ultimo_lua
    assert juego.ultimo_lua.count("commandSendCommPlayer") == 1


# --- Navegación: maniobra de combate y atraque (#519) --------------------------


@pytest.mark.parametrize("cantidad", [0.0, 0.5, 1.0])
def test_combat_maneuver_boost_genera_lua(client, juego, auth, cantidad):
    r = client.post(
        CMD, headers=auth, json={"op": "combat_maneuver_boost", "amount": cantidad}
    )
    assert r.status_code == 200
    assert r.json()["op"] == "combat_maneuver_boost"
    assert f"commandCombatManeuverBoost(ship, {cantidad:.3f})" in juego.ultimo_lua
    assert "getPlayerShip(-1)" in juego.ultimo_lua


@pytest.mark.parametrize("cantidad", [-0.1, -1.0, 1.1])
def test_combat_maneuver_boost_solo_hacia_adelante(client, juego, auth, cantidad):
    # El eje de empuje del control nativo va 0..1: un valor negativo no es
    # marcha atrás, es una errata. Se rechaza en vez de recortarse.
    r = client.post(
        CMD, headers=auth, json={"op": "combat_maneuver_boost", "amount": cantidad}
    )
    assert r.status_code == 422
    assert not juego.llamadas


@pytest.mark.parametrize("cantidad", [-1.0, 0.0, 1.0])
def test_combat_maneuver_strafe_conserva_el_signo(client, juego, auth, cantidad):
    # A diferencia del empuje, aquí el signo es información: babor o estribor.
    r = client.post(
        CMD, headers=auth, json={"op": "combat_maneuver_strafe", "amount": cantidad}
    )
    assert r.status_code == 200
    assert f"commandCombatManeuverStrafe(ship, {cantidad:.3f})" in juego.ultimo_lua


@pytest.mark.parametrize("cantidad", [-1.1, 1.1, 100])
def test_combat_maneuver_strafe_fuera_de_rango_rechazado(client, juego, auth, cantidad):
    r = client.post(
        CMD, headers=auth, json={"op": "combat_maneuver_strafe", "amount": cantidad}
    )
    assert r.status_code == 422
    assert not juego.llamadas


@pytest.mark.parametrize("op", ["combat_maneuver_boost", "combat_maneuver_strafe"])
def test_combat_maneuver_rechaza_campos_extra(client, juego, auth, op):
    r = client.post(CMD, headers=auth, json={"op": op, "amount": 0.5, "duration": 10})
    assert r.status_code == 422
    assert not juego.llamadas


def test_dock_genera_lua_de_busqueda_y_comando(client, juego, auth):
    r = client.post(CMD, headers=auth, json={"op": "dock", "callsign": "Argia"})
    assert r.status_code == 200
    assert r.json()["op"] == "dock"
    # Misma búsqueda compartida que scan_object: comparación por nombre dentro
    # del Lua fijo, nunca una entidad enviada por el cliente.
    assert 'cs == "Argia"' in juego.ultimo_lua
    assert "target_not_found" in juego.ultimo_lua
    assert "commandDock(ship, target)" in juego.ultimo_lua


@pytest.mark.parametrize(
    "callsign_malicioso",
    ['"); victory("Exuari"); ("', "Argia\nvictory('Exuari')", 'Arg"ia'],
)
def test_dock_callsign_fuera_de_whitelist_rechazado(client, juego, auth, callsign_malicioso):
    r = client.post(CMD, headers=auth, json={"op": "dock", "callsign": callsign_malicioso})
    assert r.status_code == 422
    assert not juego.llamadas


def test_undock_genera_lua_fijo(client, juego, auth):
    r = client.post(CMD, headers=auth, json={"op": "undock"})
    assert r.status_code == 200
    assert "commandUndock(ship)" in juego.ultimo_lua


def test_abort_dock_no_es_sinonimo_de_undock(client, juego, auth):
    # Cancelar el acercamiento y soltar un atraque consumado son órdenes
    # distintas del motor; confundirlas dejaría a la nave amarrada creyendo que
    # ha soltado.
    r = client.post(CMD, headers=auth, json={"op": "abort_dock"})
    assert r.status_code == 200
    assert "commandAbortDock(ship)" in juego.ultimo_lua
    assert "commandUndock(ship)" not in juego.ultimo_lua
