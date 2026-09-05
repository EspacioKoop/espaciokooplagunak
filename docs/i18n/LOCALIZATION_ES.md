# Localización Español (España)

Espaciokoop Lagunak utiliza catálogos GNU gettext en formato PO. El código de
idioma interno es `es` y el selector lo presenta como **Español (España)**.

## Alcance

Cada archivo `*.en.po` distribuido bajo `resources/locale` o `scripts/locale`
debe tener un archivo hermano `*.es.po`. La cobertura técnica se mide por la
igualdad de claves `(msgctxt, msgid, msgid_plural)`, no por el número bruto de
líneas.

La primera cobertura se generó de forma asistida con el modelo local Argos
English → Spanish 1.0:

```text
translate-en_es-1_0.argosmodel
SHA-256: d698d0ef87ad70d5d184b7fa6965905bf4368f09a2bb9ffb165a79bac96af0c4
```

El modelo no se distribuye con el repositorio. Los catálogos resultantes son
parte del fork GPLv2 y deben revisarse lingüísticamente antes de considerar una
pantalla o escenario terminado.

## Herramientas locales

- GNU gettext: extracción y `msgfmt`.
- `polib`: lectura/escritura y validación de catálogos.
- CTranslate2 + SentencePiece: primera pasada local, sin enviar textos a
  servicios externos.

## Actualizar interfaz C++

```bash
python3 tools/update_main_locale.py --root .
```

Este comando extrae las llamadas `tr(msgid)` y `tr(contexto, msgid)` de `src/`
y actualiza únicamente `resources/locale/main.en.po`. No modifica otros
idiomas silenciosamente.

Regenerar es un paso **manual**, y por tanto olvidable. La red que avisa cuando
se olvidó es:

```bash
python3 tools/check_cpp_locale_coverage.py .
```

Comprueba que **cada `tr()`/`trMark()` con literal en `src/` tiene entrada en
`main.en.po` y en `main.es.po`**, y la ejecuta CI en el job *Tools* (por eso el
filtro de rutas de ese workflow incluye `src/` y `resources/locale/`).

Es una comprobación distinta de `validate_es_locale.py`, y las dos hacen falta:
aquel compara en-US contra es-ES, así que **no puede ver** una cadena que no
llegó a ninguno de los dos catálogos —los dos coinciden en no tenerla—. Eso fue
[#55](https://github.com/EspacioKoop/espaciokooplagunak/issues/55): 22 `msgid` nuevos
del editor de naves sin ninguna entrada, CI en verde y el editor saliendo medio
en inglés en una partida en español. Uno mira código→catálogo; el otro,
catálogo→catálogo.

Límite declarado: solo se auditan las llamadas con el literal en la propia
llamada. Un `tr()` sobre una variable no es extraíble sin compilar —tampoco por
xgettext—, así que se ignora en vez de inventarse una cadena. Los `tr()`
comentados no cuentan.

## Catálogo vivo del tutorial

El tutorial carga su traducción según la ruta del script mediante
`i18n::load("locale/" + filename…)`. Para `scripts/tutorial/00_all.lua`, los
catálogos efectivos son:

- `scripts/locale/tutorial/00_all.en.po`;
- `scripts/locale/tutorial/00_all.es.po`.

Los archivos agregados `resources/locale/tutorial.*.po` son un artefacto
heredado de upstream: el juego no los carga y `update_locale.py` no los
regenera. Se conservan para evitar divergencia y conflictos innecesarios con
upstream, pero **no son fuente de verdad**, no deben usarse para certificar el
tutorial ni requieren nuevas pasadas de traducción asistida. Si upstream
reactiva ese catálogo, esta decisión debe revisarse contra el código de carga.

## Generar la primera pasada española

Con un entorno Python que contenga `polib`, `ctranslate2` y `sentencepiece`:

```bash
python3 tools/i18n_es.py \
  --root . \
  --provider argos \
  --model ~/.local/share/espaciokoop-i18n/models/en_es \
  --overwrite
```

Para una segunda pasada de mayor calidad sobre cadenas públicas puede usarse
Google Translate mediante `deep-translator`. Los placeholders nunca se envían
al traductor y las peticiones se agrupan con un separador verificado:

```bash
python3 tools/i18n_es.py --root . --provider google \
  --only resources/locale/main.en.po --overwrite
python3 tools/i18n_es.py --root . --provider google \
  --only scripts/locale/tutorial --overwrite
```

La herramienta protege placeholders, contextos, plurales, saltos finales y
cabeceras. Su salida es una base de traducción, no una certificación humana.

## Validar

```bash
python3 tools/validate_es_locale.py .
find resources scripts -name '*.es.po' -print0 \
  | xargs -0 -n1 msgfmt --check --check-format -o /dev/null
```

Antes de integrar también deben pasar:

- `git diff --check`;
- build C++/CI;
- arranque con `language=es`;
- apertura del selector y pantallas principales;
- tutorial básico y una sesión multipuesto;
- revisión de terminología y de textos largos.

## Glosario base

| Inglés | Español (España) |
|---|---|
| Helms | Timón |
| Weapons | Armas |
| Engineering | Ingeniería |
| Science | Ciencia |
| Relay | Comunicaciones |
| Game master | Director de juego |
| Hull | Casco |
| Shield | Escudo |
| Warp | Curvatura |
| Dock / Undock | Atracar / Desatracar |
| Coolant | Refrigerante |
| Repair crew | Equipo de reparación |

Mantener nombres propios y facciones. Preferir español de España claro y
neutral; evitar calcos como «aclamar» para *hail*, «barco» para *spaceship* o
formas latinoamericanas como «ingrese» cuando la interfaz se dirige al jugador.
