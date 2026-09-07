# Instrucciones para agentes de IA

Este archivo define el contrato operativo para cualquier agente que trabaje en Espaciokoop Lagunak.

## Repositorio canónico obligatorio

El único repositorio de trabajo es [`EspacioKoop/espaciokooplagunak`](https://github.com/EspacioKoop/espaciokooplagunak). Todo agente, bot o automatización debe usarlo para consultar issues y PR, crear ramas y publicar cambios. `origin` debe apuntar a `https://github.com/EspacioKoop/espaciokooplagunak.git`.

La ubicación anterior `VaroTv7/espaciokooplagunak` es solo una redirección histórica. No la uses como identificador canónico, remoto, destino de API ni base de enlaces nuevos. Si el remoto no apunta a la organización `EspacioKoop`, detente y corrígelo antes de trabajar.

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

## Coordinación

Antes de trabajar, comprueba issues, pull requests y ramas para evitar duplicados. El issue es el contrato de alcance; el pull request es el registro de implementación y verificación.

Un issue lleva **milestone solo si bloquea el criterio de salida de esa fase**, tal y como está escrito en el `README.md` y en [`docs/ROADMAP_PRODUCTO.md`](docs/ROADMAP_PRODUCTO.md). Todo lo demás va sin milestone: trabajo transversal (seguridad heredada, investigación, calidad) y mejoras que no cierran ninguna puerta. Un milestone no es el backlog —para eso está el tablero—, es la respuesta a «¿qué falta para cerrar esta fase?», y deja de responderla en cuanto se usa como cajón. No existen etiquetas `Fase N`: esa información vive en el milestone y solo ahí, porque duplicada en dos sitios se desincroniza sin que nada avise.

Si hay cambios locales ajenos o instrucciones contradictorias, detente y solicita decisión humana. Si el cambio puede dividirse, evita editar los mismos archivos que otro colaborador.

Para repartir trabajo entre varios agentes —qué áreas pueden ir en paralelo, qué archivos son puntos de colisión conocidos y cómo se parte un issue en unidades entregables— la guía es [`docs/TRABAJO_PARALELO_AGENTES.md`](docs/TRABAJO_PARALELO_AGENTES.md). Los agentes especializados del proyecto están versionados en [`.claude/agents/`](.claude/agents): úsalos en vez de improvisar uno.

## Qué comprobar según lo que toques

`tools/` tiene **veintitrés** herramientas de verificación. Seis las ejecuta CI; el
resto están escritas, probadas y **no las encuentra nadie** — y una guarda que nadie
ejecuta no protege de nada. La lista corta, por área:

| Si tocas… | Ejecuta | Qué caza |
|---|---|---|
| Cualquier cosa | `python3 tools/check_restos_herramienta.py` | Cobertura, `node_modules`, `.bak`, `tmp/` trackeados |
| Cualquier `.md` | `python3 tools/refs-rotas.py .` | Rutas citadas que ya no existen |
| Un documento de inventario | `python3 tools/doc-coherencia.py DOC.md --contra DIR --patron '*.mjs'` | Que la lista no se haya desincronizado del disco |
| `scripts/locale/**` o `resources/locale/**` | `python3 tools/validate_es_locale.py .` | Paridad es/en, placeholders, `msgstr` vacío |
| Un escenario Lua | `python3 tools/check_scenario_header_locale.py` | Cabecera del escenario sin su clave en el catálogo |
| `src/**` (cadenas nuevas) | `python3 tools/check_cpp_locale_coverage.py .` | Cadena en pantalla sin entrada de catálogo |
| `foundry-module/**` | `node --test foundry-module/tests/*.test.mjs` | La suite del módulo |
| Un módulo nuevo del módulo | `python3 scripts/check_orphan_modules.py --check` | Módulos que no alcanza nadie |
| `bridge/**` | `cd bridge && python3 -m pytest -q` | El puente, con el juego mockeado |
| `.github/workflows/**` | `python3 -m pytest tools/tests/ -q` | Fijado por SHA y forma de las puertas |

Dos avisos que valen más que la tabla:

- **Un check SALTADO no es un check aprobado.** Las puertas de CI filtran por rutas, y
  una puerta que no se despierta informa en verde. Antes de fiarte de un tick, mira el
  filtro: `.github/workflows/*.yml` → `rutas:`. En agosto de 2026 esto dejó `main` en
  rojo durante horas, porque el filtro de i18n no incluía `scripts/locale/`.
- **Un objetivo numérico se cierra con la cifra medida**, no con los tests en verde. Si
  la tarea pide subir cobertura, el criterio es lo que imprime
  `node --test --experimental-test-coverage` **después** del cambio, y va pegado en el PR.

Si añades una herramienta de verificación, añádela a esta tabla y a `tools.yml`. Si no
puede ser puerta todavía porque el árbol no la pasa, dilo en su issue en vez de dejarla
suelta: eso es deuda anotada, no una herramienta.

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
- El destino exacto de `origin` es `https://github.com/EspacioKoop/espaciokooplagunak.git`.
- `upstream` corresponde a EmptyEpsilon.
- Las actualizaciones de upstream se preparan en ramas `upstream/<fecha-o-version>`.
- No mezcles una sincronización upstream con funcionalidades propias.
- Conserva commits originales; no hagas squash de todo el historial heredado.

Consulta `docs/UPSTREAM.md` para el procedimiento completo.
