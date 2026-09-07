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
| `netboot/` | EmptyEpsilon; el fork no lo mantiene, no lo ejecuta y no lo modifica |

### `netboot/`: heredado y sin mantener

`netboot/` (arranque por red PXE) son tres ficheros que vienen enteros de
EmptyEpsilon. Su último commit es de 2022 y **ningún contribuidor de este fork
lo ha tocado nunca**: todos sus autores son de upstream. No entra en CI ni en
CMake, está en `.dockerignore`, y `tools/check_final_newline.py` ya lo exime
explícitamente como territorio de upstream.

Su antigüedad **no es motivo para retirarlo ni reescribirlo**. Por ADR-0007, un
arreglo en código heredado se propone primero a EmptyEpsilon; moverlo o
sustituirlo por documentación propia crearía una divergencia permanente nueva
donde hoy no hay ninguna. El análisis completo, con las premisas verificadas,
está en [#721](https://github.com/EspacioKoop/espaciokooplagunak/issues/721).

No se renombra masivamente el proyecto original dentro del código: cualquier cambio de identidad debe preservar los créditos y distinguir con claridad producto derivado y upstream.

## Remotos

Configuración esperada:

```text
origin   https://github.com/EspacioKoop/espaciokooplagunak.git
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
2. Actualiza la revisión fija de SeriousProton en los DOS sitios que la
   declaran: `SERIOUS_PROTON_REF` en `docker/Dockerfile` y en `docker/build.sh`
   (deben apuntar al mismo SHA; la CI y la imagen de release compilan contra él).
3. Ejecuta compilación y pruebas aplicables.
4. Revisa el diff y enumera conflictos o adaptaciones.
5. Publica la rama y abre un pull request hacia `main`.
6. Integra solo tras revisión.

Si `main` no tiene cambios propios desde la última sincronización, el merge puede ser fast-forward; aun así debe revisarse mediante una rama/PR una vez concluido el bootstrap.

### Checklist de relectura obligatoria

Además de resolver conflictos, cada sync `upstream/AAAA-MM-DD` debe releer estos puntos
sensibles aunque el merge no los toque, para confirmar que el modelo de amenaza documentado
sigue vigente tras los cambios que upstream haya hecho en esa área:

- `src/httpScriptAccess.*` — expone `/exec.lua` (ejecución de Lua arbitrario por red) y los
  stubs `/get.lua`/`/set.lua`. No requiere cambiarse solo por antigüedad; confirma que la
  mitigación (httpserver apagado por defecto + gate de CI `guardia-exec-lua`) sigue cubriendo
  el comportamiento real tras el merge. Ver CLAUDE.md y [`SECURITY.md`](../SECURITY.md) (issue #272).
- `scripts/shiptemplates/frigates.lua` — el interior del Phobos M3P (trece salas sobre una
  rejilla) es la **fuente autoritativa** de la planta que el módulo Foundry copia en
  `foundry-module/scripts/nave-planta-phobos.mjs`, según [ADR-0015](adr/0015-dato-derivado-se-copia-y-se-compara.md).
  Si upstream cambia ese interior, `foundry-module/tests/nave-planta-phobos.test.mjs` **fallará
  durante el sync**, con el mensaje «la copia de `SALAS_PHOBOS` ya no coincide con
  `scripts/shiptemplates/frigates.lua`». Eso es un **fallo esperado y no una regresión del
  fork**: es la guarda haciendo su trabajo. Se resuelve actualizando la copia del módulo en el
  mismo PR de sync, nunca relajando ni saltando la prueba.

## Reglas

- No hagas `push --force` sobre `main` ni ramas compartidas.
- No cambies `upstream` para apuntarlo al fork.
- No hagas squash del historial completo heredado.
- No atribuyas a este fork características de upstream como trabajo propio.
- Mantén los avisos de licencia de archivos modificados.
- Documenta en cada release qué cambios proceden de upstream y cuáles son propios.

## Contribuir al proyecto original

Una corrección general que no dependa de Espaciokoop Lagunak puede proponerse también a EmptyEpsilon siguiendo sus reglas. La aceptación upstream no se presupone y la discusión debe mantener separados ambos repositorios.

### Parches locales enviables aguas arriba

Cambios nuestros sobre archivos heredados que **no** dependen de este fork y conviene ofrecer a EmptyEpsilon. Mientras no se acepten son divergencia, así que se listan aquí para no olvidarlos en la próxima sincronización:

| Archivo | Qué hace | Origen | Estado |
|---|---|---|---|
| `CMakeLists.txt` (bloque `WITH_DISCORD`) + `cmake/DiscordGameSdk.cmake` | Comprueba la descarga y la extracción del SDK de Discord y aborta la configuración con un diagnóstico correcto. Antes, un archivo roto dejaba configurar y el build moría seis minutos después por una cabecera ausente, señalando al culpable equivocado. El propio módulo dice que conviene ofrecerlo aguas arriba; esta fila es lo que impide que ese «conviene» se pierda. **Incluye la versión fijada del SDK (`3.2.1`) con SHA-256 esperado en vez de `latest`**: con `latest`, Discord puede cambiar la cabecera bajo los pies entre dos builds del mismo commit. | [#400](https://github.com/EspacioKoop/espaciokooplagunak/issues/400) | sin enviar |
