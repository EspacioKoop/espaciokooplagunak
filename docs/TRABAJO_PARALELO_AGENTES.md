# Repartir trabajo entre agentes

Cómo partir el trabajo de este repositorio entre varios agentes, subagentes y modelos sin que se
pisen. El contrato de conducta está en [`AGENTS.md`](../AGENTS.md) y el flujo de entrega en
[`CONTRIBUTING.md`](../CONTRIBUTING.md); esto es lo otro: **quién puede tocar qué a la vez**.

No es teoría. Los puntos de colisión de más abajo son los que ya han chocado de verdad, y cada uno
trae la regla que lo desactiva.

## La regla de oro

> Un issue, una rama, un PR, un área. Si dos unidades de trabajo tienen que editar el mismo archivo,
> **no son dos unidades**: es una, y va con un solo agente.

Todo lo demás de este documento es cómo cumplir esa frase sin tener que adivinar.

---

## El mapa de áreas

Dos agentes en áreas distintas pueden trabajar a la vez sin coordinarse. Dos en la misma área se
coordinan o se turnan. La columna de pruebas es lo que tiene que estar en verde **antes** de abrir el
PR: cada área se verifica sola, y por eso se pueden entregar por separado.

<!-- MAPA_AREAS -->

| Área | Rutas | Pruebas |
|---|---|---|
| Simulación (C++) | `src/**` | `ctest --test-dir build -R content` (más compilar) |
| Escenarios (Lua) | `scripts/**/*.lua` | `find scripts -iname '*.lua' -print0 \| xargs -0 -n1 luac -p` |
| Puente | `bridge/**` | `cd bridge && pytest` |
| Herramientas | `tools/**` | `python3 -m pytest tools/tests` |
| Módulo: orquestación | `foundry-module/scripts/main.mjs`, `foundry-module/scripts/lagunak-constantes.mjs`, `foundry-module/scripts/control-escena.mjs`, `foundry-module/scripts/puerta-catalogo.mjs`, `foundry-module/scripts/idioma-modulo.mjs`, `foundry-module/scripts/foco-render.mjs`, `foundry-module/scripts/filtros-escena.mjs`, `foundry-module/scripts/diagnostico-conexion.mjs`, `foundry-module/module.json` | `node --test foundry-module/tests/*.test.mjs` |
| Módulo: puente y telemetría | `foundry-module/scripts/bridge-*.mjs`, `foundry-module/scripts/telemetria-*.mjs`, `foundry-module/scripts/contactos-*.mjs`, `foundry-module/scripts/sensores-*.mjs`, `foundry-module/scripts/resolver-*.mjs`, `foundry-module/scripts/casco-*.mjs`, `foundry-module/scripts/ship-view.mjs`, `foundry-module/scripts/barras-estado.mjs`, `foundry-module/scripts/base-datos-cientifica.mjs`, `foundry-module/scripts/lamina-contacto.mjs`, `foundry-module/scripts/*-control.mjs`, `foundry-module/scripts/consola-caliente-*.mjs`, `foundry-module/scripts/panel-gm*.mjs` | `node --test foundry-module/tests/*.test.mjs` |
| Módulo: puestos y autoridad | `foundry-module/scripts/station-*.mjs`, `foundry-module/scripts/requisitos-puesto.mjs`, `foundry-module/scripts/proyeccion-puesto.mjs`, `foundry-module/scripts/asistencia*.mjs`, `foundry-module/scripts/asistencia/**` | `node --test foundry-module/tests/*.test.mjs` |
| Módulo: eventos y ambiente | `foundry-module/scripts/alarma-*.mjs`, `foundry-module/scripts/alerta*.mjs`, `foundry-module/scripts/nivel-alerta.mjs`, `foundry-module/scripts/alertas-nave.mjs`, `foundry-module/scripts/bitacora-nave.mjs`, `foundry-module/scripts/event-journal.mjs`, `foundry-module/scripts/musica-*.mjs`, `foundry-module/scripts/audio-*.mjs` | `node --test foundry-module/tests/*.test.mjs` |
| Módulo: escenas y 3D | `foundry-module/scripts/nave-*.mjs`, `foundry-module/scripts/retro3d*.mjs`, `foundry-module/scripts/escena-*.mjs`, `foundry-module/scripts/props-*.mjs`, `foundry-module/scripts/piel-textura.mjs`, `foundry-module/scripts/playa-escena.mjs`, `foundry-module/scripts/museo-escena.mjs`, `foundry-module/scripts/cantina*.mjs`, `foundry-module/scripts/terraza-cantina.mjs`, `foundry-module/scripts/seccion-*.mjs`, `foundry-module/scripts/horizonte-*.mjs`, `foundry-module/scripts/visor-piloto*.mjs`, `foundry-module/scripts/mapa-*.mjs`, `foundry-module/scripts/decorado-fondo.mjs`, `foundry-module/scripts/ventana-nave.mjs`, `foundry-module/scripts/andar-nave-app.mjs`, `foundry-module/scripts/rig-esqueleto.mjs` | `node --test foundry-module/tests/*.test.mjs` |
| Módulo: arte y avatares | `foundry-module/scripts/paleta.mjs`, `foundry-module/scripts/avatar-*.mjs`, `foundry-module/scripts/retrato-tripulante.mjs`, `foundry-module/scripts/ficha-nave*.mjs`, `foundry-module/scripts/iconos-sistema.mjs`, `foundry-module/scripts/laminas-clasicas.mjs`, `foundry-module/scripts/png-indexado.mjs` | `node --test foundry-module/tests/*.test.mjs` |
| Módulo: minijuegos | `foundry-module/scripts/minijuegos/**`, `foundry-module/scripts/minijuegos-wiring.mjs` | `node --test foundry-module/tests/*.test.mjs` |
| Módulo: catálogos con procedencia | `foundry-module/scripts/catalogo-*.mjs`, `foundry-module/scripts/procedencia-*.mjs`, `foundry-module/scripts/museo-piezas.mjs`, `foundry-module/scripts/atlas-hyg.mjs`, `foundry-module/data/**` | `node --test foundry-module/tests/*.test.mjs` |
| Módulo: contenido externo del GM | `foundry-module/scripts/contenido-externo/**` | `node --test foundry-module/tests/*.test.mjs` |
| Documentación | `docs/**`, `README.md`, `CLAUDE.md`, `AGENTS.md`, `CONTRIBUTING.md` | — (revisión humana) |

