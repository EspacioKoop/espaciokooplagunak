# Relación con EmptyEpsilon y sincronización upstream

Espaciokoop Lagunak es un fork independiente de [EmptyEpsilon](https://github.com/daid/EmptyEpsilon). Conservamos su historial Git, licencia GPL-2.0, avisos de autoría y documentación original.

## Separación de responsabilidades

| Elemento | Responsable / procedencia |
|---|---|
| Código e historial previos al fork | EmptyEpsilon y sus contribuidores |
| `CHANGELOG.md` original | EmptyEpsilon; no se reutiliza como lista de logros propios |
| Web y wiki enlazadas de EmptyEpsilon | Proyecto original |
| `README.md`, `CONTRIBUTING.md`, `AGENTS.md`, `docs/` del fork | Espaciokoop Lagunak, salvo indicación contraria |
| Nuevos escenarios y cambios propios | Contribuidores de Espaciokoop Lagunak |

No se renombra masivamente el proyecto original dentro del código: cualquier cambio de identidad debe preservar los créditos y distinguir con claridad producto derivado y upstream.

## Remotos

Configuración esperada:

```text
origin   https://github.com/VaroTv7/espaciokooplagunak.git
upstream https://github.com/daid/EmptyEpsilon.git
```

Verificación:

```bash
git remote -v
git remote get-url origin
git remote get-url upstream
```

Nunca incluyas un token en la URL del remoto.

## Incorporar actualizaciones

La sincronización no debe mezclarse con una funcionalidad propia:

```bash
git fetch --prune upstream
git switch main
git pull --ff-only origin main
git switch -c upstream/AAAA-MM-DD
git merge --no-ff upstream/master
```

Después:

1. Resuelve conflictos preservando intención y atribución.
2. Ejecuta compilación y pruebas aplicables.
3. Revisa el diff y enumera conflictos o adaptaciones.
4. Publica la rama y abre un pull request hacia `main`.
5. Integra solo tras revisión.

Si `main` no tiene cambios propios desde la última sincronización, el merge puede ser fast-forward; aun así debe revisarse mediante una rama/PR una vez concluido el bootstrap.

## Reglas

- No hagas `push --force` sobre `main` ni ramas compartidas.
- No cambies `upstream` para apuntarlo al fork.
- No hagas squash del historial completo heredado.
- No atribuyas a este fork características de upstream como trabajo propio.
- Mantén los avisos de licencia de archivos modificados.
- Documenta en cada release qué cambios proceden de upstream y cuáles son propios.

## Contribuir al proyecto original

Una corrección general que no dependa de Espaciokoop Lagunak puede proponerse también a EmptyEpsilon siguiendo sus reglas. La aceptación upstream no se presupone y la discusión debe mantener separados ambos repositorios.
