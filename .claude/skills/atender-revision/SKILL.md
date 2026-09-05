---
name: atender-revision
description: Atender un PR con changes requested en Espaciokoop Lagunak — reproducir primero lo que dice el revisor, corregir con evidencia y pedir re-review con la verificación pegada. Úsala ante cualquier PR en CHANGES_REQUESTED, y antes de asumir que una review pide arreglar en vez de cerrar.
---

# Atender una revisión

Las revisiones de este repositorio son **sustantivas**: señalan un fallo reproducible con
su SHA. Varias piden **cerrar**, no arreglar. No las trates como una lista de tareas.

## 1. Antes de tocar nada

**¿Ya está corregido?** Muchas ramas tienen commits posteriores al SHA revisado:

```bash
gh pr view <n> --json reviews --jq '.reviews[]|select(.state=="CHANGES_REQUESTED")|.body'
git log --oneline --no-merges <SHA_revisado>..origin/<rama>
```

Si lo está, no hay nada que arreglar: comenta lo que se cambió y pide re-review.

## 2. Reproduce la afirmación del revisor

Siempre, y antes de escribir código. Dos motivos: confirma el fallo, y a veces el
diagnóstico es **medio correcto**, lo que cambia el arreglo.

Ejemplos reales de este repositorio:

- «La URL de Europeana no resuelve» → **sí resolvía**, con 200 y la misma página. Lo malo
  era otra cosa: `/eu/` es el código de locale de *euskera*, no la raíz del sitio. La
  conclusión (usar `/en/`) no cambia; el motivo escrito sí, y es lo que evita que
  alguien lo «arregle» de vuelta.
- «Los enlaces del Met apuntan a otras obras» → cierto, y además los **números de acceso
  del documento eran correctos**: lo inventado eran los object ID. Ese matiz es lo que
  explica por qué nadie lo detectó leyendo.
- «12 de 18 miradores colisionan» → cierto, y al arreglarlo apareció una **tercera causa**
  que la review no mencionaba.

Reproduce con el mandato real: `curl` a la API, ejecutar el script, correr la suite.

## 3. Corrige de raíz, no el síntoma

Si un número mágico se desincronizó, **derívalo** en vez de corregirlo: `DISTANCIA_MIRADA`
pasó de `1.5` fijo a salir del pasillo, así que no puede volver a divergir. Si una lista
se queda obsoleta al añadir algo, usa `omit` en vez de enumerar.

## 4. Cuando la review pide algo que no es correcto

Dilo, con el motivo, y ofrece la alternativa. Una guarda repo-wide de «ninguna `msgstr`
preexistente cambia» sería incorrecta —corregir una traducción es legítimo—, así que la
respuesta fue medir ese PR concreto y explicar por qué no debe ser regla general. Eso
cierra la conversación mejor que obedecer.

## 5. Pide re-review con la evidencia pegada

```bash
gh pr comment <n> --body "..."
gh pr edit <n> --add-reviewer VaroTv7
```

El comentario lleva: qué decía la review, qué se cambió, **por qué de esa forma** y la
verificación **ejecutada** con su salida. Nunca «debería funcionar».

## 6. Antes de culpar a la rama, mira `main`

Un CI en rojo puede ser heredado. Compruébalo ejecutando la misma comprobación sobre
`origin/main` en un worktree limpio. Y mira el **filtro de rutas**: un check que no
aparece no es un check que pasa — un PR llegó a no ejecutar nunca la puerta que lo
vigilaba.

## 7. Quién aprueba

`main` exige revisión de code owner y **GitHub no cuenta al autor**. Si los abre todos la
misma cuenta, esa cuenta no puede firmar ninguno. Un `mergeStateStatus: CLEAN` con CI
verde puede seguir parado en `REVIEW_REQUIRED`.
