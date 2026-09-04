"""Núcleo del cliente de APIs: caché, ritmo y presupuesto."""
import json
import os
import sqlite3
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request

# Configuración de caché y User-Agent
# La cache va donde diga el entorno y, si no, al directorio temporal del
# sistema. NUNCA a una ruta con el nombre de una persona dentro: este
# repositorio es publico, y una ruta asi ademas se rompe para quien clone.
# Medido el 2026-08-22: por no tener este modulo en el arbol, DOS agentes se
# inventaron una ruta a un directorio personal para suplirlo.
CACHE = os.path.join(
    os.environ.get("LAGUNAK_CACHE") or tempfile.gettempdir(),
    "lagunak-apis.sqlite")
UA = {"User-Agent": "lagunak-verificador/1.0 (+https://github.com/EspacioKoop/espaciokooplagunak)"}

# Segundos entre peticiones al mismo host, y tope de peticiones por día.
#
# Estos números NO son inventados: salen de la documentación de cada API
# (consultada el 2026-08-20). Donde el proveedor publica un límite, nos
# quedamos deliberadamente por debajo; donde no publica ninguno, aplicamos el
# ritmo más conservador del módulo, porque el silencio no es permiso.
RITMO = {
    # Met: «Please limit request rate to 80 requests per second», sin clave.
    # 5/s es 16 veces menos que su tope; de sobra para verificar documentos.
    "collectionapi.metmuseum.org": (0.2, 500),

    # Wikidata: sin tope duro publicado para la Action API, pero exige
    # User-Agent descriptivo y pide acceso en serie, no en paralelo.
    "www.wikidata.org": (1.0, 400),

    # Rijksmuseum: NO publica límite en su documentación de Data Services.
    # Sin cifra oficial, ritmo prudente. Silencio != barra libre.
    # Son DOS hosts porque la búsqueda devuelve identificadores que se
    # resuelven en otro dominio, y cada obra cuesta una petición a cada uno:
    # por eso los topes van emparejados.
    "data.rijksmuseum.nl": (1.5, 300),   # búsqueda por objectNumber
    "id.rijksmuseum.nl": (1.5, 300),     # resolución de la ficha (~100 KB)
    "www.rijksmuseum.nl": (1.5, 200),    # API antigua de Rijksstudio, en desuso

    # Europeana: su FAQ dice que las operaciones de lectura no tienen
    # limitación... pero también que los límites de las claves personales «se
    # han ido reduciendo progresivamente» frente a las de proyecto. Como la
    # nuestra es personal, no nos fiamos de la promesa general.
    "api.europeana.eu": (1.0, 500),

    # AIC: «Anonymous users are throttled to 60 requests per minute», y además
    # recomiendan «no more than one per second» y no paralelizar. Hacemos caso
    # a la recomendación (1/s), que es más estricta que el tope (1/s = 60/min).
    "api.artic.edu": (1.0, 300),

    # Freesound: 60/min y 2000/día documentados para lectura. Nos quedamos en
    # la mitad del tope diario.
    "freesound.org": (1.0, 1000),

    # NASA Image and Video Library: sin clave y sin límite publicado para este
    # endpoint (el de api.nasa.gov, que sí lo tiene, es otro servicio distinto).
    "images-api.nasa.gov": (1.0, 300),

    # Lospec: sin límite publicado. Es un sitio pequeño mantenido por su
    # comunidad, así que aquí la prudencia es sobre todo educación.
    "lospec.com": (2.0, 150),
}
RITMO_POR_DEFECTO = (2.0, 100)

TTL_OK = 90 * 24 * 3600     # las fichas de museo no cambian
TTL_FALLO = 6 * 3600        # un fallo puede ser pasajero; no insistir en bucle


def _con():
    os.makedirs(os.path.dirname(CACHE), exist_ok=True)
    c = sqlite3.connect(CACHE, timeout=20)
    c.execute("CREATE TABLE IF NOT EXISTS respuestas ("
              "url TEXT PRIMARY KEY, cuerpo TEXT, ok INTEGER, guardado REAL)")
    c.execute("CREATE TABLE IF NOT EXISTS gasto ("
              "host TEXT, dia TEXT, n INTEGER, ultima REAL, PRIMARY KEY (host, dia))")
    return c


def _presupuesto(c, host):
    """(¿puedo pedir?, segundos que debo esperar antes). Consume una unidad."""
    espera, tope = RITMO.get(host, RITMO_POR_DEFECTO)
    dia = time.strftime("%Y-%m-%d")
    fila = c.execute("SELECT n, ultima FROM gasto WHERE host=? AND dia=?",
                     (host, dia)).fetchone()
    n, ultima = fila if fila else (0, 0.0)
    if n >= tope:
        return False, 0.0
    pausa = max(0.0, espera - (time.time() - (ultima or 0.0)))
    c.execute("INSERT INTO gasto (host, dia, n, ultima) VALUES (?,?,?,?) "
              "ON CONFLICT(host, dia) DO UPDATE SET n=n+1, ultima=?",
              (host, dia, 1, time.time() + pausa, time.time() + pausa))
    c.commit()
    return True, pausa


