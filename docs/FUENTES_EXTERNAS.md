# Manual de fuentes externas: qué comprobar antes de creerse una API

> **Referencia obligatoria:** [ASSETS_LIBRES.md](ASSETS_LIBRES.md) y [CONTENIDO_EXTERNO.md](CONTENIDO_EXTERNO.md) ya existen y contienen criterios de licencia, filtrado y consumidor. Este documento **no los repite**: enlaza y añade el procedimiento de verificación técnica.

---

## El procedimiento de cuatro pasos

Antes de escribir **una sola línea** de código contra una fuente externa, ejecuta estos cuatro pasos en orden. Si uno falla, la fuente no se usa.

### 1. Resuelve la URL real (no la que dice la skill / el README / el blog)

```bash no-ejecutar
curl -s -o /dev/null -w "%{http_code}" "URL_CANDIDATA" && echo ""
```
- Debe devolver `200`. Cualquier otra cosa (301, 302, 404, 403) significa que la URL publicada **no es la que responde**.
- Sigue redirecciones con `-L` solo para confirmar el destino final, pero **la URL que vas a usar en el código es la que devuelve 200 sin redirección**.

### 2. Descarga y examina la respuesta real (no el ejemplo de la docs)

```bash no-ejecutar
curl -s "URL_REAL" | head -200
```
- Verifica que el **esquema** (claves, arrays, tipado) coincide con lo que la skill afirma.
- Si es HTML en vez de JSON, la fuente no es una API consumible tal cual.

### 3. Comprueba la licencia **del archivo**, no del repositorio

```bash no-ejecutar
curl -s "URL_LICENSE_O_METADATA" | grep -i license
```
- La licencia del repo (p. ej. `NASA Open Source Agreement 1.3` en la raíz) **no acredita** la licencia de cada pieza.
- Para datos: busca campo `license` en la respuesta, o página de la pieza concreta.
- **Ausencia de campo de licencia ≠ dominio público**. Ver regla de procedencia abajo.

### 4. Deja constancia escrita (comando + salida + decisión)

En el PR o en la issue que trae la integración, pega:
- El comando exacto del paso 1 y su salida (`200` o el código real).
- El comando exacto del paso 2 y las primeras líneas que prueban el esquema.
- El comando exacto del paso 3 y lo que dice la licencia.
- Decisión: **se usa / se descarta / necesita verificación humana**.

> **Regla:** un comando que no se ha ejecutado **no existe**. Los tres casos abajo incluyen sus comandos listos para copiar-pegar y ejecutar; la suite de tests los ejecuta.

---

## Tres casos medidos (2026-08-22)

### Caso 1 — NASA 3D Resources: la URL del repo está mal en la skill

**Afirmación de la skill / docs antiguas:** `https://github.com/nasa/3D-Resources`  
**Realidad:**

```bash
curl -s -o /dev/null -w "%{http_code}" "https://github.com/nasa/3D-Resources" && echo ""
# Salida: 404

curl -s -o /dev/null -w "%{http_code}" "https://github.com/nasa/NASA-3D-Resources" && echo ""
# Salida: 200
```

**URL buena:** `https://github.com/nasa/NASA-3D-Resources`  
**Decisión:** actualizar cualquier referencia al repo correcto antes de tocar código.

---

### Caso 2 — NASA meta.json: no existe array `models[]`

**Afirmación de la skill:** «el `meta.json` tiene un array `models[]` con los modelos».  
**Realidad:**

```bash
curl -s "https://raw.githubusercontent.com/nasa/NASA-3D-Resources/master/meta.json" | head -200
# Salida:
# {
# "title": "NASA-3D-Resources",
# "visibility": "public",
# "type": "GIT",
# "description": "collection of 3D models, textures, and images from inside NASA",
# "url": "https://github.com/nasa/NASA-3D-Resources",
# "repo": "nasa/NASA-3D-Resources",
# "missions":["OCIO", "ARC", "Code I"],
# "categories": ["NASA", "Open Data", "Models", "3d Printing"],
# "languages": [],
# "operating_systems": ["Linux", "Windows", "Unix", "Mac"],
# "poc": "ARC Special Projects",
# "poc_mbox": " arc-special-proj@lists.nasa.gov",
# "license": "NASA Open Source Agreement Version 1.3",
# "software_types": ["3D Models", "3D Printing", "Graphics", "Assets"]
# }
```

**Claves reales:** `title`, `visibility`, `type`, `description`, `url`, `repo`, `missions`, `categories`, `languages`, `operating_systems`, `poc`, `poc_mbox`, `license`, `software_types`.  
**No hay `models[]`.** Los modelos están en los directorios `3D Models/`, `3D Printing/`, `Images and Textures/` — hay que recorrer el árbol de GitHub, no leer un array inexistente.  
**Decisión:** cualquier código que espere `meta.json.models` está roto; reescribir contra la API de contenidos de GitHub (`/contents/{path}`).

