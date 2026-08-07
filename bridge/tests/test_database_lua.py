"""Prueba adversarial de /v1/database (#520).

La base de datos científica es un ÁRBOL de entidades encadenadas por `parent`,
y eso trae dos problemas que no tiene ningún otro recurso del puente:

- **el identificador**. No hay uno estable en el juego, así que se usa la RUTA de
  nombres ("Naves/Exuari/Cazador"), que es como se navega el árbol en la
  pantalla nativa. Una entrada sin nombre no tiene ruta, y sin ruta se descarta
  entera en vez de colarse con un id inventado;
- **los ciclos**. Un `parent` que apunte hacia arriba en círculo colgaría el
  juego dentro de `/exec.lua`, y el puente solo vería un timeout. Hay un tope de
  profundidad y aquí se comprueba que de verdad corta.

Se ejecuta el Lua real contra un mundo simulado; requiere un intérprete Lua.
"""

from __future__ import annotations

import json
import shutil
import subprocess

import pytest

import app as bridge

_CABECERA = r"""
-- Constructor de entradas: cada una es una entidad con su componente.
local function entrada(nombre, padre, descripcion, pares)
    local e = {}
    e.components = {
        science_database = {
            name = nombre,
            description = descripcion,
            parent = padre,
            key_values = pares or {},
        },
    }
    return e
end
"""


def _interprete_lua():
    for nombre in ("lua5.3", "lua5.4", "lua"):
        ruta = shutil.which(nombre)
        if ruta:
            return ruta
    return None


def _ejecutar(tmp_path, cuerpo_mundo: str) -> dict:
    lua = _interprete_lua()
    if lua is None:
        pytest.skip("no hay intérprete Lua para probar el encoder real")
    driver = (
        _CABECERA
        + cuerpo_mundo
        + "\nlocal function cuerpo()\n"
        + bridge._DATABASE_LUA
        + "\nend\nio.write(cuerpo())\n"
    )
    ruta = tmp_path / "driver_database.lua"
    ruta.write_text(driver, encoding="utf-8")
    proc = subprocess.run([lua, str(ruta)], capture_output=True, timeout=10)
    assert proc.returncode == 0, proc.stderr.decode("utf-8", "replace")
    return json.loads(proc.stdout.decode("utf-8"))


_ARBOL = """
local naves = entrada("Naves", nil, "Clasificación de naves", nil)
local exuari = entrada("Exuari", naves, nil, nil)
local cazador = entrada("Cazador", exuari, "Rápido y frágil", {
    { key = "Casco", value = "70" },
    { key = "Escudos", value = "40" },
})
local todas = { naves, exuari, cazador }
function getEntitiesWithComponent(nombre) return todas end
"""


def test_el_id_es_la_ruta_de_nombres(tmp_path):
    entradas = {e["id"]: e for e in _ejecutar(tmp_path, _ARBOL)["entries"]}
    assert set(entradas) == {"Naves", "Naves/Exuari", "Naves/Exuari/Cazador"}
    hoja = entradas["Naves/Exuari/Cazador"]
    assert hoja["name"] == "Cazador"
    assert hoja["parent"] == "Naves/Exuari"
    assert hoja["description"] == "Rápido y frágil"
    assert hoja["values"] == [
        {"key": "Casco", "value": "70"},
        {"key": "Escudos", "value": "40"},
    ]


def test_la_raiz_no_tiene_padre_y_lo_dice_con_null(tmp_path):
    entradas = {e["id"]: e for e in _ejecutar(tmp_path, _ARBOL)["entries"]}
    assert entradas["Naves"]["parent"] is None
    # Sin descripción se publica null, no una cadena vacía: "no tiene ficha" y
    # "tiene una ficha en blanco" son cosas distintas.
    assert entradas["Naves/Exuari"]["description"] is None


def test_una_entrada_sin_nombre_se_descarta_entera(tmp_path):
    # Sin nombre no hay ruta, y sin ruta no hay identificador estable. Colarla
    # con un id inventado sería peor: dos entradas anónimas chocarían.
    mundo = """
local sin_nombre = entrada(nil, nil, "fantasma", nil)
local buena = entrada("Naves", nil, nil, nil)
local todas = { sin_nombre, buena }
function getEntitiesWithComponent(nombre) return todas end
"""
    salida = _ejecutar(tmp_path, mundo)
    assert [e["id"] for e in salida["entries"]] == ["Naves"]
    assert salida["total"] == 1
    assert "fantasma" not in json.dumps(salida)


def test_un_hijo_de_padre_sin_nombre_tampoco_se_publica(tmp_path):
    # Su ruta sería incompleta y por tanto ambigua: mejor no publicarla que
    # publicar una que no lleva a ningún sitio.
    mundo = """
local sin_nombre = entrada(nil, nil, nil, nil)
local hijo = entrada("Cazador", sin_nombre, nil, nil)
local todas = { sin_nombre, hijo }
function getEntitiesWithComponent(nombre) return todas end
"""
    assert _ejecutar(tmp_path, mundo)["entries"] == []


def test_un_ciclo_de_padres_no_cuelga_el_juego(tmp_path):
    # LA prueba de este archivo. Sin tope de profundidad esto sería un bucle
    # infinito DENTRO de /exec.lua: el juego entero se queda colgado y el puente
    # solo ve un timeout, sin forma de saber por qué.
    mundo = """
local a = entrada("A", nil, nil, nil)
local b = entrada("B", a, nil, nil)
a.components.science_database.parent = b
local todas = { a, b }
function getEntitiesWithComponent(nombre) return todas end
"""
    salida = _ejecutar(tmp_path, mundo)
    # No se exige un contenido concreto: se exige que TERMINE y devuelva JSON.
    assert isinstance(salida["entries"], list)


def test_sin_base_de_datos_la_respuesta_es_vacia_y_no_un_error(tmp_path):
    mundo = "function getEntitiesWithComponent(nombre) return {} end\n"
    assert _ejecutar(tmp_path, mundo) == {"entries": [], "truncated": False, "total": 0}


def test_el_truncamiento_se_declara_en_vez_de_disimularse(tmp_path):
    mundo = """
local todas = {}
for i = 1, 450 do todas[i] = entrada("Ficha " .. i, nil, nil, nil) end
function getEntitiesWithComponent(nombre) return todas end
"""
    salida = _ejecutar(tmp_path, mundo)
    assert len(salida["entries"]) == 400
    assert salida["total"] == 450
    assert salida["truncated"] is True


def test_los_pares_clave_valor_tambien_estan_acotados(tmp_path):
    mundo = """
local pares = {}
for i = 1, 40 do pares[i] = { key = "k" .. i, value = i } end
local todas = { entrada("Ficha", nil, nil, pares) }
function getEntitiesWithComponent(nombre) return todas end
"""
    salida = _ejecutar(tmp_path, mundo)
    assert len(salida["entries"][0]["values"]) == 24


def test_nombres_con_comillas_no_rompen_el_json(tmp_path):
    mundo = """
local todas = { entrada('Nave "rara"', nil, 'con \\\\ barra', nil) }
function getEntitiesWithComponent(nombre) return todas end
"""
    salida = _ejecutar(tmp_path, mundo)
    assert salida["entries"][0]["name"] == 'Nave "rara"'
