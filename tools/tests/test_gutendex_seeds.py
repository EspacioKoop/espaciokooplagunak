"""Network-free regression of copyright filtering and bounded output."""
import importlib.util
from pathlib import Path
from types import SimpleNamespace
from urllib.parse import parse_qs, urlparse

import pytest

spec = importlib.util.spec_from_file_location("gutendex_seeds", Path(__file__).parents[1] / "gutendex_seeds.py")
assert spec is not None and spec.loader is not None
seeds = importlib.util.module_from_spec(spec)
spec.loader.exec_module(seeds)


def test_filter_and_limit(monkeypatch):
    urls = []
    books = [{"id": i, "copyright": value} for i, value in enumerate([True, None, 0, "false", False, False])]
    books.insert(0, {"id": 99})
    def get(url, timeout):
        urls.append(url)
        assert timeout == 30
        return SimpleNamespace(raise_for_status=lambda: None, json=lambda: {"results": books})
    monkeypatch.setattr(seeds, "requests", SimpleNamespace(get=get))
    result = seeds.fetch_books("fairy tales & myths", 1)
    assert [book["id"] for book in result] == [4]
    assert result[0]["copyright"] is False
    query = parse_qs(urlparse(urls[0]).query)
    assert query == {"topic": ["fairy tales & myths"], "languages": ["en"], "copyright": ["false"]}
    assert len(seeds.fetch_books("adventure", 32)) == 2


@pytest.mark.parametrize("limit", [0, -1, 33, True, None, "1", 1.5])
def test_invalid_limit_before_network(monkeypatch, limit):
    monkeypatch.setattr(seeds, "requests", None)
    with pytest.raises(ValueError):
        seeds.fetch_books("adventure", limit)


def test_missing_dependency(monkeypatch):
    monkeypatch.setattr(seeds, "requests", None)
    with pytest.raises(RuntimeError):
        seeds.fetch_books("adventure", 1)


def test_http_failure_propagates(monkeypatch):
    def fail():
        raise RuntimeError("HTTP failed")
    monkeypatch.setattr(seeds, "requests", SimpleNamespace(get=lambda *a, **k: SimpleNamespace(raise_for_status=fail)))
    with pytest.raises(RuntimeError, match="HTTP failed"):
        seeds.fetch_books("adventure", 1)
