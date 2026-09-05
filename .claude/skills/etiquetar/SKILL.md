---
name: etiquetar
description: Etiquetar issues y PRs de Espaciokoop Lagunak contra la taxonomía real del repositorio, y auditar la propia taxonomía (etiquetas muertas, solapadas o que mienten). Úsala al abrir o triar un issue/PR, cuando alguien pida "poner etiquetas" o "limpiar labels", y antes de crear una etiqueta nueva — casi siempre ya existe una que hace ese trabajo.
---

# Etiquetar en Espaciokoop Lagunak

**Una etiqueta sirve para filtrar, no para describir.** Si nadie va a escribir nunca
`label:X` en una búsqueda, esa etiqueta es ruido con color. Antes de crear una, la
pregunta es «¿qué consulta se vuelve posible?», y si la respuesta es una que ya
contesta otra etiqueta, no se crea.

Medido el 2026-08-27: 40 etiquetas, 14 de los 61 issues abiertos **sin ninguna**, y
seis etiquetas sin un solo uso en toda la historia del repositorio.

## Los cinco ejes

Cada issue/PR se etiqueta recorriendo los ejes en este orden. **Área y tipo son
obligatorios**; el resto solo si aportan.

| Eje | Etiquetas | Regla |
|---|---|---|
| **Área** (dónde vive) | `area:foundry` `area:bridge` `area:juego` `area:escenarios` `area:docker` `area:tools` `area:repo` | Exactamente una, la del código que se toca. Si un cambio toca dos áreas de verdad, va la principal y se menciona la otra en el cuerpo — dos áreas suelen ser dos issues. `area:repo` es para lo que no toca código de juego (roadmap, ADRs, créditos, auditorías, proceso): existe porque el 2026-08-27 la mitad de los issues sin clasificar eran de ese tipo y la regla de «área obligatoria» los empujaba a un área falsa. |
| **Tipo** (qué es) | `bug` `enhancement` `documentation` `decision` `Coordinación` `upstream-sync` | Exactamente uno. `decision` es para lo que se **decide**, no para lo que se implementa: cuando cierra, suele nacer un ADR. |
| **Lenguaje** (opcional) | `javascript` `python` `cpp` `lua` `github_actions` `docker` | Solo si ayuda a filtrar trabajo mecánico (dependencias, formato, migraciones). El área ya dice casi siempre el lenguaje: `area:bridge` es Python. No lo repitas por costumbre. |
| **Materia** (opcional) | `i18n` `arte` `codigo-huerfano` | Temas que cruzan áreas y que la gente busca por sí mismos. `codigo-huerfano` es código mergeado que nada llama o trabajo terminado sin entregar — el patrón de #653, #634, #667. |
| **Dimensión AECF** (opcional) | `seguridad` `Accesibilidad` `Calidad` `AECF` `Compatibilidad` | Solo si el issue mueve una práctica de `docs/BASELINE.md`. `seguridad` es de las pocas que se lee de verdad: no la gastes en "esto sería más robusto". |
| **Estado / fase** (opcional) | `Fase 0`–`Fase 5` `triage` `bloqueado` `main-roto` `Betatesting` `automation` | `Fase N` solo si el roadmap del `README.md` lo sitúa ahí. `main-roto` va antes que nada y es efímera: se quita al arreglar. |

## Etiquetar un issue o PR

```bash
gh issue view <n> --json title,body,labels
```

Lee el cuerpo, no solo el título — muchos títulos aquí ya vienen con prefijo
convencional (`feat(core/persist): …`), y ese prefijo **da el área directamente**:
`core`/`src` → `area:juego`, `foundry`/`retro3d` → `area:foundry`, `bridge` → `area:bridge`,
`scenario` → `area:escenarios`, `docs` → `documentation`, `chore(repo)` → `Coordinación`.

```bash
gh issue edit <n> --add-label "area:foundry,enhancement,Fase 3"
```

Para una tanda, comprueba primero **qué queda sin etiquetar**, que es donde está el
trabajo real:

```bash
gh issue list --state open --limit 400 --json number,title,labels \
  --jq '.[]|select(.labels|length==0)|"\(.number)\t\(.title)"'
```

