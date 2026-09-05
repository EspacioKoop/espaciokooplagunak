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

Para repartir trabajo entre varios agentes —qué áreas pueden ir en paralelo, qué archivos son puntos de colisión conocidos y cómo se parte un issue en unidades entregables— la guía es [`docs/TRABAJO_PARALELO_AGENTES.md`](docs/TRABAJO_PARALELO_AGENTES.md). Los agentes especializados del proyecto están versionados en [`.claude/agents/`](.claude/agents); los agentes seleccionables desde VS Code están en [`.github/agents/`](.github/agents). Usa el agente existente que corresponda en vez de improvisar uno. Los procedimientos repetidos (triaje de entregas, encargos al enjambre, revisiones, telemetría, etiquetado) están como skills en [`.claude/skills/`](.claude/skills).

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
