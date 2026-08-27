"""Clientes de las APIs externas de Lagunak, con la tacañería por defecto.

El módulo entero sigue una regla:

    **Una petición que no se hace no puede fallar, no gasta cuota y es
    instantánea. La mejor petición es la que no se manda.**

Tres frenos, en este orden:

1. **Caché en disco, permanente.** Una ficha de museo es *inmutable*: el objeto
   SK-C-5 seguirá siendo La Ronda de Noche el año que viene. Se pide una vez en
   la vida y se guarda.
2. **Límite de ritmo por host.** Espera entre peticiones al mismo dominio en vez
   de dispararlas juntas y comerse un 429.
3. **Presupuesto diario por host.** Tope duro. Un bucle que se desmande gasta su
   presupuesto y para, en vez de tumbar la cuenta.

Los fallos también se cachean (menos tiempo), porque reintentar en bucle algo
que no existe fue justo lo que pasó con los modelos gratuitos.

Claves: por variable de entorno. Sin clave, el cliente devuelve None y lo dice;
nunca revienta ni deja al script sin salida.

    EUROPEANA_API_KEY     gratuita: pro.europeana.eu/page/get-api
    FREESOUND_API_KEY     gratuita: freesound.org/apiv2/apply

**El Rijksmuseum y el Art Institute of Chicago no necesitan clave**, ni el Met
ni Wikidata. Para el Rijksmuseum se usa la plataforma abierta
`data.rijksmuseum.nl` (Linked Art), no la API antigua de Rijksstudio, que sí
pedía clave y está en desuso.

Un valor de plantilla sin rellenar (`...`, `tu-clave`, `changeme`) cuenta como
clave ausente: si no, el cliente creería tenerla y gastaría presupuesto en
peticiones condenadas a fallar.
"""

from .core import pedir, ULTIMO_MOTIVO
from .met import met
from .rijks import rijks
from .aic import aic
from .europeana import europeana
from .freesound import freesound
from .nasa import nasa, nasa_asset
from .lospec import lospec, lospec_aleatoria
from .wikidata import wikidata
from .openverse import openverse_audio

__all__ = [
    'pedir', 'ULTIMO_MOTIVO',
    'met', 'rijks', 'aic', 'europeana', 'freesound',
    'nasa', 'nasa_asset', 'lospec', 'lospec_aleatoria',
    'wikidata', 'openverse_audio'
]
