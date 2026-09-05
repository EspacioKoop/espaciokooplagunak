# Telemetría desconocida y posiciones ausentes (#1005)

**OTACON Astra** — corrección acotada; no certifica terminada la modernización.

## Contrato y delta observable

La ausencia no es una medición cero. `null`, `undefined`, cadenas vacías o
blancas, booleanos, arrays, objetos y números no finitos se rechazan antes de
coerción. Se conservan números finitos y cadenas numéricas no vacías, incluido
`0`, por compatibilidad con las lecturas existentes.

- `ship-view/telemetria-difusion.mjs` conserva desconocido en rumbo, casco,
  energía, escudos, sistemas, maniobra, cuenta atrás, frecuencia y sondas.
  No crea salas/equipos ni destinos de reparación con coordenadas ausentes.
- `contactos-degradados.mjs` rechaza posiciones incompletas en ambos ejes,
  también en contactos propios, centro de nave y centro de sonda. Sin centro
  conocido devuelve `null`, no una exploración vacía ni un contacto en el origen.
- `station-workspaces.mjs` no vuelve a convertir el desconocido recibido en
  rumbo, posición, velocidad, proporciones ni cuenta atrás cero. Un máximo
  ocultado por la allowlist sigue oculto: no se inventa un porcentaje ni se
  amplía la difusión para rellenarlo. La plantilla omite la línea de rumbo
  cuando no existe una lectura; el resto de indicadores conserva `—`.
- La deduplicación incluye `sensoresSonda`: perder/recuperar solo la posición
  de la sonda debe publicar la transición, aunque nave y radar propio no cambien.

Se mantienen allowlist, supresión de códigos/credenciales, coordenadas absolutas
ocultas, niveles de escaneo y resolución por banda. No cambian órdenes, permisos,
HTTP, licencia ni manifest de compatibilidad.

## Reproducción y pruebas

Base de reproducción negativa: `234d58573036a69afb5fb0269ef453023410a5ac`.
Revalidación positiva tras rebase: `be9ebe2e2bab63d6aa0bff99fd30658f63c3e749`.
Node `v22.23.2`, fixtures explícitamente sintéticos, catálogo español del módulo.

```bash
node --test foundry-module/tests/unknown-telemetry-chain.test.mjs
node --test --experimental-test-coverage foundry-module/tests/unknown-telemetry-chain.test.mjs
bash -c 'shopt -s globstar; node --test foundry-module/tests/**/*.test.mjs'
git diff --check
```

La regresión atraviesa productor → publicación inyectada → serialización JSON →
receptores reales → modelo real del puesto. No es solo un test de normalizador.

- Suite nueva sobre archivo de la base inmutable: **7 pasan / 22 fallan**, 29
  pruebas. Reproduce rumbo/carga cero falsos, contactos ficticios, interior
  incompleto y transición de sonda perdida.
- Sobre la corrección: **29/29 pasan**.
- Suite completa del módulo: **2481/2481 pasan**, sin omisiones ni cancelaciones.
- Cobertura focal de líneas / ramas: contactos **98,78% / 79,55%**;
  difusión **98,50% / 79,41%**; workspace **81,66% / 60,23%**. Son métricas de la
  suite nueva, no del repositorio entero ni una afirmación de cobertura total.
- El workflow `foundry-module.yml` descubre recursivamente los `.test.mjs`;
  la regresión entra en la puerta existente sin modificar CI.

## Límites y review

La publicación es una función inyectada en Node, **no escritura a un setting
Foundry real**. No se ha desplegado ni consultado simulación, puente ni datos de
partida. No se ha probado GUI con licencia en v11.302/dnd5e 2.3.1 ni en host
moderno. No se amplía `compatibility.verified`.

Este lote no audita todos los estados booleanos, contadores de sensores, todos
los consumidores gráficos ni el DTO completo del puente. La revisión profunda
restante sigue abierta en #1005. La interfaz aún puede necesitar una revisión
separada de estados no numéricos y de la distinción entre radar sin lectura y
conteo vacío. No atribuir esa cobertura a esta regresión.

Antes de editar se consultaron los archivos de las 84 PR abiertas, incluidas
#1006–#1008: las rutas de implementación modificadas estaban libres. La plantilla
también figura en #961 y exige revalidar ese solapamiento antes de integrar. No
se modifica `bridge-client.mjs`, ocupado por #1007, ni los renderers de canvas.
Rollback: revertir el commit acotado, sin migración de formato ni de datos.
