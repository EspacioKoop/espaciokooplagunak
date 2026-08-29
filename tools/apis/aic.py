"""Cliente para el Art Institute of Chicago."""
from .core import pedir, _en_cache_por_acceso
import urllib.parse


def aic(num):
    """Ficha del Art Institute of Chicago. Sin clave, y filtra campos en la
    propia consulta para no traerse el objeto entero."""
    o = _en_cache_por_acceso(num, "%artic.edu%", campo="main_reference_number")
    if o:
        return {"fuente": "aic", "titulo": o.get("title"),
                "autor": o.get("artist_title"),
                "dominio_publico": o.get("is_public_domain")}
    campos = "id,title,artist_title,is_public_domain,main_reference_number"
    # `AIC-User-Agent` lo piden explícitamente en su documentación («a matter
    # of courtesy»), y `fields` es su propia recomendación para no traerse el
    # objeto entero. Cuesta nada y es la diferencia entre un consumidor
    # educado y uno al que acaban capando.
    d = pedir("https://api.artic.edu/api/v1/artworks/search"
              f"?q={urllib.parse.quote(num)}&fields={campos}&limit=5",
              cabeceras={"AIC-User-Agent": "lagunak-verificador"})
    for o in (d or {}).get("data") or []:
        if (o.get("main_reference_number") or "").upper() == num.upper():
            return {"fuente": "aic", "titulo": o.get("title"),
                    "autor": o.get("artist_title"),
                    "dominio_publico": o.get("is_public_domain")}
    return None
