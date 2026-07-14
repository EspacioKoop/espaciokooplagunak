# Assets vendorizados de highlight.js

Copia local de [highlight.js](https://highlightjs.org/) **11.11.1** (licencia BSD-3-Clause,
ver `LICENSE.txt`). Se incrusta *inline* en `script_reference.html` durante la generación
(`main.py`, etiqueta de plantilla `{{inline ...}}`), de modo que la referencia de scripting
funciona sin conexión y sin cargar código de un CDN sin comprobación de integridad
(issue #87, alertas CodeQL `js/functionality-from-untrusted-source` 8 y 9).

## Origen y verificación

Descargados de cdnjs y verificados contra los hashes SRI que publica su API
(`https://api.cdnjs.com/libraries/highlight.js/11.11.1?fields=sri`):

| Fichero | URL de origen | SRI (sha512) verificado |
|---|---|---|
| `highlight.min.js` | `https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/highlight.min.js` | `sha512-EBLzUL8XLl+va/zAsmXwS7Z2B1F9HUHkZwyS/VKwh3S7T/U0nF4BaU29EP/ZSf6zgiIxYAnKLu6bJ8dqpmX5uw==` |
| `lua.min.js` | `https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/languages/lua.min.js` | `sha512-X5esXUorjCqQP58g37nqQ7Okq7aLzWMN0uGTmlGzCXfCrrF0uj3IX7riKyXZItmTPZfTx/yLslzphKOERT8Fvg==` |
| `github-dark.min.css` | `https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/github-dark.min.css` | `sha512-rO+olRTkcf304DQBxSWxln8JXCzTHlKnIdnMUwYvQa9/Jd4cQaNkItIUj6Z4nvW1dqK0SKXLbn9h4KwZTNtAyw==` |

## Cómo actualizar la versión

1. Descarga los tres ficheros de la nueva versión desde cdnjs.
2. Verifica cada uno contra el SRI de la API de cdnjs:
   `openssl dgst -sha512 -binary <fichero> | base64 -w0`
3. Comprueba que el JS no contiene los literales `</script` ni `{{`
   (romperían el inline o el parser de plantilla de `main.py`).
4. Actualiza la tabla de arriba y regenera la referencia:
   `python3 script_docs/main.py salida.html` (desde la raíz del repo).
