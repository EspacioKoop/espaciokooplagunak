"""Tests del token-bucket (`_TokenBucket`), lógica pura con reloj controlado."""

from __future__ import annotations

import app as bridge


def test_permite_hasta_la_rafaga_y_luego_bloquea(monkeypatch):
    reloj = {"t": 1000.0}
    monkeypatch.setattr(bridge.time, "monotonic", lambda: reloj["t"])
    bucket = bridge._TokenBucket(rate=10, burst=3)

    # Sin avanzar el reloj, solo hay `burst` tokens.
    assert bucket.allow() is True
    assert bucket.allow() is True
    assert bucket.allow() is True
    assert bucket.allow() is False


def test_recarga_con_el_tiempo(monkeypatch):
    reloj = {"t": 0.0}
    monkeypatch.setattr(bridge.time, "monotonic", lambda: reloj["t"])
    bucket = bridge._TokenBucket(rate=10, burst=2)

    assert bucket.allow() is True
    assert bucket.allow() is True
    assert bucket.allow() is False  # agotado

    reloj["t"] = 0.1  # 0.1 s * 10 tok/s = 1 token nuevo
    assert bucket.allow() is True
    assert bucket.allow() is False


def test_la_recarga_no_supera_la_capacidad(monkeypatch):
    reloj = {"t": 0.0}
    monkeypatch.setattr(bridge.time, "monotonic", lambda: reloj["t"])
    bucket = bridge._TokenBucket(rate=10, burst=2)

    reloj["t"] = 100.0  # tiempo de sobra para muchos tokens
    # Aun así, nunca más de `burst`.
    assert bucket.allow() is True
    assert bucket.allow() is True
    assert bucket.allow() is False