# Por qué `None` no basta como respuesta. Medido el 2026-08-20: el verificador
# de arte reportó «no se encuentra en la colección» para seis obras cuando lo
# que pasaba es que el presupuesto diario estaba agotado y no se había pedido
# nada. Estuvo a punto de acusar de inventarse datos a quien no lo había hecho.
#
# «No lo encuentro» y «no he podido preguntar» son cosas distintas y quien
# llama tiene que poder distinguirlas. `ULTIMO_MOTIVO` dice cuál de las dos fue
# la última vez que `pedir` devolvió None.
#
#   "ok"            -> hubo respuesta
#   "no_encontrado" -> se preguntó y la fuente no lo tiene (o dio error)
#   "presupuesto"   -> NO se preguntó: tope diario del host agotado
#   "cache_fallo"   -> NO se preguntó: hay un fallo reciente cacheado (TTL_FALLO)
ULTIMO_MOTIVO = "ok"


def pedir(url, cabeceras=None, forzar=False):
    """GET con caché permanente, ritmo y presupuesto. None si no se pudo.

    Cuando devuelve None, `ULTIMO_MOTIVO` explica por qué.
    """
    global ULTIMO_MOTIVO
    ULTIMO_MOTIVO = "ok"
    c = _con()
    try:
        if not forzar:
            fila = c.execute("SELECT cuerpo, ok, guardado FROM respuestas WHERE url=?",
                             (url,)).fetchone()
            if fila:
                cuerpo, ok, guardado = fila
                if time.time() - guardado < (TTL_OK if ok else TTL_FALLO):
                    if not ok:
                        ULTIMO_MOTIVO = "cache_fallo"
                    return json.loads(cuerpo) if ok else None

        host = urllib.parse.urlparse(url).netloc
        puedo, pausa = _presupuesto(c, host)
        if not puedo:
            # Presupuesto agotado: se avisa una vez y se sigue sin pedir.
            print(f"  · presupuesto diario agotado para {host}; no se pide", flush=True)
            ULTIMO_MOTIVO = "presupuesto"
            return None
        if pausa:
            time.sleep(pausa)

        cab = dict(UA)
        cab.update(cabeceras or {})
        datos, ok = None, 0
        try:
            req = urllib.request.Request(url, headers=cab)
            with urllib.request.urlopen(req, timeout=25) as r:
                datos = json.load(r)
                ok = 1
        except Exception:
            datos, ok = None, 0

        c.execute("INSERT OR REPLACE INTO respuestas VALUES (?,?,?,?)",
                  (url, json.dumps(datos) if ok else "null", ok, time.time()))
        c.commit()
        if not ok:
            ULTIMO_MOTIVO = "no_encontrado"
        return datos if ok else None
    finally:
        c.close()


# Valores que parecen clave pero no lo son: plantillas sin rellenar. Sin esto,
# un `CLAVE=...` copiado de un ejemplo se toma por buena y el cliente manda
# peticiones condenadas a fallar, gastando presupuesto para nada.
_MARCADORES = {"", "...", "…", "xxx", "tu-clave", "your-key", "changeme",
               "todo", "pon-aqui-tu-clave", "<valor>", "none", "null"}


def _cargar_env():
    """Las claves salen del ENTORNO, y de ningun otro sitio.

    La version anterior leia un `.env` de un directorio personal. Eso hacia el
    modulo comodo dentro de una maquina concreta e inservible fuera, y metia
    una ruta con nombre propio en un repositorio publico. Quien necesite claves
    las exporta antes de llamar; el modulo no va a buscarlas por el disco.
    """
    return


def _en_cache_por_acceso(num, patron_url, campo="accessionNumber"):
    """Busca una ficha YA descargada cuyo número de acceso coincida.

    La petición más barata es la que no se hace. `met()` costaba una búsqueda
    más hasta diez fichas por número, y repetía ese gasto aunque el objeto
    estuviera en la caché desde hacía semanas: la caché indexa por URL, y la
    URL de búsqueda cambia con cada consulta. Aquí se mira por número de
    acceso, que es lo que de verdad identifica a la obra.
    """
    c = _con()
    try:
        for (cuerpo,) in c.execute(
                "SELECT cuerpo FROM respuestas WHERE ok=1 AND url LIKE ?",
                (patron_url,)):
            try:
                o = json.loads(cuerpo)
            except Exception:
                continue
            # Dos formas: la ficha suelta (Met) o una respuesta de busqueda
            # con la lista en `data` (Art Institute). Se miran las dos.
            candidatos = [o] if isinstance(o, dict) else []
            if isinstance(o, dict) and isinstance(o.get("data"), list):
                candidatos += [x for x in o["data"] if isinstance(x, dict)]
            for x in candidatos:
                if (x.get(campo) or "").upper() == num.upper():
                    return x
    except Exception:
        pass
    finally:
        c.close()
    return None


def _clave(nombre):
    v = os.environ.get(nombre, "").strip().strip('"').strip("'")
    # Un comentario al final de la linea en el .env no siempre lo quita quien
    # carga el fichero; si el valor trae almohadilla, nos quedamos con lo de antes.
    if "#" in v:
        v = v.split("#", 1)[0].strip()
    if v.lower() in _MARCADORES or set(v) <= {".", "…"}:
        return None
    return v or None
