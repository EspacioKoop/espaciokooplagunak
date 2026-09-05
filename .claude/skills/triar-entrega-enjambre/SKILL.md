---
name: triar-entrega-enjambre
description: Triar una entrega del enjambre (rama, worktree o PR) antes de leerla o revisarla — cuenta elementos antes y después, comprueba que todo parsea y detecta andamiaje commiteado. Úsala ante cualquier PR o rama que venga del enjambre Hermes, antes de gastar una revisión humana en ella, y siempre que un diff sea grande o toque tests, catálogos .po o declaraciones.
---

# Triar una entrega del enjambre

**El worker optimiza contra el comprobador, no contra la tarea.** Si el criterio solo
mira una parte —las claves de cabecera de un `.po`, un porcentaje de cobertura—,
**borrar el resto lo satisface**. Medido: de cinco entregas de una tanda, tres destruían
trabajo que ya estaba en `main`.

**El diff no lo delata.** Un `.po` reescrito parece reflujo de líneas largas:
`+124 −1939` no dice «he borrado el diálogo del escenario». Lo único fiable es
**contar elementos antes y después**.

## Orden de comprobación

Para en cuanto algo salga en rojo: no sigas leyendo el contenido de una entrega que
ya sabes que está rota.

### 1. ¿Parsea?

```bash
git diff --name-only origin/main...HEAD | grep '\.mjs$' | while read f; do
  [ -f "$f" ] && { node --check "$f" 2>/dev/null || echo "NO PARSEA: $f"; }
done
```

Milisegundos, y nombra la causa. `node --test` también lo diría, pero tarda 20 s y
entierra el motivo entre miles de líneas. El fallo típico: un fichero escrito a través
de una capa de shell o JSON sin deshacer el escapado, con todas las comillas como `\"`.
El otro: un parche aplicado como texto, con `--` y `+` literales dentro del fuente.

### 2. ¿Encoge algo?

```bash
# suites: fichero a fichero, nunca en total — el total puede SUBIR mientras se
# pierden las pruebas buenas
for f in $(git diff --name-only origin/main...HEAD | grep 'tests/.*\.test\.mjs$'); do
  antes=$(git show origin/main:$f 2>/dev/null | grep -cE '^\s*(test|it)\(' | head -1)
  ahora=$(grep -cE '^\s*(test|it)\(' "$f" | head -1)
  [ "${ahora:-0}" -lt "${antes:-0}" ] && echo "ENCOGE: $f  $antes -> $ahora"
done

# catálogos .po
python3 tools/validate_es_locale.py --base origin/main
```

Ojo: `grep -c` imprime `0` **y** sale con rc 1, así que un `|| echo 0` añade un segundo
cero y la comparación revienta en silencio. Usa `| head -1`.

### 3. ¿Trae andamiaje?

```bash
python3 scripts/check_orphan_modules.py --check   # si toca declaraciones
git diff --name-only origin/main...HEAD | grep -iE \
  '^[^/]+\.(py|js|mjs|txt|json|lcov)$|coverage|find_unused|extract_used|\.bak$|^(output|stdout)$'
```

Este árbol **no tiene ningún script suelto en la raíz**, así que lo que aparezca ahí es
de un worker fabricándose su propia forma de verificar. Una entrega llegó a commitear
465 líneas de borrador como si fueran el entregable.

### 4. ¿Es una reversión disfrazada?

Antes de rescatar una rama huérfana, pregunta si su trabajo ya está en `main`:

```bash
git log --oneline origin/main -- <ficheros que toca>    # ¿es reciente lo de main?
git diff origin/main...<rama> | grep '^-' | grep -v '^---'   # ¿borra código o tests?
```

Si lo segundo borra lo que lo primero dice que es reciente, **es una reversión**. El CI
sale verde porque la rama se lleva por delante también los tests que lo detectarían.

Y compara siempre contra `origin/<rama>`, no contra la copia local: las locales del
checkout del enjambre suelen ir **desfasadas**, y abrir un PR desde ellas revierte
arreglos ya subidos.

### 5. ¿Ensancha la API pública para poder probarla?

```bash
git diff origin/main...HEAD -- '*/scripts/*.mjs' | grep '^+export'
```

Un `export` nuevo sobre lo que antes era privado casi nunca es la mejora que aparenta:
es el camino barato para que un test alcance internos. En un módulo de seguridad
(tokens, autoridad) es motivo de rechazo por sí solo.

## Cómo se informa

Di **qué comprobación falló y con qué números**, no «parece que hay un problema».
`363 claves -> 67` convence; «el diff es sospechoso» no. Si todo pasa, dilo igual de
claro: el suelo mecánico dice que no has roto nada, **nunca** que la tarea esté hecha.
