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
| Inventario del módulo | `scripts/check_orphan_modules.py`, `scripts/tests/test_check_orphan_modules.py`, `docs/orphan-declarations.json`, `foundry-module/tests/modulos-alcanzables.test.mjs`, `foundry-module/tests/paleta.test.mjs` | `python3 -m unittest discover -s scripts/tests -p 'test_check_orphan_modules.py'` y `node --test foundry-module/tests/modulos-alcanzables.test.mjs foundry-module/tests/paleta.test.mjs` |
| Módulo: orquestación | `foundry-module/scripts/main.mjs`, `foundry-module/scripts/lagunak-constantes.mjs`, `foundry-module/scripts/control-escena.mjs`, `foundry-module/scripts/puerta-catalogo.mjs`, `foundry-module/scripts/idioma-modulo.mjs`, `foundry-module/scripts/foco-render.mjs`, `foundry-module/scripts/filtros-escena.mjs`, `foundry-module/scripts/diagnostico-conexion.mjs`, `foundry-module/scripts/herramientas-gm-catalogo.mjs`, `foundry-module/module.json` | `node --test $(find foundry-module/tests -name '*.test.mjs')` |
| Módulo: puente y telemetría | `foundry-module/scripts/bridge-*.mjs`, `foundry-module/scripts/ship-view/*.mjs`, `foundry-module/scripts/contactos-*.mjs`, `foundry-module/scripts/sensores-*.mjs`, `foundry-module/scripts/resolver-*.mjs`, `foundry-module/scripts/base-datos-cientifica.mjs`, `foundry-module/scripts/lamina-contacto.mjs`, `foundry-module/scripts/*-control.mjs`, `foundry-module/scripts/consola-caliente-*.mjs`, `foundry-module/scripts/panel-gm*.mjs` | `node --test $(find foundry-module/tests -name '*.test.mjs')` |
| Módulo: puestos y autoridad | `foundry-module/scripts/station-*.mjs`, `foundry-module/scripts/requisitos-puesto.mjs`, `foundry-module/scripts/proyeccion-puesto.mjs`, `foundry-module/scripts/asistencia*.mjs`, `foundry-module/scripts/asistencia/**` | `node --test $(find foundry-module/tests -name '*.test.mjs')` |
| Módulo: eventos y ambiente | `foundry-module/scripts/alarma-*.mjs`, `foundry-module/scripts/alerta*.mjs`, `foundry-module/scripts/nivel-alerta.mjs`, `foundry-module/scripts/alertas-nave.mjs`, `foundry-module/scripts/bitacora-nave.mjs`, `foundry-module/scripts/event-journal.mjs`, `foundry-module/scripts/chronicle-event.mjs`, `foundry-module/scripts/arte/audio/*.mjs` | `node --test $(find foundry-module/tests -name '*.test.mjs')` |
| Módulo: parlamento (comunicaciones TTRPG) | `foundry-module/scripts/parlamento.mjs`, `foundry-module/scripts/catalogo-encuentros.mjs`, `foundry-module/scripts/parlamento-ventana.mjs`, `foundry-module/scripts/parlamento-tirada.mjs` | `node --test foundry-module/tests/parlamento.test.mjs foundry-module/tests/parlamento-tirada.test.mjs` |
| Módulo: escenas y 3D | `foundry-module/scripts/nave-*.mjs`, `foundry-module/scripts/retro3d*.mjs`, `foundry-module/scripts/escena-*.mjs`, `foundry-module/scripts/props-*.mjs`, `foundry-module/scripts/piel-textura.mjs`, `foundry-module/scripts/playa-escena.mjs`, `foundry-module/scripts/museo-escena.mjs`, `foundry-module/scripts/cantina*.mjs`, `foundry-module/scripts/terraza-cantina.mjs`, `foundry-module/scripts/seccion-*.mjs`, `foundry-module/scripts/horizonte-*.mjs`, `foundry-module/scripts/visor-piloto*.mjs`, `foundry-module/scripts/mapa-*.mjs`, `foundry-module/scripts/decorado-fondo.mjs`, `foundry-module/scripts/ventana-nave.mjs`, `foundry-module/scripts/andar-nave-app.mjs`, `foundry-module/scripts/rig-esqueleto.mjs`, `foundry-module/scripts/estatua-rig.mjs`, `foundry-module/scripts/retargeting-pose.mjs`, `foundry-module/scripts/libro-geometria.mjs`, `foundry-module/scripts/libro-pagina.mjs`, `foundry-module/scripts/convocatoria-estancia.mjs`, `foundry-module/scripts/convocatoria-wiring.mjs` | `node --test $(find foundry-module/tests -name '*.test.mjs')` |
| Módulo: arte y avatares | `foundry-module/scripts/paleta.mjs`, `foundry-module/scripts/avatar/*.mjs`, `foundry-module/scripts/ficha-nave*.mjs`, `foundry-module/scripts/iconos-sistema.mjs`, `foundry-module/scripts/laminas-clasicas.mjs`, `foundry-module/scripts/png-indexado.mjs` | `node --test $(find foundry-module/tests -name '*.test.mjs')` |
| Módulo: NPC y bestiario | `foundry-module/scripts/npc-*.mjs` | `node --test $(find foundry-module/tests -name '*.test.mjs')` |
| Módulo: minijuegos | `foundry-module/scripts/minijuegos/**`, `foundry-module/scripts/minijuegos-wiring.mjs` | `node --test $(find foundry-module/tests -name '*.test.mjs')` |
| Módulo: catálogos con procedencia | `foundry-module/scripts/catalogo-*.mjs`, `foundry-module/scripts/procedencia-*.mjs`, `foundry-module/scripts/museo-piezas.mjs`, `foundry-module/scripts/atlas-hyg.mjs`, `foundry-module/data/**` | `node --test $(find foundry-module/tests -name '*.test.mjs')` |
| Módulo: contenido externo del GM | `foundry-module/scripts/contenido-externo/**` | `node --test $(find foundry-module/tests -name '*.test.mjs')` |
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
| `docs/orphan-declarations.json` | Fuente única de huérfanos declarados, módulos de arte y su justificación | Añade solo tu entrada sin reordenar las ajenas; incluye procedencia completa y evidencia existente. Si es arte, actualiza `artModules` y la justificación cuando cambie la frontera |
| `foundry-module/tests/paleta.test.mjs` | Consume `artModules` y su justificación desde el JSON | No añadas listas paralelas: normalmente no se toca al incorporar un módulo; cambia la guarda solo si cambia el contrato |
| `foundry-module/tests/modulos-alcanzables.test.mjs` | Consume los estados derivados por el inventario Python | No declares huérfanos aquí: edita el JSON; toca esta guarda solo si cambia el contrato compartido Node/Python |
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

