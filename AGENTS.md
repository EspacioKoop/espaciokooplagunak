# Instrucciones para agentes de IA

Este archivo define el contrato operativo para cualquier agente que trabaje en Espaciokoop Lagunak.

## Prioridades

1. Proteger historial, licencia, atribución y trabajo ajeno.
2. Entender el issue y el código antes de editar.
3. Realizar el cambio mínimo que cumpla el criterio de aceptación.
4. Ejecutar pruebas reales y comunicar límites con honestidad.
5. Dejar contexto suficiente para la siguiente persona o agente.

## Inicio obligatorio

Antes de modificar:

```bash
git status --short --branch
git remote -v
git fetch origin
git switch main
git pull --ff-only origin main
```

Después, lee `README.md`, `CONTRIBUTING.md`, el issue relacionado y la documentación del área. Crea una rama de trabajo; no desarrolles directamente sobre `main`.

## Límites

- No uses `push --force`, `reset --hard`, limpieza masiva ni reescritura de historial sin autorización humana explícita.
- No borres o sobrescribas cambios que no hayas creado.
- No cambies remotos, CI, licencia o dependencias principales como efecto secundario oculto.
- No accedas ni escribas fuera del workspace autorizado.
- No guardes tokens, claves, cookies, contraseñas, datos personales ni contenido de prompts.
- No presentes código de EmptyEpsilon como creación de Espaciokoop Lagunak.
- No afirmes que compila, arranca o funciona si no se ha ejecutado la comprobación correspondiente.

## Qué archivo lee cada herramienta

Este archivo (`AGENTS.md`) es **el contrato**, y es común a todas. Cada herramienta busca además un
archivo con su nombre; todos ellos son punteros de veinte líneas a este y a `CLAUDE.md`, no copias:

| Herramienta | Archivo que lee | Contenido |
|---|---|---|
| Cualquier agente | [`AGENTS.md`](AGENTS.md) | El contrato operativo. Manda sobre los demás. |
| Claude Code | [`CLAUDE.md`](CLAUDE.md) | El conocimiento del repositorio: comandos, arquitectura, estilo. |
| Gemini CLI | [`GEMINI.md`](GEMINI.md) | Puntero. |
| Qwen Code | [`QWEN.md`](QWEN.md) | Puntero. |
| Codex CLI | [`CODEX.md`](CODEX.md) | Puntero. |

El conocimiento del repositorio vive en `CLAUDE.md` por razones históricas —lo escribió y lo
mantiene Claude Code— pero **no es específico de esa herramienta**: describe el proyecto, no al
agente. Si añades un archivo para una herramienta nueva, que sea otro puntero y añade su fila aquí.
**No copies el contenido**: cuatro contratos divergen en silencio, y una regla desincronizada es
peor que no tenerla porque parece vigente.

Las decisiones ya tomadas están en [`docs/adr/`](docs/adr/README.md), con índice legible por máquina
en [`docs/adr/index.json`](docs/adr/index.json) y una tabla «si tocas X, lee el ADR N» en
`CLAUDE.md`. No se rediscuten en un PR: se sustituyen con un ADR nuevo.

## Coordinación

Antes de trabajar, comprueba issues, pull requests y ramas para evitar duplicados. El issue es el contrato de alcance; el pull request es el registro de implementación y verificación.

Si hay cambios locales ajenos o instrucciones contradictorias, detente y solicita decisión humana. Si el cambio puede dividirse, evita editar los mismos archivos que otro colaborador.

Para repartir trabajo entre varios agentes —qué áreas pueden ir en paralelo, qué archivos son puntos de colisión conocidos y cómo se parte un issue en unidades entregables— la guía es [`docs/TRABAJO_PARALELO_AGENTES.md`](docs/TRABAJO_PARALELO_AGENTES.md). Los agentes especializados del proyecto están versionados en [`.claude/agents/`](.claude/agents): úsalos en vez de improvisar uno.

## Entrega requerida

Cada contribución debe resumir:

- objetivo e issue;
- archivos cambiados;
- decisiones relevantes;
- comandos de prueba ejecutados y resultado;
- comprobaciones pendientes y bloqueo exacto;
- riesgos o compatibilidad con upstream;
- siguiente paso recomendado.

Actualiza `README.md` solo cuando cambien el estado real, las características o el roadmap. No marques tareas como completadas por haber escrito código: deben estar integradas y verificadas.

## Upstream

- `origin` corresponde a Espaciokoop Lagunak.
- `upstream` corresponde a EmptyEpsilon.
- Las actualizaciones de upstream se preparan en ramas `upstream/<fecha-o-version>`.
- No mezcles una sincronización upstream con funcionalidades propias.
- Conserva commits originales; no hagas squash de todo el historial heredado.

Consulta `docs/UPSTREAM.md` para el procedimiento completo.
