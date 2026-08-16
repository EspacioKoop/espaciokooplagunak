# Ecosistema open source y fuentes de dominio público: qué se puede aprovechar

> **Issue de origen:** [#568](https://github.com/VaroTv7/espaciokooplagunak/issues/568).
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

Los cuatro veredictos que se usan abajo:

- **Depender** — entra como dependencia declarada.
- **Copiar el patrón** — se lee, se entiende y se escribe código propio. Licencia irrelevante mientras no se copien líneas.
- **Inspiración** — se mira y ya. Normalmente porque la licencia impide más.
- **Descartar** — ni eso, y se dice por qué para no volver a evaluarlo.

## Capa 1 — Simulación (C++, el núcleo heredado)

| Proyecto | Licencia | Veredicto | Por qué |
|---|---|---|---|
| [Space Nerds In Space](https://github.com/smcameron/space-nerds-in-space) | GPL-2.0 **o posterior** | **Copiar el patrón**, y es el único del que además se PODRÍA copiar código | El único simulador de puente cuya licencia es compatible con la nuestra. Comparte problema y género con EE: puestos, API Lua de misiones, universo grande con tránsito entre instancias. Su modelo de «warp gates» entre sistemas es material directo para el atlas de [#213](https://github.com/VaroTv7/espaciokooplagunak/issues/213) |
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
| [behaviourtreelua2e](https://github.com/MaxYari/behaviourtreelua2e) | Revisar | **Inspiración** | Árboles de comportamiento en Lua. Antes de traer nada: las crisis multipuesto ([#484](https://github.com/VaroTv7/espaciokooplagunak/issues/484)) se resolvieron con máquinas de estado a mano y funcionan; un árbol de comportamiento es la respuesta a un problema que todavía no tenemos |

## Capa 3 — Arte y audio

| Fuente | Licencia | Veredicto | Por qué |
|---|---|---|---|
| [Kenney](https://kenney.nl/assets) (Space Kit, UI Pack Sci-Fi, Sci-fi Sounds, UI Audio) | **CC0** | **Depender**, si alguna vez hace falta arte que no sea nuestro | CC0 es lo más limpio que existe: sin atribución y sin condiciones. Es la fuente por defecto para sonido de interfaz |
| [NASA 3D Resources](https://github.com/nasa/NASA-3D-Resources) | Sin copyright en EE.UU. | **Depender** con cautela | Modelos y texturas reales de misión. La cautela es de MARCA, no de copyright: no se puede usar de forma que insinúe que la NASA respalda nada |
| [OpenGameArt](https://opengameart.org) | Mezcla; hay que mirar entrada por entrada | **Caso a caso** | Mismo criterio que ya aplica `DOMINIO_PUBLICO_SCIFI.md`: sin licencia verificada, se descarta |

**Advertencia que este proyecto ya se ha ganado:** la estética es propia y deliberada
(pixelart de rejilla única, paleta corta, escalonado por época). Un pack ajeno bien hecho
**estorba** si rompe esa frontera. El sitio natural de los assets externos es lo que no
tiene estética propia — sonido de interfaz—, no los muros de la nave.

## Capa 4 — Datos (donde más hay que ganar)

| Fuente | Licencia | Veredicto | Por qué |
|---|---|---|---|
| [HYG / AT-HYG](https://codeberg.org/astronexus/athyg) | CC BY-SA-4.0 | **Depender** — el mejor candidato del documento | Catálogo estelar real (Hipparcos, Yale, Gliese, Tycho-2, Gaia DR3) **con los nombres propios oficiales de la IAU**. `catalogo-cosmografico.mjs` ya exige procedencia y licencia POR ENTRADA: HYG encaja en ese formato sin tocarlo. Es la diferencia entre un atlas de sistemas inventados y uno donde el cielo es el de verdad |
| [NASA Image and Video Library](https://images.nasa.gov) | Sin copyright en EE.UU. | **Depender** con la misma cautela de marca | Fondos y referencia visual |
| [Open MCT](https://github.com/nasa/openmct) | Apache-2.0 | **Inspiración**, y nada más | Marco web de control de misión de la NASA: telemetría en vivo, paneles componibles. Es exactamente nuestro problema en la consola del GM ([#276](https://github.com/VaroTv7/espaciokooplagunak/issues/276))… y **su licencia no entra en un GPL-2.0**. Se mira cómo resuelven la composición de paneles y se escribe lo nuestro |

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