## El reparto tiene nombres, y no es decoración

La convención la empezó **Odiseo**, el revisor externo (ChatGPT) que firma las revisiones de
los issues. Se sigue: cada pieza automática lleva nombre mitológico, y el nombre **dice qué
hace y qué NO hace**, que es lo que de verdad hay que recordar al delegarle algo.

| Nombre | Qué es | Qué aporta — y dónde acaba |
|---|---|---|
| **Odiseo** | Revisión externa (ChatGPT) | Criterio de diseño sobre trabajo ya hecho. No escribe código |
| **Mnemósine** | `tools/issues_similares.py` + `all-minilm` (~45 MB) | **Memoria del tablero**: qué issue se parece a cuál. No razona, no clasifica, no cierra nada — ordena por parecido y lo lee una persona |
| **Eco** | Un chat local pequeño (`qwen3:1.7b`) | Repite con otra forma: reformatear, extraer campos, pasar prosa a JSON. **Sin voz propia**: medido en 0 de 3 cuando se le pidió criterio |
| **Hermes** | El framework de agentes ya instalado | Mensajería y orquestación entre superficies |

La regla que ordena la tabla: **que el modelo genere candidatos y que decida siempre otra
cosa** — un test, un script o una persona. Si no sabes escribir lo que juzga la salida, la
tarea no es delegable; y si sabes escribirlo, plantéate si no basta con eso.

## Cómo se lanza Mnemósine desde fuera de una sesión

Requisitos, una sola vez:

```bash
ollama pull all-minilm          # ~45 MB, corre en CPU sin GPU
```

A mano, cuando quieras mirar el tablero:

```bash
cd <raíz del repo>
gh issue list --state open --limit 100 --json number,title,body > /tmp/issues.json
python3 tools/issues_similares.py /tmp/issues.json --umbral 0.62      # todo el tablero
python3 tools/issues_similares.py /tmp/issues.json --issue 598        # solo una
```

El `--umbral` es el mando: 0.5 enseña de más, 0.7 solo lo muy parecido. 0.62 es lo que
separaba señal de ruido en el tablero de agosto de 2026.

Para **dejarlo activado** sin depender de ninguna sesión, una línea de `crontab -e` — lunes
a las 9, con el resultado en un fichero que se lee cuando apetece:

