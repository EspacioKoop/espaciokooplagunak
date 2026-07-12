# Distribución del módulo Foundry VTT

Esta guía construye un artefacto instalable y reproducible del módulo
`espaciokoop-lagunak`. No publica releases ni modifica el rango de
compatibilidad declarado.

## Construir

Requiere Python 3.10 o posterior y no instala dependencias:

```bash
python3 tools/package_foundry_module.py
```

Genera, sin añadirlos a Git:

```text
dist/espaciokoop-lagunak-<version>.zip
dist/espaciokoop-lagunak-<version>.zip.sha256
```

La versión procede de `foundry-module/module.json`. El empaquetador valida el
ID, la versión y que existan los módulos ESM, estilos e idiomas declarados.
Falla cerrado si falta cualquiera de esas rutas.

## Contenido y reproducibilidad

El ZIP contiene `module.json` en la raíz, `LICENSE`, `README.md` y los
directorios de runtime `lang/`, `scripts/`, `styles/` y `templates/`.
No incluye tests, caches, configuración local, tokens ni el resto del código
del juego.

Los nombres se ordenan y todos los timestamps/permisos del ZIP se normalizan.
Dos builds del mismo commit producen los mismos bytes y SHA-256.

Comprobación:

```bash
python3 -m unittest tools.tests.test_package_foundry_module -v
python3 tools/package_foundry_module.py
(cd dist && sha256sum -c espaciokoop-lagunak-*.zip.sha256)
unzip -l dist/espaciokoop-lagunak-*.zip
```

## Instalación manual desde ZIP

1. Comprueba el SHA-256 publicado por un canal independiente.
2. Crea `Data/modules/espaciokoop-lagunak/` en la instalación de Foundry.
3. Extrae **el contenido** del ZIP dentro de esa carpeta; `module.json` debe
   quedar directamente en `espaciokoop-lagunak/module.json`.
4. Reinicia Foundry, activa el módulo en el mundo y entra como GM.

## Publicación futura

Cuando exista una release etiquetada e inmutable:

1. construir desde el commit exacto de la etiqueta;
2. adjuntar ZIP y `.sha256` a GitHub Releases;
3. descargar ambos artefactos y repetir checksum/inspección;
4. añadir a `module.json` las URLs estables `manifest` y `download`;
5. probar una instalación limpia desde la URL de Foundry;
6. actualizar `compatibility.verified` solo hasta una versión ejercitada.

No debe añadirse `download` apuntando a una rama móvil ni declararse una
versión de Foundry que no haya pasado el smoke GUI de #29.
