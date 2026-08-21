# Auditoría de issues y PRs cerrados: rescatar trabajo colgado

Este documento proporciona una guía para auditar issues y PRs cerrados con el objetivo de rescatar trabajo que pueda haberse quedado colgado o que requiera reapertura.

## Por qué hacer esta auditoría

- Recuperar trabajo valioso que fue cerrado prematuramente.
- Identificar issues que fueron cerrados sin resolver completamente.
- Revisar PRs que fueron cerrados sin merge y que podrían ser reutilizados.
- Mejorar la trazabilidad y el conocimiento del proyecto.

## Pasos para la auditoría

### 1. Definir el alcance
   - Decidir el período de tiempo (por ejemplo, últimos 3 meses, últimos 6 meses).
   - Decidir si se incluyen todos los repositorios o solo algunos.
   - Definir criterios de cierre: issues/PRs cerrados sin merge, cerrados como duplicados, etc.

### 2. Herramientas y comandos
   - Usar GitHub CLI (`gh`) para listar issues y PRs cerrados.
   - Ejemplo para listar issues cerrados en el repositorio actual:
     ```
     gh issue list --state closed --limit 100 --json number,title,state,closedAt,author,labels
     ```
   - Ejemplo para listar PRs cerrados:
     ```
     gh pr list --state closed --limit 100 --json number,title,state,mergedAt,closedAt,author,labels
     ```

### 3. Filtrar y analizar
   - Filtrar por aquellos que no fueron mergeados (en caso de PRs) o que fueron cerrados sin una resolución clara.
   - Buscar patrones: etiquetas como `waiting-for-info`, `stalled`, `needs-more-info`.
   - Revisar los comentarios de cierre para entender el motivo.

### 4. Acciones posibles
   - Reabrir issues o PRs si el trabajo aún es relevante y se puede completar.
   - Crear nuevos issues a partir de los cerrados si el trabajo se ha dividido o evolucionado.
   - Documentar lecciones aprendidas para evitar que el trabajo se quede colgado en el futuro.
   - Actualizar la documentación o los procesos de cierre.

### 5. Seguimiento
   - Crear un issue de seguimiento para la auditoría misma (si no existe).
   - Asignar responsables para revisar los elementos encontrados.
   - Establecer un calendario para realizar auditorías periódicas (por ejemplo, mensual o trimestral).

## Plantilla para registro de auditoría

| Número | Tipo (Issue/PR) | Título | Estado de cierre | Motivo de cierre | Acción propuesta | Responsable | Fecha límite |
|--------|-----------------|--------|------------------|------------------|------------------|-------------|--------------|
| #123   | Issue           | Ejemplo de título | cerrado          | waiting-for-info | Reabrir y solicitar información | @usuario    | 2026-09-01   |

## Mejora continua

- Después de cada auditoría, revisar el proceso y actualizar esta guía.
- Compartir los resultados con el equipo para crear conciencia.
- Considerar la automatización de partes de la auditoría con scripts o GitHub Actions.