**No etiquetes a ciegas en bucle.** Un issue mal etiquetado es peor que uno sin
etiquetar: el segundo aparece en la lista de arriba, el primero desaparece de todas
las búsquedas por parecer ya clasificado.

## Milestones: se derivan, no se deciden aquí

**El milestone es la etiqueta `Fase N`.** No son dos clasificaciones: son la misma, y
tenerlas separadas es cómo se desincronizan. Al etiquetar con una fase, pon el
milestone en el mismo gesto:

```bash
for f in 3 4 5; do
  gh issue list --state open --limit 400 --label "Fase $f" --json number,milestone \
    --jq '.[]|select(.milestone==null)|.number' | while read n; do
    [ -n "$n" ] && gh issue edit "$n" --milestone "Fase $f"
  done
done
```

Y comprueba que ninguno diga dos cosas a la vez:

```bash
gh issue list --state open --limit 400 --json number,labels,milestone \
  --jq '.[]|select(.milestone!=null)|select((.labels|map(.name)|map(select(startswith("Fase")))|first) != null and (.labels|map(.name)|map(select(startswith("Fase")))|first) != .milestone.title)|"#\(.number)"'
```

**Lo que NO se automatiza es poner fase a un issue que no la tiene.** En qué fase cae
un trabajo lo dice el roadmap del `README.md`, y es una decisión de producto: adivinarla
desde el título llena los milestones de basura plausible. Un issue sin fase se queda sin
milestone y aparece en la lista de pendientes, que es donde tiene que estar.

## Auditar la taxonomía

**Cuenta issues Y PRs, y sube el `--limit`.** Medirlo mal es el error que ya se cometió
una vez: una consulta sin PRs y capada a 200 issues declaró «cero usos» sobre `Fix`, que
tenía **33**. Un borrado sobre esa cifra habría tirado la clasificación de 25 PRs
fusionados.

Uso real de cada etiqueta, incluido el cero:

```bash
gh label list --limit 300 --json name --jq '.[].name' | while IFS= read -r l; do
  n=$(gh issue list --state all --limit 400 --label "$l" --json number --jq '.|length')
  p=$(gh pr list --state all --limit 400 --label "$l" --json number --jq '.|length')
  printf '%5d %s\n' "$((n+p))" "$l"
done | sort -n
```

Qué hacer con lo que salga en la parte de arriba:

- **Cero usos y heredada de la plantilla de GitHub** (`invalid`, `wontfix`,
  `duplicate`, `good first issue`, `help wanted`, `question`): bórralas. Un
  repositorio de dos personas no reparte tareas para recién llegados, y `wontfix`
  lo dice el cierre del issue, no una etiqueta.
- **Cero usos y propia**: no la borres sin preguntar — puede ser una intención
  declarada que aún no ha tenido su primer caso.
- **Solapada**: `Fix` con `bug`, `docker` con `area:docker`. Se queda la que ya usa
  la gente y se retira la otra; migra los issues antes de borrar
  (`gh issue edit <n> --add-label X --remove-label Y`).

**Borrar una etiqueta borra su historia**: los issues cerrados dejan de ser
encontrables por ella y no hay deshacer. Migra siempre primero, y confirma con un
humano antes de borrar cualquier etiqueta con uso > 0.

## Crear una etiqueta

Último recurso, y con las convenciones que ya tiene el repositorio: prefijo `area:`
en minúscula para las áreas, resto en la forma que ya predomine. Nombre en castellano
salvo que sea término técnico establecido (`upstream-sync`, `automation`).

```bash
gh label create "area:nueva" --description "Qué filtra, en una línea" --color e8a33d
```

## La trampa de `gh ... edit` sin número

`gh issue edit` / `gh pr edit` **sin número editan el PR de la rama actual**. En un bucle
`while read n`, si la lista viene vacía la variable queda vacía y el comando se aplica a
un PR que no tenías delante — pasó el 2026-08-27 y hubo que revertirlo. Guarda siempre:

```bash
[ -n "$n" ] && gh issue edit "$n" --add-label "..."
```

## Qué NO hace este trabajo

No cierra issues, no reasigna, no toca hitos y no reescribe títulos. Etiquetar es
clasificar lo que hay; decidir qué se hace con ello es de quien lleva el proyecto.
