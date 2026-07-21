"""Regresiones para cuerpos que intentan agotar el parser del puente."""

from __future__ import annotations

import json

import app as bridge

CMD = "/v1/command"


def _post_json_text(client, auth, body):
    return client.post(
        CMD,
        headers={**auth, "Content-Type": "application/json"},
        content=body,
    )


def test_json_muy_grande_se_rechaza_antes_de_tocar_el_juego(client, juego, auth):
    body = json.dumps(
        {
            "op": "set_impulse",
            "value": 0.5,
            "padding": "x" * bridge.MAX_REQUEST_BODY_BYTES,
        }
    )

    response = _post_json_text(client, auth, body)

    assert response.status_code == 413
    assert response.json() == {"detail": "Cuerpo de petición demasiado grande"}
    assert not juego.llamadas


def test_cadena_excesivamente_larga_se_rechaza(client, juego, auth):
    body = json.dumps(
        {
            "op": "spawn_encounter",
            "archetype": "x" * bridge.MAX_REQUEST_BODY_BYTES,
        }
    )

    response = _post_json_text(client, auth, body)

    assert response.status_code == 413
    assert not juego.llamadas


def test_json_profundamente_anidado_se_rechaza_sin_parsearlo(client, juego, auth):
    depth = bridge.MAX_REQUEST_BODY_BYTES // 6 + 1
    body = '{"x":' * depth + "null" + "}" * depth
    assert len(body.encode("utf-8")) > bridge.MAX_REQUEST_BODY_BYTES

    response = _post_json_text(client, auth, body)

    assert response.status_code == 413
    assert not juego.llamadas


def test_transferencia_fragmentada_sin_content_length_respeta_el_limite(
    client, juego, auth
):
    chunks = iter(
        [
            b'{"op":"set_impulse","value":0.5,"padding":"',
            b"x" * bridge.MAX_REQUEST_BODY_BYTES,
            b'"}',
        ]
    )

    response = client.post(
        CMD,
        headers={**auth, "Content-Type": "application/json"},
        content=chunks,
    )

    assert response.status_code == 413
    assert not juego.llamadas


def test_cuerpo_en_el_limite_sigue_aceptado(client, juego, auth):
    command = b'{"op":"set_impulse","value":0.5}'
    body = command + b" " * (bridge.MAX_REQUEST_BODY_BYTES - len(command))
    assert len(body) == bridge.MAX_REQUEST_BODY_BYTES

    response = _post_json_text(client, auth, body)

    assert response.status_code == 200
    assert "commandImpulse(0.500)" in juego.ultimo_lua