---

### Caso 3 — dnd5e API: endpoint 5e-bits da 404, el que funciona es dnd5eapi.co

**Afirmación de la skill / docs antiguas:** `https://5e-bits.github.io/api/classes.json`  
**Realidad:**

```bash
curl -s -o /dev/null -w "%{http_code}" "https://5e-bits.github.io/api/classes.json" && echo ""
# Salida: 404

curl -s -o /dev/null -w "%{http_code}" "https://www.dnd5eapi.co/api/2014/classes" && echo ""
# Salida: 200

curl -s "https://www.dnd5eapi.co/api/2014/classes" | head -200
# Salida:
# {"count":12,"results":[{"index":"barbarian","name":"Barbarian","url":"/api/2014/classes/barbarian"},{"index":"bard","name":"Bard","url":"/api/2014/classes/bard"},{"index":"cleric","name":"Cleric","url":"/api/2014/classes/cleric"},{"index":"druid","name":"Druid","url":"/api/2014/classes/druid"},{"index":"fighter","name":"Fighter","url":"/api/2014/classes/fighter"},{"index":"monk","name":"Monk","url":"/api/2014/classes/monk"},{"index":"paladin","name":"Paladin","url":"/api/2014/classes/paladin"},{"index":"ranger","name":"Ranger","url":"/api/2014/classes/ranger"},{"index":"rogue","name":"Rogue","url":"/api/2014/classes/rogue"},{"index":"sorcerer","name":"Sorcerer","url":"/api/2014/classes/sorcerer"},{"index":"warlock","name":"Warlock","url":"/api/2014/classes/warlock"},{"index":"wizard","name":"Wizard","url":"/api/2014/classes/wizard"}]}
```

**Endpoint bueno:** `https://www.dnd5eapi.co/api/2014/classes` (y resto de endpoints bajo `/api/2014/`).  
**Decisión:** cambiar la base URL en el adaptador antes de escribir consumidores.

---

## Regla de procedencia (ya aplicada en el proyecto)

> **La ausencia de un fichero de licencia NO es dominio público.**

- NASA devuelve `"license": "NASA Open Source Agreement Version 1.3"` a nivel de repo, pero **advertencia explícita**: «occasionally includes third-party protected material». La pieza concreta se verifica **caso a caso** (ver [ECOSISTEMA_OPEN_SOURCE.md](ECOSISTEMA_OPEN_SOURCE.md) § Capa 3 y 4).
- El módulo `tools/nasa3d.py` (o su equivalente actual) **declara `licencia_declarada: null`** y **enlaza las condiciones de uso de la NASA** en vez de afirmar «dominio público».
- El mismo criterio rige para **cualquier** fuente: si la respuesta no trae campo de licencia por entrada, **no se asume CC0 / PD** — se marca `licencia_desconocida` y se requiere verificación humana antes de importar.

Ver [ASSETS_LIBRES.md](ASSETS_LIBRES.md) §3 «La trampa, antes que la lista» y [PROCEDENCIA_ASSETS.md](PROCEDENCIA_ASSETS.md) §1 «La trampa, escrita antes que la lista».

---

## Checklist para el revisor del PR

Cuando veas una integración nueva contra fuente externa, exige en la descripción del PR:

- [ ] Paso 1 ejecutado: URL real devuelve 200 (pegar comando y salida).
- [ ] Paso 2 ejecutado: esquema real coincide con lo que el código espera (pegar comando y primeras líneas).
- [ ] Paso 3 ejecutado: licencia de la **entrada concreta** verificada (pegar comando y salida).
- [ ] Paso 4: decisión escrita y trazable.

Si falta cualquiera, **el PR no se aprueba**. La excusa «la skill lo decía» no existe desde esta fecha.

---

## Enlaces a documentos base (no repetir su contenido)

- [ASSETS_LIBRES.md](ASSETS_LIBRES.md) — filtro técnico, trampa de licencia del archivo vs obra, fuentes verificadas y por verificar, precio de entrada medido, reglas para traer algo.
- [CONTENIDO_EXTERNO.md](CONTENIDO_EXTERNO.md) — integración dnd5e opcional, filtro 2014 cerrado, contrato funcional, cero contenido de terceros en repo.
- [PROCEDENCIA_ASSETS.md](PROCEDENCIA_ASSETS.md) — ficha obligatoria por asset, trampa obra/archivo, ejemplos León de Al-Lât y Colección Real de Vaciados (SMK).
- [ECOSISTEMA_OPEN_SOURCE.md](ECOSISTEMA_OPEN_SOURCE.md) — catálogo por capas, veredictos (Depender / Copiar patrón / Inspiración / Descartar), regla de compatibilidad GPL-2.0, advertencia NASA caso a caso.
- [DOMINIO_PUBLICO_SCIFI.md](DOMINIO_PUBLICO_SCIFI.md) — mismo criterio de verificación por entrada aplicado al contenido de ambientación.