# Política de versionado

Los releases públicos de Espaciokoop Lagunak usan [SemVer 2.0.0](https://semver.org/lang/es/).
La fuente canónica de la versión de un release es su etiqueta Git `vMAJOR.MINOR.PATCH`.
El número `0.4.0` de `foundry-module/module.json` describe la versión del módulo Foundry
y no sustituye a la etiqueta del release del repositorio. CMake conserva su versión
calendario heredada mientras no se acuerde una migración independiente.

## Incrementos

- **MAJOR**: cambio incompatible con la API o el formato publicado.
- **MINOR**: funcionalidad compatible hacia atrás.
- **PATCH**: corrección compatible hacia atrás.

Las versiones preliminares siguen el formato SemVer (`1.0.0-rc.1`), pero el helper
actual solo propone incrementos de versiones estables. Una política de promoción de
pre-releases se añadirá cuando exista un primer release que la necesite.

## Flujo reproducible

1. Asegura que estás en la rama de release, sincronizado con su remoto y con el árbol limpio.
2. Ejecuta `scripts/release_helper.sh {major|minor|patch} --dry-run` y revisa la propuesta.
3. Ejecuta el mismo comando con `--create-tag` cuando la propuesta esté aprobada.
4. Revisa `git show vX.Y.Z` y publica únicamente esa etiqueta: `git push origin vX.Y.Z`.
5. Crea el release de GitHub asociado al tag y documenta cambios, pruebas y compatibilidad.

El helper nunca publica tags, usa `git push --tags`, modifica archivos de versión ni
requiere una clave GPG implícitamente. La firma de tags, si se convierte en requisito,
deberá documentarse y automatizarse como una decisión separada.