```cron
0 9 * * 1 cd /ruta/al/repo && gh issue list --state open --limit 100 --json number,title,body > /tmp/issues.json && python3 tools/issues_similares.py /tmp/issues.json --umbral 0.62 > /tmp/mnemosine.txt 2>&1
```

Tres avisos, para que no falle en silencio:

- **`gh` necesita estar autenticado** en el usuario que lanza el cron (`gh auth status`).
- **Ollama tiene que estar levantado** (`systemctl is-active ollama`). Si no lo está, el
  script lo dice y sale con error en vez de inventarse una lista — que es justo por lo que
  no tiene camino de respaldo.
- El cron **no avisa a nadie**: escribe un fichero. Si quieres que te llegue, el gateway de
  Hermes ya sabe hablar por Telegram y tiene su propio `cron`; ese es el sitio para
  engancharlo, no un `mail` desde crontab.

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

---

## Cómo fallan los agentes en este repositorio

Los cuatro patrones de abajo se midieron aquí, no salen de un manual. Todos tienen la misma forma:
**el agente cree haber cumplido, y lo que dice es literalmente falso**. Ninguno se detecta leyendo
el resumen del propio agente, que es precisamente por qué están escritos.

### 1. Cerrar en verde con la rama rota

Un agente cambió una llamada para pasarle dos parámetros nuevos y nunca los declaró en la firma de
la función. `ReferenceError` en tres tests. Cerró la tarea afirmando que sus comprobaciones pasaban.

**La regla:** el criterio de entrega de una tarea es un comando que devuelve 0, ejecutado antes de
cerrar, con la salida pegada. Un criterio que nadie ejecuta se cumple por confianza, y la confianza
no compila. Para este repositorio:

```bash
node --test $(find foundry-module/tests -name '*.test.mjs')
```

Ojo con la ruta: `node --test foundry-module/tests/` **sin nada más** falla siempre, y es fácil creer
que el fallo es tuyo. Y ojo también con `foundry-module/tests/*.test.mjs` a secas (sin `find`): ese
glob **no baja a subcarpetas** — con módulos ya organizados en `tests/<grupo>/` (#932), esa forma
corta en silencio los tests de cualquier grupo movido, y el comando sigue devolviendo 0 porque
"ningún test falló" y "ese test no se ejecutó" se ven idénticos desde fuera.

### 2. Entregar en el árbol equivocado

Otro agente escribió su documento en el checkout principal —que estaba en la rama de un PR ajeno
abierto— en vez de en su worktree. Resultado: cero commits propios, el entregable a un paso de
colarse en el PR de otra persona, y la tarea cerrada como hecha.

**La regla:** un fichero sin confirmar en tu rama no es un entregable. Antes de cerrar:

```bash
git log origin/main..HEAD --name-only    # ¿está tu entregable aquí?
git status --porcelain                   # ¿te dejas algo sin confirmar?
```

Y el checkout principal no es de nadie que trabaje en paralelo: cada unidad de trabajo vive en su
propia rama.

### 3. Cumplir la letra del criterio y perder la intención

Un documento tenía que publicar el comando que producía cada una de sus cifras. Las cifras eran
correctas; el comando publicado **no las producía** —un `awk` con el volcado dentro de un bloque
`END`, que solo emitía el último registro—. El criterio automático solo comprobaba que la cadena
`git log` apareciera en el texto, y apareció.

**La regla:** una comprobación que busca una *cadena* es débil; una que **ejecuta lo que el
documento afirma** es fuerte. Si publicas un comando, ejecútalo pegado tal cual sale del documento,
no de memoria. Un número cuyo comando no se ha ejecutado no está verificado, aunque el número sea
cierto.

### 4. Contar solo el primer nivel y llamarlo total

`grep` sobre `foundry-module/scripts/*.mjs` ve 132 ficheros; el árbol tiene 169, porque hay
subdirectorios. Contar el primer nivel y presentarlo como total es el error de conteo más repetido
aquí, y lo cometen tanto los agentes como quien los revisa.

Relacionado: para enumerar llamantes de una función, `grep` cuenta comentarios, cadenas y el propio
`export`. Una búsqueda estructural distingue una llamada real de una mención:

```bash
ast-grep run --pattern 'miFuncion($$$ARGS)' --lang js foundry-module/scripts
```

En un caso real dio 5 llamadas frente a los 28 aciertos de `grep`.

### El patrón común

Los cuatro comparten raíz: **la verificación la hacía quien había hecho el trabajo, leyendo su propia
conclusión**. Una revisión que empieza por el resumen del autor devuelve el resumen del autor. Quien
revise debe recibir el contrato (qué había que cumplir) y el artefacto (el diff), y leer las
conclusiones del autor al final, si acaso.
