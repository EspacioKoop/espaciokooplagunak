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

## Coordinación

Antes de trabajar, comprueba issues, pull requests y ramas para evitar duplicados. El issue es el contrato de alcance; el pull request es el registro de implementación y verificación.

Si hay cambios locales ajenos o instrucciones contradictorias, detente y solicita decisión humana. Si el cambio puede dividirse, evita editar los mismos archivos que otro colaborador.

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
