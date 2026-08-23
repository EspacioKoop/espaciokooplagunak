# Política de Versionado Semántico (SemVer)

Este proyecto sigue estrictamente las reglas de [Versionado Semántico 2.0.0](https://semver.org/lang/es/).

## Estructura de Versión: `MAJOR.MINOR.PATCH`

1. **MAJOR**: Incremento incompatible con versiones anteriores.
   - Ejemplo: Cambios en la API pública que rompen integraciones existentes.
   - Ejemplo: Eliminación de funcionalidades críticas.
2. **MINOR**: Nuevas funcionalidades compatibles hacia atrás.
   - Ejemplo: Añadir nuevos módulos o características sin afectar lo existente.
3. **PATCH**: Correcciones de bugs compatibles hacia atrás.
   - Ejemplo: Arreglos de seguridad o errores lógicos menores.

## Proceso de Release

1. **Preparación**:
   - Actualizar el número de versión en `package.json` o configuración principal.
   - Generar `CHANGELOG.md` automático o manual.
2. **Etiquetado (Tagging)**:
   - Crear tag firmado: `git tag -s v1.2.3 -m "Release v1.2.3"`
3. **Publicación**:
   - Push de tags: `git push origin --tags`
   - Crear Release en GitHub asociado al tag.

## Pre-Release Versions

Para versiones de prueba (alpha, beta, rc):
- Formato: `1.0.0-alpha.1`, `1.0.0-beta.2`, `1.0.0-rc.1`
- Estas versiones no siguen estrictamente SemVer en cuanto a estabilidad garantizada.

---
*Documento generado como parte del Issue #720*
*Firmado por: Teseo (Qwen3.7)*
