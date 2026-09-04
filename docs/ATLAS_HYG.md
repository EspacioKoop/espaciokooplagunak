# Atlas desde HYG: el cielo real en el formato de #213

> **Issues:** [#568](https://github.com/EspacioKoop/espaciokooplagunak/issues/568) (de dónde sale) ·
> [#213](https://github.com/EspacioKoop/espaciokooplagunak/issues/213) (dónde se decide si se usa).
> **Estado:** adaptador escrito y probado, **sin cablear a nada**. Igual que
> `catalogo-cosmografico.mjs`, es un cimiento a la espera de que #213 se decida.

## Qué es

`foundry-module/scripts/atlas-hyg.mjs` convierte el CSV del catálogo estelar **HYG**
—Hipparcos, Yale, Gliese, Tycho-2 y Gaia DR3, con los nombres propios oficiales de la
IAU— en un catálogo con el formato que define `catalogo-cosmografico.mjs`.

```js
import { atlasDesdeHyg } from "./scripts/atlas-hyg.mjs";

const atlas = atlasDesdeHyg(csvComoTexto);           // todas las que tengan nombre
const cortito = atlasDesdeHyg(csvComoTexto, { maximo: 100 }); // las 100 más brillantes
const trazable = atlasDesdeHyg(csvComoTexto, { versionHyg: "4.1" }); // la edición usada
```

Sale un `{ format, version, entries }` listo para `validateCosmography`. Una prueba lo
comprueba, porque el adaptador **no** importa el validador: acoplarlos obligaría a pagar
la validación en cada importación.

## El CSV no está en el repositorio, y es deliberado

HYG es **CC BY-SA-4.0**: obliga a atribuir y a compartir igual las obras derivadas.
Empaquetar el CSV dentro de un módulo GPL-2.0 mezcla dos licencias sin ninguna necesidad.
Se sigue el patrón de [CONTENIDO_EXTERNO.md](CONTENIDO_EXTERNO.md): si quien juega tiene
el fichero, esto lo aprovecha; si no, no pasa nada.

Descarga: <https://codeberg.org/astronexus/hyg> (o AT-HYG, con la misma licencia).

**La atribución viaja con el dato.** Cada entrada generada lleva su `provenance` con
fuente, licencia y URL — que es exactamente el mecanismo que el formato ya tenía previsto,
y la forma de cumplir CC BY-SA sin pelearse con la GPL.

**Y con la versión.** HYG tiene historial: su documentación identifica **4.x** como
CC BY-SA 4.0, y ediciones anteriores llevaban otras condiciones. El CSV no declara cuál
es, así que lo declara quien importa con `versionHyg`, y queda escrito en el `source` de
cada estrella (`HYG Database 4.1 (AstroNexus)`). Va dentro de `source` y no en una clave
nueva porque el contrato cosmográfico fija exactamente las claves de `provenance`, y
ampliarlo por comodidad de un importador sería la cola moviendo al perro. Sin esto, un
catálogo generado hoy y otro generado de una edición distinta son indistinguibles después
—y con ellos, la licencia que declaran deja de ser comprobable—. Por defecto se escribe
`4.x`, que es lo que corresponde a la licencia declarada.

**Que no haya CSV no es un error.** Sin fichero simplemente no hay atlas HYG: el
adaptador devuelve un catálogo con solo el plano raíz, que es válido, y quien lo consuma
sigue funcionando. No se lanza nada ni se avisa de nada, igual que en
[CONTENIDO_EXTERNO.md](CONTENIDO_EXTERNO.md).

## Qué decide el adaptador, y por qué

| Decisión | Por qué |
|---|---|
| Solo estrellas con **nombre propio** de la IAU | HYG trae ~120.000 filas y el formato admite 2.000. Es el único corte que produce un atlas **nombrable**: una mesa dice «vamos a Aldebarán», no «vamos a HIP 21421». Son ~450 |
| Ordenadas por **brillo** | Es el orden en que una mesa las conocería. (El Sol sale primero: magnitud −26,7. No es un fallo de orden) |
| Los resúmenes salen **solo de los datos** | Tipo espectral, distancia y magnitud. Nada de facciones ni de historia: eso es contenido de campaña y lo decide quien juega |
| Lo que falta, **no se menciona** | Una estrella sin distancia publicada no dice a cuántos años luz está. Inventarlo para que la frase quede redonda sería mentir con formato válido |
| Las columnas se leen **por nombre** | HYG ha cambiado de orden entre versiones; leer por índice es cómo un importador se rompe en silencio con la siguiente |
| Un `plane` raíz llamado `espacio-real` | El formato exige que todo sistema tenga un padre de tipo `plane`, y el cielo real no viene con uno puesto. Es la única entrada con procedencia propia |

## Lo que NO hace

- **No se cablea a la partida.** #213 sigue sin decidirse; cablearlo promovería a hecho una
  decisión que no está tomada.
- **No trae planetas.** El formato admite `planet` colgando de un sistema, pero HYG es un
  catálogo de estrellas. Los exoplanetas son otra fuente y otra licencia.
- **No mezcla continuidades.** Todo entra como `continuity: "original"`: el cielo real no
  es Spelljammer ni homebrew.
