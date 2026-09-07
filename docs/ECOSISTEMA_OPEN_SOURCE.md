# Ecosistema open source y fuentes de dominio público: qué se puede aprovechar

> **Issue de origen:** [#568](https://github.com/EspacioKoop/espaciokooplagunak/issues/568).
> **Qué es:** un catálogo de proyectos libres y fuentes de dominio público que pueden
> ahorrarnos trabajo, **a cualquier nivel de la pila**, con el veredicto de qué se puede
> hacer con cada uno y por qué.
> **Qué NO es:** una declaración de dependencias. Ninguna de las de aquí está declarada
> en `foundry-module/module.json` ni en `CMakeLists.txt`; declarar una es un PR aparte.
> **Qué no cubre:** la capa de módulos de Foundry, que ya tiene el suyo en
> [ECOSISTEMA_MODULOS_FOUNDRY.md](ECOSISTEMA_MODULOS_FOUNDRY.md), y el contenido de
> ambientación, que está en [DOMINIO_PUBLICO_SCIFI.md](DOMINIO_PUBLICO_SCIFI.md).

## La regla que decide antes que el gusto: nuestra licencia

Este repositorio es **GPL-2.0**, heredada de EmptyEpsilon ([`LICENSE`](../LICENSE)), y el
módulo declara `"license": "GPL-2.0"`. Eso ordena el catálogo entero, porque la
compatibilidad de licencias **no es simétrica**:

| Licencia del candidato | ¿Se puede fusionar en este repo? | Por qué |
|---|---|---|
| GPL-2.0, o «v2 o posterior» | **Sí** | Misma licencia, o el candidato permite tomar la rama v2 |
| GPL-3.0 (solo) | **No** | GPL-3.0 impone condiciones que GPL-2.0 no admite; la incompatibilidad va en un solo sentido |
| Apache-2.0 | **No** hacia GPL-2.0 | Su cláusula de patentes es compatible con GPL-3.0, no con GPL-2.0 |
| MIT / BSD / CC0 | **Sí** | Permisivas: se pueden reeditar bajo GPL |
| CC BY / CC BY-SA | Assets sí, con atribución | No es licencia de software; para datos y arte |
| Cualquier **NC** (no comercial) | **No** | Restringe el uso, que es justo lo que la GPL no permite restringir |

**Consecuencia práctica:** un proyecto GPL-3.0 excelente sirve para **leer y aprender**,
nunca para copiar código. Y esa es la mayoría del vecindario, porque casi todo lo bueno
del género se relicenció a v3.

**La licencia del proyecto no es la licencia de la pieza.** Para código suele coincidir;
para repositorios de assets y datasets, no. Un `LICENSE` en la raíz dice bajo qué
condiciones publica ese proyecto **lo suyo**, no acredita la procedencia de cada archivo
que contiene. Así que el veredicto de la tabla se aplica a la fuente, y la entrada
concreta que queramos importar se verifica igual: es el mismo criterio que
[DOMINIO_PUBLICO_SCIFI.md](DOMINIO_PUBLICO_SCIFI.md) ya aplica al contenido de
ambientación, y la razón por la que el atlas guarda procedencia y licencia POR ENTRADA.

Los cuatro veredictos que se usan abajo:

- **Depender** — entra como dependencia declarada.
- **Copiar el patrón** — se lee, se entiende y se escribe código propio. Licencia irrelevante mientras no se copien líneas.
- **Inspiración** — se mira y ya. Normalmente porque la licencia impide más.
- **Descartar** — ni eso, y se dice por qué para no volver a evaluarlo.

## Capa 1 — Simulación (C++, el núcleo heredado)

| Proyecto | Licencia | Veredicto | Por qué |
|---|---|---|---|
| [Space Nerds In Space](https://github.com/smcameron/space-nerds-in-space) | GPL-2.0 **o posterior** | **Copiar el patrón**, y es el único del que además se PODRÍA copiar código | El único simulador de puente cuya licencia es compatible con la nuestra. Comparte problema y género con EE: puestos, API Lua de misiones, universo grande con tránsito entre instancias. Su modelo de «warp gates» entre sistemas es material directo para el atlas de [#213](https://github.com/EspacioKoop/espaciokooplagunak/issues/213) |
| [Oolite](https://github.com/OoliteProject/oolite) | Código GPL-2.0-or-later; **recursos CC BY-NC-SA** | **Copiar el patrón** (solo código) | Compatible en código. Sus **assets no entran**: el `NC` los inhabilita para un proyecto GPL |
| [Endless Sky](https://github.com/endless-sky/endless-sky) | GPL-3.0 | **Inspiración** | Incompatible en un solo sentido. Su arte sí es aprovechable por separado (dominio público y CC permisivas), pero el código no |
| [Naev](https://github.com/naev/naev) | GPL-3.0 | **Inspiración** | Igual que el anterior |
| [Thorium](https://thoriumsim.com) | Revisar antes de nada | **Inspiración** | Simulador de puente más centrado en el GM y menos automatizado — exactamente el eje en el que este fork se mueve. Interesa el **diseño**, no el código |

**Lo que de verdad sale de aquí:** Space Nerds In Space es el único vecino del que se
puede tomar código, y conviene saberlo antes de reimplementar algo que allí lleva años
funcionando.

## Capa 2 — Escenarios (Lua)

| Proyecto | Licencia | Veredicto | Por qué |
|---|---|---|---|
| [Jumper](https://github.com/Yonaba/Jumper) | MIT | **Copiar el patrón** | Búsqueda de caminos en rejilla, Lua puro y sin dependencias. La navegación por la nave ya es de rejilla (`nave-movimiento.mjs`), pero eso es JS: aquí el encaje sería la IA de escenarios, no el módulo |
| [behaviourtreelua2e](https://github.com/MaxYari/behaviourtreelua2e) | Revisar | **Inspiración** | Árboles de comportamiento en Lua. Antes de traer nada: las crisis multipuesto ([#484](https://github.com/EspacioKoop/espaciokooplagunak/issues/484)) se resolvieron con máquinas de estado a mano y funcionan; un árbol de comportamiento es la respuesta a un problema que todavía no tenemos |

## Capa 3 — Arte y audio

| Fuente | Licencia | Veredicto | Por qué |
|---|---|---|---|
| [Kenney](https://kenney.nl/assets) (Space Kit, UI Pack Sci-Fi, Sci-fi Sounds, UI Audio) | **CC0** | **Depender**, si alguna vez hace falta arte que no sea nuestro | CC0 es lo más limpio que existe: sin atribución y sin condiciones. Es la fuente por defecto para sonido de interfaz |
| [NASA 3D Resources](https://github.com/nasa/NASA-3D-Resources) | NASA Open Source Agreement 1.3 en el repositorio, con material de terceros posible | **Caso a caso**, pieza a pieza | Modelos y texturas reales de misión. Los materiales de NASA generalmente no están sujetos a copyright en EE. UU., pero **eso no se extrapola al repositorio entero**: la NASA advierte que ocasionalmente incluye material de terceros protegido, y hay que verificar procedencia y condiciones de la pieza concreta que se quiera importar. Además, marcas e identificadores de la NASA tienen sus propias restricciones: no se puede usar de forma que insinúe que la NASA respalda nada |
| [OpenGameArt](https://opengameart.org) | Mezcla; hay que mirar entrada por entrada | **Caso a caso** | Mismo criterio que ya aplica `DOMINIO_PUBLICO_SCIFI.md`: sin licencia verificada, se descarta |

**Advertencia que este proyecto ya se ha ganado:** la estética es propia y deliberada
(pixelart de rejilla única, paleta corta, escalonado por época). Un pack ajeno bien hecho
**estorba** si rompe esa frontera. El sitio natural de los assets externos es lo que no
tiene estética propia — sonido de interfaz—, no los muros de la nave.

## Capa 4 — Puente (Python)

`bridge/` ya depende de `fastapi`, `uvicorn` y `httpx` — MIT/BSD, sin fricción con
GPL-2.0 y ya declarados en `requirements.txt`. Lo que sigue no es esa capa (eso no
es investigación, ya está resuelto); es qué más del ecosistema Python encajaría en
lo que el puente todavía hace a mano.

| Proyecto | Licencia | Veredicto | Por qué |
|---|---|---|---|
| [slowapi](https://github.com/laurentS/slowapi) | MIT | **Descartar** | Limitador de frecuencia para FastAPI. `rate_limit.py` es un *token bucket* de 29 líneas, sin dependencias, ajustado a «una mesa de juego» — el criterio 4 de `ECOSISTEMA_MODULOS_FOUNDRY.md` (copiar el patrón sale más barato que heredar el módulo) ya se cumplió antes de que este documento existiera |
| [PyJWT](https://github.com/jpadilla/pyjwt) / [python-jose](https://github.com/mpdavis/python-jose) | MIT | **Inspiración**, no hace falta hoy | El puente autentica hoy con un token opaco de sesión (`bridge-token-session.mjs` en el lado Foundry, solo en memoria del GM). Si algún día el contrato v0 necesita tokens firmados con expiración verificable en vez de un secreto compartido, aquí está el patrón; traerlo ahora sería una dependencia para un problema que no tenemos |
| [pydantic-settings](https://github.com/pydantic/pydantic-settings) | MIT | **Copiar el patrón** | `pydantic` ya llega transitivamente con FastAPI. La configuración del puente hoy es variables de entorno leídas a mano en `app.py`; si crece, el patrón de `pydantic-settings` (modelo tipado desde env) es más barato de escribir a mano con lo que ya está instalado que de añadir como dependencia nueva |
| [websockets](https://github.com/python-websockets/websockets) | BSD-3-Clause | **Inspiración** | El contrato v0 del puente es HTTP request/response, no push. Si `bridge/` necesita alguna vez empujar eventos al módulo Foundry en vez de que este haga *polling* (como hace hoy la consola caliente, `consola-caliente-poll.mjs`), aquí está la implementación de referencia — pero eso es una decisión de arquitectura del contrato v0, no algo que este catálogo autorice |

**Lo que de verdad sale de aquí:** la capa Python es la que menos hueco tiene para
candidatos nuevos, precisamente porque `bridge/` ya es pequeño y ya usa las tres
piezas permisivas que necesitaba. El patrón se repite: nada de esta capa se declara
solo porque exista.

## Capa 5 — Datos (donde más hay que ganar)

| Fuente | Licencia | Veredicto | Por qué |
|---|---|---|---|
| [HYG / AT-HYG](https://codeberg.org/astronexus/athyg) | CC BY-SA-4.0 | **Depender** — el mejor candidato del documento | Catálogo estelar real (Hipparcos, Yale, Gliese, Tycho-2, Gaia DR3) **con los nombres propios oficiales de la IAU**. `catalogo-cosmografico.mjs` ya exige procedencia y licencia POR ENTRADA: HYG encaja en ese formato sin tocarlo. Es la diferencia entre un atlas de sistemas inventados y uno donde el cielo es el de verdad |
| [NASA Image and Video Library](https://images.nasa.gov) | Generalmente sin copyright en EE. UU., con excepciones de terceros | **Caso a caso**, con la misma cautela de marca | Fondos y referencia visual. Mismo criterio que 3D Resources: la excepción de terceros se comprueba en la entrada concreta, no se presume del conjunto |
| [Open MCT](https://github.com/nasa/openmct) | Apache-2.0 | **Inspiración**, y nada más | Marco web de control de misión de la NASA: telemetría en vivo, paneles componibles. Es exactamente nuestro problema en la consola del GM ([#276](https://github.com/EspacioKoop/espaciokooplagunak/issues/276))… y **su licencia no entra en un GPL-2.0**. Se mira cómo resuelven la composición de paneles y se escribe lo nuestro |

**El aviso de CC BY-SA:** obliga a atribuir **y** a compartir igual las obras derivadas de
los datos. Para un catálogo consultable no es problema; convertirlo en un derivado
integrado sí arrastra la condición. Por eso el formato del atlas guarda la licencia por
entrada: fue una buena decisión antes de tener a quién aplicársela.

## Lo que este documento NO recomienda

- **Cambiar la licencia del repo a GPL-3.0 para poder tomar código de Endless Sky o Naev.**
  Se puede hacer legalmente, pero es una decisión de proyecto que afecta a la relación con
  EmptyEpsilon aguas arriba ([ADR-0007](adr/0007-frontera-upstream.md)) y no se compra con
  un módulo de nadie.
- **Traer una librería para un problema que ya está resuelto a mano.** Media docena de
  cosas de esta lista serían dependencias nuevas para código que ya funciona y está
  probado. El criterio 4 de `ECOSISTEMA_MODULOS_FOUNDRY.md` —copiar el patrón sale más
  barato que heredar el módulo— vale igual aquí.

## Relacionado

- **[INSPIRACION_JUEGOS_LIBRES.md](INSPIRACION_JUEGOS_LIBRES.md) (issue [#840](https://github.com/EspacioKoop/espaciokooplagunak/issues/840)):** estudia *qué mecánica de rol robar* de juegos libres, no de qué dependencias traer. Es el complemento de este documento: aquí se decide **de qué depender**; allí se decide **qué idea reutilizar** (sin tocar código ajeno, por la frontera #568).
