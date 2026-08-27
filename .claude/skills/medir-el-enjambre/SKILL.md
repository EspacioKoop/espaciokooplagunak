---
name: medir-el-enjambre
description: Consultar la telemetría de Hermes y OmniRoute sin tropezar con el esquema — tasas por proveedor, amplificación de peticiones, caché, estado del tablero y salud de los servicios. Úsala antes de afirmar cualquier cifra sobre el enjambre, y siempre que una medida sorprenda: el instrumento falla más que el sistema.
---

# Medir el enjambre

**Duda del instrumento antes que del sistema.** Casi todas las «anomalías» de este
enjambre han resultado ser medidas mal hechas: una consulta de combos mala en tres
sitios a la vez, una tasa de proveedor diluida por pings de salud, una alarma de
amplificación disparada por 26 peticiones. Los tropiezos de abajo están medidos, no
supuestos.

## Antes de escribir la primera consulta

- **No hay `sqlite3` en el PATH.** Usa `python3` con el módulo `sqlite3`.
- **Abre siempre en solo lectura**: `sqlite3.connect("file:...?mode=ro", uri=True)`.
  OmniRoute está escribiendo mientras consultas.
- Bases: `~/.omniroute/storage.sqlite` (telemetría) y `~/.hermes/kanban.db` (tablero).

## Los tropiezos del esquema

| Creerás que se llama | Se llama |
|---|---|
| `call_logs.created_at` | **`timestamp`** (ISO con `Z`) |
| `call_logs.status_code` | **`status`** |
| `tasks.body` para el criterio | `body`, pero el criterio va dentro, en markdown |

`call_logs.request_type` está **casi siempre a NULL**: no sirve para filtrar.

## La regla que decide si una cifra vale

**Un intento upstream real es una fila con `combo_step_id IS NOT NULL`.** Las demás
son dos cosas, y cada una estropea la medida de una forma distinta:

1. **Pings de salud** (`model = 'connection-test'`, `path = /api/providers/test`).
   Llevan el proveedor **real** y devuelven 200 casi siempre, así que **inflan la tasa
   de éxito de un proveedor muerto**. Midiendo mal, `mistral` salía al 63 % mientras
   llevaba 31 de 31 intentos reales en 402.
2. **Envoltorios de combo.** Una fila resumen por petición lógica, sin escalón; 1097
   de 5263 llevan el **nombre del combo** en la columna `provider`, así que inventan
   proveedores que no existen y doblan el conteo.

El filtro, siempre:

```python
S = " AND combo_step_id IS NOT NULL AND COALESCE(model,'') NOT LIKE '%connection-test%'"
```

## Recetas verificadas

```python
import sqlite3
c = sqlite3.connect("file:/home/eloy/.omniroute/storage.sqlite?mode=ro", uri=True)
S = " AND combo_step_id IS NOT NULL AND COALESCE(model,'') NOT LIKE '%connection-test%'"

# Tasa real por proveedor
c.execute(f"""SELECT provider, count(*), sum(status=200), sum(status=429),
  sum(status>=500) FROM call_logs WHERE timestamp>'2026-08-22'{S}
  GROUP BY 1 HAVING count(*)>30 ORDER BY 2 DESC""").fetchall()

# Conexiones habilitadas de verdad (el /health devuelve las CONFIGURADAS)
c.execute("SELECT sum(is_active), count(*) FROM provider_connections").fetchone()

# Caché: 'upstream' es la del proveedor y funciona; 'semantic' es la de OmniRoute
c.execute(f"""SELECT cache_source, count(*), sum(COALESCE(tokens_cache_read,0))
  FROM call_logs WHERE timestamp>'2026-08-22' GROUP BY 1""").fetchall()
```

Amplificación y reintentos **no los reimplementes**: ya están, y con la clasificación
correcta.

```bash
~/.hermes/bin/amplificacion.py --horas 24 --json   # trae 'veredicto' ya calculado
~/.hermes/bin/omniroute-mando.py estado
```

## Lo que NO se puede medir aquí

`provider_connections.backoff_level` y `rate_limited_until` **están a 0 y a NULL
siempre**, pese a existir la sentencia que los escribe. No construyas nada sobre ellos:
mídelo todo sobre `call_logs`.

## Un ratio sin muestra no es una medida

`amplificacion.py` no da veredicto por debajo de `MUESTRA_MINIMA` (200 peticiones
lógicas) y dice «muestra insuficiente». Respeta eso: con ventanas cortas un solo retry
mueve el ratio décimas enteras, y la alarma acaba midiendo el silencio. Un **conteo**
(p. ej. `retry_tras_429_mismo_escalon`) sí vale con poca muestra; el **ratio** no.

## Tablero y servicios

```bash
hermes kanban list --status blocked        # también ready / running / done
hermes kanban show <id>                    # cuerpo, comentarios y eventos
systemctl --user is-active omniroute hermes-gateway
```

`hermes kanban block` quiere **las banderas antes** del id posicional, o argparse se
atraganta: `hermes kanban block --kind needs_input <id> "motivo"`.

Las 42 herramientas MCP de OmniRoute **no son alcanzables por REST** (`/api/mcp/call`
da 404): se sirven por el protocolo MCP y se usan desde una sesión o una skill.

## Al reiniciar

**Nunca `systemctl --user restart hermes-gateway` a secas.** OmniRoute admite UNA sesión
MCP global y el gateway anterior la retiene: el nuevo arranca con `400 Bad Request` y
las herramientas MCP apagadas, sin más aviso que una línea del journal. Usa
`~/.hermes/bin/reiniciar-enjambre.sh`, que hace el orden correcto y **comprueba** que
MCP conectó.

## Un aviso sobre `grep -c` en bash

Imprime `0` **y además** sale con rc 1. Un `$(grep -c … || echo 0)` produce `"0\n0"` y
`[ "0\n0" -lt … ]` revienta con «se esperaba una expresión entera» — sin `set -e` el
script sigue y la comprobación se salta en silencio. Usa `| head -1`.
