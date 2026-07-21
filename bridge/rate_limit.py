"""Límite de frecuencia global del puente (token bucket)."""

from __future__ import annotations

import threading
import time


class _TokenBucket:
    """Límite de frecuencia global, suficiente para una mesa de juego."""

    def __init__(self, rate: float, burst: float) -> None:
        self._rate = rate
        self._capacity = burst
        self._tokens = burst
        self._updated = time.monotonic()
        self._lock = threading.Lock()

    def allow(self) -> bool:
        with self._lock:
            now = time.monotonic()
            self._tokens = min(
                self._capacity, self._tokens + (now - self._updated) * self._rate
            )
            self._updated = now
            if self._tokens < 1:
                return False
            self._tokens -= 1
            return True
