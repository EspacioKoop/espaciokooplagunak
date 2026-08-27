---
name: escribir-encargo-enjambre
description: Escribir o reescribir una tarjeta del kanban de Hermes para el enjambre de Lagunak, con la forma que la puerta de entrada exige y que la evidencia respalda. Úsala al crear cualquier tarjeta nueva, al partir una que el worker rechazó por demasiado grande, o al arreglar una que llegó bloqueada sin criterio.
---

# Escribir un encargo para el enjambre

## La regla que lo decide todo

**Nombra un comportamiento, nunca una métrica.** Medido sobre 193 PRs del repositorio,
tasa de rechazo por clase de tarjeta:

| clase | total | rechazado | % |
|---|---|---|---|
| cobertura / % | 13 | 8 | **61 %** |
| catálogos `.po` | 9 | 4 | 44 % |
| tests | 12 | 5 | 41 % |
| docs | 47 | 14 | 29 % |
| **comportamiento** | 112 | 23 | **20 %** |

Una tarjeta de métrica se rechaza **tres veces más**, y el mecanismo está medido: un
criterio de porcentaje **se satisface borrando**. `kanban-portero.py` las rechaza en la
entrada desde el 27-ago-2026.

«Sube la cobertura a 75 %» → mal. «Un all-in corto cobra del bote principal» → bien.
La cobertura se pega en el PR **como dato**, jamás como criterio.

## Un comportamiento por tarjeta

Si el worker pide «confirmar el entorno», «guía» o «crear una subtarea», **el encargo no
cabe**: eso no es un worker flojo, es una tarjeta mal escrita. Pártela, una por
comportamiento.

## Encabezados literales

`kanban-portero.py` busca exactamente `## Criterio de hecho` (con bloque ```bash) y
`## Entregable` (con una ruta entre acentos graves). Escribir «## Cómo se mide» hace que
la puerta rechace la tarjeta.

## Estructura

```markdown
**Título:** <el comportamiento, en presente> (<módulo>)

## Por qué existe
<Qué se rompe si no está. CITA LAS LÍNEAS del código: `:301`, `:1036`.>

## Comportamiento a fijar
Uno solo, en 3-4 casos. Incluye SIEMPRE el caso positivo:
una guarda que bloquea siempre no es una guarda, es un módulo roto.

## Criterio de hecho
```bash
node --test foundry-module/tests/<suite>.test.mjs
node --test foundry-module/tests/*.test.mjs
```

## Entregable
`ruta/concreta.test.mjs`, que hoy tiene N pruebas y **crece**. No se reescribe.

## Reglas
1. Una prueba nombra un comportamiento.
2. No toques el módulo — si una prueba falla, has encontrado un bug: márcalo y dilo.
3. El patrón de dobles ya existe: globales planos ANTES de importar, `await import()`.
4. Nada de `assert.ok(true)` ni pruebas que solo instancian.
5. Castellano en nombres y comentarios.
6. Alcance cerrado: un comportamiento, un fichero, una pull request.
```

## Escribir la tarjeta bien encuentra bugs

No es un efecto secundario, es la razón de citar líneas. Al redactar una tarjeta sobre
una guarda post-`await` salió que no eran tres condiciones sino **cuatro**, y que la que
faltaba era la única que cubría «cerraron la ventana mientras la red respondía». Al
redactar otra salió que una comprobación estaba **una línea antes** de poner un candado,
y que moverla abajo dejaría la función bloqueada para toda la sesión sin que nada lo
dijera. Eso solo aparece leyendo el código; el worker no lo encuentra porque le estás
pidiendo cinco cosas a la vez.

## Comprobarlo antes de crearla

```bash
cd ~/.hermes/bin && python3 - <<'PY'
import importlib.util,sys
sp=importlib.util.spec_from_file_location("kp","kanban-portero.py")
m=importlib.util.module_from_spec(sp); sys.argv=["kp","--dry-run"]
try: sp.loader.exec_module(m)
except SystemExit: pass
t="<título>"; c=open("<fichero.md>",encoding="utf-8").read()
cr=m.CRITERIO.search(c); e=m.ENTREGABLE.search(c)
print("metrica:",m.objetivo_es_metrica(t,c)[0],
      "| criterio:",bool(cr) and m.ejecutable(cr.group(1))[0],
      "| entregable:",bool(e and m.RUTA.findall(e.group(1))))
PY
```

Crear:

```bash
hermes kanban create "<título>" --body "$(cat tarjeta.md)" \
  --assignee lagunakpeon4 --project p_63241b3a --workspace worktree --goal
```