<!-- /MAPA_AREAS -->

`tools/tests/test_mapa_areas.py` comprueba que este mapa no se pudra: que toda ruta declarada existe
de verdad y que **ningún módulo de `foundry-module/scripts/` queda fuera de todas las áreas**. Un
módulo nuevo sin área es un módulo que nadie sabe quién puede tocar.

Lo que NO exige es que un módulo esté en una sola área: hay piezas que legítimamente son dos cosas
—el museo es escena y es catálogo con procedencia— y forzar una partición limpia obligaría a mentir
sobre eso. El área es a quién avisar, no una propiedad exclusiva.

**El mapa se actualiza en el PR que trae el módulo**, igual que su documentación. Si tu módulo aún
está en vuelo cuando escribes el mapa, declara la ruta y anótala en `EN_VUELO` (en esa misma prueba)
con su número de PR: la excepción se limpia sola, porque en cuanto el archivo existe la prueba exige
retirarla.

---

## Los puntos de colisión, y la regla que los desactiva

Estos archivos los toca **casi cualquier** trabajo del módulo, así que son donde chocan dos ramas que
por lo demás no se rozan. La regla general es la misma en todos: **añade al final del bloque que te
toca, no reordenes, y si te lo pisan, rebasa — nunca fuerces.**

| Archivo | Por qué choca | Regla |
|---|---|---|
| `CLAUDE.md` | Todo PR de módulo mete su párrafo en la lista de grupos | Inserta tu bullet **completo** y no toques los vecinos: el conflicto queda en una línea y se resuelve solo |
| `foundry-module/lang/es.json` y `en.json` | Toda función nueva trae claves | Añade las claves **juntas y al final de su bloque temático**, y las dos lenguas en el mismo commit |
| `foundry-module/scripts/main.mjs` | Es donde se declaran las herramientas de la barra | Un botón nuevo va como **entrada de un catálogo** (`puerta-catalogo.mjs`, `panel-gm.mjs`, `cantina.mjs`), no como herramienta suelta |
| `foundry-module/tests/main-compat.test.mjs` | Fija la lista exacta de herramientas | Si de verdad añades una herramienta, actualiza la lista en el mismo commit |
| `foundry-module/scripts/paleta.mjs` | Toda escena nueva quiere su grupo de color | Grupo **nuevo al final**; no toques los grupos ajenos ni "de paso" |
| `foundry-module/tests/paleta.test.mjs` | `MODULOS_DE_ARTE` crece con cada módulo de arte | Añade tu módulo el día que nace, al final de la lista |
| `foundry-module/tests/modulos-alcanzables.test.mjs` | `HUERFANOS_DECLARADOS` | Solo se toca si tu módulo nace huérfano; con motivo y número de issue |
| `foundry-module/scripts/nave-catalogo-andar.mjs` | Toda estancia nueva | Estancia nueva **al final** del catálogo |
| `README.md` | El roadmap por fases | Marca solo tu línea; no reescribas las de al lado |

