# Auditoría de issues cerrados y trabajo recuperable

Este documento entrega la parte documental de [#617](https://github.com/EspacioKoop/espaciokooplagunak/issues/617).
La auditoría no decide qué trabajo debe retomarse: conserva evidencia y deja las
opciones a una decisión humana.

## Método reproducible

La herramienta [`tools/auditar_area.py`](../tools/auditar_area.py), entregada en
[#624](https://github.com/EspacioKoop/espaciokooplagunak/pull/624), sigue esta cadena:

```text
issue cerrado → PR mergeado que lo referencia → ficheros modificados
              → presencia de esos ficheros en origin/main
```

La herramienta clasifica cada resultado como:

- `VIVO`: existe un PR mergeado y sus ficheros siguen en `main`.
- `RETIRADO`: existe un PR mergeado, pero alguno de sus ficheros ya no está en
  `main`.
- `SIN_PR`: el issue se cerró sin un PR mergeado demostrable por este método; no
  significa que el trabajo no se hiciera.

La fuente de entrada debe excluir ficheros temporales de auditoría, y cada
afirmación debe conservar la referencia al issue, PR, rutas y commit que la
justifican. Una coincidencia textual en el título del issue no es evidencia de
implementación.

## Resultado contrastado

La ejecución documentada en #617 y #624 produjo:

| Área | `VIVO` | `RETIRADO` | `SIN_PR` |
|---|---:|---:|---:|
| `area:bridge` | 32 | 0 | 0 |
| `area:escenarios` | 14 | 0 | 0 |
| `area:foundry` | 102 | 0 | 4 |

La ausencia de resultados `RETIRADO` no se interpreta como prueba universal de
salud: la herramienta señala expresamente los informes sin casos negativos para
que se revisen con atención.

## Hallazgos que requieren decisión humana

Los cuatro `SIN_PR` de Foundry no tienen un PR mergeado que permita demostrar su
estado mediante esta auditoría:

| Issue | Título | Opciones a valorar |
|---:|---|---|
| #558 | La cantina con la rampa del casco se lee como un cuarto de máquinas | Retomar, sustituir por otra solución visual o descartar |
| #557 | Las consolas de sala no existen y se activan pisando suelo vacío | Retomar, rediseñar la interacción o descartar |
| #550 | Pixelart también en puertas y objetos con una rejilla común | Retomar dentro de la piel prerenderizada o descartar |
| #420 | Planetas del decorado con volumen de consola | Retomar como parte de la cadena de #362 o descartar |

Estos casos no se convierten automáticamente en nuevos requisitos. Antes de abrir
un sub-issue hay que comprobar la experiencia actual, el issue relacionado y el
consumidor técnico que tendría la propuesta.

## Ejemplo de cadena de evidencia

El issue #519 se clasificó como `VIVO` mediante el PR #528: se identificaron 21
ficheros tocados por el PR y se comprobó que los 21 siguen en `main`, incluyendo
`bridge/command_models.py`, `bridge/lua_templates.py` y
`bridge/tests/test_state_combat_maneuver_lua.py`.

## Límites y siguiente paso

La auditoría rescata trazabilidad; no decide producto, UX ni arquitectura. Los
cuatro casos `SIN_PR` deben recibir una decisión explícita antes de convertirse
en trabajo. Si se repite la auditoría, se debe conservar el comando, la revisión
de `HEAD` y la salida estructurada junto al informe.