**Cómo se resuelve cuando pasa igualmente:** el segundo en mergear rebasa su rama sobre `main`,
resuelve el conflicto (que será de una o dos líneas) y vuelve a lanzar la suite del área. Nunca
`push --force` sobre trabajo ajeno, nunca `merge -X ours` a ciegas: los dos bullets tienen que
sobrevivir, porque los dos describen código que existe.

---

## Cómo se parte un issue

Un issue se parte en **verticales finos**, no en capas horizontales. Un vertical trae su módulo puro,
su suite y su documentación, y se puede mergear solo aunque los demás no lleguen nunca.

- **Bien**: «formato y validación» → «la sala que lo consume» → «el catálogo de contenido». Cada uno
  es un PR con verde propio. Es como se entregó #598.
- **Mal**: «todos los módulos» → «todos los tests» → «toda la documentación». Nada se puede mergear
  hasta que llegue el último, y los tres tocan los mismos archivos.

Cuando el issue ya viene por fases con criterio de salida (#603 es el ejemplo), **las fases son las
unidades**: una fase, un agente, un PR. No adelantes la fase siguiente «ya que estás».

### Lo que tiene que traer una unidad para poder repartirse

1. Qué issue cierra y qué parte de él.
2. Su área del mapa de arriba, y si toca algún punto de colisión.
3. El comando de pruebas que la verifica.
4. Qué decisión humana necesita **antes** de empezar, si necesita alguna. Una unidad bloqueada en una
   decisión no se reparte: se pregunta.

---

## Qué trabajo va a qué modelo

Por **forma de la tarea**, no por prestigio del modelo. Los nombres cambian; la forma no.

| Forma de la tarea | Qué pide | Modelo |
|---|---|---|
| Decisión estructural, diseño de formato, partir un issue, revisar arquitectura | Razonamiento largo y criterio; equivocarse aquí cuesta un rediseño | El más capaz disponible |
| Implementar un vertical ya acotado con su criterio de salida | Cuidado y disciplina de pruebas, pocas decisiones abiertas | Capaz o intermedio |
| Cambios mecánicos y verificables (renombrar, mover claves i18n, actualizar una lista) | Precisión, no criterio | Intermedio o rápido |
| Barrido de lectura: «¿dónde se usa X?», «¿qué módulos tocan Y?» | Recorrer mucho y devolver poco | Rápido, y mejor como **subagente** |

**Cuándo un subagente y cuándo no.** Un subagente arranca en frío: vuelve a derivar el contexto que
tú ya tienes. Sale a cuenta cuando la tarea es **leer mucho y devolver poco** (un barrido por todo el
repo) o cuando es **un juicio con voz propia** — este repo tiene dos agentes versionados en
[`.claude/agents/`](../.claude/agents): `kojima-game-design` para decisiones de diseño y
`solid-snake-qa` para una pasada de QA con el juego vivo. No sale a cuenta para trabajo que ya sabes
hacer y cuyo contexto ya está cargado.

---

## Antes de empezar, y al terminar

Antes:

```bash
git fetch origin && git switch main && git pull --ff-only origin main
gh pr list --state open          # ¿hay alguien en tu área?
gh issue view <n>                # el issue ES el contrato de alcance
```

Si un PR abierto toca tu área, léelo antes de tocar nada: puede que tu unidad ya no exista, o que
tenga que esperar a que ese mergee.

Al terminar, la entrega es la de [`AGENTS.md`](../AGENTS.md), con una adición que hace posible el
relevo: **di explícitamente qué NO has hecho y por qué**. Un alcance recortado en silencio es lo que
obliga al siguiente a releer todo el diff para averiguar dónde se quedó el anterior.
